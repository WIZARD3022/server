const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { uploadRoot } = require('./middleware/upload.middleware');

const app = express();

app.set("trust proxy", true);

// Middleware
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "unsafe-none" }, // Required for Google login popups on web
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Prevent CSP from blocking Google GIS scripts
}));
app.use(compression()); // Compress all responses
app.use(cors({
  origin: true, // Dynamically mirror request origin for credentials support
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate Limiting (Disabled for local dev to prevent 429 errors)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000, // Effectively disabled for dev
  message: 'Too many requests'
});
if (process.env.NODE_ENV === 'production') {
  app.use('/api/', limiter);
}

const path = require('path');
// ... other imports

// Static files for uploads
app.use('/uploads', express.static(uploadRoot));

// Serve Flutter Web Build (Optional, but good for testing)
const webPath = path.join(__dirname, '../../build/web');
app.use(express.static(webPath));

// Feature Routes
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/user', require('./routes/user.routes'));
app.use('/api/v1/users', require('./routes/user.routes'));
app.use('/api/v1/cart', require('./routes/cart.routes'));
app.use('/api/v1/admin', require('./routes/admin.routes'));
app.use('/api/v1/upload', require('./routes/upload.routes'));
app.use('/api/v1/uploads', require('./routes/upload.routes'));
app.use('/api/v1/payment', require('./routes/payment.routes'));
app.use('/api/v1/payments', require('./routes/payment.routes'));
app.use('/api/v1/printer', require('./routes/printer.routes'));
app.use('/api/v1/printers', require('./routes/printer.routes'));
app.use('/api/v1/printing', require('./routes/printing.routes'));
app.use('/api/v1/shopping', require('./routes/shopping.routes'));
app.use('/api/v1/coupons', require('./routes/coupon.routes'));
app.use('/api/v1/notification', require('./routes/notification.routes'));
app.use('/api/v1/notifications', require('./routes/notification.routes'));

// Handle non-existent API routes to avoid 405 on POST/PUT/DELETE
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.method} ${req.originalUrl} not found`
  });
});

// Handle Flutter Web Routing (Catch-all)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(webPath, 'index.html'));
  }
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : (err.status || 500);
  res.status(status).json({
    success: false,
    message: err.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file is too large' : (err.message || 'Internal Server Error'),
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

module.exports = app;
