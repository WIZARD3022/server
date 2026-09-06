const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/unikart';
    const conn = await mongoose.connect(mongoUri, {
      dbName: process.env.MONGO_DB_NAME || 'unikart'
    });
    console.log(`🚀 MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected!');
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ MongoDB connection error: ${err}`);
});

const closeDB = async () => {
  await mongoose.connection.close();
  console.log('🛑 MongoDB connection closed through app termination');
};

module.exports = connectDB;
module.exports.closeDB = closeDB;
