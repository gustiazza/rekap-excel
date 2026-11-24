const prisma = require('../prisma/client');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { dateRange } = require('../utils/query');
const { satkerTotals } = require('../services/rekapSummary');

// Daftar satker (untuk dropdown), sama untuk semua pengguna.
exports.list = asyncHandler(async (req, res) => {
  const data = await prisma.satker.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, name: true, _count: { select: { users: true } } },
  });
  res.json({ data: data.map((s) => ({ id: s.id, name: s.name, users: s._count.users })) });
});

// Rekap per satker (pagu, realisasi Akrual dan SP2D, target, gap) dari upload terbaru pada rentang tanggal
exports.summary = asyncHandler(async (req, res) => {
  let satkerId = null;
  if (req.query.satker_id) {
    satkerId = Number(req.query.satker_id);
    if (!Number.isInteger(satkerId)) throw new HttpError(400, 'Satker tidak valid.');
  }
  const range = dateRange(req.query.date_from, req.query.date_to);
  res.json(await satkerTotals({ satkerId, range, dateTo: req.query.date_to }));
});
