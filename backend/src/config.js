require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET belum diatur di file .env');
  process.exit(1);
}

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

module.exports = {
  port: num(process.env.PORT, 5000),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  maxUploadMb: num(process.env.MAX_UPLOAD_MB, 10),
};
