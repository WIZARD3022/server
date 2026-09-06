const path = require('path');

const printerConfig = {
  enabled: process.env.CUPS_ENABLED !== 'false',
  printer: process.env.CUPS_PRINTER || '',
  lpBinary: process.env.CUPS_LP_BINARY || 'lp',
  lpstatBinary: process.env.CUPS_LPSTAT_BINARY || 'lpstat',
  lpoptionsBinary: process.env.CUPS_LPOPTIONS_BINARY || 'lpoptions',
  cancelBinary: process.env.CUPS_CANCEL_BINARY || 'cancel',
  commandTimeout: Number(process.env.CUPS_COMMAND_TIMEOUT || 15000),
  maxFileSize: Number(
    process.env.PRINTER_MAX_FILE_SIZE
      || (Number(process.env.MAX_PRINT_FILE_SIZE_MB || 20) * 1024 * 1024)
  ),
  uploadRoot: path.resolve(process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads')),
  maxJobs: Number(process.env.PRINTER_MAX_JOBS || 100)
};

module.exports = printerConfig;
