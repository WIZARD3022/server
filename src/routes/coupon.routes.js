const express = require('express');
const router = express.Router();
const couponController = require('../controllers/coupon.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth.middleware');

// Customer Routes (Authenticated Users)
router.post('/apply', authMiddleware, couponController.applyCoupon);
router.post('/remove', authMiddleware, couponController.removeCoupon);

// Admin Routes (Admin Authorization Required)
router.get('/', authMiddleware, adminMiddleware, couponController.getCoupons);
router.post('/', authMiddleware, adminMiddleware, couponController.createCoupon);
router.get('/:id', authMiddleware, adminMiddleware, couponController.getCouponById);
router.get('/:id/stats', authMiddleware, adminMiddleware, couponController.getCouponStats);
router.put('/:id', authMiddleware, adminMiddleware, couponController.updateCoupon);
router.patch('/:id/status', authMiddleware, adminMiddleware, couponController.toggleCouponStatus);
router.put('/:id/status', authMiddleware, adminMiddleware, couponController.toggleCouponStatus);
router.delete('/:id', authMiddleware, adminMiddleware, couponController.deleteCoupon);

module.exports = router;
