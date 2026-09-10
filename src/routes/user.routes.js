const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

router.get('/profile', authMiddleware, userController.getProfile);
router.put('/profile', authMiddleware, userController.updateProfile);
router.post('/set-password', authMiddleware, userController.setPassword);
router.get('/lookup', authMiddleware, userController.lookupUser);
router.get('/sendcode', authMiddleware, userController.sendcode);
router.get('/verify', authMiddleware, userController.verifymail);

// Addresses
router.get('/addresses', authMiddleware, userController.getAddresses);
router.post('/addresses', authMiddleware, userController.addAddress);
router.put('/addresses/:id', authMiddleware, userController.updateAddress);
router.put('/addresses/:id/default', authMiddleware, userController.setDefaultAddress);
router.delete('/addresses/:id', authMiddleware, userController.deleteAddress);

// Support
router.post('/support-ticket', authMiddleware, userController.createSupportTicket);
router.get('/support-tickets', authMiddleware, userController.getUserSupportTickets);

module.exports = router;
