const ExcelJS = require('exceljs');
const prisma = require('../prisma/client');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, dateRange } = require('../utils/query');
const { latestUploadIds } = require('../services/rekapSummary');

const MAX_EXPORT_ROWS = 50000;

async function buildWhere(req) {
  const q = req.query;
  const and = [];

  // Semua pengguna melihat data seluruh satker
  if (q.satker_id) and.push({ satker_id: Number(q.satker_id) || -1 });

  if (q.upload_id) {
    and.push({ upload_id: Number(q.upload_id) || -1 });
  } else {
    // Tanpa memilih upload tertentu, hanya upload terbaru tiap satker per kategori yang diambil
    const kategori = ['AKRUAL', 'SP2D'].includes(q.kategori) ? q.kategori : undefined;
    const ids = await latestUploadIds({ kategori });
    and.push({ upload_id: { in: ids.length ? ids : [-1] } });
  }
  if (['AKRUAL', 'SP2D'].includes(q.kategori)) and.push({ upload: { kategori: q.kategori } });
  const range = dateRange(q.date_from, q.date_to);
  if (range) and.push({ created_at: range });
  if (q.file && String(q.file).trim()) {
    and.push({ upload: { file_name: { contains: String(q.file).trim(), mode: 'insensitive' } } });
  }
  if (q.search && String(q.search).trim()) {
    const s = String(q.search).trim();
    and.push({
      OR: [
        { uraian: { contains: s, mode: 'insensitive' } },
        { kode: { contains: s, mode: 'insensitive' } },
        { uploader_name: { contains: s, mode: 'insensitive' } },
        { upload: { file_name: { contains: s, mode: 'insensitive' } } },
      ],
    });
  }
  return { AND: and };
}

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 20);
  const where = await buildWhere(req);
  const [total, data] = await Promise.all([
    prisma.rekapData.count({ where }),
    prisma.rekapData.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
      skip,
      take: limit,
      include: { upload: { select: { id: true, file_name: true, kategori: true } }, satker: { select: { id: true, name: true } } },
    }),
  ]);
  res.json({ data, pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) } });
});

exports.exportExcel = asyncHandler(async (req, res) => {
  const rows = await prisma.rekapData.findMany({
    where: await buildWhere(req),
    orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
    take: MAX_EXPORT_ROWS,
    include: { upload: { select: { file_name: true, kategori: true } }, satker: { select: { name: true } } },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Rekap');
  sheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Satker', key: 'satker', width: 34 },
    { header: 'Uploader', key: 'uploader', width: 22 },
    { header: 'File', key: 'file', width: 30 },
    { header: 'Kategori', key: 'kategori', width: 12 },
    { header: 'Kode', key: 'kode', width: 14 },
    { header: 'Uraian', key: 'uraian', width: 44 },
    { header: 'Pagu Efektif', key: 'pagu_revisi', width: 18 },
    { header: 'Lock Pagu', key: 'lock_pagu', width: 18 },
    { header: 'Periode Lalu', key: 'periode_lalu', width: 18 },
    { header: 'Periode Ini', key: 'periode_ini', width: 18 },
    { header: 'Realisasi', key: 'sampai_periode', width: 18 },
    { header: 'Persentase (%)', key: 'persentase', width: 14 },
    { header: 'Sisa Anggaran', key: 'sisa_anggaran', width: 18 },
    { header: 'Waktu Upload', key: 'waktu', width: 20 },
  ];

  const num = (v) => (v === null || v === undefined ? null : Number(v));
  rows.forEach((r, i) => {
    sheet.addRow({
      no: i + 1,
      satker: r.satker ? r.satker.name : '',
      uploader: r.uploader_name,
      file: r.upload.file_name,
      kategori: r.upload.kategori === 'SP2D' ? 'SP2D' : 'Akrual',
      kode: r.kode || '',
      uraian: r.uraian,
      pagu_revisi: num(r.pagu_revisi),
      lock_pagu: num(r.lock_pagu),
      periode_lalu: num(r.periode_lalu),
      periode_ini: num(r.periode_ini),
      sampai_periode: num(r.sampai_periode),
      persentase: num(r.persentase),
      sisa_anggaran: num(r.sisa_anggaran),
      waktu: r.created_at,
    });
  });

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  header.alignment = { vertical: 'middle', horizontal: 'center' };
  ['pagu_revisi', 'lock_pagu', 'periode_lalu', 'periode_ini', 'sampai_periode', 'sisa_anggaran'].forEach((k) => {
    sheet.getColumn(k).numFmt = '#,##0.00';
  });
  sheet.getColumn('persentase').numFmt = '0.00';
  sheet.getColumn('waktu').numFmt = 'dd/mm/yyyy hh:mm';
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'O1' };

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="rekap-${stamp}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});
