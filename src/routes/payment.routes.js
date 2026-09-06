const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

router.post('/create-order', authMiddleware, paymentController.createOrder);
router.post('/verify', authMiddleware, paymentController.verifyPayment);
router.post('/transfer', authMiddleware, paymentController.transferMoney);
router.get('/history', authMiddleware, paymentController.getHistory);
router.get('/balance', authMiddleware, paymentController.getBalance);
router.post('/redeem-points', authMiddleware, paymentController.redeemPoints);

module.exports = router;
