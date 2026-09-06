const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware').authMiddleware;
const printerUpload = require('../middleware/printer-upload.middleware');
const controller = require('../controllers/printer.controller');

router.post('/print', auth, printerUpload.normal, controller.print);
router.post('/print/normal', auth, printerUpload.normal, controller.print);
router.post('/print/express', auth, printerUpload.express, controller.print);
router.get('/status', auth, controller.status);
router.get('/options', auth, controller.options);
router.get('/jobs', auth, controller.listJobs);
router.get('/jobs/:jobId', auth, controller.getJob);
router.delete('/jobs/:jobId', auth, controller.cancelJob);
module.exports = router;
