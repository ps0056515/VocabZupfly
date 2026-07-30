const mongoose = require('mongoose');
const config = require('../server/config');
const Test = require('../server/models/Test');

async function migrate() {
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log('Connected to MongoDB.');

    const result = await Test.updateMany(
      { $or: [{ passPercentage: { $exists: false } }, { passPercentage: null }] },
      { $set: { passPercentage: 30 } }
    );

    console.log(`Successfully updated ${result.modifiedCount || result.nModified || 0} existing test(s) with passPercentage: 30.`);
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

migrate();
