const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../services/db.service');
const { sendVerificationEmail } = require('../services/mail.service');

const fixUrl = (url) => {
  if (!url || !process.env.BASE_URL) return url;
  if (url.includes('147.79.68.196:5000')) {
    return url.replace(/http:\/\/147\.79\.68\.196:5000/g, process.env.BASE_URL);
  }
  return url;
};

exports.getProfile = async (req, res) => {
  try {
    const [user, orderCount] = await Promise.all([
      db.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          profilePicture: true,
          rollNumber: true,
          department: true,
          year: true,
          role: true,
          walletBalance: true,
          rewardPoints: true,
          premiumMember: true,
          hasSetPassword: true,
          isEmailVerified: true,
          isPhoneVerified: true
        }
      }),
      db.order.count({ where: { userId: req.user.id } })
    ]);

    if (!user) return res.status(404).json({ success: false, message: 'User found' });

    res.json({
      success: true,
      data: {
        ...user,
        profilePicture: fixUrl(user.profilePicture),
        orderCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { fullName, phoneNumber, rollNumber, department, year, profilePicture } = req.body;
    const user = await db.user.update({
      where: { id: req.user.id },
      data: { fullName, phoneNumber, rollNumber, department, year, profilePicture }
    });
    res.json({ success: true, message: 'Profile updated successfully', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.lookupUser = async (req, res) => {
  try {
    const { identifier } = req.query;
    if (!identifier) return res.status(400).json({ success: false, message: 'Identifier is required' });

    const user = await db.user.findFirst({
      where: {
        OR: [
          { phoneNumber: identifier },
          { rollNumber: identifier }
        ]
      },
      select: {
        id: true,
        fullName: true,
        rollNumber: true,
        department: true
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.setPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.user.update({
      where: { id: req.user.id },
      data: {
        password: hashedPassword,
        hasSetPassword: true
      }
    });

    res.json({ success: true, message: 'Password set successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendcode = async (req, res) => {
  try{
    const {email} = req.user;
    const otp = crypto.randomInt(100000, 1000000);
    await db.otp.create({
      data: {
        email,
        otp
      }
    });
    sendVerificationEmail(email, otp).catch(error => console.error('otp email error:', error.message))
    res.status(200).json({ success: true, message:  "code is sent on registered mail"});

  }
  catch(error){
    res.status(500).json({success: false, message: error.message });
  }
}

exports.verifymail = async (req, res) => {
  try{
const { email } = req.user;
const { otp } = req.body;

try {
  // Find the OTP for this user
  const otpRecord = await db.otp.findFirst({
    where: {
      email: email,
      otp: otp
    }
  });

  if (!otpRecord) {
    return res.status(400).json({
      success: false,
      message: "Invalid OTP"
    });
  }

  // Delete the OTP after successful verification
  await db.otp.delete({
    where: {
      id: otpRecord.id
    }
  });

  // Mark email as verified
  await db.user.update({
    where: {
      id: req.user.id
    },
    data: {
      isEmailVerified: true
    }
  });

  return res.status(200).json({
    success: true,
    message: "Email verified successfully"
  });

} catch (error) {
  console.error("OTP verification error:", error);

  return res.status(500).json({
    success: false,
    message: "Failed to verify OTP"
  });
}

  }
  catch{
    res.status(500).json({success: false, message: error.message });
  }
};

// --- Address Management ---

exports.getAddresses = async (req, res) => {
  try {
    const addresses = await db.address.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: addresses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const { title, address, phone, isDefault } = req.body;
    const userId = req.user.id;

    if (isDefault) {
      await db.address.updateMany({
        where: { userId },
        data: { isDefault: false }
      });
    }

    const count = await db.address.count({ where: { userId } });

    const newAddress = await db.address.create({
      data: {
        userId,
        title,
        address,
        phone,
        isDefault: Boolean(isDefault) || count === 0
      }
    });

    res.status(201).json({ success: true, data: newAddress });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const { title, address, phone, isDefault } = req.body;
    const userId = req.user.id;
    const addressId = req.params.id;

    if (isDefault) {
      await db.address.updateMany({
        where: { userId },
        data: { isDefault: false }
      });
    }

    const updated = await db.address.update({
      where: { id: addressId, userId },
      data: { title, address, phone, isDefault }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;

    await db.address.updateMany({
      where: { userId },
      data: { isDefault: false }
    });

    const updated = await db.address.update({
      where: { id: addressId, userId },
      data: { isDefault: true }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;

    const existing = await db.address.findFirst({ where: { id: addressId, userId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Address not found' });

    await db.address.delete({ where: { id: addressId, userId } });

    if (existing.isDefault) {
      const next = await db.address.findFirst({ where: { userId } });
      if (next) {
        await db.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    res.json({ success: true, message: 'Address deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createSupportTicket = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message / Comment is required' });
    }

    const user = await db.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const ticket = await db.supportTicket.create({
      data: {
        userId: user.id,
        fullName: user.fullName || 'Student',
        email: user.email,
        message: message.trim(),
        status: 'PENDING'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Your inquiry has been submitted! Our support team will respond shortly.',
      data: ticket
    });
  } catch (error) {
    console.error('Create support ticket error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserSupportTickets = async (req, res) => {
  try {
    const tickets = await db.supportTicket.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

