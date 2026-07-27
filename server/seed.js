/**
 * Seed script — creates default super admin and Panimalar org.
 * Run: node server/seed.js
 */
const { connectDB, mongoose } = require('./db');
const config = require('./config');
const User = require('./models/User');
const Organization = require('./models/Organization');

async function seed() {
  try {
    await connectDB();
    console.log('\n  Seeding database...\n');

    // 1. Create default organization
    var org = await Organization.findOne({ name: config.DEFAULT_ORG_NAME });
    if (!org) {
      org = await Organization.create({
        name: config.DEFAULT_ORG_NAME,
        email: config.DEFAULT_ORG_EMAIL,
        address: config.DEFAULT_ORG_ADDRESS,
      });
      console.log('  ✓ Organization created: ' + org.name);
    } else {
      console.log('  → Organization already exists: ' + org.name);
    }

    // 2. Create default super admin
    var superAdmin = await User.findOne({ email: config.SUPER_ADMIN_EMAIL });
    if (!superAdmin) {
      superAdmin = await User.create({
        name: config.SUPER_ADMIN_NAME,
        email: config.SUPER_ADMIN_EMAIL,
        password: config.SUPER_ADMIN_PASSWORD,
        role: 'super_admin',
        orgId: org._id,
      });
      console.log('  ✓ Super Admin created: ' + superAdmin.email);
    } else {
      console.log('  → Super Admin already exists: ' + superAdmin.email);
    }

    console.log('\n  Seed complete!\n');
    console.log('  Login credentials:');
    console.log('    Email:    ' + config.SUPER_ADMIN_EMAIL);
    console.log('    Password: ' + config.SUPER_ADMIN_PASSWORD);
    console.log('');
  } catch (err) {
    console.error('\n  ✗ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

seed();
