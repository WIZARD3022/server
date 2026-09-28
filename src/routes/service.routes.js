const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/service.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth.middleware');

// Public/Customer Routes
router.get('/', serviceController.getServices);
router.get('/my-bookings', authMiddleware, serviceController.getUserBookings);
router.get('/:id', serviceController.getServiceById);
router.post('/book', authMiddleware, serviceController.createBooking);

// Admin Routes
router.get('/admin/all', authMiddleware, adminMiddleware, serviceController.getAllServices);
router.post('/admin/create', authMiddleware, adminMiddleware, serviceController.createService);
router.put('/admin/:id', authMiddleware, adminMiddleware, serviceController.updateService);
router.delete('/admin/:id', authMiddleware, adminMiddleware, serviceController.deleteService);
router.get('/admin/bookings', authMiddleware, adminMiddleware, serviceController.getAllBookings);
router.put('/admin/bookings/:id/status', authMiddleware, adminMiddleware, serviceController.updateBookingStatus);

module.exports = router;
