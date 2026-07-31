const express = require('express');
const Word = require('../models/Word');
const WordList = require('../models/WordList');
const TenseContent = require('../models/TenseContent');
const PracticeQuestion = require('../models/PracticeQuestion');
const AssessmentResult = require('../models/AssessmentResult');
const Test = require('../models/Test');
const { authenticate } = require('../middleware/auth');
const { evaluateQuestion, evaluateTest } = require('../services/evaluationService');
const { evaluateQuestion: evaluatePracticeQuestion } = require('../services/practiceEvaluationService');

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

      const grpId = q.groupId || 'official';
      const grpTitle = q.groupTitle || grpId;

      if (!groupStats[grpId]) {
        groupStats[grpId] = { groupId: grpId, groupTitle: grpTitle, total: 0, correct: 0, wrong: 0 };
      }
      groupStats[grpId].total++;

      // Fetch correct answers from MongoDB database if available
      let gradeQ = q;
      if (q.dbId) {
        const dbQ = await PracticeQuestion.findById(q.dbId).lean();
        if (dbQ) {
          gradeQ = Object.assign({}, q, {
            type: dbQ.type || q.type,
            options: dbQ.options || q.options,
            correctAnswer: dbQ.correctAnswer || q.correctAnswer || q.correctAnswerText || '',
            correctAnswers: dbQ.correctAnswers || q.correctAnswers,
            mcqType: dbQ.mcqType || q.mcqType,
            subQuestions: dbQ.subQuestions || q.subQuestions
          });
        }
      }

      const result = evaluateQuestion(gradeQ, userAns);

      q.userAnswer = userAns;
      q.isCorrect = result.isCorrect;
      q.earnedMarks = result.earnedMarks;
      if (result.gradedSubQs) q.subQuestions = result.gradedSubQs;

      if (result.isCorrect) {
        correctCount++;
        groupStats[grpId].correct++;
      } else {
        wrongCount++;
        groupStats[grpId].wrong++;
      }

      evaluatedQuestions.push(q);
    }

    // Compute accuracy percentages
    Object.keys(groupStats).forEach(function (gId) {
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
 * POST /api/assessment/evaluate-practice — Perform server-side evaluation of student practice answers
 */
router.post('/assessment/evaluate-practice', async function (req, res) {
  try {
    const { questions, userAnswers } = req.body;
    let correctCount = 0;
    let wrongCount = 0;
    const groupStats = {};
    const evaluatedQuestions = [];

    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      const userAns = userAnswers[idx];

      // Enrich question with actual correct answer from DB for absolute accuracy
      if (q.dbId) {
        try {
          var dbQ = await PracticeQuestion.findById(q.dbId).lean();
          if (dbQ) {
            q.correctAnswer = dbQ.correctAnswer;
            const resolveIdx = (correctAns, options) => {
              if (!options || !options.length) return -1;
              var str = (correctAns !== undefined && correctAns !== null) ? String(correctAns).trim() : '';
              if (!str) return -1;
              var directIdx = options.indexOf(str);
              if (directIdx >= 0) return directIdx;
              var cleanStr = str;
              var match = str.match(/^([A-Za-z0-9]+)/);
              if (match) cleanStr = match[1];
              var upper = cleanStr.toUpperCase();
              if (upper.length === 1 && upper >= 'A' && upper <= 'Z') {
                var letterIdx = upper.charCodeAt(0) - 65;
                if (letterIdx >= 0 && letterIdx < options.length) return letterIdx;
              }
              var numIdx = parseInt(cleanStr, 10);
              if (!isNaN(numIdx) && numIdx >= 0 && numIdx < options.length) return numIdx;
              return -1;
            };

            if (q.type === 'mcq') {
              q.correctAnswerIndex = resolveIdx(dbQ.correctAnswer, q.options);
            } else if (q.type === 'mcq_multi') {
              var parts = (dbQ.correctAnswer || '').split(',').map(s => s.trim()).filter(Boolean);
              q.correctAnswerIndices = parts.map(p => resolveIdx(p, q.options)).filter(i => i >= 0);
            }
          }
        } catch (dbErr) {
          console.error('[Student API] Db lookup error during practice evaluation:', dbErr);
        }
      }

      const grpId = q.groupId || 'official';
      const grpTitle = q.groupTitle || grpId;

      if (!groupStats[grpId]) {
        groupStats[grpId] = { groupId: grpId, groupTitle: grpTitle, total: 0, correct: 0, wrong: 0 };
      }
      groupStats[grpId].total++;

      // Grade directly using the enriched structure
      const result = evaluatePracticeQuestion(q, userAns);

      q.userAnswer = userAns;
      q.isCorrect = result.isCorrect;
      q.earnedMarks = result.earnedMarks;
      if (result.gradedSubQs) q.subQuestions = result.gradedSubQs;

      if (result.isCorrect) {
        correctCount++;
        groupStats[grpId].correct++;
      } else {
        wrongCount++;
        groupStats[grpId].wrong++;
      }

      evaluatedQuestions.push(q);
    }

    // Compute accuracy percentages
    Object.keys(groupStats).forEach(function (gId) {
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
    console.error('[Student API] Practice Evaluation error:', err);
    res.status(500).json({ error: 'Failed to evaluate practice assessment.' });
  }
});


/**
 * GET /api/student/tests — Get the list of tests assigned to the student
 */
router.get('/student/tests', async function (req, res) {
  try {
    var userOrgId = req.user.orgId && /^[0-9a-fA-F]{24}$/.test(req.user.orgId) ? req.user.orgId : null;
    var conditions = [
      { isAssigned: true },
      { isDisabled: false },
      { $or: [{ orgId: userOrgId }, { orgId: null }] }
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

    // Fetch user's test attempt states
    var results = await AssessmentResult.find({
      userEmail: req.user.email
    }).select('assessmentId correctCount totalQuestions percentage status').lean();

    var attemptMap = {};
    results.forEach(function (r) {
      if (r.assessmentId) {
        attemptMap[r.assessmentId.toString()] = {
          status: r.status,
          correctCount: r.correctCount,
          totalQuestions: r.totalQuestions,
          percentage: r.percentage
        };
      }
    });

    // Match and filter based on status
    var list = tests.map(function (t) {
      var attObj = attemptMap[t._id.toString()] || null;
      var isCompleted = attObj ? attObj.status === 'completed' : false;
      var isInProgress = attObj ? attObj.status === 'in_progress' : false;
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
        isInProgress: isInProgress,
        completedResult: isCompleted ? attObj : null,
        showResult: t.showResult,
        showAnswer: t.showAnswer,
        malpracticeLimit: t.malpracticeLimit,
        passPercentage: t.passPercentage !== undefined ? t.passPercentage : 30,
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
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
      return res.status(404).json({ error: 'Test not found or not assigned.' });
    }
    var userOrgId = req.user.orgId && /^[0-9a-fA-F]{24}$/.test(req.user.orgId) ? req.user.orgId : null;
    var test = await Test.findOne({
      _id: req.params.id,
      isAssigned: true,
      isDisabled: false,
      $or: [{ orgId: userOrgId }, { orgId: null }]
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


/**
 * POST /api/student/tests/:id/start — Mark student test attempt as in_progress
 */
router.post('/student/tests/:id/start', async function (req, res) {
  try {
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
      return res.status(404).json({ error: 'Test not found or not active.' });
    }
    var userOrgId = req.user.orgId && /^[0-9a-fA-F]{24}$/.test(req.user.orgId) ? req.user.orgId : null;
    var test = await Test.findOne({
      _id: req.params.id,
      isAssigned: true,
      isDisabled: false,
      $or: [{ orgId: userOrgId }, { orgId: null }]
    }).lean();

    if (!test) return res.status(404).json({ error: 'Test not found or not active.' });

    var now = new Date();
    if (test.endTime && now > test.endTime) {
      return res.status(400).json({ error: 'This test availability window has expired.' });
    }

    // Find existing attempt
    var attempt = await AssessmentResult.findOne({
      userEmail: req.user.email,
      assessmentId: test._id.toString()
    });

    if (attempt) {
      if (attempt.status === 'completed') {
        return res.status(400).json({ error: 'You have already completed this test.' });
      }
      // Rejoining: return existing attempt details
      return res.json({ ok: true, attempt: attempt });
    }

    // Create new in_progress attempt
    var durationSec = test.totalDurationSec || (15 * 60);

    attempt = await AssessmentResult.create({
      userEmail: req.user.email,
      userName: req.user.name || req.user.email.split('@')[0],
      assessmentId: test._id.toString(),
      title: test.title,
      type: 'test',
      totalQuestions: test.totalQuestions || 0,
      status: 'in_progress',
      startTimeMs: Date.now(),
      durationSeconds: durationSec,
      orgId: test.orgId,
      malpracticeCount: 0,
      userAnswers: {},
      currentIndex: 0
    });

    res.json({ ok: true, attempt: attempt });
  } catch (err) {
    console.error('[Student API] Start test error:', err);
    res.status(500).json({ error: 'Failed to start test.' });
  }
});

/**
 * POST /api/student/tests/:id/malpractice — Increment malpractice count for active test
 */
router.post('/student/tests/:id/malpractice', async function (req, res) {
  try {
    var test = await Test.findById(req.params.id).lean();
    if (!test) return res.status(404).json({ error: 'Test not found.' });

    var attempt = await AssessmentResult.findOne({
      userEmail: req.user.email,
      assessmentId: req.params.id,
      status: 'in_progress'
    });

    if (!attempt) return res.status(400).json({ error: 'No active session found.' });

    attempt.malpracticeCount = (attempt.malpracticeCount || 0) + 1;
    await attempt.save();

    var limitReached = attempt.malpracticeCount >= (test.malpracticeLimit || 3);
    res.json({
      ok: true,
      malpracticeCount: attempt.malpracticeCount,
      limitReached: limitReached
    });
  } catch (err) {
    console.error('[Student API] Malpractice update error:', err);
    res.status(500).json({ error: 'Failed to update malpractice status.' });
  }
});

/**
 * GET /api/student/tests/:id/session — Get active test attempt state
 */
router.get('/student/tests/:id/session', async function (req, res) {
  try {
    var attempt = await AssessmentResult.findOne({
      userEmail: req.user.email,
      assessmentId: req.params.id
    }).lean();

    res.json({ ok: true, attempt: attempt });
  } catch (err) {
    console.error('[Student API] Get test session error:', err);
    res.status(500).json({ error: 'Failed to fetch session.' });
  }
});

/**
 * POST /api/student/tests/:id/submit — Securely evaluate and submit a test attempt
 */
router.post('/student/tests/:id/submit', async function (req, res) {
  try {
    var test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found.' });

    var attempt = await AssessmentResult.findOne({
      userEmail: req.user.email,
      assessmentId: req.params.id
    });

    if (!attempt) return res.status(400).json({ error: 'Attempt session not found.' });
    if (attempt.status === 'completed') {
      return res.json({ ok: true, alreadySubmitted: true });
    }

    var userAnswers = req.body.userAnswers || {};

    // Use centralized evaluation service
    var evalResult = evaluateTest(test.sections, userAnswers);

    attempt.status = 'completed';
    attempt.completedAt = new Date();
    attempt.userAnswers = userAnswers;
    attempt.correctCount = evalResult.correctCount;
    attempt.wrongCount = evalResult.wrongCount;
    attempt.percentage = evalResult.percentage;
    attempt.totalMarks = evalResult.totalMarks;
    attempt.earnedMarks = evalResult.earnedMarks;
    attempt.questions = evalResult.evaluatedQuestions;

    await attempt.save();

    // Prepare response payload based on security config
    var response = {
      ok: true,
      showResult: test.showResult,
      showAnswer: test.showAnswer
    };

    if (test.showResult) {
      response.percentage = evalResult.percentage;
      response.correctCount = evalResult.correctCount;
      response.wrongCount = evalResult.wrongCount;
      response.totalQuestions = evalResult.evaluatedQuestions.length;
      response.totalMarks = evalResult.totalMarks;
      response.earnedMarks = evalResult.earnedMarks;

      if (test.showAnswer) {
        response.questions = evalResult.evaluatedQuestions;
      } else {
        // Strip correct answers if showAnswer is false
        response.questions = evalResult.evaluatedQuestions.map(function (eq) {
          return {
            questionId: eq.questionId,
            questionText: eq.questionText,
            type: eq.type,
            options: eq.options,
            userAnswer: eq.userAnswer
          };
        });
      }
    }

    res.json(response);
  } catch (err) {
    console.error('[Student API] Submit test error:', err);
    res.status(500).json({ error: 'Failed to submit test.' });
  }
});

module.exports = router;
