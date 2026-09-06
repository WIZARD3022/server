const multer = require('multer');
const fs = require('fs');
const path = require('path');
const config = require('../config/printer');

const createPrinterUpload = type => {
  const folder = type === 'express' ? 'express' : 'normal';
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const destination = path.join(config.uploadRoot, folder);
        fs.mkdirSync(destination, { recursive: true });
        cb(null, destination);
      },
      filename: (req, file, cb) => {
        const extension = '.pdf';
        const basename = path.basename(file.originalname, path.extname(file.originalname))
          .replace(/[^a-z0-9_-]/gi, '-')
          .replace(/-+/g, '-')
          .slice(0, 80) || 'document';
        cb(null, `${basename}-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
      }
    }),
    limits: { fileSize: config.maxFileSize, files: 1 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf') {
        return cb(null, true);
      }
      const error = new Error('Only PDF files are allowed');
      error.status = 400;
      return cb(error);
    }
  });
};

const middlewareFor = type => (req, res, next) => {
  createPrinterUpload(type).single('file')(req, res, error => {
    if (error && req.file && req.file.path) fs.unlink(req.file.path, () => {});
    next(error);
  });
};

module.exports = {
  normal: middlewareFor('normal'),
  express: middlewareFor('express')
};
