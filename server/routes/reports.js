/**
 * Reports routes — Student-wise, Test-wise, and Overall org reports.
 * All routes require authentication + admin/super_admin role.
 */
const express = require('express');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const User = require('../models/User');
const Test = require('../models/Test');
const AssessmentResult = require('../models/AssessmentResult');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/**
 * Helper: resolve orgId from query or user context.
 * super_admin must provide orgId. admin uses own orgId.
 */
function resolveOrgId(req) {
  if (req.user.role === 'super_admin') {
    return req.query.orgId || null;
  }
  return req.user.orgId ? String(req.user.orgId) : null;
}

/** Helper: safely convert string to ObjectId */
function toObjectId(id) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch (e) {
    return null;
  }
}

/* ══════════════════════════════════════════════════
   1. STUDENT-WISE REPORT
   ══════════════════════════════════════════════════ */

/**
 * GET /api/reports/students?orgId=&page=&limit=&search=&sortBy=&order=
 * Returns paginated list of students with aggregated test stats.
 */
router.get('/students', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID is required.' });

    var page = Math.max(1, parseInt(req.query.page, 10) || 1);
    var limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    var search = (req.query.search || '').trim();
    var sortBy = req.query.sortBy || 'name';
    var order = req.query.order === 'desc' ? -1 : 1;

    // Build student query
    var studentQuery = { orgId: toObjectId(orgId), role: 'student', isActive: true };
    if (search) {
      var regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      studentQuery.$or = [{ name: regex }, { email: regex }, { registerNo: regex }];
    }

    var totalStudents = await User.countDocuments(studentQuery);
    var students = await User.find(studentQuery)
      .select('name email registerNo branch gender')
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Aggregate results for these students by email
    var studentEmails = students.map(function (s) { return s.email; });

    // Match by userEmail (reliable — orgId may be null on older records)
    var pipeline = [
      { $match: { userEmail: { $in: studentEmails }, status: 'completed' } },
      { $group: {
        _id: '$userEmail',
        testsAttended: { $sum: 1 },
        totalCorrect: { $sum: '$correctCount' },
        totalWrong: { $sum: '$wrongCount' },
        totalQuestions: { $sum: '$totalQuestions' },
        avgPercentage: { $avg: '$percentage' },
        earnedMarks: { $sum: { $ifNull: ['$earnedMarks', 0] } },
        totalMarks: { $sum: { $ifNull: ['$totalMarks', 0] } },
        totalMalpractice: { $sum: { $ifNull: ['$malpracticeCount', 0] } }
      }}
    ];
    var statsArr = await AssessmentResult.aggregate(pipeline);
    var statsMap = {};
    statsArr.forEach(function (s) { statsMap[s._id] = s; });

    var list = students.map(function (s) {
      var stats = statsMap[s.email] || {};
      return {
        id: s._id,
        name: s.name,
        email: s.email,
        registerNo: s.registerNo || '',
        branch: s.branch || '',
        testsAttended: stats.testsAttended || 0,
        totalCorrect: stats.totalCorrect || 0,
        totalWrong: stats.totalWrong || 0,
        avgPercentage: stats.avgPercentage ? Number(stats.avgPercentage.toFixed(2)) : 0,
        earnedMarks: stats.earnedMarks ? Number(stats.earnedMarks.toFixed(2)) : 0,
        totalMarks: stats.totalMarks ? Number(stats.totalMarks.toFixed(2)) : 0,
        malpracticeCount: stats.totalMalpractice || 0
      };
    });

    res.json({
      ok: true,
      students: list,
      pagination: { page: page, limit: limit, total: totalStudents, totalPages: Math.ceil(totalStudents / limit) }
    });
  } catch (err) {
    console.error('[Reports] Student-wise error:', err);
    res.status(500).json({ error: 'Failed to fetch student report.' });
  }
});

/**
 * GET /api/reports/students/:studentId?orgId=
 * Returns all completed test results for a specific student.
 */
router.get('/students/:studentId', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID is required.' });

    var student = await User.findById(req.params.studentId).select('name email registerNo branch').lean();
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    // Get all completed results for this student's email
    var results = await AssessmentResult.find({
      userEmail: student.email,
      status: 'completed'
    }).sort({ completedAt: -1 }).lean();

    // Get test passPercentage data
    var testIds = [...new Set(results.map(function (r) { return r.assessmentId; }))];
    var tests = await Test.find({ _id: { $in: testIds } }).select('passPercentage title').lean();
    var testMap = {};
    tests.forEach(function (t) { testMap[String(t._id)] = t; });

    var testResults = results.map(function (r) {
      var testDef = testMap[r.assessmentId] || {};
      var passPct = testDef.passPercentage !== undefined ? testDef.passPercentage : 30;
      return {
        testTitle: r.title || testDef.title || 'Unknown Test',
        percentage: r.percentage || 0,
        correctCount: r.correctCount || 0,
        wrongCount: r.wrongCount || 0,
        totalQuestions: r.totalQuestions || 0,
        earnedMarks: r.earnedMarks || 0,
        totalMarks: r.totalMarks || 0,
        malpracticeCount: r.malpracticeCount || 0,
        status: (r.percentage || 0) >= passPct ? 'Passed' : 'Failed',
        completedAt: r.completedAt
      };
    });

    // Overall summary
    var totalTests = testResults.length;
    var totalPassed = testResults.filter(function (t) { return t.status === 'Passed'; }).length;
    var avgPct = totalTests > 0 ? Number((testResults.reduce(function (sum, t) { return sum + t.percentage; }, 0) / totalTests).toFixed(2)) : 0;

    res.json({
      ok: true,
      student: student,
      summary: { totalTests: totalTests, passed: totalPassed, failed: totalTests - totalPassed, avgPercentage: avgPct },
      tests: testResults
    });
  } catch (err) {
    console.error('[Reports] Student detail error:', err);
    res.status(500).json({ error: 'Failed to fetch student detail report.' });
  }
});

/* ══════════════════════════════════════════════════
   2. TEST-WISE REPORT
   ══════════════════════════════════════════════════ */

/**
 * GET /api/reports/tests?orgId=&page=&limit=&search=&sortBy=&order=
 * Returns paginated list of tests with aggregated student performance stats.
 */
router.get('/tests', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID is required.' });

    var page = Math.max(1, parseInt(req.query.page, 10) || 1);
    var limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    var search = (req.query.search || '').trim();
    var sortBy = req.query.sortBy || 'title';
    var order = req.query.order === 'desc' ? -1 : 1;

    var testQuery = { orgId: toObjectId(orgId) };
    if (search) {
      testQuery.title = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    var totalTests = await Test.countDocuments(testQuery);
    var tests = await Test.find(testQuery)
      .select('title totalQuestions totalMarks passPercentage malpracticeLimit isAssigned startTime endTime')
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    var testIds = tests.map(function (t) { return String(t._id); });

    // Aggregate results per test — sort by percentage desc before grouping to get the actual top scorer
    var pipeline = [
      { $match: { assessmentId: { $in: testIds }, status: 'completed' } },
      { $sort: { percentage: -1 } },
      { $group: {
        _id: '$assessmentId',
        totalStudents: { $sum: 1 },
        avgPercentage: { $avg: '$percentage' },
        maxPercentage: { $max: '$percentage' },
        topScorerName: { $first: '$userName' },
        percentages: { $push: '$percentage' },
        malpracticeCounts: { $push: { $ifNull: ['$malpracticeCount', 0] } }
      }}
    ];
    var statsArr = await AssessmentResult.aggregate(pipeline);
    var statsMap = {};
    statsArr.forEach(function (s) { statsMap[s._id] = s; });

    var list = tests.map(function (t) {
      var stats = statsMap[String(t._id)] || {};
      var passPct = t.passPercentage !== undefined ? t.passPercentage : 30;
      var malpracticeLimit = t.malpracticeLimit !== undefined ? t.malpracticeLimit : 3;
      var totalStudents = stats.totalStudents || 0;
      var percentages = stats.percentages || [];
      var malpracticeCounts = stats.malpracticeCounts || [];
      var passedCount = percentages.filter(function (p) { return p >= passPct; }).length;
      var malpracticeSubmittedCount = malpracticeCounts.filter(function (mc) { return mc >= malpracticeLimit && malpracticeLimit > 0; }).length;

      return {
        id: t._id,
        title: t.title,
        totalQuestions: t.totalQuestions || 0,
        totalMarks: t.totalMarks || 0,
        passPercentage: passPct,
        isAssigned: t.isAssigned || false,
        totalStudents: totalStudents,
        malpracticeSubmitted: malpracticeSubmittedCount,
        passed: passedCount,
        failed: totalStudents - passedCount,
        avgPercentage: stats.avgPercentage ? Number(stats.avgPercentage.toFixed(2)) : 0,
        topScore: stats.maxPercentage || 0,
        topScorer: stats.topScorerName || '-'
      };
    });

    res.json({
      ok: true,
      tests: list,
      pagination: { page: page, limit: limit, total: totalTests, totalPages: Math.ceil(totalTests / limit) }
    });
  } catch (err) {
    console.error('[Reports] Test-wise error:', err);
    res.status(500).json({ error: 'Failed to fetch test report.' });
  }
});

/**
 * GET /api/reports/tests/:testId?orgId=&page=&limit=&search=&sortBy=&order=
 * Returns paginated list of students who attempted a specific test.
 */
router.get('/tests/:testId', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID is required.' });

    var test = await Test.findById(req.params.testId).select('title totalQuestions totalMarks passPercentage malpracticeLimit').lean();
    if (!test) return res.status(404).json({ error: 'Test not found.' });

    var page = Math.max(1, parseInt(req.query.page, 10) || 1);
    var limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    var search = (req.query.search || '').trim();
    var sortBy = req.query.sortBy || 'percentage';
    var order = req.query.order === 'asc' ? 1 : -1;

    // Get student emails from this org
    var orgStudents = await User.find({ orgId: toObjectId(orgId), role: 'student' }).select('email').lean();
    var orgEmails = orgStudents.map(function (s) { return s.email; });

    var resultQuery = {
      assessmentId: req.params.testId,
      status: { $in: ['completed', 'in_progress'] },
      userEmail: { $in: orgEmails }
    };
    if (search) {
      var regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      resultQuery.$or = [{ userName: regex }, { userEmail: regex }];
    }

    var totalResults = await AssessmentResult.countDocuments(resultQuery);
    var results = await AssessmentResult.find(resultQuery)
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    var passPct = test.passPercentage !== undefined ? test.passPercentage : 30;

    var malpracticeLimit = test.malpracticeLimit !== undefined ? test.malpracticeLimit : 3;

    var students = results.map(function (r, idx) {
      return {
        rank: (page - 1) * limit + idx + 1,
        attemptId: r._id,
        name: r.userName,
        email: r.userEmail,
        correctCount: r.correctCount || 0,
        wrongCount: r.wrongCount || 0,
        totalQuestions: r.totalQuestions || 0,
        percentage: r.percentage || 0,
        earnedMarks: r.earnedMarks || 0,
        totalMarks: r.totalMarks || 0,
        malpracticeCount: r.malpracticeCount || 0,
        status: r.status === 'in_progress' ? 'In Progress' : ((r.percentage || 0) >= passPct ? 'Passed' : 'Failed'),
        completedAt: r.completedAt
      };
    });

    // Summary stats using same email filter
    var allResults = await AssessmentResult.find({
      assessmentId: req.params.testId,
      status: 'completed',
      userEmail: { $in: orgEmails }
    }).select('percentage malpracticeCount').lean();

    var totalStudents = allResults.length;
    var passedCount = allResults.filter(function (r) { return (r.percentage || 0) >= passPct; }).length;
    var avgPct = totalStudents > 0 ? Number((allResults.reduce(function (sum, r) { return sum + (r.percentage || 0); }, 0) / totalStudents).toFixed(2)) : 0;
    var malpracticeSubmittedCount = allResults.filter(function (r) { return (r.malpracticeCount || 0) >= malpracticeLimit && malpracticeLimit > 0; }).length;

    res.json({
      ok: true,
      test: { title: test.title, totalQuestions: test.totalQuestions, totalMarks: test.totalMarks, passPercentage: passPct },
      summary: { totalStudents: totalStudents, passed: passedCount, failed: totalStudents - passedCount, avgPercentage: avgPct, malpracticeSubmitted: malpracticeSubmittedCount },
      students: students,
      pagination: { page: page, limit: limit, total: totalResults, totalPages: Math.ceil(totalResults / limit) }
    });
  } catch (err) {
    console.error('[Reports] Test detail error:', err);
    res.status(500).json({ error: 'Failed to fetch test detail report.' });
  }
});

/* ══════════════════════════════════════════════════
   3. OVERALL ORG REPORT
   ══════════════════════════════════════════════════ */

/**
 * GET /api/reports/overall?orgId=&page=&limit=&search=
 * Returns paginated list of all tests for the org with aggregate performance.
 */
router.get('/overall', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID is required.' });

    var page = Math.max(1, parseInt(req.query.page, 10) || 1);
    var limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    var search = (req.query.search || '').trim();

    var testQuery = { orgId: toObjectId(orgId) };
    if (search) {
      testQuery.title = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    var totalTests = await Test.countDocuments(testQuery);
    var tests = await Test.find(testQuery)
      .select('title totalQuestions totalMarks passPercentage isAssigned')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    var testIds = tests.map(function (t) { return String(t._id); });

    var pipeline = [
      { $match: { assessmentId: { $in: testIds }, status: 'completed' } },
      { $group: {
        _id: '$assessmentId',
        totalAttempted: { $sum: 1 },
        avgPercentage: { $avg: '$percentage' },
        percentages: { $push: '$percentage' }
      }}
    ];
    var statsArr = await AssessmentResult.aggregate(pipeline);
    var statsMap = {};
    statsArr.forEach(function (s) { statsMap[s._id] = s; });

    var list = tests.map(function (t) {
      var stats = statsMap[String(t._id)] || {};
      var passPct = t.passPercentage !== undefined ? t.passPercentage : 30;
      var percentages = stats.percentages || [];
      var passedCount = percentages.filter(function (p) { return p >= passPct; }).length;
      var totalAttempted = stats.totalAttempted || 0;

      return {
        id: t._id,
        title: t.title,
        totalQuestions: t.totalQuestions || 0,
        totalMarks: t.totalMarks || 0,
        isAssigned: t.isAssigned || false,
        totalAttempted: totalAttempted,
        passed: passedCount,
        failed: totalAttempted - passedCount,
        avgPercentage: stats.avgPercentage ? Number(stats.avgPercentage.toFixed(2)) : 0,
        passRate: totalAttempted > 0 ? Number(((passedCount / totalAttempted) * 100).toFixed(1)) : 0
      };
    });

    // Org-wide summary — count all completed results for tests in this org
    var allTestIds = (await Test.find({ orgId: toObjectId(orgId) }).select('_id').lean()).map(function (t) { return String(t._id); });
    var allPipeline = [
      { $match: { assessmentId: { $in: allTestIds }, status: 'completed' } },
      { $group: { _id: null, total: { $sum: 1 }, avgPct: { $avg: '$percentage' } }}
    ];
    var orgAgg = await AssessmentResult.aggregate(allPipeline);
    var orgStats = orgAgg[0] || { total: 0, avgPct: 0 };

    res.json({
      ok: true,
      orgSummary: { totalTests: totalTests, totalAttempts: orgStats.total, avgPercentage: orgStats.avgPct ? Number(orgStats.avgPct.toFixed(2)) : 0 },
      tests: list,
      pagination: { page: page, limit: limit, total: totalTests, totalPages: Math.ceil(totalTests / limit) }
    });
  } catch (err) {
    console.error('[Reports] Overall error:', err);
    res.status(500).json({ error: 'Failed to fetch overall report.' });
  }
});

/* ══════════════════════════════════════════════════
   4. EXCEL DOWNLOAD
   ══════════════════════════════════════════════════ */

/**
 * GET /api/reports/download/:type?orgId=&testId=&studentId=&sortBy=&order=
 * Downloads complete (non-paginated) report as .xlsx.
 */
router.get('/download/:type', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID is required.' });
    var type = req.params.type;
    var rows = [];
    var sheetName = 'Report';
    var fileName = 'report.xlsx';

    if (type === 'students') {
      sheetName = 'Student Report';
      fileName = 'student_wise_report.xlsx';
      var students = await User.find({ orgId: toObjectId(orgId), role: 'student', isActive: true }).select('name email registerNo branch').lean();
      var emails = students.map(function (s) { return s.email; });
      var pipeline = [
        { $match: { userEmail: { $in: emails }, status: 'completed' } },
        { $group: { _id: '$userEmail', testsAttended: { $sum: 1 }, avgPercentage: { $avg: '$percentage' }, totalCorrect: { $sum: '$correctCount' }, totalWrong: { $sum: '$wrongCount' } }}
      ];
      var statsArr = await AssessmentResult.aggregate(pipeline);
      var statsMap = {};
      statsArr.forEach(function (s) { statsMap[s._id] = s; });

      rows = students.map(function (s) {
        var st = statsMap[s.email] || {};
        return {
          'Name': s.name,
          'Email': s.email,
          'Register No': s.registerNo || '-',
          'Branch': s.branch || '-',
          'Tests Attended': st.testsAttended || 0,
          'Total Correct': st.totalCorrect || 0,
          'Total Wrong': st.totalWrong || 0,
          'Avg Percentage (%)': st.avgPercentage ? Number(st.avgPercentage.toFixed(2)) : 0
        };
      });

    } else if (type === 'student-detail') {
      sheetName = 'Student Detail';
      fileName = 'student_detail_report.xlsx';
      var student = await User.findById(req.query.studentId).select('name email').lean();
      if (!student) return res.status(404).json({ error: 'Student not found.' });
      var results = await AssessmentResult.find({ userEmail: student.email, status: 'completed' }).sort({ completedAt: -1 }).lean();
      var testIds = [...new Set(results.map(function (r) { return r.assessmentId; }))];
      var tests = await Test.find({ _id: { $in: testIds } }).select('passPercentage title').lean();
      var testMap = {};
      tests.forEach(function (t) { testMap[String(t._id)] = t; });

      rows = results.map(function (r) {
        var td = testMap[r.assessmentId] || {};
        var pp = td.passPercentage !== undefined ? td.passPercentage : 30;
        return {
          'Test Title': r.title || td.title || 'Unknown',
          'Correct': r.correctCount || 0,
          'Wrong': r.wrongCount || 0,
          'Total Questions': r.totalQuestions || 0,
          'Percentage (%)': r.percentage || 0,
          'Status': (r.percentage || 0) >= pp ? 'Passed' : 'Failed',
          'Completed At': r.completedAt ? new Date(r.completedAt).toLocaleString() : '-'
        };
      });

    } else if (type === 'tests') {
      sheetName = 'Test Report';
      fileName = 'test_wise_report.xlsx';
      var tests = await Test.find({ orgId: toObjectId(orgId) }).select('title totalQuestions totalMarks passPercentage').lean();
      var testIds = tests.map(function (t) { return String(t._id); });
      var pipeline = [
        { $match: { assessmentId: { $in: testIds }, status: 'completed' } },
        { $group: { _id: '$assessmentId', totalStudents: { $sum: 1 }, avgPercentage: { $avg: '$percentage' }, percentages: { $push: '$percentage' } }}
      ];
      var statsArr = await AssessmentResult.aggregate(pipeline);
      var statsMap = {};
      statsArr.forEach(function (s) { statsMap[s._id] = s; });

      rows = tests.map(function (t) {
        var st = statsMap[String(t._id)] || {};
        var pp = t.passPercentage !== undefined ? t.passPercentage : 30;
        var pcts = st.percentages || [];
        var passed = pcts.filter(function (p) { return p >= pp; }).length;
        return {
          'Test Title': t.title,
          'Total Questions': t.totalQuestions || 0,
          'Total Marks': t.totalMarks || 0,
          'Students Attempted': st.totalStudents || 0,
          'Passed': passed,
          'Failed': (st.totalStudents || 0) - passed,
          'Avg Percentage (%)': st.avgPercentage ? Number(st.avgPercentage.toFixed(2)) : 0
        };
      });

    } else if (type === 'test-detail') {
      sheetName = 'Test Detail';
      fileName = 'test_detail_report.xlsx';
      var testId = req.query.testId;
      if (!testId) return res.status(400).json({ error: 'Test ID is required.' });
      var test = await Test.findById(testId).select('title passPercentage').lean();
      if (!test) return res.status(404).json({ error: 'Test not found.' });

      // Get org students for filtering
      var orgStudents = await User.find({ orgId: toObjectId(orgId), role: 'student' }).select('email').lean();
      var orgEmails = orgStudents.map(function (s) { return s.email; });

      var sortBy = req.query.sortBy || 'percentage';
      var orderVal = req.query.order === 'asc' ? 1 : -1;
      var results = await AssessmentResult.find({
        assessmentId: testId, status: 'completed',
        userEmail: { $in: orgEmails }
      }).sort({ [sortBy]: orderVal }).lean();

      var pp = test.passPercentage !== undefined ? test.passPercentage : 30;
      rows = results.map(function (r, idx) {
        return {
          'Rank': idx + 1,
          'Name': r.userName,
          'Email': r.userEmail,
          'Correct': r.correctCount || 0,
          'Wrong': r.wrongCount || 0,
          'Total Questions': r.totalQuestions || 0,
          'Percentage (%)': r.percentage || 0,
          'Status': (r.percentage || 0) >= pp ? 'Passed' : 'Failed',
          'Completed At': r.completedAt ? new Date(r.completedAt).toLocaleString() : '-'
        };
      });

    } else if (type === 'overall') {
      sheetName = 'Overall Report';
      fileName = 'overall_org_report.xlsx';
      var tests = await Test.find({ orgId: toObjectId(orgId) }).select('title totalQuestions totalMarks passPercentage isAssigned').sort({ createdAt: -1 }).lean();
      var testIds = tests.map(function (t) { return String(t._id); });
      var pipeline = [
        { $match: { assessmentId: { $in: testIds }, status: 'completed' } },
        { $group: { _id: '$assessmentId', totalAttempted: { $sum: 1 }, avgPercentage: { $avg: '$percentage' }, percentages: { $push: '$percentage' } }}
      ];
      var statsArr = await AssessmentResult.aggregate(pipeline);
      var statsMap = {};
      statsArr.forEach(function (s) { statsMap[s._id] = s; });

      rows = tests.map(function (t) {
        var st = statsMap[String(t._id)] || {};
        var pp = t.passPercentage !== undefined ? t.passPercentage : 30;
        var pcts = st.percentages || [];
        var passed = pcts.filter(function (p) { return p >= pp; }).length;
        var total = st.totalAttempted || 0;
        return {
          'Test Title': t.title,
          'Total Questions': t.totalQuestions || 0,
          'Total Marks': t.totalMarks || 0,
          'Assigned': t.isAssigned ? 'Yes' : 'No',
          'Total Attempted': total,
          'Passed': passed,
          'Failed': total - passed,
          'Avg Percentage (%)': st.avgPercentage ? Number(st.avgPercentage.toFixed(2)) : 0,
          'Pass Rate (%)': total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0
        };
      });

    } else {
      return res.status(400).json({ error: 'Invalid report type.' });
    }

    // Generate XLSX
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'No Data': 'No records found' }]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    var buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('[Reports] Download error:', err);
    res.status(500).json({ error: 'Failed to generate report download.' });
  }
});

module.exports = router;
