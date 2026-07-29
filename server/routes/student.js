const express = require('express');
const Word = require('../models/Word');
const WordList = require('../models/WordList');
const TenseContent = require('../models/TenseContent');
const PracticeQuestion = require('../models/PracticeQuestion');
const AssessmentResult = require('../models/AssessmentResult');
const Test = require('../models/Test');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Require authentication for all student content APIs
router.use(authenticate);

/**
 * GET /api/words — Fetch all vocabulary words
 */
router.get('/words', async function (req, res) {
  try {
    const words = await Word.find().sort({ word: 1 }).lean();
    res.json(words);
  } catch (err) {
    console.error('[Student API] Get words error:', err);
    res.status(500).json({ error: 'Failed to load words' });
  }
});

/**
 * GET /api/word-lists — Fetch vocabulary word lists
 */
router.get('/word-lists', async function (req, res) {
  try {
    const lists = await WordList.find().sort({ listNum: 1 }).lean();
    let groupCount = 0;
    lists.forEach(function (l) {
      groupCount += (l.groups || []).length;
    });

    res.json({
      source: 'MongoDB',
      version: 1,
      listCount: lists.length,
      groupCount: groupCount,
      lists: lists
    });
  } catch (err) {
    console.error('[Student API] Get word lists error:', err);
    res.status(500).json({ error: 'Failed to load word lists' });
  }
});

/**
 * GET /api/tenses-content — Fetch all tenses content grouped by module/group
 */
router.get('/tenses-content', async function (req, res) {
  try {
    const items = await TenseContent.find().lean();
    const grouped = {};
    items.forEach(function (item) {
      if (!grouped[item.group]) {
        grouped[item.group] = [];
      }
      grouped[item.group].push(item);
    });
    res.json(grouped);
  } catch (err) {
    console.error('[Student API] Get tenses content error:', err);
    res.status(500).json({ error: 'Failed to load tenses content' });
  }
});

/**
 * GET /api/practice-questions/pool — Retrieve practice questions pool for student practice
 */
router.get('/practice-questions/pool', async function (req, res) {
  try {
    var query = {};
    if (req.query.listId) query.listId = req.query.listId;
    if (req.query.groupIds) {
      query.groupId = { $in: req.query.groupIds.split(',') };
    }
    const questions = await PracticeQuestion.find(query).lean();
    res.json({ ok: true, questions: questions });
  } catch (err) {
    console.error('[Student API] Get practice questions pool error:', err);
    res.status(500).json({ error: 'Failed to retrieve questions.' });
  }
});

/**
 * GET /api/assessment/session/:assessmentId — Get in-progress assessment result or state
 */
router.get('/assessment/session/:assessmentId', async function (req, res) {
  try {
    const result = await AssessmentResult.findOne({
      userEmail: req.user.email,
      assessmentId: req.params.assessmentId
    }).lean();
    res.json({ ok: true, result: result });
  } catch (err) {
    console.error('[Student API] Get assessment session error:', err);
    res.status(500).json({ error: 'Failed to retrieve assessment session.' });
  }
});

/**
 * POST /api/assessment/start — Initialize or retrieve an assessment session in MongoDB
 */
router.post('/assessment/start', async function (req, res) {
  try {
    const { assessmentId, title, type, totalQuestions, questions } = req.body;
    let result = await AssessmentResult.findOne({
      userEmail: req.user.email,
      assessmentId: assessmentId
    });

    if (!result) {
      result = await AssessmentResult.create({
        userEmail: req.user.email,
        userName: req.user.name,
        assessmentId: assessmentId,
        title: title,
        type: type || 'practice',
        totalQuestions: totalQuestions,
        questions: questions || [],
        userAnswers: {},
        status: 'in_progress',
        startTimeMs: Date.now(),
        currentIndex: 0
      });
    }

    res.json({ ok: true, result: result });
  } catch (err) {
    console.error('[Student API] Start assessment error:', err);
    res.status(500).json({ error: 'Failed to start assessment session.' });
  }
});

/**
 * POST /api/assessment/save-progress — Sync user answers and index to MongoDB
 */
router.post('/assessment/save-progress', async function (req, res) {
  try {
    const { assessmentId, userAnswers, currentIndex } = req.body;
    const result = await AssessmentResult.findOneAndUpdate(
      { userEmail: req.user.email, assessmentId: assessmentId },
      { $set: { userAnswers: userAnswers, currentIndex: currentIndex } },
      { new: true }
    );
    res.json({ ok: true, result: result });
  } catch (err) {
    console.error('[Student API] Save progress error:', err);
    res.status(500).json({ error: 'Failed to save progress.' });
  }
});

/**
 * POST /api/assessment/submit — Complete assessment session in MongoDB
 */
router.post('/assessment/submit', async function (req, res) {
  try {
    const {
      assessmentId,
      correctCount,
      wrongCount,
      percentage,
      questions,
      userAnswers
    } = req.body;

    const result = await AssessmentResult.findOneAndUpdate(
      { userEmail: req.user.email, assessmentId: assessmentId },
      {
        $set: {
          correctCount: correctCount,
          wrongCount: wrongCount,
          percentage: percentage,
          questions: questions,
          userAnswers: userAnswers,
          status: 'completed',
          completedAt: new Date()
        }
      },
      { new: true, upsert: true }
    );

    res.json({ ok: true, resultId: result._id });
  } catch (err) {
    console.error('[Student API] Submit assessment error:', err);
    res.status(500).json({ error: 'Failed to submit assessment.' });
  }
});

/**
 * GET /api/assessment/list — List all assessment sessions for the student
 */
router.get('/assessment/list', async function (req, res) {
  try {
    const list = await AssessmentResult.find({ userEmail: req.user.email })
      .sort({ completedAt: -1, startTimeMs: -1 })
      .lean();
    res.json({ ok: true, list: list });
  } catch (err) {
    console.error('[Student API] Get assessment list error:', err);
    res.status(500).json({ error: 'Failed to retrieve assessments.' });
  }
});

/**
 * POST /api/assessment/evaluate — Perform server-side evaluation of student answers
 */
router.post('/assessment/evaluate', async function (req, res) {
  try {
    const { questions, userAnswers } = req.body;
    let correctCount = 0;
    let wrongCount = 0;
    const groupStats = {};
    const evaluatedQuestions = [];

    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      const userAns = userAnswers[idx];
      let isCorrect = false;

      const grpId = q.groupId || "official";
      const grpTitle = q.groupTitle || grpId;

      if (!groupStats[grpId]) {
        groupStats[grpId] = {
          groupId: grpId,
          groupTitle: grpTitle,
          total: 0,
          correct: 0,
          wrong: 0,
        };
      }
      groupStats[grpId].total++;

      // Fetch correct answers from MongoDB database
      let dbQ = null;
      if (q.dbId) {
        dbQ = await PracticeQuestion.findById(q.dbId).lean();
      }

      const qType = dbQ ? dbQ.type : (q.type === 'fill_blank' ? 'fib' : q.type);
      const qOptions = dbQ ? dbQ.options : q.options;
      const dbCorrectAnswer = dbQ ? dbQ.correctAnswer : (q.correctAnswerText || '');

      if (qType === 'mcq_multi') {
        const expectedAnswers = dbCorrectAnswer.split(',').map(s => s.trim());
        const expectedIndices = expectedAnswers.map(ans => qOptions.indexOf(ans)).filter(i => i >= 0).sort();
        const userIndices = Array.isArray(userAns) ? userAns.slice().sort() : [];
        isCorrect = expectedIndices.length > 0 &&
                    expectedIndices.length === userIndices.length &&
                    expectedIndices.every((v, i) => v === userIndices[i]);
      } else if (qType === 'mcq') {
        const expectedIdx = qOptions.indexOf(dbCorrectAnswer);
        isCorrect = userAns === expectedIdx;
      } else if (qType === 'fib') {
        const expected = dbCorrectAnswer.trim().toLowerCase();
        const actual = typeof userAns === 'string' ? userAns.trim().toLowerCase() : '';
        isCorrect = expected.length > 0 && expected === actual;
      }

      q.userAnswer = userAns;
      q.isCorrect = isCorrect;

      if (isCorrect) {
        correctCount++;
        groupStats[grpId].correct++;
      } else {
        wrongCount++;
        groupStats[grpId].wrong++;
      }

      evaluatedQuestions.push(q);
    }

    // Compute accuracy percentages
    Object.keys(groupStats).forEach((gId) => {
      const g = groupStats[gId];
      g.percentage = g.total > 0 ? Number(((g.correct / g.total) * 100).toFixed(2)) : 0;
    });

    const percentage = questions.length > 0 ? Number(((correctCount / questions.length) * 100).toFixed(2)) : 0;

    res.json({
      ok: true,
      correctCount: correctCount,
      wrongCount: wrongCount,
      percentage: percentage,
      groupStats: groupStats,
      questions: evaluatedQuestions
    });
  } catch (err) {
    console.error('[Student API] Evaluation error:', err);
    res.status(500).json({ error: 'Failed to evaluate assessment.' });
  }
});


/**
 * GET /api/student/tests — Get the list of tests assigned to the student
 */
router.get('/student/tests', async function (req, res) {
  try {
    var conditions = [
      { isAssigned: true },
      { isDisabled: false },
      { $or: [{ orgId: req.user.orgId }, { orgId: null }] }
    ];

    if (req.query.search) {
      var search = req.query.search.trim();
      if (search) {
        var safeRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        conditions.push({ title: safeRegex });
      }
    }

    var filter = conditions.length > 1 ? { $and: conditions } : conditions[0];

    // Find all matching tests
    var tests = await Test.find(filter)
      .select('-sections.questions.correctAnswer -sections.questions.correctAnswers -sections.questions.explanation')
      .sort({ startTime: -1 })
      .lean();

    // Fetch user's completed results
    var results = await AssessmentResult.find({
      userEmail: req.user.email,
      status: 'completed'
    }).select('assessmentId correctCount totalQuestions percentage').lean();

    var completedMap = {};
    results.forEach(function (r) {
      if (r.assessmentId) {
        completedMap[r.assessmentId.toString()] = {
          correctCount: r.correctCount,
          totalQuestions: r.totalQuestions,
          percentage: r.percentage
        };
      }
    });

    // Match and filter based on status
    var list = tests.map(function (t) {
      var resObj = completedMap[t._id.toString()] || null;
      var isCompleted = !!resObj;
      return {
        id: t._id,
        title: t.title,
        description: t.description,
        totalQuestions: t.totalQuestions,
        totalMarks: t.totalMarks,
        totalDurationSec: t.totalDurationSec,
        startTime: t.startTime,
        endTime: t.endTime,
        isCompleted: isCompleted,
        completedResult: resObj,
        showResult: t.showResult,
        showAnswer: t.showAnswer,
        malpracticeLimit: t.malpracticeLimit,
        sectionsCount: (t.sections || []).length
      };
    });

    var status = req.query.status || 'new';
    if (status === 'new') {
      list = list.filter(function (t) { return !t.isCompleted; });
    } else if (status === 'completed') {
      list = list.filter(function (t) { return t.isCompleted; });
    }

    // Apply pagination
    var page = Math.max(1, parseInt(req.query.page) || 1);
    var limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    var skip = (page - 1) * limit;

    var paginatedList = list.slice(skip, skip + limit);

    res.json({
      ok: true,
      tests: paginatedList,
      total: list.length,
      page: page,
      pages: Math.ceil(list.length / limit),
    });
  } catch (err) {
    console.error('[Student API] Get assigned tests error:', err);
    res.status(500).json({ error: 'Failed to retrieve assigned tests.' });
  }
});

/**
 * GET /api/student/tests/:id — Get details of a specific assigned test
 */
router.get('/student/tests/:id', async function (req, res) {
  try {
    var test = await Test.findOne({
      _id: req.params.id,
      isAssigned: true,
      isDisabled: false,
      $or: [{ orgId: req.user.orgId }, { orgId: null }]
    })
    .select('-sections.questions.correctAnswer -sections.questions.correctAnswers -sections.questions.explanation')
    .lean();

    if (!test) return res.status(404).json({ error: 'Test not found or not assigned.' });

    res.json({ ok: true, test: test });
  } catch (err) {
    console.error('[Student API] Get test detail error:', err);
    res.status(500).json({ error: 'Failed to retrieve test details.' });
  }
});

module.exports = router;
