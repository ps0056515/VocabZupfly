/**
 * MongoDB connection using Mongoose.
 */
const mongoose = require('mongoose');
const config = require('./config');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  try {
    await mongoose.connect(config.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log('  ✓ MongoDB connected:', config.MONGO_URI.replace(/\/\/.*@/, '//<credentials>@'));
  } catch (err) {
    console.error('  ✗ MongoDB connection failed:', err.message);
    console.error('    Make sure MongoDB is running. Install: https://www.mongodb.com/try/download/community');
    throw err;
  }
}

mongoose.connection.on('disconnected', function () {
  isConnected = false;
  console.warn('  ⚠ MongoDB disconnected');
});

mongoose.connection.on('error', function (err) {
  console.error('  ✗ MongoDB error:', err.message);
});

module.exports = { connectDB, mongoose };
