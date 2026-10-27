const express = require('express');
const router = express.Router();
const multer = require('multer');
const { promisify } = require('util');
const libre = require('libreoffice-convert');
libre.convertAsync = promisify(libre.convert);

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

router.post('/word-to-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const ext = '.pdf';

    // Convert Word buffer to PDF buffer using LibreOffice
    const pdfBuf = await libre.convertAsync(req.file.buffer, ext, undefined);

    // Send back the raw PDF bytes
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="converted_${Date.now()}.pdf"`);
    res.send(pdfBuf);

  } catch (error) {
    console.error('Word to PDF Error:', error);
    res.status(500).json({ success: false, message: 'Failed to convert document: ' + error.message });
  }
});

module.exports = router;
