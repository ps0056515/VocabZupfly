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


/**
 * POST /api/student/tests/:id/start — Mark student test attempt as in_progress
 */
router.post('/student/tests/:id/start', async function (req, res) {
  try {
    var test = await Test.findOne({
      _id: req.params.id,
      isAssigned: true,
      isDisabled: false,
      $or: [{ orgId: req.user.orgId }, { orgId: null }]
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
    var correctCount = 0;
    var wrongCount = 0;
    var evaluatedQuestions = [];

    // Flatten all test snapshot questions for server-side grading
    var flatQuestions = [];
    (test.sections || []).forEach(function (sec) {
      (sec.questions || []).forEach(function (q) {
        var qCopy = JSON.parse(JSON.stringify(q));
        qCopy.groupTitle = sec.name;
        flatQuestions.push(qCopy);
      });
    });

    flatQuestions.forEach(function (q, idx) {
      var userAns = userAnswers[idx];
      var isCorrect = false;

      var gradedSubQs = undefined;

      // Handle grading based on question type
      if (q.type === 'mcq') {
        var expectedIdx = q.options.indexOf(q.correctAnswer);
        isCorrect = userAns === expectedIdx;
      } else if (q.type === 'mcq_multi' || q.mcqType === 'multiple') {
        var expectedAnswers = (q.correctAnswer || '').split(',').map(s => s.trim());
        var expectedIndices = expectedAnswers.map(ans => q.options.indexOf(ans)).filter(i => i >= 0).sort();
        var userIndices = Array.isArray(userAns) ? userAns.slice().sort() : [];
        isCorrect = expectedIndices.length > 0 &&
                    expectedIndices.length === userIndices.length &&
                    expectedIndices.every((v, i) => v === userIndices[i]);
      } else if (q.type === 'fill_blank' && q.correctAnswers && q.correctAnswers.length > 1) {
        var expectedArr = q.correctAnswers.map(s => (s || '').trim().toLowerCase());
        var userArr = Array.isArray(userAns) ? userAns.map(s => (s || '').trim().toLowerCase()) : [];
        isCorrect = expectedArr.length > 0 &&
                    expectedArr.length === userArr.length &&
                    expectedArr.every((v, i) => v === userArr[i]);
      } else if (q.type === 'passage') {
        var subAnswers = userAns || {};
        var subQuestions = q.subQuestions || [];
        var allSubCorrect = true;
        
        gradedSubQs = subQuestions.map(function(sq, sqIdx) {
          var sqUserAns = subAnswers[sqIdx];
          var sqIsCorrect = false;
          
          if (sq.options && sq.options.length) {
            var expectedIdx = sq.options.indexOf(sq.correctAnswer);
            sqIsCorrect = sqUserAns === expectedIdx;
          } else if (Array.isArray(sq.correctAnswers) && sq.correctAnswers.length > 1) {
            var expectedArr = sq.correctAnswers.map(s => (s || '').trim().toLowerCase());
            var userArr = Array.isArray(sqUserAns) ? sqUserAns.map(s => (s || '').trim().toLowerCase()) : [];
            sqIsCorrect = expectedArr.length > 0 &&
                          expectedArr.length === userArr.length &&
                          expectedArr.every((v, i) => v === userArr[i]);
          } else {
            var expected = (sq.correctAnswer || (sq.correctAnswers ? sq.correctAnswers[0] : '') || '').trim().toLowerCase();
            var actual = typeof sqUserAns === 'string' ? sqUserAns.trim().toLowerCase() : '';
            sqIsCorrect = expected.length > 0 && expected === actual;
          }
          
          if (!sqIsCorrect) allSubCorrect = false;
          
          return {
            questionText: sq.questionText || sq.text,
            options: sq.options,
            correctAnswer: sq.correctAnswer,
            correctAnswers: sq.correctAnswers,
            userAnswer: sqUserAns,
            isCorrect: sqIsCorrect
          };
        });
        isCorrect = allSubCorrect;
      } else {
        // Single blanks, speaking, listening, etc.
        var expected = (q.correctAnswer || (q.correctAnswers ? q.correctAnswers[0] : '') || '').trim().toLowerCase();
        var actual = typeof userAns === 'string' ? userAns.trim().toLowerCase() : '';
        isCorrect = expected.length > 0 && expected === actual;
      }

      var qGraded = {
        questionId: q.questionId || q._id,
        questionText: q.questionText,
        type: q.type,
        options: q.options,
        correctAnswer: q.correctAnswer,
        correctAnswers: q.correctAnswers,
        explanation: q.explanation,
        marks: q.marks,
        userAnswer: userAns,
        isCorrect: isCorrect,
        groupTitle: q.groupTitle,
        subQuestions: gradedSubQs
      };

      if (isCorrect) correctCount++;
      else wrongCount++;

      evaluatedQuestions.push(qGraded);
    });

    var percentage = flatQuestions.length > 0 ? Number(((correctCount / flatQuestions.length) * 100).toFixed(2)) : 0;

    attempt.status = 'completed';
    attempt.completedAt = new Date();
    attempt.userAnswers = userAnswers;
    attempt.correctCount = correctCount;
    attempt.wrongCount = wrongCount;
    attempt.percentage = percentage;
    attempt.questions = evaluatedQuestions;

    await attempt.save();

    // Prepare response payload based on security config
    var response = {
      ok: true,
      showResult: test.showResult,
      showAnswer: test.showAnswer
    };

    if (test.showResult) {
      response.percentage = percentage;
      response.correctCount = correctCount;
      response.wrongCount = wrongCount;
      response.totalQuestions = flatQuestions.length;

      if (test.showAnswer) {
        response.questions = evaluatedQuestions;
      } else {
        // Strip correct answers if showAnswer is false
        response.questions = evaluatedQuestions.map(function (eq) {
          return {
            questionId: eq.questionId,
            questionText: eq.questionText,
            type: eq.type,
            options: eq.options,
            userAnswer: eq.userAnswer
            // Omit correct answers & correctness status
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
