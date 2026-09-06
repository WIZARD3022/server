const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { Expressupload, Normalupload, Bannersupload, Productsupload } = require('../middleware/upload.middleware');

const uploaders = {
  express: Expressupload,
  normal: Normalupload,
  banners: Bannersupload,
  products: Productsupload
};

const uploadByType = (req, res, next) => {
  const type = String(req.params.type || req.query.type || '').toLowerCase();
  const uploader = uploaders[type];

  if (!uploader) {
    return res.status(400).json({
      success: false,
      message: 'Invalid type. Use /file/normal or /file/express'
    });
  }

  req.uploadType = type;
  return uploader.single('file')(req, res, next);
};

router.post('/file/:type', authMiddleware, uploadByType, uploadController.uploadFile);
router.post('/file', authMiddleware, uploadByType, uploadController.uploadFile);

module.exports = router;
