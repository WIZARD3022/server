const db = require('../services/db.service');
const { sendCompletionEmail, sendCancellationEmail } = require('../services/mail.service');
const { Jimp } = require('jimp');
const jsQR = require('jsqr');

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await db.order.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const userIds = [...new Set(orders.map(o => o.userId).filter(Boolean))];
    const users = await db.user.findMany({
      where: { id: { in: userIds } }
    });

    const userMap = {};
    users.forEach(u => {
      userMap[u.id] = {
        id: u.id,
        fullName: u.fullName || u.email?.split('@')[0] || 'Customer',
        name: u.fullName || 'Customer',
        rollNumber: u.rollNumber || 'N/A',
        phoneNumber: u.phoneNumber || 'N/A',
        email: u.email || 'N/A'
      };
    });

    const populatedOrders = orders.map(order => ({
      ...order,
      user: userMap[order.userId] || {
        fullName: 'Customer (Unknown)',
        name: 'Customer',
        rollNumber: 'N/A',
        phoneNumber: 'N/A'
      }
    }));

    res.json({ success: true, data: populatedOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await db.order.update({
      where: { id: req.params.id },
      data: { status }
    });
    res.json({ success: true, data: order });
    const user = await db.user.findUnique({ where: { id: order.userId } });
    if (status === 'READY' || status === 'DELIVERED') {
      sendCompletionEmail(user, order).catch(error => console.error('Completion email error:', error.message));
    } else if (status === 'CANCELLED') {
      sendCancellationEmail(user, order).catch(error => console.error('Cancellation email error:', error.message));
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const userCount = await db.user.count();
    const orderCount = await db.order.count();
    const productCount = await db.product.count();
    const totalRevenue = await db.order.aggregate({
      where: { status: 'DELIVERED' },
      _sum: { totalAmount: true }
    });

    res.json({
      success: true,
      data: {
        users: userCount,
        orders: orderCount,
        products: productCount,
        revenue: totalRevenue._sum.totalAmount || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.decodeQr = async (req, res) => {
  try {
    let orderNumber = req.body?.orderId || req.body?.code || req.body?.orderNumber;

    if (!orderNumber && req.file && req.file.buffer) {
      try {
        const image = await Jimp.read(req.file.buffer);

        // Pass 1: Raw image
        let qrCode = jsQR(Uint8ClampedArray.from(image.bitmap.data), image.bitmap.width, image.bitmap.height);

        // Pass 2: Resize to 800px width for high-res camera photos
        if ((!qrCode || !qrCode.data) && image.bitmap.width > 1000) {
          const resized = image.clone().resize({ w: 800 });
          qrCode = jsQR(Uint8ClampedArray.from(resized.bitmap.data), resized.bitmap.width, resized.bitmap.height);
        }

        // Pass 3: Greyscale + Resize
        if (!qrCode || !qrCode.data) {
          const grey = image.clone().resize({ w: 600 }).greyscale();
          qrCode = jsQR(Uint8ClampedArray.from(grey.bitmap.data), grey.bitmap.width, grey.bitmap.height);
        }

        if (qrCode && qrCode.data) {
          orderNumber = qrCode.data.trim();
        }
      } catch (imgError) {
        console.error('Image processing error:', imgError);
      }
    }

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: 'Could not detect or decode QR code from the uploaded image'
      });
    }

    const cleanNumber = orderNumber.trim();
    const formattedWithHash = cleanNumber.startsWith('#') ? cleanNumber : `#${cleanNumber}`;

    const order = await db.order.findFirst({
      where: {
        OR: [
          { orderNumber: cleanNumber },
          { orderNumber: formattedWithHash },
          { id: cleanNumber }
        ]
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `No order found matching QR code "${cleanNumber}"`
      });
    }

    let user = null;
    if (order.userId) {
      user = await db.user.findUnique({ where: { id: order.userId } });
    }

    const populatedOrder = {
      ...order,
      user: {
        id: user?.id || order.userId,
        fullName: user?.fullName || user?.email?.split('@')[0] || 'Customer',
        rollNumber: user?.rollNumber || 'N/A',
        phoneNumber: user?.phoneNumber || 'N/A',
        email: user?.email || 'N/A'
      }
    };

    res.json({
      success: true,
      orderId: order.orderNumber,
      data: populatedOrder
    });
  } catch (error) {
    console.error('QR Decode Error:', error);
    res.status(500).json({ success: false, message: 'QR decoding failed: ' + error.message });
  }
};

exports.getSupportTickets = async (req, res) => {
  try {
    const tickets = await db.supportTicket.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('Get admin support tickets error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.replySupportTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { replyMessage } = req.body;

    if (!replyMessage || !replyMessage.trim()) {
      return res.status(400).json({ success: false, message: 'Reply message is required' });
    }

    const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const updated = await db.supportTicket.update({
      where: { id: ticketId },
      data: {
        adminReply: replyMessage.trim(),
        status: 'REPLIED',
        repliedAt: new Date()
      }
    });

    // Notify the user via in-app Notification
    await db.notification.create({
      data: {
        userId: ticket.userId,
        title: 'Support Reply from UniKart Team',
        message: replyMessage.trim(),
        icon: 'support'
      }
    });

    res.json({
      success: true,
      message: 'Reply sent and user notified!',
      data: updated
    });
  } catch (error) {
    console.error('Reply support ticket error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
