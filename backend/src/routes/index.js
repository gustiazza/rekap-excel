const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadLimiter, exportLimiter } = require('../middleware/rateLimit');
const uploadFile = require('../middleware/upload');
const auth = require('../controllers/auth');
const dashboard = require('../controllers/dashboard');
const uploads = require('../controllers/uploads');
const rekap = require('../controllers/rekap');
const users = require('../controllers/users');
const satker = require('../controllers/satker');
const pagu = require('../controllers/pagu');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
});

// Auth
router.post('/auth/login', loginLimiter, auth.login);
router.get('/auth/me', authenticate, auth.me);
router.put('/auth/password', authenticate, auth.changePassword);

// Satker (daftar untuk dropdown, ringkasan total per satker)
router.get('/satker', authenticate, satker.list);
router.get('/satker/summary', authenticate, satker.summary);

// Input manual: pagu total dan target SP2D (semua pengguna; hak ubah dicek di controller)
router.get('/pagu', authenticate, pagu.get);
router.get('/pagu/riwayat', authenticate, pagu.history);
router.put('/pagu', authenticate, pagu.save);
router.delete('/pagu/:id', authenticate, pagu.remove);

// Dashboard
router.get('/dashboard', authenticate, dashboard.get);
router.get('/dashboard/group', authenticate, dashboard.group);
router.get('/dashboard/brmp', authenticate, dashboard.brmp);

// Upload (USER & ADMIN; filter kepemilikan dilakukan di controller)
router.post('/uploads', authenticate, uploadLimiter, uploadFile, uploads.create);
router.get('/uploads', authenticate, uploads.list);
router.get('/uploads/:id', authenticate, uploads.detail);
router.delete('/uploads/:id', authenticate, requireRole('ADMIN'), uploads.remove);

// Rekap
router.get('/rekap/export', authenticate, exportLimiter, rekap.exportExcel);
router.get('/rekap', authenticate, rekap.list);

// Pengguna (ADMIN saja)
router.use('/users', authenticate, requireRole('ADMIN'));
router.get('/users', users.list);
router.post('/users', users.create);
router.put('/users/:id', users.update);
router.put('/users/:id/status', users.setStatus);
router.put('/users/:id/password', users.resetPassword);
router.delete('/users/:id', users.remove);

module.exports = router;
