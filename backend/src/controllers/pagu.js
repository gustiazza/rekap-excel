const { Prisma } = require('@prisma/client');
const prisma = require('../prisma/client');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { inputsAt, latestUploadIds, refDate, BELANJA, round2 } = require('../services/rekapSummary');

// Input manual: pagu total (satker, program, belanja) dan persentase target SP2D.
// Setiap perubahan menambah riwayat; nilai yang berlaku mengikuti tanggal berlaku.
// Pengguna hanya dapat mengubah satkernya sendiri; Admin dapat mengubah semua satker.

const JENIS = ['PAGU_SATKER', 'PAGU_PROGRAM', 'PAGU_BELANJA', 'TARGET_SP2D', 'TARGET_LINGKUP', 'PAGU_REKAP', 'TARGET_REKAP'];
const isPersen = (jenis) => jenis === 'TARGET_SP2D' || jenis === 'TARGET_LINGKUP' || jenis === 'TARGET_REKAP';
const MAX_NILAI = 999999999999999;
const isAdmin = (req) => req.user.role === 'ADMIN';
const canEdit = (req, satkerId) => isAdmin(req) || req.user.satker_id === satkerId;

const toId = (v, msg = 'Satker tidak valid.') => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, msg);
  return n;
};

async function findSatker(id) {
  const rows = await prisma.$queryRaw`SELECT id, name FROM satker WHERE id = ${id}`;
  if (!rows.length) throw new HttpError(404, 'Satker tidak ditemukan.');
  return rows[0];
}

const isValidDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

function normKode(jenis, kode) {
  const k = String(kode || '').trim().toUpperCase();
  if (jenis === 'PAGU_PROGRAM') {
    if (!/^[A-Z]{2}$/.test(k)) throw new HttpError(400, 'Kode program harus 2 huruf, mis. EC.');
    return k;
  }
  if (jenis === 'PAGU_BELANJA') {
    if (!BELANJA.some((b) => b.kode === k)) throw new HttpError(400, 'Jenis belanja harus 51, 52, atau 53.');
    return k;
  }
    if (jenis === 'PAGU_REKAP' || jenis === 'TARGET_REKAP') {
    // Jalur kode baris rekap, mis. HA|SDA.003|051|051.0A (kode 051 muncul di banyak induk, jadi dicatat bersama induknya)
    if (!/^[A-Z0-9.]{1,12}(\|[A-Z0-9.]{1,12}){0,3}$/.test(k)) throw new HttpError(400, 'Kode baris tidak valid.');
    return k;
  }
  return '';
}

const item = (i) => (i ? { id: i.id, nilai: i.nilai, berlaku_mulai: i.berlaku_mulai, diubah_oleh: i.diubah_oleh, updated_at: i.updated_at } : null);

// Data formulir untuk satu satker pada tanggal acuan
exports.get = asyncHandler(async (req, res) => {
  const satkerId = toId(req.query.satker_id || req.user.satker_id);
  const satker = await findSatker(satkerId);
  const tanggal = req.query.tanggal && isValidDate(String(req.query.tanggal)) ? String(req.query.tanggal) : null;
  const ref = refDate(tanggal);

  const values = await inputsAt({ ref, satkerId });
  const pick = (jenis, kode = '') => values.find((v) => v.jenis === jenis && v.kode === kode) || null;

  // Daftar program: dari file terbaru satker (Akrual dan SP2D) + program yang pernah diinput manual
  const ids = await latestUploadIds({ satkerId });
  const fromFiles = ids.length
    ? await prisma.$queryRaw`
        SELECT r.kode, MIN(r.uraian) AS uraian FROM rekap_data r
        WHERE r.upload_id = ANY(${ids}::int[]) AND r.tipe::text = 'PROGRAM' AND r.kode IS NOT NULL
        GROUP BY r.kode`
    : [];
  const fromInput = await prisma.$queryRaw`
    SELECT kode, (ARRAY_AGG(uraian ORDER BY berlaku_mulai DESC, id DESC) FILTER (WHERE uraian IS NOT NULL))[1] AS uraian
    FROM input_manual WHERE satker_id = ${satkerId} AND jenis::text = 'PAGU_PROGRAM' GROUP BY kode`;
  const progMap = new Map();
  fromFiles.forEach((p) => progMap.set(p.kode, p.uraian));
  fromInput.forEach((p) => {
    if (!progMap.has(p.kode) || !progMap.get(p.kode)) progMap.set(p.kode, p.uraian || null);
  });
  const programs = [...progMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([kode, uraian]) => ({ kode, uraian, input: item(pick('PAGU_PROGRAM', kode)) }));
  const belanja = BELANJA.map((b) => ({ kode: b.kode, label: b.label, input: item(pick('PAGU_BELANJA', b.kode)) }));

  const sum = (list) => round2(list.reduce((a, x) => a + (x.input ? x.input.nilai : 0), 0));
  res.json({
    satker,
    ref,
    can_edit: canEdit(req, satkerId),
    pagu_satker: item(pick('PAGU_SATKER')),
    target_sp2d: item(pick('TARGET_SP2D')),
    programs,
    belanja,
    sum_programs: sum(programs),
    sum_belanja: sum(belanja),
  });
});

// Riwayat perubahan satu nilai
exports.history = asyncHandler(async (req, res) => {
  const jenis = String(req.query.jenis || '');
  if (!JENIS.includes(jenis)) throw new HttpError(400, 'Jenis input tidak valid.');
  const lingkup = jenis === 'TARGET_LINGKUP';
  const satkerId = lingkup ? null : toId(req.query.satker_id);
  const kode = normKode(jenis, req.query.kode);
  const rows = await prisma.$queryRaw`
    SELECT m.id, m.nilai::float8 AS nilai, to_char(m.berlaku_mulai, 'YYYY-MM-DD') AS berlaku_mulai,
           m.updated_at, us.name AS diubah_oleh
    FROM input_manual m JOIN users us ON us.id = m.user_id
    WHERE ${lingkup ? Prisma.sql`m.satker_id IS NULL` : Prisma.sql`m.satker_id = ${satkerId}`}
      AND m.jenis::text = ${jenis} AND m.kode = ${kode}
    ORDER BY m.berlaku_mulai DESC, m.id DESC`;
  res.json({ data: rows, can_edit: lingkup ? isAdmin(req) : canEdit(req, satkerId) });
});

// Simpan nilai baru (menambah riwayat; tanggal berlaku yang sama menimpa nilai pada tanggal itu)
exports.save = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const jenis = String(b.jenis || '');
  if (!JENIS.includes(jenis)) throw new HttpError(400, 'Jenis input tidak valid.');
  const lingkup = jenis === 'TARGET_LINGKUP';
  const satkerId = lingkup ? null : toId(b.satker_id);
  const kode = normKode(jenis, b.kode);
  if (lingkup) {
    if (!isAdmin(req)) throw new HttpError(403, 'Target lingkup hanya dapat diubah oleh Admin.');
  } else {
    await findSatker(satkerId);
    if (!canEdit(req, satkerId)) throw new HttpError(403, 'Anda hanya dapat mengubah data satker Anda sendiri.');
  }

  const raw = typeof b.nilai === 'string' ? b.nilai.trim().replace(',', '.') : b.nilai;
  const nilai = raw === '' || raw === null || raw === undefined ? NaN : Number(raw);
  if (!Number.isFinite(nilai) || nilai < 0) throw new HttpError(400, 'Nilai harus berupa angka, tidak boleh negatif.');
  if (isPersen(jenis) && nilai > 100) throw new HttpError(400, 'Persentase target tidak boleh lebih dari 100.');
  if (nilai > MAX_NILAI) throw new HttpError(400, 'Nilai terlalu besar.');

  const tanggal = b.berlaku_mulai ? String(b.berlaku_mulai) : refDate();
  if (!isValidDate(tanggal)) throw new HttpError(400, 'Tanggal berlaku tidak valid.');

  let uraian = null;
  if (jenis === 'PAGU_PROGRAM' && b.uraian && String(b.uraian).trim()) uraian = String(b.uraian).trim().slice(0, 120);

  const saved = round2(nilai);
  const rows = lingkup
    ? await prisma.$queryRaw`
        INSERT INTO input_manual (satker_id, jenis, kode, uraian, nilai, berlaku_mulai, user_id, updated_at)
        VALUES (NULL, ${jenis}::"InputJenis", ${kode}, NULL, ${saved}, ${tanggal}::date, ${req.user.id}, now())
        ON CONFLICT (jenis, kode, berlaku_mulai) WHERE satker_id IS NULL
        DO UPDATE SET nilai = EXCLUDED.nilai, user_id = EXCLUDED.user_id, updated_at = now()
        RETURNING id`
    : await prisma.$queryRaw`
        INSERT INTO input_manual (satker_id, jenis, kode, uraian, nilai, berlaku_mulai, user_id, updated_at)
        VALUES (${satkerId}, ${jenis}::"InputJenis", ${kode}, ${uraian}, ${saved}, ${tanggal}::date, ${req.user.id}, now())
        ON CONFLICT (satker_id, jenis, kode, berlaku_mulai)
        DO UPDATE SET nilai = EXCLUDED.nilai, uraian = COALESCE(EXCLUDED.uraian, input_manual.uraian),
                      user_id = EXCLUDED.user_id, updated_at = now()
        RETURNING id`;
  res.status(201).json({ message: 'Data berhasil disimpan.', id: rows[0].id });
});

// Hapus satu baris riwayat (mis. salah input)
exports.remove = asyncHandler(async (req, res) => {
  const id = toId(req.params.id, 'ID tidak valid.');
  const rows = await prisma.$queryRaw`SELECT id, satker_id FROM input_manual WHERE id = ${id}`;
  if (!rows.length) throw new HttpError(404, 'Data tidak ditemukan.');
  const allowed = rows[0].satker_id === null ? isAdmin(req) : canEdit(req, rows[0].satker_id);
  if (!allowed) throw new HttpError(403, 'Anda tidak berhak mengubah data ini.');
  await prisma.$executeRaw`DELETE FROM input_manual WHERE id = ${id}`;
  res.json({ message: 'Riwayat berhasil dihapus.' });
});

