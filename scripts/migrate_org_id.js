/**
 * Migration script to populate orgId: "6a6336008e7335277d4b6ab0" (Panimalar)
 * on all existing tests and assessment results where orgId is null.
 */
const mongoose = require('mongoose');
const { connectDB } = require('../server/db');
const Test = require('../server/models/Test');
const AssessmentResult = require('../server/models/AssessmentResult');
const User = require('../server/models/User');

const PANIMALAR_ORG_ID = '6a6336008e7335277d4b6ab0';

async function migrate() {
  await connectDB();

  console.log('Migrating tests...');
  const testsUpdated = await Test.updateMany(
    { orgId: null },
    { $set: { orgId: new mongoose.Types.ObjectId(PANIMALAR_ORG_ID) } }
  );
  console.log(`Updated ${testsUpdated.modifiedCount} tests.`);

  console.log('Migrating assessment results...');
  const resultsUpdated = await AssessmentResult.updateMany(
    { orgId: null },
    { $set: { orgId: new mongoose.Types.ObjectId(PANIMALAR_ORG_ID) } }
  );
  console.log(`Updated ${resultsUpdated.modifiedCount} assessment results.`);

  process.exit(0);
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
