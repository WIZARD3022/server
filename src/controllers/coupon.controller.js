const db = require('../services/db.service');

// Helper: Normalize coupon code
const normalizeCode = (code) => {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase();
};

// Helper: Validate code format
const validateCodeFormat = (code) => {
  const norm = normalizeCode(code);
  if (norm.length < 3 || norm.length > 30) return false;
  return /^[A-Z0-9_-]+$/.test(norm);
};

// Core Coupon Validation & Calculation Engine (Server-Side Source of Truth)
const calculateCouponDiscount = async (rawCode, userId) => {
  const code = normalizeCode(rawCode);

  if (!validateCodeFormat(code)) {
    throw { statusCode: 400, message: 'Invalid coupon code format. Use 3-30 letters, numbers, or hyphens.', code: 'INVALID_FORMAT' };
  }

  // 1. Find coupon
  const coupon = await db.coupon.findFirst({ where: { code } });
  if (!coupon) {
    throw { statusCode: 404, message: 'Coupon code does not exist.', code: 'COUPON_NOT_FOUND' };
  }

  // 2. Check active
  if (!coupon.isActive) {
    throw { statusCode: 400, message: 'This coupon is currently inactive.', code: 'COUPON_INACTIVE' };
  }

  // 3. Check dates against server time
  const now = new Date();
  if (coupon.startsAt && new Date(coupon.startsAt) > now) {
    throw { statusCode: 400, message: 'This coupon is not yet available.', code: 'COUPON_NOT_STARTED' };
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
    throw { statusCode: 400, message: 'Coupon has expired.', code: 'COUPON_EXPIRED' };
  }

  // 4. Check global usage limit
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    throw { statusCode: 400, message: 'This coupon has reached its maximum global usage limit.', code: 'GLOBAL_LIMIT_REACHED' };
  }

  // 5. Check per-user limit
  if (coupon.perUserUsageLimit > 0) {
    const userRedemptionCount = await db.couponRedemption.count({
      where: { couponId: coupon.id, userId }
    });

    if (userRedemptionCount >= coupon.perUserUsageLimit) {
      throw { statusCode: 400, message: `You have already used this coupon the maximum number of times (${coupon.perUserUsageLimit}).`, code: 'USER_LIMIT_REACHED' };
    }
  }

  // 6. Fetch user's cart from database to calculate actual subtotal
  const cartItems = await db.cartItem.findMany({
    where: { userId, isSelected: true }
  });

  if (!cartItems || cartItems.length === 0) {
    throw { statusCode: 400, message: 'Your cart is empty or no items are selected.', code: 'CART_EMPTY' };
  }

  // 7. Calculate actual subtotal from DB product prices
  let shoppingSubtotal = 0;
  let printingSubtotal = 0;

  for (const item of cartItems) {
    let itemPrice = Number(item.price || 0);
    const itemQty = Number(item.quantity || 1);

    if (item.type === 'Shopping' && item.productId) {
      const dbProduct = await db.product.findUnique({ where: { id: item.productId } });
      if (dbProduct) {
        itemPrice = Number(dbProduct.price || 0);
      }
      shoppingSubtotal += itemPrice * itemQty;
    } else if (item.type === 'Printing') {
      printingSubtotal += itemPrice * itemQty;
    } else {
      shoppingSubtotal += itemPrice * itemQty;
    }
  }

  const totalCartSubtotal = shoppingSubtotal + printingSubtotal;

  // 8. Determine eligible amount based on applicableType
  let eligibleSubtotal = totalCartSubtotal;
  if (coupon.applicableType === 'SHOPPING_ONLY') {
    eligibleSubtotal = shoppingSubtotal;
  } else if (coupon.applicableType === 'PRINTING_ONLY') {
    eligibleSubtotal = printingSubtotal;
  }

  if (eligibleSubtotal <= 0) {
    throw { statusCode: 400, message: `This coupon is only applicable to ${coupon.applicableType === 'SHOPPING_ONLY' ? 'Shopping' : 'Printing'} items.`, code: 'NOT_APPLICABLE' };
  }

  // 9. Check minimum order requirement
  if (coupon.minimumOrderAmount > 0 && totalCartSubtotal < coupon.minimumOrderAmount) {
    throw { statusCode: 400, message: `Minimum order amount to use this coupon is ₹${coupon.minimumOrderAmount.toFixed(2)}.`, code: 'MIN_ORDER_NOT_MET' };
  }

  // 10. Calculate discount
  let discount = 0;
  if (coupon.discountType === 'FIXED') {
    discount = Number(coupon.discountValue || 0);
  } else if (coupon.discountType === 'PERCENTAGE') {
    discount = (eligibleSubtotal * Number(coupon.discountValue || 0)) / 100;
  }

  // 11. Cap discount at maximumDiscountAmount if set
  if (coupon.maximumDiscountAmount > 0 && discount > coupon.maximumDiscountAmount) {
    discount = coupon.maximumDiscountAmount;
  }

  // Ensure discount does not exceed eligible subtotal
  discount = Math.min(discount, eligibleSubtotal);

  // Round discount to 2 decimal places cleanly
  discount = Math.round(discount * 100) / 100;
  const finalAmount = Math.max(0, Math.round((totalCartSubtotal - discount) * 100) / 100);

  return {
    coupon,
    couponId: coupon.id,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    discountAmount: discount,
    subtotal: totalCartSubtotal,
    finalAmount
  };
};

// Customer Controller Methods

exports.applyCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Coupon code is required', error: { code: 'CODE_REQUIRED' } });
    }

    const calc = await calculateCouponDiscount(code, userId);

    res.json({
      success: true,
      message: 'Coupon applied successfully',
      data: {
        couponId: calc.couponId,
        code: calc.code,
        discountType: calc.discountType,
        discountValue: calc.discountValue,
        discountAmount: calc.discountAmount,
        subtotal: calc.subtotal,
        finalAmount: calc.finalAmount
      }
    });
  } catch (error) {
    const status = error.statusCode || 400;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to apply coupon',
      error: { code: error.code || 'APPLY_ERROR' }
    });
  }
};

exports.removeCoupon = async (req, res) => {
  try {
    const userId = req.user.id;
    const cartItems = await db.cartItem.findMany({
      where: { userId, isSelected: true }
    });

    let subtotal = 0;
    for (const item of cartItems) {
      let price = Number(item.price || 0);
      if (item.type === 'Shopping' && item.productId) {
        const p = await db.product.findUnique({ where: { id: item.productId } });
        if (p) price = Number(p.price || 0);
      }
      subtotal += price * Number(item.quantity || 1);
    }

    res.json({
      success: true,
      message: 'Coupon removed successfully',
      data: {
        subtotal: Math.round(subtotal * 100) / 100,
        discountAmount: 0,
        finalAmount: Math.round(subtotal * 100) / 100
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin Controller Methods

exports.getCoupons = async (req, res) => {
  try {
    const { search, status } = req.query;
    let where = {};

    if (search) {
      where.code = { contains: search.trim().toUpperCase(), mode: 'insensitive' };
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    const coupons = await db.coupon.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: coupons });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      minimumOrderAmount,
      maximumDiscountAmount,
      usageLimit,
      perUserUsageLimit,
      startsAt,
      expiresAt,
      isActive,
      applicableType
    } = req.body;

    const normCode = normalizeCode(code);
    if (!validateCodeFormat(normCode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coupon code format. Code must be 3-30 characters (letters, numbers, hyphen, underscore only).'
      });
    }

    const existing = await db.coupon.findFirst({ where: { code: normCode } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Coupon code "${normCode}" already exists.`
      });
    }

    const coupon = await db.coupon.create({
      data: {
        code: normCode,
        discountType: discountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED',
        discountValue: Math.max(0, Number(discountValue || 0)),
        minimumOrderAmount: Math.max(0, Number(minimumOrderAmount || 0)),
        maximumDiscountAmount: Math.max(0, Number(maximumDiscountAmount || 0)),
        usageLimit: Math.max(0, parseInt(usageLimit || 0)),
        usedCount: 0,
        perUserUsageLimit: Math.max(0, parseInt(perUserUsageLimit || 1)),
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: isActive !== false,
        applicableType: ['SHOPPING_ONLY', 'PRINTING_ONLY'].includes(applicableType) ? applicableType : 'ALL'
      }
    });

    res.status(201).json({ success: true, message: 'Coupon created successfully', data: coupon });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCouponById = async (req, res) => {
  try {
    const coupon = await db.coupon.findUnique({ where: { id: req.params.id } });
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    res.json({ success: true, data: coupon });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCouponStats = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await db.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });

    const redemptions = await db.couponRedemption.findMany({
      where: { couponId },
      orderBy: { createdAt: 'desc' }
    });

    const totalDiscountGranted = redemptions.reduce((sum, r) => sum + Number(r.discountAmount || 0), 0);
    const uniqueUserIds = new Set(redemptions.map(r => r.userId)).size;

    res.json({
      success: true,
      data: {
        coupon,
        stats: {
          usedCount: coupon.usedCount,
          usageLimit: coupon.usageLimit,
          remainingUses: coupon.usageLimit > 0 ? Math.max(0, coupon.usageLimit - coupon.usedCount) : 'Unlimited',
          perUserUsageLimit: coupon.perUserUsageLimit,
          totalDiscountGranted: Math.round(totalDiscountGranted * 100) / 100,
          totalRedemptions: redemptions.length,
          uniqueUsersCount: uniqueUserIds
        },
        redemptions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const {
      discountType,
      discountValue,
      minimumOrderAmount,
      maximumDiscountAmount,
      usageLimit,
      perUserUsageLimit,
      startsAt,
      expiresAt,
      isActive,
      applicableType
    } = req.body;

    const existing = await db.coupon.findUnique({ where: { id: couponId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Coupon not found' });

    const updated = await db.coupon.update({
      where: { id: couponId },
      data: {
        discountType: discountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED',
        discountValue: Math.max(0, Number(discountValue || 0)),
        minimumOrderAmount: Math.max(0, Number(minimumOrderAmount || 0)),
        maximumDiscountAmount: Math.max(0, Number(maximumDiscountAmount || 0)),
        usageLimit: Math.max(0, parseInt(usageLimit || 0)),
        perUserUsageLimit: Math.max(0, parseInt(perUserUsageLimit || 1)),
        startsAt: startsAt ? new Date(startsAt) : existing.startsAt,
        expiresAt: expiresAt ? new Date(expiresAt) : existing.expiresAt,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        applicableType: ['SHOPPING_ONLY', 'PRINTING_ONLY'].includes(applicableType) ? applicableType : existing.applicableType
      }
    });

    res.json({ success: true, message: 'Coupon updated successfully', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleCouponStatus = async (req, res) => {
  try {
    const couponId = req.params.id;
    const existing = await db.coupon.findUnique({ where: { id: couponId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Coupon not found' });

    const updated = await db.coupon.update({
      where: { id: couponId },
      data: { isActive: !existing.isActive }
    });

    res.json({
      success: true,
      message: `Coupon "${updated.code}" is now ${updated.isActive ? 'Active' : 'Inactive'}`,
      data: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const existing = await db.coupon.findUnique({ where: { id: couponId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Coupon not found' });

    // If coupon has been used in redemptions, soft-deactivate instead of deleting to preserve order history
    if (existing.usedCount > 0) {
      await db.coupon.update({
        where: { id: couponId },
        data: { isActive: false }
      });
      return res.json({ success: true, message: 'Coupon has historical redemptions, so it was set to Inactive to preserve order records.' });
    }

    await db.coupon.delete({ where: { id: couponId } });
    res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports.calculateCouponDiscount = calculateCouponDiscount;
