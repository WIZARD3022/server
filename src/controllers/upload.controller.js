exports.uploadFile = (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Use multipart field "file".'
    });
  }

  const type = req.uploadType || req.params.type || req.query.type;

  // Use BASE_URL from .env if available, otherwise fallback to request headers
  const rawBaseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const baseUrl = rawBaseUrl.replace(/^http:\/\//, 'https://');
  const fileUrl = `${baseUrl}/uploads/${type}/${encodeURIComponent(req.file.filename)}`;

  return res.status(201).json({
    success: true,
    message: 'File uploaded successfully',
    data: {
      type,
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    }
  });
};
