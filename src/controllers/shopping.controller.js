const db = require('../services/db.service');
const { sendOrderEmail } = require('../services/mail.service');

const fixUrl = (url) => {
  if (!url || !process.env.BASE_URL) return url;
  // If the URL contains the old IP/Port, replace it with the clean BASE_URL
  if (url.includes('147.79.68.196:5000')) {
    return url.replace(/http:\/\/147\.79\.68\.196:5000/g, process.env.BASE_URL);
  }
  return url;
};

// --- Categories ---
exports.getCategories = async (req, res) => {
  try {
    const categories = await db.category.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' }
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const category = await db.category.create({
      data: {
        ...req.body,
        order: parseInt(req.body.order) || 0
      }
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await db.category.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        order: req.body.order !== undefined ? parseInt(req.body.order) : undefined
      }
    });
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    await db.category.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Products ---
exports.getProducts = async (req, res) => {
  try {
    const { category, featured, trending, bestSeller, dealOfDay, search } = req.query;

    const where = {};
    if (category && category !== 'General') where.category = category;
    if (featured === 'true') where.isFeatured = true;
    if (trending === 'true') where.isTrending = true;
    if (bestSeller === 'true') where.isBestSeller = true;
    if (dealOfDay === 'true') where.isDealOfTheDay = true;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const products = await db.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' }
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await db.product.findUnique({
      where: { id: req.params.id }
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.id;

    const product = await db.product.create({
      data: {
        ...data,
        price: parseFloat(data.price),
        originalPrice: data.originalPrice ? parseFloat(data.originalPrice) : 0,
        stock: parseInt(data.stock) || 0,
        discountPercentage: parseFloat(data.discountPercentage) || 0,
        averageRating: parseFloat(data.averageRating) || 0,
        totalReviews: parseInt(data.totalReviews) || 0
      }
    });
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const data = { ...req.body };
    const id = req.params.id;
    delete data.id;

    const product = await db.product.update({
      where: { id },
      data: {
        ...data,
        price: data.price !== undefined ? parseFloat(data.price) : undefined,
        originalPrice: data.originalPrice !== undefined ? parseFloat(data.originalPrice) : undefined,
        stock: data.stock !== undefined ? parseInt(data.stock) : undefined,
        discountPercentage: data.discountPercentage !== undefined ? parseFloat(data.discountPercentage) : undefined,
        averageRating: data.averageRating !== undefined ? parseFloat(data.averageRating) : undefined,
        totalReviews: data.totalReviews !== undefined ? parseInt(data.totalReviews) : undefined
      }
    });
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await db.product.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Reviews ---
exports.getReviews = async (req, res) => {
  try {
    const reviews = await db.review.findMany({
      where: { productId: req.params.id },
      orderBy: { timestamp: 'desc' }
    });

    const userIds = [...new Set(reviews.map(r => r.userId).filter(Boolean))];
    const users = await db.user.findMany({
      where: { id: { in: userIds } }
    });

    const userMap = {};
    users.forEach(u => {
      userMap[u.id] = u.fullName || u.email?.split('@')[0] || 'UniKart Student';
    });

    const populatedReviews = reviews.map(r => ({
      ...r,
      userName: userMap[r.userId] || 'UniKart Student',
      reviewText: r.comment || r.reviewText || ''
    }));

    res.json({ success: true, data: populatedReviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserReviews = async (req, res) => {
  try {
    const reviews = await db.review.findMany({
      where: { userId: req.user.id },
      orderBy: { timestamp: 'desc' }
    });

    const productIds = reviews.map(r => r.productId);
    const products = await db.product.findMany({ where: { id: { in: productIds } } });
    const productMap = {};
    products.forEach(p => { productMap[p.id] = p.name; });

    const data = reviews.map(r => ({
      ...r,
      productName: productMap[r.productId] || 'Product',
      reviewText: r.comment || ''
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addReview = async (req, res) => {
  try {
    const { rating, comment, reviewText } = req.body;
    const productId = req.params.id || req.body.productId;

    const review = await db.review.create({
      data: {
        userId: req.user.id,
        productId,
        rating: Number(rating) || 5,
        comment: comment || reviewText || ''
      }
    });

    const allReviews = await db.review.findMany({ where: { productId } });
    const totalReviews = allReviews.length;
    const averageRating = allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / (totalReviews || 1);

    await db.product.update({
      where: { id: productId },
      data: { averageRating, totalReviews }
    });

    const user = await db.user.findUnique({ where: { id: req.user.id } });
    const populatedReview = {
      ...review,
      userName: user?.fullName || 'UniKart Student',
      reviewText: review.comment || ''
    };

    res.status(201).json({ success: true, data: populatedReview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    await db.review.delete({
      where: { id: req.params.id, userId: req.user.id }
    });
    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Banners ---
exports.getBanners = async (req, res) => {
  try {
    const { active } = req.query;
    const where = active === 'true' ? { isActive: true } : {};
    const banners = await db.banner.findMany({
      where,
      orderBy: { order: 'asc' }
    });

    const fixedBanners = banners.map(b => ({ ...b, imageUrl: fixUrl(b.imageUrl) }));
    res.json({ success: true, data: fixedBanners });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createBanner = async (req, res) => {
  try {
    const banner = await db.banner.create({
      data: {
        ...req.body,
        order: parseInt(req.body.order) || 0
      }
    });
    res.json({ success: true, data: banner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateBanner = async (req, res) => {
  try {
    const banner = await db.banner.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        order: req.body.order !== undefined ? parseInt(req.body.order) : undefined
      }
    });
    res.json({ success: true, data: banner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteBanner = async (req, res) => {
  try {
    await db.banner.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Banner deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Super High Speed Home API ---
exports.getHomeData = async (req, res) => {
  try {
    const [categories, banners, featured, trending, bestSellers, dealOfDay] = await Promise.all([
      db.category.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
      db.banner.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
      db.product.findMany({ where: { isFeatured: true, isAvailable: true }, take: 6 }),
      db.product.findMany({ where: { isTrending: true, isAvailable: true }, take: 6 }),
      db.product.findMany({ where: { isBestSeller: true, isAvailable: true }, take: 6 }),
      db.product.findMany({ where: { isDealOfTheDay: true, isAvailable: true }, take: 6 })
    ]);

    res.json({
      success: true,
      data: {
        categories,
        banners: banners.map(b => ({ ...b, imageUrl: fixUrl(b.imageUrl) })),
        sections: {
          featured: featured.map(p => ({ ...p, images: p.images.map(fixUrl) })),
          trending: trending.map(p => ({ ...p, images: p.images.map(fixUrl) })),
          bestSellers: bestSellers.map(p => ({ ...p, images: p.images.map(fixUrl) })),
          dealOfDay: dealOfDay.map(p => ({ ...p, images: p.images.map(fixUrl) }))
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Wishlist ---
exports.getWishlistIds = async (req, res) => {
  try {
    const wishlist = await db.wishlist.findMany({
      where: { userId: req.user.id },
      select: { productId: true }
    });
    res.json({ success: true, data: wishlist.map(item => item.productId) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getWishlistProducts = async (req, res) => {
  try {
    const wishlist = await db.wishlist.findMany({
      where: { userId: req.user.id }
    });

    const productIds = wishlist.map(item => item.productId);

    const products = await db.product.findMany({
      where: {
        id: { in: productIds }
      }
    });

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user.id;

    const existing = await db.wishlist.findFirst({
      where: { userId, productId }
    });

    if (existing) {
      await db.wishlist.delete({
        where: { id: existing.id }
      });
      res.json({ success: true, message: 'Removed from wishlist', isAdded: false });
    } else {
      await db.wishlist.create({
        data: { userId, productId }
      });
      res.json({ success: true, message: 'Added to wishlist', isAdded: true });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Orders ---
exports.createOrder = async (req, res) => {
  try {
    const { items, totalAmount, paymentMethod, pickupPoint, type, discount, redeemPoints, pointsRedeemed } = req.body;
    const userId = req.user.id;

    const result = await db.$transaction(async (tx) => {
      // 1. Verify and deduct product stock for shopping items
      for (const item of items) {
        const productId = item.productId || (item.type === 'Shopping' ? item.id : null);
        if (productId) {
          const product = await tx.product.findUnique({ where: { id: productId } });
          if (product) {
            const requestedQty = parseInt(item.quantity) || 1;
            if (product.stock < requestedQty) {
              throw new Error(`Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${requestedQty}`);
            }
            const newStock = Math.max(0, product.stock - requestedQty);
            await tx.product.update({
              where: { id: productId },
              data: {
                stock: newStock,
                isAvailable: newStock > 0
              }
            });
          }
        }
      }

      // 2. Handle Points Redemption if selected by user
      if ((redeemPoints || pointsRedeemed > 0) && parseInt(pointsRedeemed) > 0) {
        const user = await tx.user.findUnique({ where: { id: userId } });
        const actualDeduct = Math.min(user.rewardPoints || 0, parseInt(pointsRedeemed));
        if (actualDeduct > 0) {
          await tx.user.update({
            where: { id: userId },
            data: {
              rewardPoints: { decrement: actualDeduct }
            }
          });
        }
      }

      // 3. Award Reward Points ONLY for Paid Online Transactions (Not COD, Not ₹0 Orders)
      const isOnlinePayment = paymentMethod !== 'COD' && paymentMethod !== 'Reward Points' && parseFloat(totalAmount) > 0;
      if (isOnlinePayment) {
        const pointsEarned = Math.floor(parseFloat(totalAmount) / 10);
        if (pointsEarned > 0) {
          await tx.user.update({
            where: { id: userId },
            data: {
              rewardPoints: { increment: pointsEarned }
            }
          });
        }
      }

      // 4. Verify and Update Wallet if needed
      if (paymentMethod === 'Wallet') {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (user.walletBalance < totalAmount) {
          throw new Error('Insufficient wallet balance');
        }

        await tx.user.update({
          where: { id: userId },
          data: {
            walletBalance: { decrement: totalAmount }
          }
        });

        // Record Wallet Transaction
        await tx.transaction.create({
          data: {
            userId,
            title: `Order #${type}`,
            amount: totalAmount,
            type: 'DEBIT',
            icon: 'shopping',
            paymentMethod: 'Wallet'
          }
        });
      }

      // 5. Create Order
      const orderNumber = `#UK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          type,
          totalAmount: parseFloat(totalAmount),
          discount: parseFloat(discount || 0),
          paymentMethod,
          pickupPoint,
          config: { items },
          status: 'ORDER_RECEIVED'
        }
      });

      // 3. Create Print Jobs for printing items
      for (const item of items) {
        if (item.type === 'Printing' || item.type === 'print') {
          const config = item.config || {};
          await tx.printJob.create({
            data: {
              userId,
              orderId: order.id,
              originalName: item.productName || item.title || 'Document',
              file: config.documentUrl || '',
              status: 'pending',
              options: {
                copies: parseInt(item.quantity) || 1,
                paperSize: config.paperSize || 'A4',
                color: config.printingType === 'Color' ? 'color' : 'monochrome',
                duplex: config.duplex || false,
                quality: config.quality || 'normal',
                scaling: config.scaling || 'fit',
                binding: config.binding && config.binding !== 'None',
                folders: config.folders || 0,
                // Include any other relevant config
                ...config
              }
            }
          });
        }
      }

      // 4. Clear Cart for the items placed (simplified: clear all for now)
      await tx.cartItem.deleteMany({ where: { userId } });

      // 5. Create Notification
      await tx.notification.create({
        data: {
          userId,
          title: 'Order Placed Successfully!',
          message: `Your order ${orderNumber} for ${items.length} items has been received.`,
          icon: 'shopping'
        }
      });

      return order;
    });

    const user = await db.user.findUnique({ where: { id: userId } });
    res.status(201).json({ success: true, data: result });
    sendOrderEmail(user, result).catch(error => console.error('Order email error:', error.message));
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getUserOrders = async (req, res) => {
  try {
    const orders = await db.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
