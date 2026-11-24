const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma/client');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');

const SAFE = {
  id: true,
  name: true,
  nip: true,
  role: true,
  status: true,
  satker_id: true,
  satker: { select: { id: true, name: true } },
  created_at: true,
  updated_at: true,
};
const ROLES = ['ADMIN', 'USER'];
const STATUSES = ['ACTIVE', 'INACTIVE'];
const NIP_RE = /^\d{5,25}$/; // NIP hanya berupa angka

const parseId = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, 'ID pengguna tidak valid.');
  return id;
};

// Memastikan satker ada. Mengembalikan id satker.
const checkSatker = async (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Satker wajib dipilih.');
  if (!(await prisma.satker.findUnique({ where: { id } }))) throw new HttpError(400, 'Satker tidak ditemukan.');
  return id;
};

exports.list = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: { ...SAFE, _count: { select: { uploads: true } } },
    orderBy: { created_at: 'asc' },
  });
  res.json({ data: users });
});

exports.create = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const nip = String(req.body.nip || '').trim();
  const password = String(req.body.password || '');
  const role = req.body.role || 'USER';

  if (!name) {
    throw new HttpError(400, 'Nama wajib diisi.');
  }

  if (!NIP_RE.test(nip)) {
    throw new HttpError(400, 'NIP harus berupa angka (5-25 digit).');
  }

  if (password.length < 8) {
    throw new HttpError(400, 'Password minimal 8 karakter.');
  }

  if (!ROLES.includes(role)) {
    throw new HttpError(400, 'Role tidak valid.');
  }

  if (await prisma.user.findUnique({ where: { nip } })) {
    throw new HttpError(409, 'NIP sudah digunakan.');
  }

  // Pengguna (USER) wajib punya satker; Admin tidak terikat satker
  const satker_id = role === 'USER' ? await checkSatker(req.body.satker_id) : null;

  // Sistem hanya mengizinkan 1 akun ADMIN
  if (role === 'ADMIN') {
    const existingAdmin = await prisma.user.findFirst({
      where: {
        role: 'ADMIN',
      },
    });

    if (existingAdmin) {
      throw new HttpError(
        409,
        'Admin sudah terdaftar. Sistem hanya mengizinkan 1 Admin.'
      );
    }
  }

  const user = await prisma.user.create({
    data: {
      name,
      nip,
      role,
      satker_id,
      password: await bcrypt.hash(password, 10),
    },
    select: SAFE,
  });

  res.status(201).json({
    message: 'Pengguna berhasil ditambahkan.',
    user,
  });
});

exports.update = asyncHandler(async (req, res) => {
  const id = parseId(req);
  const data = {};

  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, 'Pengguna tidak ditemukan.');

  if (req.body.name !== undefined) {
    data.name = String(req.body.name).trim();
    if (!data.name) throw new HttpError(400, 'Nama wajib diisi.');
  }
  if (req.body.nip !== undefined) {
    data.nip = String(req.body.nip).trim();
    if (!NIP_RE.test(data.nip)) throw new HttpError(400, 'NIP harus berupa angka (5-25 digit).');
    const other = await prisma.user.findUnique({ where: { nip: data.nip } });
    if (other && other.id !== id) throw new HttpError(409, 'NIP sudah digunakan.');
  }
  if (req.body.role !== undefined) {
    if (!ROLES.includes(req.body.role)) {
      throw new HttpError(400, 'Role tidak valid.');
    }

    if (id === req.user.id && req.body.role !== req.user.role) {
      throw new HttpError(
        400,
        'Anda tidak dapat mengubah role akun sendiri.'
      );
    }

    // Hanya boleh ada 1 ADMIN
    if (req.body.role === 'ADMIN') {
      const existingAdmin = await prisma.user.findFirst({
        where: {
          role: 'ADMIN',
          id: {
            not: id,
          },
        },
      });

      if (existingAdmin) {
        throw new HttpError(
          409,
          'Admin sudah terdaftar. Sistem hanya mengizinkan 1 Admin.'
        );
      }
    }

    data.role = req.body.role;
  }

  // Satker: USER wajib punya satker, ADMIN tidak terikat satker
  const finalRole = data.role || current.role;
  if (finalRole === 'ADMIN') {
    data.satker_id = null;
  } else if (req.body.satker_id !== undefined) {
    data.satker_id = await checkSatker(req.body.satker_id);
  } else if (!current.satker_id) {
    throw new HttpError(400, 'Satker wajib dipilih.');
  }

  const user = await prisma.user.update({ where: { id }, data, select: SAFE });
  res.json({ message: 'Pengguna berhasil diperbarui.', user });
});

exports.setStatus = asyncHandler(async (req, res) => {
  const id = parseId(req);
  const { status } = req.body;
  if (!STATUSES.includes(status)) throw new HttpError(400, 'Status tidak valid.');
  if (id === req.user.id) throw new HttpError(400, 'Anda tidak dapat mengubah status akun sendiri.');
  if (!(await prisma.user.findUnique({ where: { id } }))) throw new HttpError(404, 'Pengguna tidak ditemukan.');

  const user = await prisma.user.update({ where: { id }, data: { status }, select: SAFE });
  res.json({ message: status === 'ACTIVE' ? 'Pengguna diaktifkan.' : 'Pengguna dinonaktifkan.', user });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const id = parseId(req);
  if (!(await prisma.user.findUnique({ where: { id } }))) throw new HttpError(404, 'Pengguna tidak ditemukan.');

  let password = String(req.body.password || '');
  let generated = false;
  if (!password) {
    password = crypto.randomBytes(9).toString('base64url'); // 12 karakter acak
    generated = true;
  } else if (password.length < 8) {
    throw new HttpError(400, 'Password minimal 8 karakter.');
  }

  await prisma.user.update({ where: { id }, data: { password: await bcrypt.hash(password, 10) } });
  res.json({ message: 'Password berhasil direset.', ...(generated ? { new_password: password } : {}) });
});

exports.remove = asyncHandler(async (req, res) => {
  const id = parseId(req);
  if (id === req.user.id) throw new HttpError(400, 'Anda tidak dapat menghapus akun sendiri.');

  const user = await prisma.user.findUnique({ where: { id }, include: { _count: { select: { uploads: true } } } });
  if (!user) throw new HttpError(404, 'Pengguna tidak ditemukan.');
  if (user._count.uploads > 0) {
    throw new HttpError(409, 'Pengguna ini memiliki riwayat upload. Nonaktifkan saja agar data dan identitas uploader tetap tersimpan.');
  }
  await prisma.user.delete({ where: { id } });
  res.json({ message: 'Pengguna berhasil dihapus.' });
});
