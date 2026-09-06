const cups = require('../services/cups.service');
const printerService = require('../services/printer.service');
const config = require('../config/printer');
const PrintJob = require('../models').PrintJob;

const responseJob = job => ({ id: String(job._id), jobId: job.cupsJobId, status: job.status, originalName: job.originalName, size: job.size, options: job.options, createdAt: job.createdAt, updatedAt: job.updatedAt });
const canAccess = (req, job) => req.user.role === 'ADMIN' || String(job.userId) === String(req.user.id);
const notFound = () => { const e = new Error('Print job not found'); e.status = 404; return e; };

exports.print = async (req, res, next) => {
  try {
    const job = await printerService.submit(req.file, req.body, req.user);
    res.status(201).json({ success: true, data: responseJob(job) });
  } catch (error) { if (req.file) await printerService.clean(req.file.path); next(error); }
};
exports.status = async (req, res, next) => { try { res.json({ success: true, data: await cups.status() }); } catch (e) { next(e); } };
exports.options = async (req, res, next) => { try { res.json({ success: true, data: await cups.options() }); } catch (e) { next(e); } };
exports.listJobs = async (req, res, next) => {
  try {
    const filter = req.user.role === 'ADMIN' ? {} : { userId: req.user.id };
    const jobs = await PrintJob.find(filter).sort({ createdAt: -1 }).limit(config.maxJobs).lean();
    res.json({ success: true, data: jobs.map(responseJob) });
  } catch (e) { next(e); }
};
exports.getJob = async (req, res, next) => {
  try {
    const job = await PrintJob.findOne({ cupsJobId: req.params.jobId }).lean();
    if (!job || !canAccess(req, job)) throw (job ? Object.assign(new Error('Access denied'), { status: 403 }) : notFound());
    if (!['completed', 'cancelled', 'failed'].includes(job.status)) {
      const current = await cups.jobStatus(job.cupsJobId);
      if (current.status !== 'unknown' && current.status !== job.status) {
        await PrintJob.updateOne({ _id: job._id }, { $set: { status: current.status } });
        job.status = current.status;
      }
    }
    res.json({ success: true, data: responseJob(job) });
  } catch (e) { next(e); }
};
exports.cancelJob = async (req, res, next) => {
  try {
    const job = await PrintJob.findOne({ cupsJobId: req.params.jobId });
    if (!job || !canAccess(req, job)) throw (job ? Object.assign(new Error('Access denied'), { status: 403 }) : notFound());
    if (['completed', 'cancelled', 'failed'].includes(job.status)) { const e = new Error('Print job cannot be canceled in its current state'); e.status = 400; throw e; }
    await cups.cancel(job.cupsJobId);
    job.status = 'cancelled';
    await job.save();
    res.json({ success: true, data: responseJob(job.toObject()) });
  } catch (e) { next(e); }
};
