const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminController = require('../controllers/admin.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth.middleware');

const shoppingController = require('../controllers/shopping.controller');

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.use(authMiddleware, adminMiddleware);

router.get('/orders', adminController.getAllOrders);
router.put('/orders/:id/status', adminController.updateOrderStatus);
router.get('/stats', adminController.getStats);
router.post('/decode-qr', memoryUpload.single('file'), adminController.decodeQr);
router.get('/support-tickets', adminController.getSupportTickets);
router.post('/support-tickets/:ticketId/reply', adminController.replySupportTicket);
router.post('/announcements', adminController.broadcastAnnouncement);
router.get('/announcements', adminController.getAnnouncements);

// Pickup Points Management
router.get('/pickup-points', shoppingController.getAllPickupPoints);
router.post('/pickup-points', shoppingController.createPickupPoint);
router.put('/pickup-points/:id', shoppingController.updatePickupPoint);
router.patch('/pickup-points/:id/status', shoppingController.togglePickupPointStatus);
router.delete('/pickup-points/:id', shoppingController.deletePickupPoint);

module.exports = router;
