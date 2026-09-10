const mongoose = require('mongoose');
const crypto = require('crypto');

const id = { type: String, default: () => crypto.randomUUID() };
const schemas = {};
const definition = {
  User: { _id: id, fullName: { type: String, required: true, trim: true }, email: { type: String, required: true, lowercase: true, trim: true, index: true, unique: true }, phoneNumber: { type: String, sparse: true, unique: true }, password: { type: String, required: true}, hasSetPassword: { type: Boolean, default: false }, role: { type: String, enum: ['CUSTOMER', 'ADMIN'], default: 'CUSTOMER' }, walletBalance: { type: Number, default: 0, min: 0 }, rewardPoints: { type: Number, default: 0, min: 0 }, isPhoneVerified: Boolean, isEmailVerified: Boolean, premiumMember: Boolean, profilePicture: String, rollNumber: String, department: String, year: String },
  otp: {_id: id, identifier: { type: String, required: true, index: true }, otp: {type: String, required: true}, expiresAt: { type: Date, required: true } },
  CartItem: { _id: id, userId: String, productId: String, title: String, type: String, price: Number, quantity: { type: Number, default: 1 }, config: mongoose.Schema.Types.Mixed, imageUrl: String, isSelected: { type: Boolean, default: true } },
  Product: { _id: id, name: String, shortDescription: String, description: String, price: Number, originalPrice: Number, discountPercentage: Number, images: [String], category: String, brand: String, stock: Number, isAvailable: { type: Boolean, default: true }, isFeatured: Boolean, isTrending: Boolean, isBestSeller: Boolean, isDealOfTheDay: Boolean, averageRating: Number, totalReviews: Number, specifications: mongoose.Schema.Types.Mixed, tags: [String], seller: String },
  Category: { _id: id, name: { type: String, unique: true }, icon: String, order: Number, isActive: { type: Boolean, default: true } },
  Order: { _id: id, orderNumber: { type: String, unique: true }, userId: String, type: String, status: { type: String, default: 'ORDER_RECEIVED' }, totalAmount: Number, discount: Number, paymentMethod: String, pickupPoint: String, config: mongoose.Schema.Types.Mixed, documentUrl: String },
  Transaction: { _id: id, userId: String, title: String, amount: Number, type: String, status: { type: String, default: 'COMPLETED' }, icon: String, paymentMethod: String, timestamp: { type: Date, default: Date.now } },
  Wishlist: { _id: id, userId: String, productId: String, addedAt: { type: Date, default: Date.now } },
  Review: { _id: id, userId: String, productId: String, rating: Number, comment: String, timestamp: { type: Date, default: Date.now } },
  Notification: { _id: id, userId: String, title: String, message: String, icon: String, isRead: { type: Boolean, default: false }, timestamp: { type: Date, default: Date.now } },
  Device: { _id: id, userId: String, deviceId: String, model: String, os: String, lastLogin: { type: Date, default: Date.now } },
  PrintingRates: { _id: { type: String, default: 'singleton' }, bwRate1: Number, bwRate2: Number, bwRate3: Number, colorRate1: Number, colorRate2: Number, colorRate3: Number, gsm80Extra: Number, gsm120Extra: Number, a3Multiplier: Number, legalMultiplier: Number, spiralBinding: Number, hardcoverBinding: Number, stickFile: Number, emergencyFee: Number, gstPercent: { type: Number, default: 18.0 } },
  Address: { _id: id, userId: { type: String, required: true, index: true }, title: { type: String, required: true }, address: { type: String, required: true }, phone: { type: String, required: true }, isDefault: { type: Boolean, default: false } },
  Banner: { _id: id, imageUrl: String, linkUrl: String, order: Number, isActive: { type: Boolean, default: true } },
  PrintJob: {
    _id: id, userId: { type: String, required: true, index: true },
    orderId: { type: String, index: true },
    cupsJobId: { type: String, index: true },
    originalName: String,
    file: String,
    size: Number,
    options: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['pending', 'submitted', 'processing', 'completed', 'cancelled', 'failed', 'unknown'], default: 'pending', index: true },
    error: String
  },
  SupportTicket: {
    _id: id,
    userId: { type: String, required: true, index: true },
    fullName: String,
    email: String,
    message: { type: String, required: true },
    adminReply: String,
    status: { type: String, enum: ['PENDING', 'REPLIED'], default: 'PENDING' },
    createdAt: { type: Date, default: Date.now },
    repliedAt: Date
  }
};
const indexes = {
  User: [[{ rollNumber: 1 }]],
  CartItem: [[{ userId: 1 }], [{ userId: 1, productId: 1 }]],
  Product: [[{ category: 1 }], [{ isAvailable: 1 }], [{ isFeatured: 1 }], [{ isTrending: 1 }], [{ isBestSeller: 1 }], [{ isDealOfTheDay: 1 }], [{ updatedAt: -1 }]],
  Order: [[{ userId: 1, createdAt: -1 }], [{ status: 1, createdAt: -1 }]],
  Transaction: [[{ userId: 1, timestamp: -1 }]],
  Wishlist: [],
  Review: [[{ productId: 1, timestamp: -1 }]],
  Notification: [[{ userId: 1, timestamp: -1 }]],
  Banner: [[{ isActive: 1 }], [{ order: 1 }]],
  PrintJob: [[{ userId: 1, createdAt: -1 }]]
};

Object.keys(definition).forEach(name => {
  if (mongoose.models[name]) {
    schemas[name] = mongoose.models[name];
    return;
  }

  const schema = new mongoose.Schema(definition[name], {
    timestamps: true,
    strict: false,
    versionKey: false
  });

  (indexes[name] || []).forEach(([fields, options]) => schema.index(fields, options));

  if (name === 'Wishlist') {
    schema.index({ userId: 1, productId: 1 }, { unique: true });
  }

  schemas[name] = mongoose.model(name, schema);
});
module.exports = schemas;
