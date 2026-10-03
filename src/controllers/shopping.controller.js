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

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { shortDescription: { contains: term, mode: 'insensitive' } },
        { category: { contains: term, mode: 'insensitive' } },
        { brand: { contains: term, mode: 'insensitive' } }
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
    const { items, totalAmount, paymentMethod, pickupPoint, type, discount, couponCode, redeemPoints, pointsRedeemed } = req.body;
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

      // 2. Validate and Atomically Redeem Coupon if provided
      let appliedCoupon = null;
      let calculatedCouponDiscount = 0;

      if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
        const normCode = couponCode.trim().toUpperCase();
        const coupon = await tx.coupon.findFirst({ where: { code: normCode } });

        if (!coupon) throw new Error(`Coupon code "${normCode}" does not exist.`);
        if (!coupon.isActive) throw new Error(`Coupon "${normCode}" is currently inactive.`);
        if (coupon.startsAt && new Date(coupon.startsAt) > new Date()) throw new Error(`Coupon "${normCode}" is not yet available.`);
        if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) throw new Error(`Coupon "${normCode}" has expired.`);

        // Global usage limit check
        if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
          throw new Error(`Coupon "${normCode}" has reached its maximum global usage limit.`);
        }

        // Per-user usage limit check
        if (coupon.perUserUsageLimit > 0) {
          const userRedemptionCount = await tx.couponRedemption.count({
            where: { couponId: coupon.id, userId }
          });

          if (userRedemptionCount >= coupon.perUserUsageLimit) {
            throw new Error(`You have already used coupon "${normCode}" the maximum number of times.`);
          }
        }

        // Calculate subtotal & print type restrictions
        let shoppingSubtotal = 0;
        let printingSubtotal = 0;
        let eligiblePrintingSubtotal = 0;
        let matchingPrintItemsCount = 0;

        const printTypeRestr = coupon.printTypeRestriction || 'ANY';

        for (const item of items) {
          const qty = Number(item.quantity || 1);
          const price = Number(item.price || 0);

          if (item.type === 'Printing' || item.type === 'print') {
            const itemCost = price * qty;
            printingSubtotal += itemCost;

            const config = item.config || {};
            const isColor = config.color === 'color' || config.printingType === 'Color';

            let isPrintTypeMatch = true;
            if (printTypeRestr === 'BW_ONLY' && isColor) isPrintTypeMatch = false;
            if (printTypeRestr === 'COLOR_ONLY' && !isColor) isPrintTypeMatch = false;

            if (isPrintTypeMatch) {
              eligiblePrintingSubtotal += itemCost;
              matchingPrintItemsCount++;
            }
          } else {
            shoppingSubtotal += price * qty;
          }
        }

        const totalCartSubtotal = shoppingSubtotal + printingSubtotal;

        if (printTypeRestr !== 'ANY' && matchingPrintItemsCount === 0) {
          throw new Error(`Coupon "${normCode}" is only applicable to ${printTypeRestr === 'BW_ONLY' ? 'Black & White' : 'Color'} print jobs.`);
        }

        let eligibleSubtotal = totalCartSubtotal;
        if (coupon.applicableType === 'SHOPPING_ONLY') eligibleSubtotal = shoppingSubtotal;
        else if (coupon.applicableType === 'PRINTING_ONLY') eligibleSubtotal = eligiblePrintingSubtotal;
        else if (printTypeRestr !== 'ANY') eligibleSubtotal = shoppingSubtotal + eligiblePrintingSubtotal;

        if (coupon.minimumOrderAmount > 0 && totalCartSubtotal < coupon.minimumOrderAmount) {
          throw new Error(`Minimum order amount for coupon "${normCode}" is ₹${coupon.minimumOrderAmount.toFixed(2)}.`);
        }

        if (coupon.discountType === 'FIXED') {
          calculatedCouponDiscount = Number(coupon.discountValue || 0);
        } else if (coupon.discountType === 'PERCENTAGE') {
          calculatedCouponDiscount = (eligibleSubtotal * Number(coupon.discountValue || 0)) / 100;
        } else if (coupon.discountType === 'PER_PAGE_RATE') {
          const specialRate = Math.max(0, Number(coupon.discountValue || 0));
          let customRateDiscount = 0;

          for (const item of items) {
            if (item.type === 'Printing' || item.type === 'print') {
              const config = item.config || {};
              const isColor = config.color === 'color' || config.printingType === 'Color';

              let isPrintTypeMatch = true;
              if (printTypeRestr === 'BW_ONLY' && isColor) isPrintTypeMatch = false;
              if (printTypeRestr === 'COLOR_ONLY' && !isColor) isPrintTypeMatch = false;

              if (isPrintTypeMatch) {
                const itemQty = Number(item.quantity || 1);
                const itemPrice = Number(item.price || 0);
                const totalItemCost = itemPrice * itemQty;

                const pagesPerCopy = Number(config.pages || 1);
                const totalPages = pagesPerCopy * itemQty;
                const specialCost = totalPages * specialRate;

                if (totalItemCost > specialCost) {
                  customRateDiscount += (totalItemCost - specialCost);
                }
              }
            }
          }

          calculatedCouponDiscount = customRateDiscount;
        }

        if (coupon.maximumDiscountAmount > 0) {
          calculatedCouponDiscount = Math.min(calculatedCouponDiscount, coupon.maximumDiscountAmount);
        }

        calculatedCouponDiscount = Math.min(calculatedCouponDiscount, eligibleSubtotal);
        calculatedCouponDiscount = Math.round(calculatedCouponDiscount * 100) / 100;

        // Atomically increment coupon usage count
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usedCount: { increment: 1 } }
        });

        appliedCoupon = coupon;
      }

      // 3. Handle Points Redemption if selected by user
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

      // 4. Award Reward Points for All Paid Transactions (Minimum 1 Point for any paid order, 1 Point per ₹10 spent)
      const isPaidOrder = paymentMethod !== 'Reward Points' && parseFloat(totalAmount) > 0;
      if (isPaidOrder) {
        const orderVal = parseFloat(totalAmount);
        const pointsEarned = Math.max(1, Math.floor(orderVal / 10));
        await tx.user.update({
          where: { id: userId },
          data: {
            rewardPoints: { increment: pointsEarned }
          }
        });
      }

      // 5. Verify and Update Wallet if needed
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

      // 6. Create Order with coupon details stored on order
      const orderNumber = `#UK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const totalDiscountApplied = parseFloat(discount || 0) + (calculatedCouponDiscount || 0);

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          type,
          totalAmount: parseFloat(totalAmount),
          discount: totalDiscountApplied,
          paymentMethod,
          pickupPoint,
          config: {
            items,
            couponId: appliedCoupon ? appliedCoupon.id : null,
            couponCode: appliedCoupon ? appliedCoupon.code : null,
            couponDiscount: calculatedCouponDiscount
          },
          status: 'ORDER_RECEIVED'
        }
      });

      // 7. Record Coupon Redemption
      if (appliedCoupon) {
        await tx.couponRedemption.create({
          data: {
            couponId: appliedCoupon.id,
            code: appliedCoupon.code,
            userId,
            orderId: order.id,
            discountAmount: calculatedCouponDiscount
          }
        });
      }

      // 3. Create Print Jobs for printing items
      for (const item of items) {
        if (item.type === 'Printing' || item.type === 'print') {
          const config = item.config || {};
          const fileplace = config.documentUrl.split('uploads/')[1].split('/')[1] || '';
          console.log("file url:", fileplace);
          await tx.printJob.create({
            data: {
              userId,
              orderId: order.id,
              uploadFilename: item.productName || item.title || 'Document',
              originalName: fileplace,
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

// --- Pickup Points ---
const DEFAULT_PICKUP_POINTS = [
  { name: 'Main Library Gateway', description: 'Near Central Library Main Entrance, Gate 2', order: 1 },
  { name: 'Hostel Block A Lobby', description: 'Hostel A Reception Counter', order: 2 },
  { name: 'Hostel Block B Lobby', description: 'Hostel B Reception Counter', order: 3 },
  { name: 'Student Center Cafeteria', description: 'Food Court Entrance Station', order: 4 },
  { name: 'Engineering Building Plaza', description: 'Block E Ground Floor Kiosk', order: 5 },
  { name: 'Medical College Reception', description: 'Medical Block Main Desk', order: 6 },
];

exports.getPickupPoints = async (req, res) => {
  try {
    let points = await db.pickupPoint.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' }
    });

    if (!points || points.length === 0) {
      for (const pt of DEFAULT_PICKUP_POINTS) {
        await db.pickupPoint.create({ data: { ...pt, isActive: true } });
      }
      points = await db.pickupPoint.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' }
      });
    }

    res.json({ success: true, data: points });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllPickupPoints = async (req, res) => {
  try {
    let points = await db.pickupPoint.findMany({
      orderBy: { order: 'asc' }
    });

    if (!points || points.length === 0) {
      for (const pt of DEFAULT_PICKUP_POINTS) {
        await db.pickupPoint.create({ data: { ...pt, isActive: true } });
      }
      points = await db.pickupPoint.findMany({
        orderBy: { order: 'asc' }
      });
    }

    res.json({ success: true, data: points });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createPickupPoint = async (req, res) => {
  try {
    const { name, description, imageUrl, isActive, order } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Pickup point name is required' });
    }

    const point = await db.pickupPoint.create({
      data: {
        name: name.trim(),
        description: (description || '').trim(),
        imageUrl: (imageUrl || '').trim(),
        isActive: isActive !== false,
        order: Number(order || 0)
      }
    });

    res.status(201).json({ success: true, message: 'Pickup point created', data: point });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePickupPoint = async (req, res) => {
  try {
    const { name, description, imageUrl, isActive, order } = req.body;
    const { id } = req.params;

    const existing = await db.pickupPoint.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Pickup point not found' });

    const updated = await db.pickupPoint.update({
      where: { id },
      data: {
        name: name ? name.trim() : existing.name,
        description: description !== undefined ? description.trim() : existing.description,
        imageUrl: imageUrl !== undefined ? imageUrl.trim() : existing.imageUrl,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        order: order !== undefined ? Number(order) : existing.order
      }
    });

    res.json({ success: true, message: 'Pickup point updated', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.togglePickupPointStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.pickupPoint.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Pickup point not found' });

    const updated = await db.pickupPoint.update({
      where: { id },
      data: { isActive: !existing.isActive }
    });

    res.json({ success: true, message: `Pickup point is now ${updated.isActive ? 'Active' : 'Inactive'}`, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deletePickupPoint = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.pickupPoint.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Pickup point not found' });

    await db.pickupPoint.delete({ where: { id } });
    res.json({ success: true, message: 'Pickup point deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
