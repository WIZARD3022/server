const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadRoot = process.env.UPLOAD_PATH
  ? path.resolve(process.env.UPLOAD_PATH)
  : path.resolve(__dirname, '../../uploads');

const storageFor = folder => multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(uploadRoot, folder);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const basename = path.basename(file.originalname, extension)
      .replace(/[^a-z0-9_-]/gi, '-')
      .replace(/-+/g, '-')
      .slice(0, 80) || 'file';
    cb(null, `${basename}-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = new Set(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']);
  const extension = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.has(extension)) {
    cb(null, true);
    return;
  }

  cb(new Error('Invalid file type. Only PDF, Word, and Images are allowed.'));
};

const createUpload = folder => multer({
  storage: storageFor(folder),
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }
});

const Expressupload = createUpload('express');
const Normalupload = createUpload('normal');
const Bannersupload = createUpload('banners');
const Productsupload = createUpload('products');

module.exports = {
  Expressupload,
  Normalupload,
  Bannersupload,
  Productsupload,
  uploadRoot
};
