const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../prisma/client');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');

// Memeriksa JWT, lalu memuat ulang pengguna dari database agar perubahan
// role/status/satker (misalnya akun dinonaktifkan) langsung berlaku.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Silakan login terlebih dahulu.');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Sesi tidak valid atau sudah berakhir. Silakan login kembali.');
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    select: { id: true, name: true, nip: true, role: true, status: true, satker_id: true },
  });
  if (!user || user.status !== 'ACTIVE') {
    throw new HttpError(401, 'Akun tidak ditemukan atau sudah dinonaktifkan.');
  }
  req.user = user;
  next();
});

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new HttpError(403, 'Anda tidak memiliki akses ke fitur ini.'));
  }
  next();
};

module.exports = { authenticate, requireRole };
