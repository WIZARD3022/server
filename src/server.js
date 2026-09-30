const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const app = require('./app');
const database = require('./config/database');
const { verifyMailTransport } = require('./config/mail');

const PORT = process.env.PORT || 3000;

let server;
const start = async () => {
  await database();
  verifyMailTransport().catch(error => {
    console.error(`Email transport verification failed: ${error.message}`);
  });
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 UniKart Server running on http://0.0.0.0:${PORT}`);
    console.log(`📡 Access locally at http://127.0.0.1:${PORT}`);
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  if (server) server.close(() => process.exit(1));
  else process.exit(1);
});

// Graceful shutdown for production (VPS/Docker)
const shutdown = () => {
  console.info('SIGTERM signal received. Closing HTTP server.');
  const finish = async () => {
    await database.closeDB();
    console.log('HTTP server closed.');
    process.exit(0);
  };
  if (server) server.close(finish);
  else finish();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch(error => {
  console.error(`❌ Server startup failed: ${error.message}`);
  process.exit(1);
});

// just testing
// just testing again