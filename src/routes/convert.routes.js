const express = require('express');
const router = express.Router();
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// Since LibreOffice requires OS-level installation and paths which are tricky on Windows Node.js,
// we will fallback to Gotenberg cloud API or a public conversion API for the MVP.
router.post('/word-to-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Free Gotenberg Cloud API / Public API fallback for Word to PDF conversion
    const form = new FormData();
    form.append('files', req.file.buffer, {
      filename: req.file.originalname || 'document.docx',
      contentType: req.file.mimetype || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    // Public demo instance of Gotenberg API for conversion (Warning: Use own instance for prod)
    // As a reliable fallback, we'll use a public API wrapper.
    const response = await axios.post('https://demo.gotenberg.dev/forms/libreoffice/convert', form, {
      headers: {
        ...form.getHeaders()
      },
      responseType: 'arraybuffer', // Expecting binary PDF data
      timeout: 30000 // 30 sec timeout
    });

    // Send back the raw PDF bytes
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="converted_${Date.now()}.pdf"`);
    res.send(response.data);

  } catch (error) {
    console.error('Word to PDF Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to convert document. Conversion server might be busy. Error: ' + error.message });
  }
});

module.exports = router;
