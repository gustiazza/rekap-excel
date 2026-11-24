const { Prisma } = require('@prisma/client');
const prisma = require('../prisma/client');

const round2 = (n) => Math.round(n * 100) / 100;
const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const has = (v) => v !== null && v !== undefined;
// Persentase tidak dijumlahkan, tetapi dihitung ulang dari jumlah realisasi dan pagu
const pct = (realisasi, pagu) => (has(realisasi) && has(pagu) && pagu > 0 ? round2((realisasi / pagu) * 100) : null);
const sumOrNull = (list) => {
  const v = list.filter(has);
  return v.length ? round2(v.reduce((a, b) => a + b, 0)) : null;
};

// Jenis belanja yang ditampilkan = 2 digit pertama kode akun
const BELANJA = [
  { kode: '51', label: 'Belanja Pegawai' },
  { kode: '52', label: 'Belanja Barang' },
  { kode: '53', label: 'Belanja Modal' },
];

// Tanggal acuan nilai input manual: tanggal "sampai" pada filter, atau hari ini (WIB) jika kosong
function refDate(dateTo) {
  if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(String(dateTo))) return String(dateTo);
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

// Upload terbaru per satker per kategori (pada rentang tanggal upload yang dipilih).
// Semua upload tetap tersimpan; hanya yang terbaru yang dihitung.
const latestCte = ({ satkerId, range } = {}) => Prisma.sql`
  latest AS (
    SELECT DISTINCT ON (u.satker_id, u.kategori)
           u.id, u.satker_id, u.kategori::text AS kategori, u.file_name, u.uploaded_at,
           u.upload_status::text AS status, us.name AS uploader,
           u.total_pagu_revisi::float8 AS total_pagu, u.total_sampai_periode::float8 AS total_sampai,
           u.total_persentase::float8 AS total_persen
    FROM uploads u
    JOIN users us ON us.id = u.user_id
    WHERE u.upload_status IN ('SUCCESS', 'PARTIAL') AND u.satker_id IS NOT NULL
      ${satkerId ? Prisma.sql`AND u.satker_id = ${satkerId}` : Prisma.empty}
      ${range?.gte ? Prisma.sql`AND u.uploaded_at >= ${range.gte}` : Prisma.empty}
      ${range?.lt ? Prisma.sql`AND u.uploaded_at < ${range.lt}` : Prisma.empty}
    ORDER BY u.satker_id, u.kategori, u.uploaded_at DESC, u.id DESC
  )`;

// ID upload terbaru (per satker per kategori)
async function latestUploadIds({ satkerId, kategori, range } = {}) {
  const rows = await prisma.$queryRaw`
    WITH ${latestCte({ satkerId, range })}
    SELECT id FROM latest ${kategori ? Prisma.sql`WHERE kategori = ${kategori}` : Prisma.empty}`;
  return rows.map((r) => r.id);
}

// Nilai input manual yang berlaku pada tanggal acuan: baris dengan berlaku_mulai terbaru yang tidak melewati tanggal itu
async function inputsAt({ ref, satkerId, jenis } = {}) {
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT ON (m.satker_id, m.jenis, m.kode)
           m.id, m.satker_id, m.jenis::text AS jenis, m.kode, m.uraian, m.nilai::float8 AS nilai,
           to_char(m.berlaku_mulai, 'YYYY-MM-DD') AS berlaku_mulai, m.updated_at, us.name AS diubah_oleh
    FROM input_manual m
    JOIN users us ON us.id = m.user_id
    WHERE m.berlaku_mulai <= ${ref}::date
      ${satkerId ? Prisma.sql`AND m.satker_id = ${satkerId}` : Prisma.empty}
      ${jenis ? Prisma.sql`AND m.jenis::text = ${jenis}` : Prisma.empty}
    ORDER BY m.satker_id, m.jenis, m.kode, m.berlaku_mulai DESC, m.id DESC`;
  return rows;
}

// Rekap per satker: pagu total & target (input manual), pagu efektif & realisasi (file terbaru tiap kategori)
async function satkerTotals({ satkerId, range, dateTo } = {}) {
  const ref = refDate(dateTo);
  const satkers = await prisma.$queryRaw`
    SELECT id, name FROM satker ${satkerId ? Prisma.sql`WHERE id = ${satkerId}` : Prisma.empty} ORDER BY id`;
  const latest = await prisma.$queryRaw`WITH ${latestCte({ satkerId, range })} SELECT * FROM latest`;
  const inputs = await inputsAt({ ref, satkerId });

  const upl = new Map(latest.map((u) => [`${u.satker_id}|${u.kategori}`, u]));
  const inp = new Map(inputs.map((i) => [`${i.satker_id}|${i.jenis}|${i.kode}`, i.nilai]));
  const meta = (u) =>
    u ? { id: u.id, file_name: u.file_name, uploaded_at: u.uploaded_at, uploader: u.uploader, status: u.status } : null;

  const rows = satkers.map((s) => {
    const a = upl.get(`${s.id}|AKRUAL`);
    const p = upl.get(`${s.id}|SP2D`);
    const pagu_efektif = a ? num(a.total_pagu) : null;
    const realisasi_akrual = a ? num(a.total_sampai) : null;
    const realisasi_sp2d = p ? num(p.total_sampai) : null;
    // Persentase dibaca dari Excel; jika kosong dihitung dari realisasi dan pagu file itu sendiri
    const pct_akrual = a ? (has(a.total_persen) ? num(a.total_persen) : pct(realisasi_akrual, pagu_efektif)) : null;
    const pct_sp2d = p ? (has(p.total_persen) ? num(p.total_persen) : pct(realisasi_sp2d, num(p.total_pagu))) : null;
    const target = inp.has(`${s.id}|TARGET_SP2D|`) ? inp.get(`${s.id}|TARGET_SP2D|`) : null;
    return {
      satker: { id: s.id, name: s.name },
      upload_akrual: meta(a),
      upload_sp2d: meta(p),
      pagu_total: inp.has(`${s.id}|PAGU_SATKER|`) ? inp.get(`${s.id}|PAGU_SATKER|`) : null,
      pagu_efektif,
      realisasi_akrual,
      persentase_akrual: pct_akrual,
      realisasi_sp2d,
      persentase_sp2d: pct_sp2d,
      target_sp2d: target,
      gap: has(target) && has(pct_sp2d) ? round2(pct_sp2d - target) : null,
      pagu_sp2d: p ? num(p.total_pagu) : null, // pagu pada file SP2D, hanya untuk menghitung persentase total
    };
  });

  const pagu_efektif = sumOrNull(rows.map((r) => r.pagu_efektif));
  const realisasi_akrual = sumOrNull(rows.map((r) => r.realisasi_akrual));
  const realisasi_sp2d = sumOrNull(rows.map((r) => r.realisasi_sp2d));
  const pagu_sp2d = sumOrNull(rows.map((r) => r.pagu_sp2d));
  const lastDates = rows
    .flatMap((r) => [r.upload_akrual, r.upload_sp2d])
    .filter(Boolean)
    .map((u) => new Date(u.uploaded_at).getTime());
  const lingkupTarget = inp.has('null|TARGET_LINGKUP|') ? inp.get('null|TARGET_LINGKUP|') : null;

  const total = {
    pagu_total: sumOrNull(rows.map((r) => r.pagu_total)),
    pagu_efektif,
    realisasi_akrual,
    persentase_akrual: pct(realisasi_akrual, pagu_efektif),
    realisasi_sp2d,
    persentase_sp2d: pct(realisasi_sp2d, pagu_sp2d),
    // Target lingkup diinput manual oleh Admin; gap = % SP2D - target (sama dengan baris satker)
    target_sp2d: lingkupTarget,
    gap: has(lingkupTarget) && has(pct(realisasi_sp2d, pagu_sp2d)) ? round2(pct(realisasi_sp2d, pagu_sp2d) - lingkupTarget) : null,
    satker_akrual: rows.filter((r) => r.upload_akrual).length,
    satker_sp2d: rows.filter((r) => r.upload_sp2d).length,
    satker_total: rows.length,
    last_upload: lastDates.length ? new Date(Math.max(...lastDates)) : null,
  };
  return { rows, total, ref };
}

// Rekap per program / per belanja, dijumlahkan dari seluruh satker.
//  - pagu efektif   : file Akrual terbaru
//  - realisasi SP2D : file SP2D terbaru
//  - pagu total     : input manual yang berlaku pada tanggal acuan
async function groupTotals({ tipe, satkerId, range, dateTo }) {
  const ref = refDate(dateTo);
  const keyExpr = tipe === 'PROGRAM' ? Prisma.sql`r.kode` : Prisma.sql`LEFT(r.kode, 2)`;
  const jenis = tipe === 'PROGRAM' ? 'PAGU_PROGRAM' : 'PAGU_BELANJA';

  const data = await prisma.$queryRaw`
    WITH ${latestCte({ satkerId, range })}
    SELECT l.kategori, ${keyExpr} AS kode, MIN(r.uraian) AS uraian,
           COALESCE(SUM(r.pagu_revisi), 0)::float8 AS pagu,
           COALESCE(SUM(r.sampai_periode), 0)::float8 AS sampai
    FROM rekap_data r
    JOIN latest l ON l.id = r.upload_id
    WHERE r.tipe::text = ${tipe} AND r.kode IS NOT NULL
    GROUP BY l.kategori, 2`;

  const inputs = await inputsAt({ ref, satkerId, jenis });

  const map = new Map();
  const slot = (kode) => {
    if (!map.has(kode)) map.set(kode, { kode, uraian: null, pagu_total: null, pagu_efektif: null, realisasi_sp2d: null });
    return map.get(kode);
  };
  data.forEach((d) => {
    if (tipe === 'AKUN' && !BELANJA.some((b) => b.kode === d.kode)) return;
    const s = slot(d.kode);
    if (!s.uraian) s.uraian = d.uraian;
    if (d.kategori === 'AKRUAL') s.pagu_efektif = round2(d.pagu);
    if (d.kategori === 'SP2D') s.realisasi_sp2d = round2(d.sampai);
  });
  inputs.forEach((i) => {
    const s = slot(i.kode);
    if (!s.uraian && i.uraian) s.uraian = i.uraian;
    s.pagu_total = round2((s.pagu_total || 0) + i.nilai);
  });
  if (tipe === 'AKUN') BELANJA.forEach((b) => slot(b.kode));

  let rows = [...map.values()];
  if (tipe === 'AKUN') {
    rows = BELANJA.map((b) => ({ ...map.get(b.kode), uraian: b.label }));
  } else {
    rows.sort((a, b) => a.kode.localeCompare(b.kode));
  }
  rows = rows.map((r) => ({
    ...r,
    persentase_pagu_total: pct(r.realisasi_sp2d, r.pagu_total),
    persentase_pagu_efektif: pct(r.realisasi_sp2d, r.pagu_efektif),
  }));

  const pagu_total = sumOrNull(rows.map((r) => r.pagu_total));
  const pagu_efektif = sumOrNull(rows.map((r) => r.pagu_efektif));
  const realisasi_sp2d = sumOrNull(rows.map((r) => r.realisasi_sp2d));
  return {
    rows,
    total: {
      pagu_total,
      pagu_efektif,
      realisasi_sp2d,
      persentase_pagu_total: pct(realisasi_sp2d, pagu_total),
      persentase_pagu_efektif: pct(realisasi_sp2d, pagu_efektif),
    },
  };
}

const programTotals = (opts = {}) => groupTotals({ ...opts, tipe: 'PROGRAM' });
const belanjaTotals = (opts = {}) => groupTotals({ ...opts, tipe: 'AKUN' });

// Rekap per satker per jenis belanja (51, 52, 53) untuk satu kategori (AKRUAL atau SP2D).
// Setiap sel: pagu total (input manual), pagu efektif (selalu dari file Akrual), realisasi (file kategori ini)
// dan dua persentase. Baris total dihitung ulang dari jumlahnya.
async function belanjaPerSatker({ kategori, satkerId, range, dateTo } = {}) {
  const ref = refDate(dateTo);
  const satkers = await prisma.$queryRaw`
    SELECT id, name FROM satker ${satkerId ? Prisma.sql`WHERE id = ${satkerId}` : Prisma.empty} ORDER BY id`;
  const data = await prisma.$queryRaw`
    WITH ${latestCte({ satkerId, range })}
    SELECT l.satker_id, l.kategori, LEFT(r.kode, 2) AS kode,
           COALESCE(SUM(r.pagu_revisi), 0)::float8 AS pagu,
           COALESCE(SUM(r.sampai_periode), 0)::float8 AS sampai
    FROM rekap_data r
    JOIN latest l ON l.id = r.upload_id
    WHERE r.tipe::text = 'AKUN' AND LEFT(r.kode, 2) IN ('51', '52', '53') AND l.kategori IN ('AKRUAL', ${kategori})
    GROUP BY 1, 2, 3`;
  const uploads = await prisma.$queryRaw`WITH ${latestCte({ satkerId, range })} SELECT satker_id, kategori FROM latest`;
  const inputs = await inputsAt({ ref, satkerId, jenis: 'PAGU_BELANJA' });

  const hasUpload = new Set(uploads.map((u) => `${u.satker_id}|${u.kategori}`));
  const val = new Map(data.map((d) => [`${d.satker_id}|${d.kategori}|${d.kode}`, d]));
  const pagu = new Map(inputs.map((i) => [`${i.satker_id}|${i.kode}`, i.nilai]));

  const cellOf = (pagu_total, pagu_efektif, realisasi) => ({
    pagu_total,
    pagu_efektif,
    realisasi,
    persentase_pagu_total: pct(realisasi, pagu_total),
    persentase_pagu_efektif: pct(realisasi, pagu_efektif),
  });

  const rows = satkers.map((s) => {
    const belanja = {};
    BELANJA.forEach((b) => {
      const akrual = hasUpload.has(`${s.id}|AKRUAL`) ? round2(val.get(`${s.id}|AKRUAL|${b.kode}`)?.pagu || 0) : null;
      const real = hasUpload.has(`${s.id}|${kategori}`) ? round2(val.get(`${s.id}|${kategori}|${b.kode}`)?.sampai || 0) : null;
      belanja[b.kode] = cellOf(pagu.has(`${s.id}|${b.kode}`) ? pagu.get(`${s.id}|${b.kode}`) : null, akrual, real);
    });
    return { satker: { id: s.id, name: s.name }, belanja };
  });

  const total = {};
  BELANJA.forEach((b) => {
    total[b.kode] = cellOf(
      sumOrNull(rows.map((r) => r.belanja[b.kode].pagu_total)),
      sumOrNull(rows.map((r) => r.belanja[b.kode].pagu_efektif)),
      sumOrNull(rows.map((r) => r.belanja[b.kode].realisasi))
    );
  });
  return { kategori, columns: BELANJA, rows, total: { belanja: total } };
}

module.exports = {
  satkerTotals,
  programTotals,
  belanjaTotals,
  belanjaPerSatker,
  latestUploadIds,
  inputsAt,
  refDate,
  BELANJA,
  pct,
  round2,
};
