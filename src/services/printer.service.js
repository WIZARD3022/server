const fs = require('fs/promises');
const cups = require('./cups.service');
const config = require('../config/printer');
const { validateConfig, validatePrintOptions } = require('../validators/printer.validator');
const PrintJob = require('../models').PrintJob;

const clean = async filePath => { if (filePath) await fs.unlink(filePath).catch(() => {}); };

async function submit(file, input, user) {
  if (!file || !file.path) { const e = new Error('PDF file is required'); e.status = 400; throw e; }
  try {
    validateConfig();
    const header = await fs.open(file.path, 'r');
    const buffer = Buffer.alloc(5);
    await header.read(buffer, 0, 5, 0).finally(() => header.close());
    if (buffer.toString() !== '%PDF-') { const e = new Error('Uploaded file is not a valid PDF'); e.status = 400; throw e; }
    const printOptions = validatePrintOptions(input);
    printOptions.queue = String(input.queue || input.type || 'normal').toLowerCase();
    if (!['normal', 'express'].includes(printOptions.queue)) {
      const error = new Error('queue must be normal or express');
      error.status = 400;
      throw error;
    }
    const submission = await cups.submit(file.path, printOptions);
    const job = await new PrintJob({
      userId: user.id,
      cupsJobId: submission.cupsJobId,
      originalName: file.originalname,
      file: file.path,
      size: file.size,
      options: printOptions,
      status: 'submitted'
    }).save();
    return job.toObject();
  } finally { await clean(file.path); }
}

module.exports = { submit, clean };
