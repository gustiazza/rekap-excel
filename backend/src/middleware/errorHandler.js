const multer = require('multer');
const config = require('../config');

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: `Ukuran file melebihi ${config.maxUploadMb} MB.` });
    }
    return res.status(400).json({ message: 'Upload file gagal. Pastikan hanya mengirim satu file Excel.' });
  }
  if (err.code === 'P2002') {
    return res.status(409).json({ message: 'Data sudah terdaftar (duplikat).' });
  }
  if (err.status) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error(err);
  res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
};
