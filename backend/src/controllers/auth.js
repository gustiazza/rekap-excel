const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../prisma/client');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');

const NIP_RE = /^\d{1,25}$/;

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  nip: u.nip,
  role: u.role,
  status: u.status,
  satker: u.satker ? { id: u.satker.id, name: u.satker.name } : null,
});

const WITH_SATKER = { satker: { select: { id: true, name: true } } };

exports.login = asyncHandler(async (req, res) => {
  const nip = String(req.body.nip || '').trim();
  const password = String(req.body.password || '');
  if (!nip || !password) throw new HttpError(400, 'NIP dan password wajib diisi.');

  const user = NIP_RE.test(nip) ? await prisma.user.findUnique({ where: { nip }, include: WITH_SATKER }) : null;
  const valid = user && (await bcrypt.compare(password, user.password));
  if (!valid) throw new HttpError(401, 'NIP atau password salah.');
  if (user.status !== 'ACTIVE') throw new HttpError(403, 'Akun Anda dinonaktifkan. Hubungi admin.');

  const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  res.json({ token, user: publicUser(user) });
});

exports.me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: WITH_SATKER });
  res.json({ user: { ...publicUser(user), created_at: user.created_at } });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const current = String(req.body.current_password || '');
  const next = String(req.body.new_password || '');
  if (next.length < 8) throw new HttpError(400, 'Password baru minimal 8 karakter.');

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!(await bcrypt.compare(current, user.password))) {
    throw new HttpError(400, 'Password saat ini tidak sesuai.');
  }
  await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(next, 10) } });
  res.json({ message: 'Password berhasil diubah.' });
});
