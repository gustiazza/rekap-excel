const path = require('path');
const multer = require('multer');
const config = require('../config');
const HttpError = require('../utils/httpError');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext === '.xls') {
      return cb(new HttpError(400, 'Format .xls lama tidak didukung. Simpan ulang file sebagai .xlsx lalu upload kembali.'));
    }
    if (ext !== '.xlsx') {
      return cb(new HttpError(400, 'File harus berupa Excel (.xlsx).'));
    }
    cb(null, true);
  },
});

module.exports = upload.single('file');
