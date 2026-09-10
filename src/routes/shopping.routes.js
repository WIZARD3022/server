const express = require('express');
const router = express.Router();
const shoppingController = require('../controllers/shopping.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth.middleware');

// Public
router.get('/home', shoppingController.getHomeData);
router.get('/categories', shoppingController.getCategories);
router.get('/products', shoppingController.getProducts);
router.get('/products/:id', shoppingController.getProductById);
router.get('/products/:id/reviews', shoppingController.getReviews);
router.get('/banners', shoppingController.getBanners);
router.get('/pickup-points', shoppingController.getPickupPoints);

// Wishlist (Authenticated)
router.get('/wishlist/ids', authMiddleware, shoppingController.getWishlistIds);
router.get('/wishlist', authMiddleware, shoppingController.getWishlistProducts);
router.post('/wishlist/toggle', authMiddleware, shoppingController.toggleWishlist);

// Reviews (Authenticated)
router.get('/my-reviews', authMiddleware, shoppingController.getUserReviews);
router.post('/products/:id/reviews', authMiddleware, shoppingController.addReview);
router.delete('/reviews/:id', authMiddleware, shoppingController.deleteReview);

// Orders (Authenticated)
router.get('/orders', authMiddleware, shoppingController.getUserOrders);
router.post('/orders', authMiddleware, shoppingController.createOrder);

// Admin only
router.post('/categories', authMiddleware, adminMiddleware, shoppingController.createCategory);
router.put('/categories/:id', authMiddleware, adminMiddleware, shoppingController.updateCategory);
router.delete('/categories/:id', authMiddleware, adminMiddleware, shoppingController.deleteCategory);

router.post('/products', authMiddleware, adminMiddleware, shoppingController.createProduct);
router.put('/products/:id', authMiddleware, adminMiddleware, shoppingController.updateProduct);
router.delete('/products/:id', authMiddleware, adminMiddleware, shoppingController.deleteProduct);

router.post('/banners', authMiddleware, adminMiddleware, shoppingController.createBanner);
router.put('/banners/:id', authMiddleware, adminMiddleware, shoppingController.updateBanner);
router.delete('/banners/:id', authMiddleware, adminMiddleware, shoppingController.deleteBanner);

module.exports = router;
