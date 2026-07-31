/**
 * Recalculates earnedMarks, totalMarks, correctCount, wrongCount, and percentage
 * for all completed AssessmentResult records using evaluateTest.
 */
const { connectDB } = require('../server/db');
const Test = require('../server/models/Test');
const AssessmentResult = require('../server/models/AssessmentResult');
const { evaluateTest } = require('../server/services/evaluationService');

async function run() {
  await connectDB();

  const results = await AssessmentResult.find({ status: 'completed' });
  console.log(`Found ${results.length} completed results.`);

  let updatedCount = 0;
  for (const r of results) {
    const test = await Test.findById(r.assessmentId);
    if (!test) {
      console.log(`Test not found for result: ${r._id} (test ID: ${r.assessmentId})`);
      continue;
    }

    const evalResult = evaluateTest(test.sections, r.userAnswers || {});

    r.correctCount = evalResult.correctCount;
    r.wrongCount = evalResult.wrongCount;
    r.percentage = evalResult.percentage;
    r.totalMarks = evalResult.totalMarks;
    r.earnedMarks = evalResult.earnedMarks;
    r.questions = evalResult.evaluatedQuestions;

    await r.save();
    updatedCount++;
  }

  console.log(`Successfully recalculated and saved ${updatedCount} assessment results.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
