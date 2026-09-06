const db = require('../services/db.service');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Masked logging for debugging keys (Never log the full secret!)
const keyId = (process.env.RAZORPAY_KEY_ID || process.env.PAYMENT_KEY_ID || "").trim();
const keySecret = (process.env.RAZORPAY_KEY_SECRET || process.env.PAYMENT_KEY_SECRET || "").trim();

console.log(`[Razorpay Setup] Using Key ID: ${keyId.substring(0, 8)}...`);
if (!keyId || !keySecret) {
  console.error("[Razorpay Setup] WARNING: Missing Razorpay Key ID or Secret in .env!");
}

const razorpay = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;

exports.createOrder = async (req, res) => {
  try {
    if (!razorpay) return res.status(503).json({ success: false, message: 'Payment provider is not configured' });
    const { amount } = req.body;
    const userId = req.user.id;

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount < 1) {
      console.warn(`[Razorpay] Order creation failed: Invalid amount "${amount}" from user ${userId}`);
      return res.status(400).json({ success: false, message: 'Minimum amount is ₹1' });
    }

    const options = {
      amount: Math.round(parsedAmount * 100),
      currency: 'INR',
      // Razorpay receipt has a limit of 40 characters.
      // Using just timestamp and a short slice of userId to keep it unique but short.
      receipt: `r_${Date.now()}_${userId.substring(0, 8)}`,
    };

    console.log(`[Razorpay] Requesting order for ₹${amount}...`);
    const order = await razorpay.orders.create(options);
    console.log('[Razorpay] Order created:', order.id);

    res.json({
      success: true,
      data: {
        id: order.id,
        amount: order.amount,
        currency: order.currency
      }
    });
  } catch (error) {
    console.error('[Razorpay] Error Details:', error);

    // Check for specific authentication error from Razorpay
    if (error.statusCode === 401) {
      return res.status(401).json({
        success: false,
        message: 'Razorpay Authentication Failed. Please check Key ID and Secret on the server.'
      });
    }

    const msg = error.error ? error.error.description : (error.description || error.message || 'Payment provider error');
    res.status(500).json({ success: false, message: msg });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    if (!razorpay) return res.status(503).json({ success: false, message: 'Payment provider is not configured' });
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.id;

    console.log(`[Razorpay] Verifying payment for user: ${userId}, order: ${razorpay_order_id}`);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment details' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || process.env.PAYMENT_KEY_SECRET;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      console.log('[Razorpay] Signature verified.');

      // Fetch the order from Razorpay to get the amount securely
      const order = await razorpay.orders.fetch(razorpay_order_id);
      const amountInInr = order.amount / 100;

      const user = await db.user.update({
        where: { id: userId },
        data: {
          walletBalance: { increment: amountInInr }
        }
      });

      await db.transaction.create({
        data: {
          userId,
          title: 'Wallet Top-up (Razorpay)',
          amount: amountInInr,
          type: 'CREDIT',
          status: 'COMPLETED',
          icon: 'wallet'
        }
      });

      await db.notification.create({
        data: {
          userId,
          title: 'Wallet Topped Up!',
          message: `₹${amountInInr.toFixed(2)} has been added to your UniKart wallet via Razorpay.`,
          icon: 'wallet'
        }
      });

      console.log(`[Razorpay] Wallet updated for user ${userId}. New balance: ${user.walletBalance}`);

      res.json({
        success: true,
        message: 'Payment verified and wallet updated',
        data: { balance: user.walletBalance }
      });
    } else {
      console.error('[Razorpay] Signature mismatch!');
      res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }
  } catch (error) {
    console.error('[Razorpay] Verification Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Payment verification failed' });
  }
};

exports.transferMoney = async (req, res) => {
  try {
    const { recipientId, amount } = req.body;
    const senderId = req.user.id;

    if (!recipientId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid recipient or amount' });
    }

    const result = await db.$transaction(async (tx) => {
      const sender = await tx.user.findUnique({ where: { id: senderId } });
      const receiver = await tx.user.findUnique({ where: { id: recipientId } });

      if (!receiver) throw new Error('Recipient not found');
      if (sender.id === receiver.id) throw new Error('Cannot send money to yourself');
      if (sender.walletBalance < amount) throw new Error('Insufficient balance');

      const updatedSender = await tx.user.update({
        where: { id: senderId },
        data: { walletBalance: { decrement: amount } }
      });

      await tx.user.update({
        where: { id: recipientId },
        data: { walletBalance: { increment: amount } }
      });

      await tx.transaction.create({
        data: {
          userId: senderId,
          title: `Sent to ${receiver.fullName}`,
          amount: amount,
          type: 'DEBIT',
          icon: 'send',
          status: 'COMPLETED'
        }
      });

      await tx.transaction.create({
        data: {
          userId: recipientId,
          title: `Received from ${sender.fullName}`,
          amount: amount,
          type: 'CREDIT',
          icon: 'wallet',
          status: 'COMPLETED'
        }
      });

      // Notifications
      await tx.notification.create({
        data: {
          userId: senderId,
          title: 'Money Sent',
          message: `You successfully sent ₹${amount.toFixed(2)} to ${receiver.fullName}.`,
          icon: 'wallet'
        }
      });

      await tx.notification.create({
        data: {
          userId: recipientId,
          title: 'Money Received',
          message: `You received ₹${amount.toFixed(2)} from ${sender.fullName}.`,
          icon: 'wallet'
        }
      });

      return updatedSender;
    });

    res.json({
      success: true,
      message: 'Money transferred successfully',
      data: { balance: result.walletBalance }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.redeemPoints = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await db.user.findUnique({ where: { id: userId } });

    if (user.rewardPoints < 100) {
      return res.status(400).json({
        success: false,
        message: 'Minimum 100 points required to redeem'
      });
    }

    const pointsToRedeem = 100;
    const amountToCredit = 10;

    const result = await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: {
          walletBalance: { increment: amountToCredit },
          rewardPoints: { decrement: pointsToRedeem }
        }
      }),
      db.transaction.create({
        data: {
          userId,
          title: 'Points Redemption (100 PTS)',
          amount: amountToCredit,
          type: 'CREDIT',
          status: 'COMPLETED',
          icon: 'stars'
        }
      }),
      db.notification.create({
        data: {
          userId,
          title: 'Points Redeemed!',
          message: `You successfully converted 100 points into ₹${amountToCredit.toFixed(2)}.`,
          icon: 'offer'
        }
      })
    ]);

    res.json({
      success: true,
      message: `Redeemed 100 points for ₹${amountToCredit.toFixed(2)}`,
      data: {
        balance: result[0].walletBalance,
        rewardPoints: result[0].rewardPoints
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const transactions = await db.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { timestamp: 'desc' }
    });
    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBalance = async (req, res) => {
  try {
    const [user, orderCount] = await Promise.all([
      db.user.findUnique({
        where: { id: req.user.id },
        select: { walletBalance: true, rewardPoints: true }
      }),
      db.order.count({ where: { userId: req.user.id } })
    ]);

    res.json({
      success: true,
      data: {
        balance: user.walletBalance,
        rewardPoints: user.rewardPoints,
        orderCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
