const { execFile } = require('child_process');
const { promisify } = require('util');
const config = require('../config/printer');
const { allowed } = require('../validators/printer.validator');

const run = promisify(execFile);
const command = async (binary, args) => {
  try {
    return await run(binary, args, { timeout: config.commandTimeout, maxBuffer: 1024 * 1024 });
  } catch (error) {
    const wrapped = new Error((error.stderr || error.message || 'CUPS command failed').trim());
    wrapped.status = error.killed ? 503 : 503;
    wrapped.code = 'CUPS_UNAVAILABLE';
    throw wrapped;
  }
};

const optionsToArgs = options => {
  const args = ['-d', config.printer];
  args.push('-q', options.queue === 'express' ? '100' : '50');
  if (options.copies) args.push('-n', String(options.copies));
  if (options.paperSize) args.push('-o', `media=${allowed.paperSize[options.paperSize]}`);
  if (options.orientation) args.push('-o', `orientation-requested=${allowed.orientation[options.orientation]}`);
  if (options.color) args.push('-o', `print-color-mode=${allowed.color[options.color]}`);
  if (options.duplex) args.push('-o', `sides=${allowed.duplex[options.duplex]}`);
  if (options.pageRanges) args.push('-o', `page-ranges=${options.pageRanges}`);
  return args;
};

async function submit(filePath, options) {
  const result = await command(config.lpBinary, optionsToArgs(options).concat([filePath]));
  const match = `${result.stdout || ''} ${result.stderr || ''}`.match(/request id is\s+([^\s]+)/i);
  if (!match) {
    const error = new Error('CUPS did not return a job id');
    error.status = 503;
    throw error;
  }
  return { cupsJobId: match[1], output: (result.stdout || '').trim() };
}

async function status() {
  const result = await command(config.lpstatBinary, ['-p', config.printer, '-l']);
  const text = (result.stdout || '').trim();
  return { printer: config.printer, available: true, status: /disabled/i.test(text) ? 'disabled' : (/idle/i.test(text) ? 'idle' : 'printing'), raw: text };
}

async function options() {
  const result = await command(config.lpoptionsBinary, ['-p', config.printer, '-l']);
  return { printer: config.printer, raw: (result.stdout || '').trim() };
}

async function jobs() {
  const result = await command(config.lpstatBinary, ['-o', config.printer]);
  return (result.stdout || '').trim().split(/\r?\n/).filter(Boolean).map(line => {
    const parts = line.trim().split(/\s+/);
    return { jobId: parts[0], user: parts[1], size: parts[2], submitted: parts.slice(3).join(' ') };
  });
}

async function jobStatus(jobId) {
  if (!/^[A-Za-z0-9_.-]+-\d+$/.test(jobId)) {
    const error = new Error('Invalid CUPS job id');
    error.status = 400;
    throw error;
  }

  const result = await command(config.lpstatBinary, ['-W', 'not-completed', '-o', config.printer]);
  const line = (result.stdout || '').split(/\r?\n/).find(item => item.trim().startsWith(`${jobId} `));
  if (!line) return { jobId, status: 'unknown' };
  return { jobId, status: /processing|active/i.test(line) ? 'processing' : 'submitted' };
}

async function cancel(jobId) {
  if (!/^[A-Za-z0-9_.-]+-\d+$/.test(jobId)) {
    const error = new Error('Invalid CUPS job id');
    error.status = 400;
    throw error;
  }
  await command(config.cancelBinary, [jobId]);
  return { jobId, canceled: true };
}

module.exports = { submit, status, options, jobs, jobStatus, cancel, optionsToArgs };
