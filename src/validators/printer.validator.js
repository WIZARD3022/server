const config = require('../config/printer');

const allowed = {
  paperSize: { A4: 'A4', A5: 'A5', Letter: 'Letter' },
  orientation: { portrait: '3', landscape: '4' },
  color: { color: 'color', grayscale: 'monochrome' },
  duplex: { simplex: 'one-sided', 'long-edge': 'two-sided-long-edge', 'short-edge': 'two-sided-short-edge' }
};

const fail = message => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

function validatePrintOptions(input) {
  const value = input || {};
  const result = {};
  if (value.copies !== undefined) {
    const copies = Number(value.copies);
    if (!Number.isInteger(copies) || copies < 1 || copies > 100) throw fail('copies must be an integer between 1 and 100');
    result.copies = copies;
  } else result.copies = 1;
  Object.keys(allowed).forEach(key => {
    if (value[key] !== undefined) {
      if (!Object.prototype.hasOwnProperty.call(allowed[key], String(value[key]))) throw fail(`Invalid ${key}`);
      result[key] = String(value[key]);
    }
  });
  if (value.pageRanges !== undefined) {
    const ranges = String(value.pageRanges).trim();
    if (!/^[1-9]\d*(?:-[1-9]\d*)?(?:,[1-9]\d*(?:-[1-9]\d*)?)*$/.test(ranges)) throw fail('Invalid pageRanges');
    result.pageRanges = ranges;
  }
  return result;
}

function validateConfig() {
  if (!config.enabled || !config.printer) {
    const error = new Error('Printer is not configured');
    error.status = 503;
    throw error;
  }
}

module.exports = { allowed, validatePrintOptions, validateConfig };
