/**
 * Comprehensive Seed Script — Seeds Organization, Super Admin, Word Lists, Words, and Tenses.
 * Run: node server/seed.js
 */
const fs = require('fs');
const path = require('path');
const { connectDB, mongoose } = require('./db');
const config = require('./config');
const User = require('./models/User');
const Organization = require('./models/Organization');
const Word = require('./models/Word');
const WordList = require('./models/WordList');
const TenseGroup = require('./models/TenseGroup');
const TenseContent = require('./models/TenseContent');

async function seed() {
  try {
    console.log('\n=========================================');
    console.log('       VocabZupfly Database Seeder        ');
    console.log('=========================================\n');

    await connectDB();
    console.log('  ✓ Connected to MongoDB');

    const dataDir = path.join(__dirname, '..', 'data');
    const wordsFile = path.join(dataDir, 'words-merged.json');
    const fallbackWordsFile = path.join(dataDir, 'words.json');
    const listsFile = path.join(dataDir, 'word-lists.json');
    const tensesFile = path.join(dataDir, 'tenses-content.json');

    // 1. Organization
    var org = await Organization.findOne({ name: config.DEFAULT_ORG_NAME });
    if (!org) {
      org = await Organization.create({
        name: config.DEFAULT_ORG_NAME,
        email: config.DEFAULT_ORG_EMAIL,
        address: config.DEFAULT_ORG_ADDRESS,
      });
      console.log('  ✓ Organization created: ' + org.name);
    } else {
      console.log('  → Organization exists: ' + org.name);
    }

    // 2. Super Admin
    var superAdmin = await User.findOne({ email: config.SUPER_ADMIN_EMAIL }).select('+password');
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
      console.log('  → Super Admin exists: ' + superAdmin.email);
    }

    // 3. Word Lists (from data/word-lists.json)
    if (fs.existsSync(listsFile)) {
      try {
        const listsData = JSON.parse(fs.readFileSync(listsFile, 'utf8'));
        const lists = listsData.lists || [];
        let listCount = 0;
        for (const l of lists) {
          if (!l.id || !l.title) continue;
          await WordList.findOneAndUpdate(
            { id: l.id },
            {
              $set: {
                listNum: l.listNum || 0,
                title: l.title,
                icon: l.icon || '📘',
                color: l.color || 'lavender',
                listType: l.listType || 'grouped',
                groups: Array.isArray(l.groups) ? l.groups : [],
                words: Array.isArray(l.words) ? l.words : [],
              },
            },
            { upsert: true, new: true }
          );
          listCount++;
        }
        console.log(`  ✓ Seeded ${listCount} Word Lists`);
      } catch (err) {
        console.warn('  ⚠ Word lists seeding warning:', err.message);
      }
    }

    // 4. Vocabulary Words (from data/words-merged.json or data/words.json)
    const targetWordsFile = fs.existsSync(wordsFile) ? wordsFile : (fs.existsSync(fallbackWordsFile) ? fallbackWordsFile : null);
    if (targetWordsFile) {
      try {
        const wordsData = JSON.parse(fs.readFileSync(targetWordsFile, 'utf8'));
        if (Array.isArray(wordsData) && wordsData.length > 0) {
          const ops = wordsData
            .filter((w) => w && w.word && typeof w.word === 'string')
            .map((w) => ({
              updateOne: {
                filter: { word: w.word.trim() },
                update: {
                  $set: {
                    phonetic: w.phonetic || '',
                    pos: w.pos || 'noun',
                    def: w.def || '',
                    example: w.example || '',
                    syn: w.syn || '',
                    ant: w.ant || '',
                    tags: Array.isArray(w.tags) ? w.tags : [],
                    premium: !!w.premium,
                    stub: !!w.stub,
                  },
                },
                upsert: true,
              },
            }));

          if (ops.length > 0) {
            const bulkRes = await Word.bulkWrite(ops, { ordered: false });
            const totalWords = (bulkRes.upsertedCount || 0) + (bulkRes.modifiedCount || 0) + (bulkRes.matchedCount || 0);
            console.log(`  ✓ Seeded ${ops.length} Vocabulary Words (matched/upserted: ${totalWords})`);
          }
        }
      } catch (err) {
        console.warn('  ⚠ Words seeding warning:', err.message);
      }
    }

    // 5. Tense Groups & Tense Content (from data/tenses-content.json)
    if (fs.existsSync(tensesFile)) {
      try {
        const tensesData = JSON.parse(fs.readFileSync(tensesFile, 'utf8'));
        const groups = Object.keys(tensesData);
        let tenseItemsCount = 0;

        for (const grpName of groups) {
          // Ensure TenseGroup exists
          await TenseGroup.findOneAndUpdate(
            { name: grpName },
            {
              $set: {
                name: grpName,
                displayName: grpName
                  .split('-')
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' '),
              },
            },
            { upsert: true, new: true }
          );

          // Replace items for this group
          const items = tensesData[grpName] || [];
          if (Array.isArray(items) && items.length > 0) {
            await TenseContent.deleteMany({ group: grpName });
            const docs = items.map((item) => ({
              group: grpName,
              category: item.category || 'reading',
              text: item.text || '',
              title: item.title || '',
              story: item.story || '',
              topic: item.topic || '',
              questions: Array.isArray(item.questions) ? item.questions : [],
            }));
            await TenseContent.insertMany(docs);
            tenseItemsCount += docs.length;
          }
        }
        console.log(`  ✓ Seeded ${groups.length} Tense Groups (${tenseItemsCount} content items)`);
      } catch (err) {
        console.warn('  ⚠ Tenses seeding warning:', err.message);
      }
    }

    console.log('\n=========================================');
    console.log('         Database Seeding Complete!        ');
    console.log('=========================================');
    console.log('  Super Admin Login:');
    console.log('    Email:    ' + config.SUPER_ADMIN_EMAIL);
    console.log('    Password: ' + config.SUPER_ADMIN_PASSWORD);
    console.log('=========================================\n');
  } catch (err) {
    console.error('\n  ✗ Seed failed:', err.message);
    process.exit(1);
  } finally {
    try {
      await mongoose.connection.close();
    } catch (_) {}
    process.exit(0);
  }
}

seed();
