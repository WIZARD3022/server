const express = require('express');
const router = express.Router();
const printingController = require('../controllers/printing.controller');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');

router.get('/rates', printingController.getRates);
router.put('/rates', authMiddleware, authorize('ADMIN'), printingController.updateRates);

module.exports = router;
