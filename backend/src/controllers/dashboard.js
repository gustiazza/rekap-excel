const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { dateRange } = require('../utils/query');
const { brmpRekap } = require('../services/brmpRekap');
const { satkerTotals, programTotals, belanjaTotals, belanjaPerSatker } = require('../services/rekapSummary');

// Dashboard = ringkasan hasil rekap: upload terbaru tiap satker per kategori (Akrual dan SP2D),
// dalam rentang tanggal upload yang dipilih. Semua pengguna melihat data seluruh satker.
exports.get = asyncHandler(async (req, res) => {
  const range = dateRange(req.query.date_from, req.query.date_to);
  const opts = { range, dateTo: req.query.date_to };

  const [satker, per_program, per_belanja, belanja_akrual, belanja_sp2d] = await Promise.all([
    satkerTotals(opts),
    programTotals(opts),
    belanjaTotals(opts),
    belanjaPerSatker({ ...opts, kategori: 'AKRUAL' }),
    belanjaPerSatker({ ...opts, kategori: 'SP2D' }),
  ]);

  res.json({
    role: req.user.role,
    ref: satker.ref,
    totals: satker.total,
    per_satker: satker.rows,
    per_program,
    per_belanja,
    belanja_akrual,
    belanja_sp2d,
  });
});

// Rekap per program dan per belanja untuk SATU satker (dipakai agar pagu total dapat diubah langsung di tabel).
exports.group = asyncHandler(async (req, res) => {
  const satkerId = Number(req.query.satker_id);
  if (!Number.isInteger(satkerId) || satkerId <= 0) throw new HttpError(400, 'Satker tidak valid.');
  const range = dateRange(req.query.date_from, req.query.date_to);
  const opts = { satkerId, range, dateTo: req.query.date_to };

  const [per_program, per_belanja] = await Promise.all([programTotals(opts), belanjaTotals(opts)]);
  res.json({ satker_id: satkerId, per_program, per_belanja });
});

// Rekap khusus BRMP Perkebunan (Program, RO, Komponen, Sub-komponen), mengikuti filter tanggal.
exports.brmp = asyncHandler(async (req, res) => {
  const range = dateRange(req.query.date_from, req.query.date_to);
  const data = await brmpRekap({ range, dateTo: req.query.date_to });
  // Hanya Admin dan pengguna satker BRMP Perkebunan
  if (req.user.role !== 'ADMIN' && (!data.satker || req.user.satker_id !== data.satker.id)) {
    throw new HttpError(403, 'Rekap ini hanya untuk satker BRMP Perkebunan.');
  }
  res.json(data);
});