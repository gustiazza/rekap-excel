const rateLimit = require('express-rate-limit');

// Pembatas per pengguna (bukan per IP). Dipasang setelah authenticate sehingga req.user sudah ada.
const perUser = ({ windowMs, max, label }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `user:${req.user.id}`,
    handler: (req, res) => {
      req.resume(); // buang sisa body agar koneksi tidak menggantung
      const minutes = Math.max(1, Math.ceil(windowMs / 60000));
      res.status(429).json({ message: `Terlalu banyak ${label}. Coba lagi dalam ${minutes} menit.` });
    },
  });

exports.uploadLimiter = perUser({ windowMs: 10 * 60 * 1000, max: 10, label: 'upload file' });
exports.exportLimiter = perUser({ windowMs: 10 * 60 * 1000, max: 20, label: 'permintaan export' });
