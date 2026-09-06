const db = require('../services/db.service');

exports.getCart = async (req, res) => {
  try {
    const items = await db.cartItem.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addItem = async (req, res) => {
  try {
    const { productId, title, type, price, quantity, config, imageUrl } = req.body;
    const userId = req.user.id;

    // If it's a shopping item, check if it already exists in the cart to merge
    if (type === 'Shopping' && productId) {
      const existingItem = await db.cartItem.findFirst({
        where: { userId, productId }
      });

      if (existingItem) {
        const updatedItem = await db.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + (quantity || 1) }
        });
        return res.json({ success: true, data: updatedItem, merged: true });
      }
    }

    const item = await db.cartItem.create({
      data: {
        userId,
        productId, title, type,
        price: parseFloat(price),
        quantity: parseInt(quantity) || 1,
        config, imageUrl,
        isSelected: true
      }
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Cart addItem error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateQuantity = async (req, res) => {
  try {
    const item = await db.cartItem.update({
      where: { id: req.params.id, userId: req.user.id },
      data: { quantity: parseInt(req.body.quantity) }
    });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleSelection = async (req, res) => {
  try {
    const item = await db.cartItem.update({
      where: { id: req.params.id, userId: req.user.id },
      data: { isSelected: req.body.isSelected }
    });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeItem = async (req, res) => {
  try {
    await db.cartItem.delete({
      where: { id: req.params.id, userId: req.user.id }
    });
    res.json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.clearCart = async (req, res) => {
  try {
    await db.cartItem.deleteMany({ where: { userId: req.user.id } });
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
