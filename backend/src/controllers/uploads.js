const prisma = require('../prisma/client');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { processExcel } = require('../services/excelProcessor');
const { parsePagination, dateRange } = require('../utils/query');
const { latestUploadIds } = require('../services/rekapSummary');

const KATEGORI = ['AKRUAL', 'SP2D'];

const isAdmin = (req) => req.user.role === 'ADMIN';

// Semua pengguna yang login dapat melihat seluruh upload (hapus tetap hanya untuk Admin).
const accessWhere = () => ({});

// Mencatat upload yang gagal agar tetap muncul di riwayat (tidak pernah dihitung di rekap)
async function recordFailure(req, satkerId, kategori, fileName, message, totalRows = 0) {
  await prisma.upload.create({
    data: {
      user_id: req.user.id,
      satker_id: satkerId,
      kategori,
      file_name: fileName,
      total_rows: totalRows,
      processed_rows: 0,
      upload_status: 'FAILED',
      error_message: message,
    },
  });
}

exports.create = asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Pilih file Excel terlebih dahulu.');

  // multer membaca nama file sebagai latin1; ubah ke UTF-8 agar nama bertanda baca tetap benar
  const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

  const kategori = String(req.body.kategori || '').toUpperCase();
  if (!KATEGORI.includes(kategori)) throw new HttpError(400, 'Pilih kategori file (Akrual atau SP2D).');

  // Data laporan dikelola per satker. Pengguna biasa selalu memakai satkernya sendiri (dari akun, bukan dari input);
  // Admin tidak terikat satker sehingga memilih satker tujuan.
  let satkerId = req.user.satker_id;
  if (isAdmin(req)) {
    satkerId = Number(req.body.satker_id);
    if (!Number.isInteger(satkerId) || satkerId <= 0) {
      throw new HttpError(400, 'Pilih satker tujuan upload terlebih dahulu.');
    }
    if (!(await prisma.satker.findUnique({ where: { id: satkerId } }))) {
      throw new HttpError(400, 'Satker tidak ditemukan.');
    }
  } else if (!satkerId) {
    throw new HttpError(403, 'Akun Anda belum terdaftar pada satker. Hubungi admin.');
  }

  let result;
  try {
    result = await processExcel(req.file.buffer);
  } catch (err) {
    console.error('[upload] Excel tidak dapat dibaca:', err.message);
    await recordFailure(req, satkerId, kategori, fileName, 'File Excel tidak dapat diproses.');
    throw new HttpError(422, 'File Excel tidak dapat diproses.');
  }

  if (result.records.length === 0) {
    const msg = 'Tidak ditemukan baris data. Pastikan file memiliki kolom kode dan uraian beserta kolom angka.';
    await recordFailure(req, satkerId, kategori, fileName, msg, result.totalRows);
    throw new HttpError(422, msg);
  }

  const { totals } = result;
  const notes = [];
  if (totals.source === 'PROGRAM') {
    notes.push('Baris "JUMLAH SELURUHNYA" tidak ditemukan, total dihitung dari baris Program.');
  } else if (!totals.source) {
    notes.push('Baris "JUMLAH SELURUHNYA" dan baris Program tidak ditemukan, total tidak dapat dihitung.');
  }
  if (result.skipped > 0) notes.push(`${result.skipped} baris dilewati karena tidak dapat dibaca.`);

  // Identitas uploader dan satker selalu diambil dari akun yang login (JWT), bukan dari input pengguna.
  // Semua upload tetap tersimpan; dashboard dan pelaporan memakai yang terbaru per satker per kategori.
  const upload = await prisma.$transaction(
    async (tx) => {
      const created = await tx.upload.create({
        data: {
          user_id: req.user.id,
          satker_id: satkerId,
          kategori,
          file_name: fileName,
          total_rows: result.totalRows,
          processed_rows: result.records.length,
          upload_status: notes.length ? 'PARTIAL' : 'SUCCESS',
          error_message: notes.length ? notes.join(' ') : null,
          total_pagu_revisi: totals.pagu_revisi,
          total_sampai_periode: totals.sampai_periode,
          total_persentase: totals.persentase,
        },
      });
      const rows = result.records.map((r) => ({
        ...r,
        upload_id: created.id,
        user_id: req.user.id,
        satker_id: satkerId,
        uploader_name: req.user.name,
      }));
      for (let i = 0; i < rows.length; i += 500) {
        await tx.rekapData.createMany({ data: rows.slice(i, i + 500) });
      }
      return created;
    },
    { timeout: 60000 }
  );

  const label = kategori === 'SP2D' ? 'SP2D' : 'Akrual';
  const message = [`File ${label} berhasil diproses. ${result.records.length} data berhasil direkap.`, ...notes]
    .filter(Boolean)
    .join(' ');

  res.status(201).json({
    message,
    upload,
    summary: {
      total_rows: result.totalRows,
      processed_rows: result.records.length,
      skipped_rows: Math.max(0, result.totalRows - result.records.length),
    },
  });
});

exports.list = asyncHandler(async (req, res) => {
  const q = req.query;
  const { page, limit, skip } = parsePagination(q);
  const and = [accessWhere(req)];

  if (q.satker_id) and.push({ satker_id: Number(q.satker_id) || -1 });
  if (KATEGORI.includes(q.kategori)) and.push({ kategori: q.kategori });
  if (['SUCCESS', 'PARTIAL', 'FAILED'].includes(q.status)) and.push({ upload_status: q.status });
  const range = dateRange(q.date_from, q.date_to);
  if (range) and.push({ uploaded_at: range });
  if (q.search && String(q.search).trim()) {
    const s = String(q.search).trim();
    and.push({
      OR: [
        { file_name: { contains: s, mode: 'insensitive' } },
        { user: { name: { contains: s, mode: 'insensitive' } } },
      ],
    });
  }
  const where = { AND: and };

  const [total, rows, latest] = await Promise.all([
    prisma.upload.count({ where }),
    prisma.upload.findMany({
      where,
      orderBy: { uploaded_at: 'desc' },
      skip,
      take: limit,
      include: { user: { select: { id: true, name: true } }, satker: { select: { id: true, name: true } } },
    }),
    latestUploadIds({}),
  ]);
  // is_latest = upload terbaru satker itu pada kategorinya (yang dihitung di dashboard bila tanpa filter tanggal)
  const latestSet = new Set(latest);
  const data = rows.map((u) => ({ ...u, is_latest: latestSet.has(u.id) }));

  res.json({ data, pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) } });
});

exports.detail = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, 'ID upload tidak valid.');

  const upload = await prisma.upload.findFirst({
    where: { id, ...accessWhere(req) },
    include: { user: { select: { id: true, name: true, nip: true } }, satker: { select: { id: true, name: true } } },
  });
  if (!upload) {
    const exists = await prisma.upload.findUnique({ where: { id }, select: { id: true } });
    throw exists
      ? new HttpError(403, 'Anda tidak memiliki akses ke data upload ini.')
      : new HttpError(404, 'Data upload tidak ditemukan.');
  }

  const rows = await prisma.rekapData.findMany({
    where: { upload_id: id },
    orderBy: { id: 'asc' },
    select: {
      id: true, uploader_name: true, sheet_name: true, row_number: true, kode: true, tipe: true, uraian: true,
      pagu_revisi: true, lock_pagu: true, periode_lalu: true, periode_ini: true, sampai_periode: true,
      persentase: true, sisa_anggaran: true, created_at: true,
    },
  });

  const latest = await latestUploadIds({ satkerId: upload.satker_id || undefined });
  res.json({
    upload: { ...upload, is_latest: latest.includes(upload.id) },
    not_taken_rows: Math.max(0, upload.total_rows - upload.processed_rows),
    rows,
  });
});

exports.remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, 'ID upload tidak valid.');
  const upload = await prisma.upload.findUnique({ where: { id } });
  if (!upload) throw new HttpError(404, 'Data upload tidak ditemukan.');

  await prisma.upload.delete({ where: { id } }); // data rekap ikut terhapus (cascade); upload sebelumnya otomatis menjadi yang terbaru

  res.json({ message: 'Data upload beserta hasil rekapnya berhasil dihapus.' });
});
