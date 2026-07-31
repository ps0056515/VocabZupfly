/**
 * Scripts to migrate and clean up existing practice question correctAnswers in the database.
 * Converts "D (feckless)" to "D".
 */
const { connectDB } = require('../server/db');
const PracticeQuestion = require('../server/models/PracticeQuestion');

async function run() {
  await connectDB();

  const questions = await PracticeQuestion.find({});
  console.log(`Found ${questions.length} practice questions in database.`);

  let updatedCount = 0;
  for (const q of questions) {
    if (!q.correctAnswer) continue;

    const original = q.correctAnswer;
    var cleanAnswerParts = [];
    var rawAnswerParts = original.split(/[,&]/).map(function(s) { return s.trim(); });
    for (var part of rawAnswerParts) {
      var match = part.match(/^([A-Fa-f0-9]+)/);
      if (match) {
        cleanAnswerParts.push(match[1].toUpperCase());
      } else {
        cleanAnswerParts.push(part);
      }
    }
    const cleaned = cleanAnswerParts.join(', ');

    if (original !== cleaned) {
      q.correctAnswer = cleaned;
      await q.save();
      console.log(`Updated question [${q._id}]: "${original}" -> "${cleaned}"`);
      updatedCount++;
    }
  }

  console.log(`Migration complete. Cleaned ${updatedCount} practice questions.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
