/**
 * Admin routes — CRUD for organizations, admins, and students.
 * All routes require authentication + appropriate role.
 */
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Question = require('../models/Question');
const TenseGroup = require('../models/TenseGroup');
const Word = require('../models/Word');
const WordList = require('../models/WordList');
const TenseContent = require('../models/TenseContent');
const PracticeQuestion = require('../models/PracticeQuestion');
const Test = require('../models/Test');
const AssessmentResult = require('../models/AssessmentResult');
const { authenticate, requireRole } = require('../middleware/auth');
const { evaluateTest } = require('../services/evaluationService');

const router = express.Router();

// All admin routes require authentication
router.use(authenticate);

/* ══════════════════════════════════════════════════
   ORGANIZATION MANAGEMENT (super_admin only)
   ══════════════════════════════════════════════════ */

/**
 * GET /api/admin/orgs — List all organizations
 */
router.get('/orgs', requireRole('super_admin'), async function (req, res) {
  try {
    var orgs = await Organization.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    var counts = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: '$orgId', count: { $sum: 1 } } }
    ]);
    var countMap = {};
    counts.forEach(function (c) {
      if (c._id) countMap[c._id.toString()] = c.count;
    });
    orgs.forEach(function (o) {
      o.studentCount = countMap[o._id.toString()] || 0;
    });
    res.json({ ok: true, orgs: orgs });
  } catch (err) {
    console.error('[Admin] List orgs error:', err);
    res.status(500).json({ error: 'Failed to fetch organizations.' });
  }
});

/**
 * POST /api/admin/orgs — Create new organization
 */
router.post('/orgs', requireRole('super_admin'), async function (req, res) {
  try {
    var name = (req.body.name || '').trim();
    var email = (req.body.email || '').trim().toLowerCase();
    var address = (req.body.address || '').trim();

    if (!name || !email || !address) {
      return res.status(400).json({ error: 'Name, email, and address are required.' });
    }

    var existing = await Organization.findOne({ name: { $regex: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } });
    if (existing) {
      return res.status(400).json({ error: 'An organization with this name already exists.' });
    }

    var org = await Organization.create({
      name: name,
      email: email,
      address: address,
      createdBy: req.user.id,
    });

    res.status(201).json({ ok: true, org: org });
  } catch (err) {
    console.error('[Admin] Create org error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Organization already exists.' });
    }
    res.status(500).json({ error: 'Failed to create organization.' });
  }
});

/* ══════════════════════════════════════════════════
   ADMIN MANAGEMENT (super_admin only)
   ══════════════════════════════════════════════════ */

/**
 * GET /api/admin/admins — List all admins
 */
router.get('/admins', requireRole('super_admin'), async function (req, res) {
  try {
    var conditions = [{ role: 'admin' }];

    if (req.query.orgId && req.query.orgId !== 'all') {
      conditions.push({ orgId: req.query.orgId });
    }

    if (req.query.status === 'active') {
      conditions.push({ isActive: true });
    } else if (req.query.status === 'inactive') {
      conditions.push({ isActive: false });
    }

    if (req.query.search) {
      var search = req.query.search.trim();
      if (search) {
        var safeRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        conditions.push({
          $or: [
            { name: safeRegex },
            { email: safeRegex },
            { phone: safeRegex }
          ]
        });
      }
    }

    var filter = conditions.length > 1 ? { $and: conditions } : conditions[0];

    var page = Math.max(1, parseInt(req.query.page) || 1);
    var limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    var skip = (page - 1) * limit;

    var total = await User.countDocuments(filter);
    var admins = await User.find(filter)
      .populate('orgId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      ok: true,
      admins: admins.map(function (a) { return a.toSafeObject(); }),
      pagination: { page: page, limit: limit, total: total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    console.error('[Admin] List admins error:', err);
    res.status(500).json({ error: 'Failed to fetch admins.' });
  }
});

/**
 * PUT /api/admin/admins/:id/status — Toggle admin active/inactive status
 */
router.put('/admins/:id/status', requireRole('super_admin'), async function (req, res) {
  try {
    var admin = await User.findById(req.params.id);
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({ error: 'Admin not found.' });
    }

    var newStatus = typeof req.body.isActive === 'boolean' ? req.body.isActive : !admin.isActive;
    admin.isActive = newStatus;
    await admin.save();

    res.json({ ok: true, message: newStatus ? 'Admin activated.' : 'Admin deactivated.', admin: admin.toSafeObject() });
  } catch (err) {
    console.error('[Admin] Admin status update error:', err);
    res.status(500).json({ error: 'Failed to update admin status.' });
  }
});

/**
 * POST /api/admin/admins — Create a new admin
 * Body: { name, email, phone, orgId }
 */
router.post('/admins', requireRole('super_admin'), async function (req, res) {
  try {
    var name = (req.body.name || '').trim();
    var email = (req.body.email || '').trim().toLowerCase();
    var phone = (req.body.phone || '').trim();
    var orgId = req.body.orgId;
    var password = req.body.password || config.DEFAULT_STUDENT_PASSWORD;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    if (!orgId) {
      return res.status(400).json({ error: 'Organization is required.' });
    }

    // Check org exists
    var org = await Organization.findById(orgId);
    if (!org) {
      return res.status(400).json({ error: 'Organization not found.' });
    }

    // Check duplicate email
    var existing = await User.findOne({ email: email });
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    var admin = await User.create({
      name: name,
      email: email,
      phone: phone,
      password: password,
      role: 'admin',
      orgId: orgId,
      createdBy: req.user.id,
    });

    res.status(201).json({ ok: true, admin: admin.toSafeObject() });
  } catch (err) {
    console.error('[Admin] Create admin error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }
    res.status(500).json({ error: 'Failed to create admin.' });
  }
});

/* ══════════════════════════════════════════════════
   STUDENT MANAGEMENT (admin + super_admin)
   ══════════════════════════════════════════════════ */

/**
 * GET /api/admin/students — List students
 * Admins see only their org's students. Super admins see all (or filter by orgId).
 */
router.get('/students', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var conditions = [{ role: 'student' }];

    // Strict organization scoping: admins are locked to their own org; super admins can filter or view all
    if (req.user.role === 'admin') {
      conditions.push({ orgId: req.user.orgId });
    } else if (req.query.orgId && req.query.orgId !== 'all') {
      conditions.push({ orgId: req.query.orgId });
    }

    // Status filtering
    if (req.query.status === 'active') {
      conditions.push({ isActive: true });
    } else if (req.query.status === 'inactive') {
      conditions.push({ isActive: false });
    }

    // Search filtering within the scoped conditions
    if (req.query.search) {
      var search = req.query.search.trim();
      if (search) {
        var safeRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        conditions.push({
          $or: [
            { name: safeRegex },
            { email: safeRegex },
            { registerNo: safeRegex }
          ]
        });
      }
    }

    var filter = conditions.length > 1 ? { $and: conditions } : conditions[0];

    // Pagination
    var page = Math.max(1, parseInt(req.query.page) || 1);
    var limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    var skip = (page - 1) * limit;

    var total = await User.countDocuments(filter);
    var students = await User.find(filter)
      .populate('orgId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      ok: true,
      students: students.map(function (s) { return s.toSafeObject(); }),
      pagination: { page: page, limit: limit, total: total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[Admin] List students error:', err);
    res.status(500).json({ error: 'Failed to fetch students.' });
  }
});

/**
 * POST /api/admin/students — Create a single student
 * Body: { name, email, phone, gender, registerNo, branch }
 */
router.post('/students', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var name = (req.body.name || '').trim();
    var email = (req.body.email || '').trim().toLowerCase();
    var phone = (req.body.phone || '').trim();
    var gender = (req.body.gender || '').trim().toLowerCase();
    var registerNo = (req.body.registerNo || '').trim();
    var branch = (req.body.branch || '').trim();

    if (!name || !email || !phone || !gender || !registerNo || !branch) {
      return res.status(400).json({ error: 'All fields are required: name, email, phone, gender, registerNo, branch.' });
    }

    // Validate gender
    if (['male', 'female', 'other'].indexOf(gender) === -1) {
      return res.status(400).json({ error: 'Gender must be male, female, or other.' });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    // Check duplicate email
    var existing = await User.findOne({ email: email });
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    // Determine org: admin uses their own org, super_admin can specify
    var orgId = req.user.role === 'admin' ? req.user.orgId : (req.body.orgId || req.user.orgId);

    var student = await User.create({
      name: name,
      email: email,
      phone: phone,
      gender: gender,
      registerNo: registerNo,
      branch: branch,
      password: config.DEFAULT_STUDENT_PASSWORD,
      role: 'student',
      orgId: orgId,
      createdBy: req.user.id,
    });

    res.status(201).json({ ok: true, student: student.toSafeObject() });
  } catch (err) {
    console.error('[Admin] Create student error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }
    res.status(500).json({ error: 'Failed to create student.' });
  }
});

/**
 * POST /api/admin/students/bulk — Bulk upload students via Excel
 * Expects multipart form with 'file' field (.xlsx or .csv)
 * Expected columns: name, email, phone, gender, registerNo, branch
 *
 * Response: { ok, registered: [...], failed: [...] }
 * Failed entries include a 'failedComment' column explaining why.
 */
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: function (req, file, cb) {
    var ext = (file.originalname || '').split('.').pop().toLowerCase();
    if (['xlsx', 'xls', 'csv'].indexOf(ext) === -1) {
      return cb(new Error('Only .xlsx, .xls, and .csv files are allowed.'));
    }
    cb(null, true);
  },
});

router.post('/students/bulk', requireRole('admin', 'super_admin'), upload.single('file'), async function (req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an Excel file (.xlsx, .xls, or .csv).' });
    }

    // Parse Excel
    var workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    var sheetName = workbook.SheetNames[0];
    var sheet = workbook.Sheets[sheetName];
    var rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) {
      return res.status(400).json({ error: 'The uploaded file is empty or has no data rows.' });
    }

    // Normalize column names (case-insensitive)
    rows = rows.map(function (row) {
      var normalized = {};
      Object.keys(row).forEach(function (key) {
        var lower = key.trim().toLowerCase().replace(/[\s_-]+/g, '');
        if (lower === 'name' || lower === 'fullname' || lower === 'studentname') normalized.name = String(row[key]).trim();
        else if (lower === 'email' || lower === 'emailaddress' || lower === 'emailid') normalized.email = String(row[key]).trim().toLowerCase();
        else if (lower === 'phone' || lower === 'phonenumber' || lower === 'mobile' || lower === 'mobilenumber') normalized.phone = String(row[key]).trim();
        else if (lower === 'gender') normalized.gender = String(row[key]).trim().toLowerCase();
        else if (lower === 'registerno' || lower === 'registernumber' || lower === 'rollno' || lower === 'rollnumber' || lower === 'regno') normalized.registerNo = String(row[key]).trim();
        else if (lower === 'branch' || lower === 'department' || lower === 'dept') normalized.branch = String(row[key]).trim();
      });
      return normalized;
    });

    // Determine org
    var orgId = req.user.role === 'admin' ? req.user.orgId : (req.body.orgId || req.user.orgId);

    var registered = [];
    var failed = [];

    // Get all existing emails for duplicate check
    var emails = rows.map(function (r) { return (r.email || '').toLowerCase(); }).filter(Boolean);
    var existingUsers = await User.find({ email: { $in: emails } }, 'email');
    var existingEmails = {};
    existingUsers.forEach(function (u) { existingEmails[u.email] = true; });

    // Track emails within this batch to prevent intra-batch duplicates
    var batchEmails = {};

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var rowNum = i + 2; // Excel row number (header is row 1)
      var errors = [];

      if (!row.name) errors.push('Name is required');
      if (!row.email) errors.push('Email is required');
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push('Invalid email format');
      if (!row.phone) errors.push('Phone is required');
      if (!row.gender) errors.push('Gender is required');
      if (row.gender && ['male', 'female', 'other'].indexOf(row.gender) === -1) errors.push('Gender must be male, female, or other');
      if (!row.registerNo) errors.push('Register number is required');
      if (!row.branch) errors.push('Branch is required');

      if (row.email && existingEmails[row.email]) {
        errors.push('Email already registered in system');
      }
      if (row.email && batchEmails[row.email]) {
        errors.push('Duplicate email in uploaded file (row ' + batchEmails[row.email] + ')');
      }

      if (errors.length > 0) {
        failed.push({
          row: rowNum,
          name: row.name || '',
          email: row.email || '',
          phone: row.phone || '',
          gender: row.gender || '',
          registerNo: row.registerNo || '',
          branch: row.branch || '',
          failedComment: errors.join('; '),
        });
        continue;
      }

      batchEmails[row.email] = rowNum;

      try {
        var student = await User.create({
          name: row.name,
          email: row.email,
          phone: row.phone,
          gender: row.gender,
          registerNo: row.registerNo,
          branch: row.branch,
          password: config.DEFAULT_STUDENT_PASSWORD,
          role: 'student',
          orgId: orgId,
          createdBy: req.user.id,
        });
        registered.push(student.toSafeObject());
        existingEmails[row.email] = true;
      } catch (createErr) {
        var errMsg = 'Registration failed';
        if (createErr.code === 11000) errMsg = 'Email already registered (duplicate)';
        else if (createErr.message) errMsg = createErr.message;

        failed.push({
          row: rowNum,
          name: row.name || '',
          email: row.email || '',
          phone: row.phone || '',
          gender: row.gender || '',
          registerNo: row.registerNo || '',
          branch: row.branch || '',
          failedComment: errMsg,
        });
      }
    }

    res.json({
      ok: true,
      totalRows: rows.length,
      registeredCount: registered.length,
      failedCount: failed.length,
      registered: registered,
      failed: failed,
    });
  } catch (err) {
    console.error('[Admin] Bulk upload error:', err);
    if (err.message && err.message.indexOf('Only .xlsx') !== -1) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to process bulk upload.' });
  }
});

/**
 * GET /api/admin/students/template — Download Excel template
 */
router.get('/students/template', requireRole('admin', 'super_admin'), function (req, res) {
  var wb = XLSX.utils.book_new();
  var data = [
    { name: 'John Doe', email: 'john@example.com', phone: '9876543210', gender: 'male', registerNo: 'REG001', branch: 'CSE' },
    { name: 'Jane Smith', email: 'jane@example.com', phone: '9876543211', gender: 'female', registerNo: 'REG002', branch: 'ECE' },
  ];
  var ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  var buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="student_upload_template.xlsx"');
  res.end(buf);
});

/**
 * PUT /api/admin/students/:id — Update student
 */
router.put('/students/:id', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var student = await User.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Student not found.' });
    }

    // Admin can only update their org's students
    if (req.user.role === 'admin' && String(student.orgId) !== String(req.user.orgId)) {
      return res.status(403).json({ error: 'You can only manage students in your organization.' });
    }

    var updates = {};
    if (req.body.name) updates.name = req.body.name.trim();
    if (req.body.phone) updates.phone = req.body.phone.trim();
    if (req.body.gender) updates.gender = req.body.gender.trim().toLowerCase();
    if (req.body.registerNo) updates.registerNo = req.body.registerNo.trim();
    if (req.body.branch) updates.branch = req.body.branch.trim();

    // Don't allow email change (it's a unique identifier)
    var updated = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json({ ok: true, student: updated.toSafeObject() });
  } catch (err) {
    console.error('[Admin] Update student error:', err);
    res.status(500).json({ error: 'Failed to update student.' });
  }
});

/**
 * PUT /api/admin/students/:id/status — Toggle or set student active/inactive status
 */
router.put('/students/:id/status', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var student = await User.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Student not found.' });
    }

    if (req.user.role === 'admin' && String(student.orgId) !== String(req.user.orgId)) {
      return res.status(403).json({ error: 'You can only manage students in your organization.' });
    }

    var newStatus = typeof req.body.isActive === 'boolean' ? req.body.isActive : !student.isActive;
    student.isActive = newStatus;
    await student.save();

    res.json({ ok: true, message: newStatus ? 'Student activated.' : 'Student deactivated.', student: student.toSafeObject() });
  } catch (err) {
    console.error('[Admin] Status update error:', err);
    res.status(500).json({ error: 'Failed to update student status.' });
  }
});

/**
 * POST /api/admin/students/:id/reset-password — Reset student password to default
 */
router.post('/students/:id/reset-password', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var student = await User.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Student not found.' });
    }

    if (req.user.role === 'admin' && String(student.orgId) !== String(req.user.orgId)) {
      return res.status(403).json({ error: 'You can only manage students in your organization.' });
    }

    student.password = config.DEFAULT_STUDENT_PASSWORD;
    await student.save();

    res.json({ ok: true, message: 'Password reset to default (Test@123).' });
  } catch (err) {
    console.error('[Admin] Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

/* ══════════════════════════════════════════════════
   QUESTION MANAGEMENT (admin + super_admin)
   ══════════════════════════════════════════════════ */

/**
 * GET /api/admin/questions — List questions with pagination and search
 */
router.get('/questions', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var conditions = [];

    if (req.user.role === 'admin') {
      conditions.push({ $or: [{ orgId: req.user.orgId }, { orgId: null }] });
    }

    if (req.query.status === 'active') {
      conditions.push({ isActive: true });
    } else if (req.query.status === 'inactive') {
      conditions.push({ isActive: false });
    }

    if (req.query.type) {
      conditions.push({ type: req.query.type });
    }

    if (req.query.category) {
      conditions.push({ category: req.query.category });
    }

    if (req.query.tenseGroup) {
      conditions.push({ tenseGroup: req.query.tenseGroup });
    }

    if (req.query.wordList) {
      conditions.push({ wordList: req.query.wordList });
    }

    if (req.query.difficulty) {
      conditions.push({ difficulty: req.query.difficulty });
    }

    if (req.query.search) {
      var search = req.query.search.trim();
      if (search) {
        var safeRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        conditions.push({
          $or: [
            { questionText: safeRegex },
            { category: safeRegex },
          ]
        });
      }
    }

    var filter = conditions.length > 1 ? { $and: conditions } : (conditions.length === 1 ? conditions[0] : {});

    var page = Math.max(1, parseInt(req.query.page) || 1);
    var limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    var skip = (page - 1) * limit;

    var total = await Question.countDocuments(filter);
    var questions = await Question.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      ok: true,
      questions: questions,
      pagination: { page: page, limit: limit, total: total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    console.error('[Admin] List questions error:', err);
    res.status(500).json({ error: 'Failed to fetch questions.' });
  }
});

/**
 * POST /api/admin/questions — Create a new question
 */
router.post('/questions', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var questionText = (req.body.questionText || '').trim();
    if (!questionText) {
      return res.status(400).json({ error: 'Question text is required.' });
    }

    var orgIdValue = null;
    if (req.user.role === 'admin') {
      orgIdValue = req.user.orgId;
    } else {
      var bodyOrgId = req.body.orgId;
      if (bodyOrgId && bodyOrgId !== 'global') {
        orgIdValue = bodyOrgId;
      }
    }

    var q = await Question.create({
      questionText: questionText,
      category: req.body.category || 'General',
      tenseGroup: req.body.tenseGroup || null,
      wordList: req.body.wordList || null,
      difficulty: req.body.difficulty || 'medium',
      type: req.body.type || 'mcq',
      mcqType: req.body.mcqType || 'single',
      marks: typeof req.body.marks === 'number' ? req.body.marks : 1,
      duration: typeof req.body.duration === 'number' ? req.body.duration : 1,
      durationType: ['seconds', 'minutes', 'hours'].indexOf(req.body.durationType) !== -1 ? req.body.durationType : 'minutes',
      playLimit: typeof req.body.playLimit === 'number' ? req.body.playLimit : 1,
      subQuestions: req.body.subQuestions || [],
      options: req.body.options || [],
      correctAnswer: req.body.correctAnswer || '',
      correctAnswers: req.body.correctAnswers || [],
      explanation: req.body.explanation || '',
      createdBy: req.user.id,
      orgId: orgIdValue,
    });

    res.status(201).json({ ok: true, question: q });
  } catch (err) {
    console.error('[Admin] Create question error:', err);
    res.status(500).json({ error: 'Failed to create question.' });
  }
});

/**
 * GET /api/admin/questions/bulk/template — Download CSV bulk template for different question types
 */
router.get('/questions/bulk/template', requireRole('admin', 'super_admin'), function (req, res) {
  var type = req.query.type || 'mcq';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=lexiquest_template_' + type + '.csv');

  if (type === 'mcq') {
    res.send(
      'questionText,category,tenseGroup,wordList,difficulty,marks,duration,durationType,mcqType,optionA,optionB,optionC,optionD,optionE,optionF,correctAnswer,explanation\r\n' +
      '"What is the capital of France?","General","","","easy",1,1,"minutes","single","Paris","London","Berlin","Rome","","","A","Paris is the capital of France."'
    );
  } else if (type === 'fib') {
    res.send(
      'questionText,category,tenseGroup,wordList,difficulty,marks,duration,durationType,correctAnswers,explanation\r\n' +
      '"The sun rises in the ${blank} and sets in the ${blank}.","General","","","medium",2,2,"minutes","east,west","Sun rises in east and sets in west."'
    );
  } else if (type === 'speech') {
    res.send(
      'type,questionText,category,tenseGroup,wordList,difficulty,marks,duration,durationType,playLimit,explanation\r\n' +
      '"listen_repeat","I would like to have a cup of tea.","General","","","medium",1,30,"seconds",1,"Listen and repeat the spoken sentence."'
    );
  } else {
    res.status(400).send('Invalid template type');
  }
});

/**
 * POST /api/admin/questions/bulk — Process bulk upload questions via Excel/CSV
 */
router.post('/questions/bulk', requireRole('admin', 'super_admin'), upload.single('file'), async function (req, res) {
  try {
    var bulkType = req.body.type || 'mcq';
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an Excel or CSV file.' });
    }

    var workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    var sheetName = workbook.SheetNames[0];
    var sheet = workbook.Sheets[sheetName];
    var rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) {
      return res.status(400).json({ error: 'The uploaded file has no data rows.' });
    }

    var saved = [];
    var failed = [];

    var orgIdValue = null; // Always save bulk questions as global (null) by default

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var errs = [];

      var questionText = (row.questionText || '').toString().trim();
      var category = (row.category || 'General').toString().trim();
      var tenseGroup = (row.tenseGroup || '').toString().trim() || null;
      var wordList = (row.wordList || '').toString().trim() || null;
      var difficulty = (row.difficulty || 'medium').toString().trim().toLowerCase();
      var marks = parseInt(row.marks, 10);
      if (isNaN(marks) || marks < 1) marks = 1;
      
      var duration = parseInt(row.duration, 10);
      if (isNaN(duration) || duration < 1) {
        errs.push('Duration is required and must be a positive number.');
      }
      var durationType = (row.durationType || 'minutes').toString().trim().toLowerCase();
      if (['seconds', 'minutes', 'hours'].indexOf(durationType) === -1) {
        errs.push('Duration type is required and must be one of: seconds, minutes, hours.');
      }
      
      var explanation = (row.explanation || '').toString().trim();

      if (!questionText) {
        errs.push('Question text is required.');
      }

      if (['easy', 'medium', 'hard'].indexOf(difficulty) === -1) {
        difficulty = 'medium';
      }

      var qType = bulkType;
      var mcqType = 'single';
      var options = [];
      var correctAnswer = '';
      var correctAnswers = [];
      var playLimit = 1;

      if (bulkType === 'mcq') {
        qType = 'mcq';
        mcqType = (row.mcqType || 'single').toString().trim().toLowerCase();
        if (['single', 'multiple'].indexOf(mcqType) === -1) mcqType = 'single';

        var optA = (row.optionA || '').toString().trim();
        var optB = (row.optionB || '').toString().trim();
        var optC = (row.optionC || '').toString().trim();
        var optD = (row.optionD || '').toString().trim();
        var optE = (row.optionE || '').toString().trim();
        var optF = (row.optionF || '').toString().trim();

        if (optA) options.push(optA);
        if (optB) options.push(optB);
        if (optC) options.push(optC);
        if (optD) options.push(optD);
        if (optE) options.push(optE);
        if (optF) options.push(optF);

        if (options.length < 2) {
          errs.push('At least optionA and optionB are required.');
        }

        var correctRaw = (row.correctAnswer || '').toString().trim();
        if (!correctRaw) {
          errs.push('correctAnswer is required (e.g. A or A,B).');
        } else {
          correctAnswers = correctRaw.split(',').map(function(s) { return s.trim().toUpperCase(); });
          correctAnswers.forEach(function(ans) {
            var code = ans.charCodeAt(0);
            var optIdx = code - 65;
            if (optIdx < 0 || optIdx >= options.length) {
              errs.push('Invalid correctAnswer letter: "' + ans + '". Must be within the defined options.');
            }
          });
          correctAnswer = correctAnswers.join(',');
        }
      } else if (bulkType === 'fib') {
        qType = 'fib';
        var blanksCount = (questionText.match(/\$\{blank\}/g) || []).length;
        if (blanksCount === 0) {
          errs.push('Question text must contain at least one ${blank} token.');
        }

        var ansRaw = (row.correctAnswers || '').toString().trim();
        if (!ansRaw) {
          errs.push('correctAnswers is required (comma-separated).');
        } else {
          correctAnswers = ansRaw.split(',').map(function(s) { return s.trim(); });
          if (correctAnswers.length !== blanksCount) {
            errs.push('Blanks count (' + blanksCount + ') does not match correctAnswers list count (' + correctAnswers.length + ').');
          }
          correctAnswer = correctAnswers.join(',');
        }
      } else if (bulkType === 'speech') {
        var rowType = (row.type || 'listen_repeat').toString().trim().toLowerCase();
        if (['reading_listening', 'listen_repeat', 'jumbled_sentence', 'story_retelling'].indexOf(rowType) === -1) {
          rowType = 'listen_repeat';
        }
        qType = rowType;
        playLimit = parseInt(row.playLimit, 10);
        if (isNaN(playLimit) || playLimit < 1) playLimit = 1;
      }

      if (errs.length) {
        row.failedComment = errs.join(' ');
        failed.push(row);
      } else {
        try {
          var q = await Question.create({
            type: qType,
            mcqType: mcqType,
            questionText: questionText,
            category: category,
            tenseGroup: tenseGroup,
            wordList: wordList,
            difficulty: difficulty,
            marks: marks,
            duration: duration,
            durationType: durationType,
            playLimit: playLimit,
            options: options,
            correctAnswer: correctAnswer,
            correctAnswers: correctAnswers,
            explanation: explanation,
            createdBy: req.user.id,
            orgId: orgIdValue
          });
          saved.push(q);
        } catch (dbErr) {
          row.failedComment = 'Database error: ' + dbErr.message;
          failed.push(row);
        }
      }
    }

    res.json({
      ok: true,
      savedCount: saved.length,
      failedCount: failed.length,
      failed: failed
    });
  } catch (err) {
    console.error('[Admin] Questions bulk upload error:', err);
    res.status(500).json({ error: 'Failed to process bulk upload.' });
  }
});

/**
 * GET /api/admin/questions/:id — Get details of a single question
 */
router.get('/questions/:id', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var q = await Question.findById(req.params.id);
    if (!q) {
      return res.status(404).json({ error: 'Question not found.' });
    }
    if (req.user.role === 'admin' && q.orgId && q.orgId.toString() !== req.user.orgId.toString()) {
      return res.status(403).json({ error: 'Unauthorized to access this question.' });
    }
    res.json({ ok: true, question: q });
  } catch (err) {
    console.error('[Admin] Get question error:', err);
    res.status(500).json({ error: 'Failed to fetch question details.' });
  }
});

/**
 * PUT /api/admin/questions/:id — Update details of a single question
 */
router.put('/questions/:id', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var q = await Question.findById(req.params.id);
    if (!q) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    if (req.user.role === 'admin' && q.orgId && q.orgId.toString() !== req.user.orgId.toString()) {
      return res.status(403).json({ error: 'Unauthorized to update this question.' });
    }

    var questionText = (req.body.questionText || '').trim();
    if (!questionText) {
      return res.status(400).json({ error: 'Question text is required.' });
    }

    var orgIdValue = q.orgId;
    if (req.user.role === 'super_admin') {
      var bodyOrgId = req.body.orgId;
      if (bodyOrgId === 'global' || !bodyOrgId) {
        orgIdValue = null;
      } else {
        orgIdValue = bodyOrgId;
      }
    }

    q.questionText = questionText;
    q.category = req.body.category || 'General';
    q.tenseGroup = req.body.tenseGroup || null;
    q.wordList = req.body.wordList || null;
    q.difficulty = req.body.difficulty || 'medium';
    q.type = req.body.type || 'mcq';
    q.mcqType = req.body.mcqType || 'single';
    q.marks = typeof req.body.marks === 'number' ? req.body.marks : 1;
    q.duration = typeof req.body.duration === 'number' ? req.body.duration : 1;
    q.durationType = ['seconds', 'minutes', 'hours'].indexOf(req.body.durationType) !== -1 ? req.body.durationType : 'minutes';
    q.playLimit = typeof req.body.playLimit === 'number' ? req.body.playLimit : 1;
    q.subQuestions = req.body.subQuestions || [];
    q.options = req.body.options || [];
    q.correctAnswer = req.body.correctAnswer || '';
    q.correctAnswers = req.body.correctAnswers || [];
    q.explanation = req.body.explanation || '';
    q.orgId = orgIdValue;

    await q.save();
    res.json({ ok: true, question: q });
  } catch (err) {
    console.error('[Admin] Update question error:', err);
    res.status(500).json({ error: 'Failed to update question.' });
  }
});

/**
 * PUT /api/admin/questions/:id/status — Toggle question active status
 */
router.put('/questions/:id/status', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var q = await Question.findById(req.params.id);
    if (!q) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    q.isActive = typeof req.body.isActive === 'boolean' ? req.body.isActive : !q.isActive;
    await q.save();

    res.json({ ok: true, message: q.isActive ? 'Question activated.' : 'Question deactivated.', question: q });
  } catch (err) {
    console.error('[Admin] Question status update error:', err);
    res.status(500).json({ error: 'Failed to update question status.' });
  }
});

/* ══════════════════════════════════════════════════
   TENSE GROUPS MANAGEMENT (admin + super_admin)
   ══════════════════════════════════════════════════ */

/**
 * GET /api/admin/tenses — List all tense groups
 */
router.get('/tenses', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var page = parseInt(req.query.page || '1', 10);
    var limit = parseInt(req.query.limit || '0', 10); // 0 means return all

    if (limit > 0) {
      var skip = (page - 1) * limit;
      var total = await TenseGroup.countDocuments({ isActive: true });
      var groups = await TenseGroup.find({ isActive: true })
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean();

      return res.json({
        ok: true,
        groups: groups,
        page: page,
        pages: Math.ceil(total / limit),
        total: total
      });
    }

    var groups = await TenseGroup.find({ isActive: true }).sort({ name: 1 }).lean();
    res.json({ ok: true, groups: groups });
  } catch (err) {
    console.error('[Admin] List tenses error:', err);
    res.status(500).json({ error: 'Failed to fetch tense groups.' });
  }
});

/**
 * POST /api/admin/tenses — Create a new tense group
 */
router.post('/tenses', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var name = (req.body.name || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
    var displayName = (req.body.displayName || '').trim();

    if (!name) {
      return res.status(400).json({ error: 'Group name is required.' });
    }

    if (!displayName) {
      displayName = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    var existing = await TenseGroup.findOne({ name: name });
    if (existing) {
      return res.status(400).json({ error: 'A tense group with this name already exists.' });
    }

    var grp = await TenseGroup.create({
      name: name,
      displayName: displayName,
      description: (req.body.description || '').trim(),
    });

    res.status(201).json({ ok: true, group: grp });
  } catch (err) {
    console.error('[Admin] Create tense group error:', err);
    res.status(500).json({ error: 'Failed to create tense group.' });
  }
});

/**
 * POST /api/admin/migrate-cms — Migrate JSON file content (CMS) to MongoDB (Super-Admin only)
 */
router.post('/migrate-cms', requireRole('super_admin'), async function (req, res) {
  try {
    var dataDir = path.join(__dirname, '..', '..', 'data');
    var wordsPath = path.join(dataDir, 'words-merged.json');
    var listsPath = path.join(dataDir, 'word-lists.json');
    var tensesPath = path.join(dataDir, 'tenses-content.json');

    var migratedWordsCount = 0;
    var migratedListsCount = 0;
    var migratedTensesCount = 0;

    // 1. Migrate Words
    if (fs.existsSync(wordsPath)) {
      var words = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
      if (Array.isArray(words)) {
        for (var w of words) {
          if (!w.word) continue;
          var updateData = {
            phonetic: w.phonetic || '',
            pos: w.pos || 'noun',
            def: w.def || '',
            example: w.example || '',
            syn: w.syn || '',
            ant: w.ant || '',
            tags: Array.isArray(w.tags) ? w.tags : [],
            premium: !!w.premium,
            stub: !!w.stub
          };
          await Word.findOneAndUpdate(
            { word: w.word.trim() },
            { $set: updateData },
            { upsert: true, new: true }
          );
          migratedWordsCount++;
        }
      }
    }

    // 2. Migrate Word Lists
    if (fs.existsSync(listsPath)) {
      var listsData = JSON.parse(fs.readFileSync(listsPath, 'utf8'));
      var lists = listsData.lists || [];
      if (Array.isArray(lists)) {
        for (var l of lists) {
          if (!l.id || !l.title) continue;
          var updateList = {
            listNum: l.listNum || 0,
            title: l.title,
            icon: l.icon || '📘',
            color: l.color || 'lavender',
            listType: l.listType || 'grouped',
            groups: Array.isArray(l.groups) ? l.groups : [],
            words: Array.isArray(l.words) ? l.words : []
          };
          await WordList.findOneAndUpdate(
            { id: l.id },
            { $set: updateList },
            { upsert: true, new: true }
          );
          migratedListsCount++;
        }
      }
    }

    // 3. Migrate Tenses Content
    if (fs.existsSync(tensesPath)) {
      var tensesData = JSON.parse(fs.readFileSync(tensesPath, 'utf8'));
      var groups = Object.keys(tensesData);
      for (var grpName of groups) {
        var items = tensesData[grpName] || [];
        if (Array.isArray(items)) {
          // Clear existing for this group to prevent endless duplicates on re-run
          await TenseContent.deleteMany({ group: grpName });
          for (var item of items) {
            await TenseContent.create({
              group: grpName,
              category: item.category || 'reading',
              text: item.text || '',
              title: item.title || '',
              story: item.story || '',
              topic: item.topic || '',
              questions: Array.isArray(item.questions) ? item.questions : []
            });
            migratedTensesCount++;
          }
        }
      }
    }

    res.json({
      ok: true,
      message: 'Migration completed successfully!',
      stats: {
        words: migratedWordsCount,
        lists: migratedListsCount,
        tenses: migratedTensesCount
      }
    });
  } catch (err) {
    console.error('[Admin] CMS data migration error:', err);
    res.status(500).json({ error: 'CMS migration failed: ' + err.message });
  }
});

/**
 * GET /api/admin/tense-contents — List all tense content records
 */
router.get('/tense-contents', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var page = parseInt(req.query.page || '1', 10);
    var limit = parseInt(req.query.limit || '0', 10); // 0 means return all

    var filter = {};
    if (req.query.group && req.query.group !== 'all') {
      filter.group = req.query.group;
    }

    if (limit > 0) {
      var skip = (page - 1) * limit;
      var total = await TenseContent.countDocuments(filter);
      var items = await TenseContent.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      return res.json({
        ok: true,
        items: items,
        page: page,
        pages: Math.ceil(total / limit),
        total: total
      });
    }

    var items = await TenseContent.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, items: items });
  } catch (err) {
    console.error('[Admin] List tense contents error:', err);
    res.status(500).json({ error: 'Failed to fetch tense content.' });
  }
});

/**
 * POST /api/admin/tense-contents — Create a new tense content record
 */
router.post('/tense-contents', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var group = (req.body.group || '').trim();
    var category = (req.body.category || 'reading').trim();
    var text = (req.body.text || '').trim();
    var title = (req.body.title || '').trim();
    var story = (req.body.story || '').trim();
    var topic = (req.body.topic || '').trim();
    var questions = Array.isArray(req.body.questions) ? req.body.questions : [];

    if (!group) {
      return res.status(400).json({ error: 'Group is required.' });
    }

    var item = await TenseContent.create({
      group: group,
      category: category,
      text: text,
      title: title,
      story: story,
      topic: topic,
      questions: questions,
    });

    res.status(201).json({ ok: true, item: item });
  } catch (err) {
    console.error('[Admin] Create tense content error:', err);
    res.status(500).json({ error: 'Failed to create tense content.' });
  }
});

/**
 * PUT /api/admin/tense-contents/:id — Update a tense content record
 */
router.put('/tense-contents/:id', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var item = await TenseContent.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Tense content record not found.' });
    }

    if (req.body.group !== undefined) item.group = String(req.body.group).trim();
    if (req.body.category !== undefined) item.category = String(req.body.category).trim();
    if (req.body.text !== undefined) item.text = String(req.body.text).trim();
    if (req.body.title !== undefined) item.title = String(req.body.title).trim();
    if (req.body.story !== undefined) item.story = String(req.body.story).trim();
    if (req.body.topic !== undefined) item.topic = String(req.body.topic).trim();
    if (req.body.questions !== undefined) item.questions = req.body.questions;

    await item.save();
    res.json({ ok: true, item: item });
  } catch (err) {
    console.error('[Admin] Update tense content error:', err);
    res.status(500).json({ error: 'Failed to update tense content.' });
  }
});

/**
 * DELETE /api/admin/tense-contents/:id — Delete a tense content record
 */
router.delete('/tense-contents/:id', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var item = await TenseContent.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Tense content record not found.' });
    }
    res.json({ ok: true, message: 'Tense content record deleted.' });
  } catch (err) {
    console.error('[Admin] Delete tense content error:', err);
    res.status(500).json({ error: 'Failed to delete tense content.' });
  }
});

/**
 * GET /api/admin/words — List all words (paginated & searchable)
 */
router.get('/words', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var page = parseInt(req.query.page || '1', 10);
    var limit = parseInt(req.query.limit || '10', 10);
    var skip = (page - 1) * limit;
    var search = (req.query.q || '').trim();

    var filter = {};
    if (search) {
      filter.$or = [
        { word: { $regex: search, $options: 'i' } },
        { def: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    var total = await Word.countDocuments(filter);
    var items = await Word.find(filter)
      .sort({ word: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      ok: true,
      items: items,
      page: page,
      pages: Math.ceil(total / limit),
      total: total
    });
  } catch (err) {
    console.error('[Admin] List words error:', err);
    res.status(500).json({ error: 'Failed to fetch words.' });
  }
});

/**
 * POST /api/admin/words — Create a new word
 */
router.post('/words', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var word = (req.body.word || '').trim();
    if (!word) {
      return res.status(400).json({ error: 'Word text is required.' });
    }

    var existing = await Word.findOne({ word: { $regex: '^' + word + '$', $options: 'i' } });
    if (existing) {
      return res.status(400).json({ error: 'Word already exists.' });
    }

    var newWord = await Word.create({
      word: word,
      phonetic: (req.body.phonetic || '').trim(),
      pos: (req.body.pos || 'noun').trim(),
      def: (req.body.def || '').trim(),
      example: (req.body.example || '').trim(),
      syn: (req.body.syn || '').trim(),
      ant: (req.body.ant || '').trim(),
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      premium: !!req.body.premium,
      stub: !!req.body.stub,
    });

    res.status(201).json({ ok: true, item: newWord });
  } catch (err) {
    console.error('[Admin] Create word error:', err);
    res.status(500).json({ error: 'Failed to create word.' });
  }
});

/**
 * PUT /api/admin/words/:id — Update an existing word
 */
router.put('/words/:id', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var item = await Word.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Word not found.' });
    }

    if (req.body.word !== undefined) item.word = String(req.body.word).trim();
    if (req.body.phonetic !== undefined) item.phonetic = String(req.body.phonetic).trim();
    if (req.body.pos !== undefined) item.pos = String(req.body.pos).trim();
    if (req.body.def !== undefined) item.def = String(req.body.def).trim();
    if (req.body.example !== undefined) item.example = String(req.body.example).trim();
    if (req.body.syn !== undefined) item.syn = String(req.body.syn).trim();
    if (req.body.ant !== undefined) item.ant = String(req.body.ant).trim();
    if (req.body.tags !== undefined) item.tags = Array.isArray(req.body.tags) ? req.body.tags : [];
    if (req.body.premium !== undefined) item.premium = !!req.body.premium;
    if (req.body.stub !== undefined) item.stub = !!req.body.stub;

    await item.save();
    res.json({ ok: true, item: item });
  } catch (err) {
    console.error('[Admin] Update word error:', err);
    res.status(500).json({ error: 'Failed to update word.' });
  }
});

/**
 * DELETE /api/admin/words/:id — Delete a word
 */
router.delete('/words/:id', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var item = await Word.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Word not found.' });
    }
    res.json({ ok: true, message: 'Word deleted.' });
  } catch (err) {
    console.error('[Admin] Delete word error:', err);
    res.status(500).json({ error: 'Failed to delete word.' });
  }
});

/**
 * GET /api/admin/word-lists — List word lists (paginated)
 */
router.get('/word-lists', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var page = parseInt(req.query.page || '1', 10);
    var limit = parseInt(req.query.limit || '10', 10);
    var skip = (page - 1) * limit;

    var total = await WordList.countDocuments();
    var items = await WordList.find()
      .sort({ listNum: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      ok: true,
      items: items,
      page: page,
      pages: Math.ceil(total / limit),
      total: total
    });
  } catch (err) {
    console.error('[Admin] List word lists error:', err);
    res.status(500).json({ error: 'Failed to fetch word lists.' });
  }
});

/**
 * POST /api/admin/word-lists — Create a new word list
 */
router.post('/word-lists', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var id = (req.body.id || '').trim();
    var title = (req.body.title || '').trim();
    if (!id || !title) {
      return res.status(400).json({ error: 'List ID and Title are required.' });
    }

    var existing = await WordList.findOne({ id: id });
    if (existing) {
      return res.status(400).json({ error: 'List ID already exists.' });
    }

    var list = await WordList.create({
      id: id,
      listNum: parseInt(req.body.listNum || '0', 10),
      title: title,
      icon: (req.body.icon || '📘').trim(),
      color: (req.body.color || 'lavender').trim(),
      listType: (req.body.listType || 'grouped').trim(),
      groups: Array.isArray(req.body.groups) ? req.body.groups : [],
      words: Array.isArray(req.body.words) ? req.body.words : []
    });

    res.status(201).json({ ok: true, item: list });
  } catch (err) {
    console.error('[Admin] Create list error:', err);
    res.status(500).json({ error: 'Failed to create list.' });
  }
});

/**
 * PUT /api/admin/word-lists/:id — Update a word list
 */
router.put('/word-lists/:id', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var item = await WordList.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Word list not found.' });
    }

    if (req.body.title !== undefined) item.title = String(req.body.title).trim();
    if (req.body.listNum !== undefined) item.listNum = parseInt(req.body.listNum || '0', 10);
    if (req.body.icon !== undefined) item.icon = String(req.body.icon).trim();
    if (req.body.color !== undefined) item.color = String(req.body.color).trim();
    if (req.body.listType !== undefined) item.listType = String(req.body.listType).trim();
    if (req.body.groups !== undefined) item.groups = req.body.groups;
    if (req.body.words !== undefined) item.words = req.body.words;

    await item.save();
    res.json({ ok: true, item: item });
  } catch (err) {
    console.error('[Admin] Update list error:', err);
    res.status(500).json({ error: 'Failed to update list.' });
  }
});

/**
 * DELETE /api/admin/word-lists/:id — Delete a word list
 */
router.delete('/word-lists/:id', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var item = await WordList.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Word list not found.' });
    }
    res.json({ ok: true, message: 'Word list deleted.' });
  } catch (err) {
    console.error('[Admin] Delete list error:', err);
    res.status(500).json({ error: 'Failed to delete word list.' });
  }
});

// CSV parser and list builder helpers for bulk upload
function parseCsvLine(line) {
  var row = [];
  var cell = '';
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  return row;
}

function parseCsv(text) {
  var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
  if (!lines.length) return [];
  var headers = parseCsvLine(lines[0]);
  var result = [];

  for (var i = 1; i < lines.length; i++) {
    var vals = parseCsvLine(lines[i]);
    if (!vals.length) continue;
    var row = {};
    headers.forEach(function (h, idx) {
      row[h.trim()] = (vals[idx] || '').trim();
    });
    result.push(row);
  }
  return result;
}

function buildListsFromCsv(listRows, groupRows, groupWordRows, dictRows) {
  var byId = {};
  (listRows || []).forEach(function (r) {
    byId[r.id] = {
      id: r.id,
      listNum: parseInt(r.listNum, 10) || 0,
      title: r.title,
      listType: r.listType || 'grouped',
      icon: r.icon || '📘',
      color: r.color || 'lavender',
      groups: [],
      words: [],
    };
  });
  (groupRows || []).forEach(function (r) {
    if (!byId[r.listId]) return;
    byId[r.listId].groups.push({
      id: r.groupId,
      groupNum: parseInt(r.groupNum, 10) || 0,
      title: r.title,
      words: [],
    });
  });
  (groupWordRows || []).forEach(function (r) {
    var lst = byId[r.listId];
    if (!lst) return;
    var g = lst.groups.find(function (x) {
      return x.id === r.groupId;
    });
    if (!g) return;
    g.words.push({
      word: r.word,
      index: parseInt(r.index, 10) || 0,
      role: r.role || 'normal',
    });
  });
  (dictRows || []).forEach(function (r) {
    var lst = byId[r.listId];
    if (!lst) return;
    lst.words.push({
      word: r.word,
      index: parseInt(r.index, 10) || lst.words.length + 1,
    });
  });
  return {
    lists: (listRows || []).map(function (r) {
      return byId[r.id];
    }),
  };
}

/**
 * POST /api/admin/import/csv — Bulk import Words and Word Lists from CSV text map
 */
router.post('/import/csv', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var files = req.body || {};
    var wordCount = 0;
    var listCount = 0;

    // 1. Process Words
    if (files['Words.csv']) {
      var rows = parseCsv(files['Words.csv']);
      for (var r of rows) {
        if (!r.word) continue;
        var tags = r.tags ? r.tags.split('|').filter(Boolean) : ['GRE', 'GMAT', 'IELTS'];
        await Word.findOneAndUpdate(
          { word: { $regex: '^' + r.word.trim() + '$', $options: 'i' } },
          {
            word: r.word.trim(),
            phonetic: (r.phonetic || '').trim(),
            pos: (r.pos || 'word').trim(),
            def: (r.def || '').trim(),
            example: (r.example || '').trim(),
            syn: (r.syn || '').trim(),
            ant: (r.ant || '').trim(),
            tags: tags,
            premium: r.premium === 'true',
            stub: r.stub === 'true'
          },
          { upsert: true, new: true }
        );
        wordCount++;
      }
    }

    // 2. Process Word Lists / Groups
    var hasListsCsv = !!files['WordLists.csv'];
    var hasOtherListCsvs = !!(files['Groups.csv'] || files['GroupWords.csv'] || files['DictionaryWords.csv']);

    if (hasListsCsv || hasOtherListCsvs) {
      var listRows = [];
      if (hasListsCsv) {
        listRows = parseCsv(files['WordLists.csv']);
      } else {
        var existingLists = await WordList.find().lean();
        listRows = existingLists.map(function (l) {
          return {
            id: l.id,
            listNum: l.listNum,
            title: l.title,
            listType: l.listType || 'grouped',
            icon: l.icon || '',
            color: l.color || '',
          };
        });
      }

      var listsResult = buildListsFromCsv(
        listRows,
        files['Groups.csv'] ? parseCsv(files['Groups.csv']) : null,
        files['GroupWords.csv'] ? parseCsv(files['GroupWords.csv']) : null,
        files['DictionaryWords.csv'] ? parseCsv(files['DictionaryWords.csv']) : null
      );

      for (var lst of listsResult.lists) {
        if (!hasOtherListCsvs) {
          await WordList.findOneAndUpdate(
            { id: lst.id },
            {
              $set: {
                listNum: lst.listNum,
                title: lst.title,
                listType: lst.listType,
                icon: lst.icon,
                color: lst.color
              }
            },
            { upsert: true, new: true }
          );
        } else {
          await WordList.findOneAndUpdate(
            { id: lst.id },
            { $set: lst },
            { upsert: true, new: true }
          );
        }
        listCount++;
      }
    }

    var tensesCount = 0;
    if (files['TensesQuestions.csv']) {
      var rows = parseCsv(files['TensesQuestions.csv']);
      var tensesMap = {};
      for (var r of rows) {
        var grp = (r.group || '').trim();
        if (!grp) continue;
        var cat = (r.category || 'reading').trim();
        var title = (r.title || '').trim();
        var key = grp + '||' + cat + '||' + title;
        if (!tensesMap[key]) {
          tensesMap[key] = {
            group: grp,
            category: cat,
            title: title,
            text: (r.text || '').trim(),
            story: (r.story || '').trim(),
            topic: (r.topic || '').trim(),
            questions: []
          };
        }
        if (r.q) {
          var opts = r.options ? r.options.split('|').map(function(o) { return o.trim(); }) : [];
          tensesMap[key].questions.push({
            q: r.q.trim(),
            options: opts,
            answer: parseInt(r.answer, 10) || 0
          });
        }
      }

      for (var k in tensesMap) {
        var tc = tensesMap[k];
        await TenseContent.deleteOne({ group: tc.group, category: tc.category, title: tc.title });
        await TenseContent.create(tc);
        tensesCount++;
      }
    }

    var practiceSuccessCount = 0;
    var practiceFailedRows = [];
    if (files['PracticeQuestions.csv']) {
      var rows = parseCsv(files['PracticeQuestions.csv']);
      for (var r of rows) {
        try {
          var title = (r.title || '').trim();
          var correctAnswer = (r.correctAnswer || '').trim();
          var listId = (r.listId || '').trim();
          var groupId = (r.groupId || '').trim();
          
          if (!title) throw new Error('Missing title/question prompt');
          if (!correctAnswer) throw new Error('Missing correctAnswer');
          if (!listId) throw new Error('Missing listId');
          if (!groupId) throw new Error('Missing groupId');
          
          var listObj = await WordList.findOne({ id: listId });
          if (!listObj) throw new Error('Word List "' + listId + '" not found in database');
          
          var groupExists = (listObj.groups || []).some(g => g.id === groupId);
          if (!groupExists) throw new Error('Synonym Group "' + groupId + '" not found in list "' + listId + '"');
          
          var opts = r.options ? r.options.split('|').map(function(o) { return o.trim(); }) : [];
          
          await PracticeQuestion.create({
            listId: listId,
            groupId: groupId,
            category: (r.category || 'normal').trim(),
            type: (r.type || 'mcq').trim(),
            title: title,
            options: opts,
            correctAnswer: correctAnswer,
            createdBy: req.user.id
          });
          practiceSuccessCount++;
        } catch (err) {
          practiceFailedRows.push({
            listId: r.listId || '',
            groupId: r.groupId || '',
            category: r.category || '',
            type: r.type || '',
            title: r.title || '',
            options: r.options || '',
            correctAnswer: r.correctAnswer || '',
            Reason: err.message || 'Database error'
          });
        }
      }
    }

    res.json({
      ok: true,
      wordCount: wordCount,
      listCount: listCount,
      tensesCount: tensesCount,
      practiceSuccessCount: practiceSuccessCount,
      practiceFailedRows: practiceFailedRows,
      message: 'Successfully imported ' + wordCount + ' words, ' + listCount + ' word lists, and ' + tensesCount + ' tense records.'
    });
  } catch (err) {
    console.error('[Admin] Bulk import CSV error:', err);
    res.status(500).json({ error: 'Failed to process CSV import.' });
  }
});

/**
 * GET /api/admin/templates/tenses — Download TensesQuestions.csv template
 */
router.get('/templates/tenses', requireRole('admin', 'super_admin'), function (req, res) {
  var csv = 'group,category,title,text,story,topic,q,options,answer\n' +
    'Present Simple,reading,Simple Present Reading,"She works in a school.","A story about school...","Daily routine","Where does she work?","School|Hospital|Library",0\n' +
    'Present Simple,reading,Simple Present Reading,"She works in a school.","A story about school...","Daily routine","What is the category of this task?","Reading|Writing|Listening",0\n';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="TensesQuestions_Template.csv"');
  res.end(csv);
});

/**
 * GET /api/admin/dictionary — List all dictionary-type word lists with their words
 */
router.get('/dictionary', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var lists = await WordList.find({ listType: 'dictionary' }).sort({ listNum: 1 }).lean();
    res.json({ ok: true, lists: lists });
  } catch (err) {
    console.error('[Admin] List dictionaries error:', err);
    res.status(500).json({ error: 'Failed to fetch dictionary lists.' });
  }
});

/**
 * POST /api/admin/dictionary/add — Add a word to a dictionary list
 */
router.post('/dictionary/add', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var listId = (req.body.listId || '').trim();
    var word = (req.body.word || '').trim();
    if (!listId || !word) {
      return res.status(400).json({ error: 'List ID and word are required.' });
    }

    var lst = await WordList.findOne({ id: listId, listType: 'dictionary' });
    if (!lst) {
      return res.status(404).json({ error: 'Dictionary list not found.' });
    }

    // Check if word already exists
    var exists = (lst.words || []).some(function (w) {
      return (typeof w === 'string' ? w : w.word).toLowerCase() === word.toLowerCase();
    });
    if (exists) {
      return res.status(400).json({ error: 'Word already exists in this dictionary.' });
    }

    lst.words.push({ word: word, index: lst.words.length + 1 });
    await lst.save();

    // Also upsert the word into the Words collection
    await Word.findOneAndUpdate(
      { word: { $regex: '^' + word + '$', $options: 'i' } },
      { word: word, stub: true },
      { upsert: true, new: true }
    );

    res.json({ ok: true, list: lst });
  } catch (err) {
    console.error('[Admin] Add dictionary word error:', err);
    res.status(500).json({ error: 'Failed to add word.' });
  }
});

/**
 * POST /api/admin/dictionary/remove — Remove a word from a dictionary list
 */
router.post('/dictionary/remove', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var listId = (req.body.listId || '').trim();
    var word = (req.body.word || '').trim();
    if (!listId || !word) {
      return res.status(400).json({ error: 'List ID and word are required.' });
    }

    var lst = await WordList.findOne({ id: listId, listType: 'dictionary' });
    if (!lst) {
      return res.status(404).json({ error: 'Dictionary list not found.' });
    }

    lst.words = lst.words.filter(function (w) {
      return (typeof w === 'string' ? w : w.word).toLowerCase() !== word.toLowerCase();
    });
    await lst.save();

    res.json({ ok: true, list: lst });
  } catch (err) {
    console.error('[Admin] Remove dictionary word error:', err);
    res.status(500).json({ error: 'Failed to remove word.' });
  }
});

/**
 * GET /api/admin/word-lists/detail/:id — Get details of a single word list by custom id field
 */
router.get('/word-lists/detail/:id', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var lst = await WordList.findOne({ id: req.params.id }).lean();
    if (!lst) {
      return res.status(404).json({ error: 'Word list not found.' });
    }
    res.json({ ok: true, list: lst });
  } catch (err) {
    console.error('[Admin] Get single list error:', err);
    res.status(500).json({ error: 'Failed to fetch word list details.' });
  }
});

/**
 * POST /api/admin/word-lists/:id/groups — Add a group to a word list
 */
router.post('/word-lists/:id/groups', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var list = await WordList.findOne({ id: req.params.id });
    if (!list) return res.status(404).json({ error: 'Word list not found.' });

    var groupId = (req.body.id || '').trim();
    var title = (req.body.title || '').trim();
    var groupNum = parseInt(req.body.groupNum || '0', 10);

    if (!groupId || !title) {
      return res.status(400).json({ error: 'Group ID and Title are required.' });
    }

    var exists = (list.groups || []).some(g => g.id === groupId);
    if (exists) {
      return res.status(400).json({ error: 'Group ID already exists in this list.' });
    }

    list.groups.push({
      id: groupId,
      groupNum: groupNum,
      title: title,
      words: []
    });

    await list.save();
    res.json({ ok: true, list: list });
  } catch (err) {
    console.error('[Admin] Add group error:', err);
    res.status(500).json({ error: 'Failed to add group.' });
  }
});

/**
 * POST /api/admin/word-lists/:id/groups/:groupId/delete — Delete a group from a word list
 */
router.post('/word-lists/:id/groups/:groupId/delete', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var list = await WordList.findOne({ id: req.params.id });
    if (!list) return res.status(404).json({ error: 'Word list not found.' });

    list.groups = (list.groups || []).filter(g => g.id !== req.params.groupId);
    await list.save();
    res.json({ ok: true, list: list });
  } catch (err) {
    console.error('[Admin] Delete group error:', err);
    res.status(500).json({ error: 'Failed to delete group.' });
  }
});

/**
 * POST /api/admin/word-lists/:id/groups/:groupId/words — Add a word to a group
 */
router.post('/word-lists/:id/groups/:groupId/words', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var list = await WordList.findOne({ id: req.params.id });
    if (!list) return res.status(404).json({ error: 'Word list not found.' });

    var g = list.groups.find(x => x.id === req.params.groupId);
    if (!g) return res.status(404).json({ error: 'Group not found.' });

    var word = (req.body.word || '').trim();
    var role = (req.body.role || 'normal').trim();
    if (!word) return res.status(400).json({ error: 'Word is required.' });

    var exists = (g.words || []).some(w => w.word.toLowerCase() === word.toLowerCase());
    if (exists) return res.status(400).json({ error: 'Word already exists in this group.' });

    var nextIdx = (g.words || []).length + 1;
    g.words.push({ word: word, role: role, index: nextIdx });

    await list.save();

    // Also upsert to Word database
    await Word.findOneAndUpdate(
      { word: { $regex: '^' + word + '$', $options: 'i' } },
      { word: word, stub: true },
      { upsert: true, new: true }
    );

    res.json({ ok: true, list: list });
  } catch (err) {
    console.error('[Admin] Add group word error:', err);
    res.status(500).json({ error: 'Failed to add word to group.' });
  }
});

/**
 * POST /api/admin/word-lists/:id/groups/:groupId/words/remove — Remove a word from a group
 */
router.post('/word-lists/:id/groups/:groupId/words/remove', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var list = await WordList.findOne({ id: req.params.id });
    if (!list) return res.status(404).json({ error: 'Word list not found.' });

    var g = list.groups.find(x => x.id === req.params.groupId);
    if (!g) return res.status(404).json({ error: 'Group not found.' });

    var word = (req.body.word || '').trim();
    if (!word) return res.status(400).json({ error: 'Word is required.' });

    g.words = (g.words || []).filter(w => w.word.toLowerCase() !== word.toLowerCase());
    await list.save();
    res.json({ ok: true, list: list });
  } catch (err) {
    console.error('[Admin] Remove group word error:', err);
    res.status(500).json({ error: 'Failed to remove word from group.' });
  }
});

/**
 * GET /api/admin/templates/words — Download Words.csv template
 */
router.get('/templates/words', requireRole('admin', 'super_admin'), function (req, res) {
  var csv = 'word,phonetic,pos,def,example,syn,ant,tags,premium,stub\n' +
    'Ephemeral,/ɪˈfem.ər.əl/,adjective,Lasting for a very short time,The morning dew is ephemeral,Fleeting|Transient,Eternal|Permanent,GRE|IELTS,false,false\n' +
    'Ubiquitous,/juːˈbɪk.wɪ.təs/,adjective,Present everywhere,"Smartphones are ubiquitous in modern life",Omnipresent|Pervasive,Rare|Scarce,GRE|GMAT,false,false\n';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="Words_Template.csv"');
  res.end(csv);
});

/**
 * GET /api/admin/templates/word-lists — Download WordLists.csv template
 */
router.get('/templates/word-lists', requireRole('admin', 'super_admin'), function (req, res) {
  var csv = 'id,listNum,title,listType,icon,color\n' +
    'list-1,1,GRE Synonym List 1,grouped,📘,lavender\n' +
    'dict-1,2,Dictionary A-Z,dictionary,📖,peach\n';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="WordLists_Template.csv"');
  res.end(csv);
});

/**
 * GET /api/admin/templates/groups — Download Groups.csv template
 */
router.get('/templates/groups', requireRole('admin', 'super_admin'), function (req, res) {
  var csv = 'listId,groupId,groupNum,title\n' +
    'list-1,grp-1,1,Agree / Harmony\n' +
    'list-1,grp-2,2,Disagree / Conflict\n';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="Groups_Template.csv"');
  res.end(csv);
});

/**
 * GET /api/admin/templates/group-words — Download GroupWords.csv template
 */
router.get('/templates/group-words', requireRole('admin', 'super_admin'), function (req, res) {
  var csv = 'listId,groupId,word,index,role\n' +
    'list-1,grp-1,Accord,1,normal\n' +
    'list-1,grp-1,Concord,2,normal\n';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="GroupWords_Template.csv"');
  res.end(csv);
});

/**
 * GET /api/admin/templates/dictionary-words — Download DictionaryWords.csv template
 */
router.get('/templates/dictionary-words', requireRole('admin', 'super_admin'), function (req, res) {
  var csv = 'listId,word,index\n' +
    'dict-1,Aberration,1\n' +
    'dict-1,Abrogate,2\n';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="DictionaryWords_Template.csv"');
  res.end(csv);
});

/**
 * GET /api/admin/practice-questions — List all practice questions (paginated & searchable/filterable)
 */
router.get('/practice-questions', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var conditions = [];
    
    if (req.query.search) {
      var search = req.query.search.trim();
      if (search) {
        conditions.push({ title: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
      }
    }
    
    if (req.query.listId) {
      conditions.push({ listId: req.query.listId });
    }
    
    if (req.query.groupId) {
      conditions.push({ groupId: req.query.groupId });
    }
    
    var filter = conditions.length > 1 ? { $and: conditions } : (conditions.length === 1 ? conditions[0] : {});
    
    var page = Math.max(1, parseInt(req.query.page) || 1);
    var limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    var skip = (page - 1) * limit;
    
    var total = await PracticeQuestion.countDocuments(filter);
    var questions = await PracticeQuestion.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
      
    res.json({
      ok: true,
      questions: questions,
      pagination: { page: page, limit: limit, total: total, pages: Math.ceil(total / limit) || 1 }
    });
  } catch (err) {
    console.error('[Admin] List practice questions error:', err);
    res.status(500).json({ error: 'Failed to fetch practice questions.' });
  }
});

/**
 * POST /api/admin/practice-questions — Create or Update a practice question
 */
router.post('/practice-questions', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var id = req.body.id;
    var listId = (req.body.listId || '').trim();
    var groupId = (req.body.groupId || '').trim();
    var category = (req.body.category || 'normal').trim();
    var type = (req.body.type || 'mcq').trim();
    var title = (req.body.title || '').trim();
    var options = Array.isArray(req.body.options) ? req.body.options : [];
    var correctAnswer = (req.body.correctAnswer || '').trim();
    
    if (!listId || !groupId || !title || !correctAnswer) {
      return res.status(400).json({ error: 'List ID, Group ID, Title (Question Text), and Correct Answer are required.' });
    }
    
    var qData = {
      listId: listId,
      groupId: groupId,
      category: category,
      type: type,
      title: title,
      options: (type === 'mcq' || type === 'mcq_multi') ? options : [],
      correctAnswer: correctAnswer
    };
    
    var question;
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      question = await PracticeQuestion.findByIdAndUpdate(id, { $set: qData }, { new: true });
      if (!question) return res.status(404).json({ error: 'Question not found.' });
    } else {
      qData.createdBy = req.user.id;
      question = await PracticeQuestion.create(qData);
    }
    
    res.json({ ok: true, question: question });
  } catch (err) {
    console.error('[Admin] Save practice question error:', err);
    res.status(500).json({ error: 'Failed to save practice question.' });
  }
});

/**
 * DELETE /api/admin/practice-questions/:id — Delete a practice question
 */
router.delete('/practice-questions/:id', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var question = await PracticeQuestion.findByIdAndDelete(req.params.id);
    if (!question) return res.status(404).json({ error: 'Question not found.' });
    res.json({ ok: true, message: 'Practice question deleted.' });
  } catch (err) {
    console.error('[Admin] Delete practice question error:', err);
    res.status(500).json({ error: 'Failed to delete practice question.' });
  }
});

/**
 * GET /api/admin/templates/practice-questions — Download PracticeQuestions.csv template
 */
router.get('/templates/practice-questions', requireRole('admin', 'super_admin'), function (req, res) {
  var csv = 'List,Group,Question,Option A,Option B,Option C,Option D,Answer Key,Category\n' +
    'list-1,grp-1,"What is a synonym for Accord?",Agreement,Conflict,Refusal,Denial,Agreement,normal\n' +
    'list-1,grp-1,"Fill in the blank: Agreement is synonym of ___",,,,,Accord,normal\n';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="PracticeQuestions_Template.csv"');
  res.end(csv);
});

/**
 * POST /api/admin/practice-questions/import — Import practice questions from CSV or XLSX file
 */
router.post('/practice-questions/import', requireRole('admin', 'super_admin'), upload.single('file'), async function (req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Please upload a file (.csv, .xlsx).' });
    }

    var rows = [];
    var filename = req.file.originalname || 'file.csv';
    var isXlsx = filename.endsWith('.xlsx') || filename.endsWith('.xls') || req.file.mimetype.includes('spreadsheet') || req.file.mimetype.includes('excel');

    if (isXlsx) {
      var workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      var sheetName = workbook.SheetNames[0];
      var sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } else {
      var csvText = req.file.buffer.toString('utf8');
      rows = parseCsv(csvText);
    }

    if (!rows || !rows.length) {
      return res.status(400).json({ error: 'The uploaded file is empty or has no data rows.' });
    }

    var practiceSuccessCount = 0;
    var practiceFailedRows = [];

    for (var r of rows) {
      var listInput = (r.List || r.listId || r.list || '').toString().trim();
      var groupInput = (r.Group || r.groupId || r.group || '').toString().trim();
      var title = (r.Question || r.title || r.question || '').toString().trim();
      var correctAnswer = (r['Answer Key'] || r.correctAnswer || r.answer || '').toString().trim();
      var category = (r.Category || r.category || 'normal').toString().trim();
      var type = (r.Type || r.type || '').toString().trim();

      // Gather options
      var opts = [];
      if (r.options) {
        opts = r.options.toString().split('|').map(function (o) { return o.trim(); });
      } else {
        var optA = (r['Option A'] || '').toString().trim();
        var optB = (r['Option B'] || '').toString().trim();
        var optC = (r['Option C'] || '').toString().trim();
        var optD = (r['Option D'] || '').toString().trim();
        if (optA || optB || optC || optD) {
          opts = [optA, optB, optC, optD].filter(Boolean);
        }
      }

      try {
        if (!title) throw new Error('Missing Question Prompt');
        if (!correctAnswer) throw new Error('Missing Answer Key');
        if (!listInput) throw new Error('Missing List ID or Title');
        if (!groupInput) throw new Error('Missing Group ID or Title');

        // Ignore question with same title (case-insensitive)
        var dup = await PracticeQuestion.findOne({
          title: { $regex: '^' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', $options: 'i' }
        });
        if (dup) throw new Error('Duplicate Question: A question with this title already exists');

        // Parse option key and ignore bracket data, e.g. A (Agreement) -> Agreement
        // Also support multiple answers like A, B -> mcq_multi
        var cleanAnswerParts = [];
        var rawAnswerParts = correctAnswer.split(/[,&]/).map(function(s) { return s.trim(); });
        for (var part of rawAnswerParts) {
          var match = part.match(/^([A-Fa-f])(?:\b|\s*\(|$)/);
          if (match) {
            var optLetter = match[1].toUpperCase();
            var optIdx = optLetter.charCodeAt(0) - 65;
            var optVal = opts[optIdx];
            if (optVal) {
              cleanAnswerParts.push(optVal);
            } else {
              cleanAnswerParts.push(part);
            }
          } else {
            cleanAnswerParts.push(part);
          }
        }
        correctAnswer = cleanAnswerParts.join(', ');

        if (!type) {
          if (cleanAnswerParts.length > 1) {
            type = 'mcq_multi';
          } else {
            type = opts.length > 0 ? 'mcq' : 'fib';
          }
        }

        // Match list by ID or Title (case-insensitive)
        var listObj = await WordList.findOne({
          $or: [
            { id: listInput },
            { title: new RegExp('^' + listInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
          ]
        });
        if (!listObj) throw new Error('Word List "' + listInput + '" not found in database');

        // Match group by ID or Title (case-insensitive)
        var groupObj = (listObj.groups || []).find(function (g) {
          return g.id.toLowerCase() === groupInput.toLowerCase() ||
                 g.title.toLowerCase() === groupInput.toLowerCase();
        });
        if (!groupObj) throw new Error('Synonym Group "' + groupInput + '" not found in list "' + listObj.title + '"');

        await PracticeQuestion.create({
          listId: listObj.id,
          groupId: groupObj.id,
          category: category,
          type: type,
          title: title,
          options: opts,
          correctAnswer: correctAnswer,
          createdBy: req.user.id
        });
        practiceSuccessCount++;
      } catch (err) {
        practiceFailedRows.push({
          List: listInput,
          Group: groupInput,
          Question: title,
          'Option A': r['Option A'] || '',
          'Option B': r['Option B'] || '',
          'Option C': r['Option C'] || '',
          'Option D': r['Option D'] || '',
          'Answer Key': correctAnswer,
          Category: category,
          Reason: err.message || 'Database error'
        });
      }
    }

    res.json({
      ok: true,
      practiceSuccessCount: practiceSuccessCount,
      practiceFailedRows: practiceFailedRows
    });
  } catch (err) {
    console.error('[Admin] Bulk practice questions import error:', err);
    res.status(500).json({ error: 'Failed to process bulk upload.' });
  }
});


/* ══════════════════════════════════════════════════
   TEST MANAGEMENT
   ══════════════════════════════════════════════════ */

/**
 * GET /api/admin/tests/check-title — Check if a test title is unique
 */
router.get('/tests/check-title', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var title = (req.query.title || '').trim();
    var excludeId = req.query.excludeId || null;
    if (!title) return res.json({ ok: true, exists: false });

    var filter = { title: new RegExp('^' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
    if (excludeId) filter._id = { $ne: excludeId };
    var exists = await Test.findOne(filter).lean();
    res.json({ ok: true, exists: !!exists });
  } catch (err) {
    console.error('[Admin] Check test title error:', err);
    res.status(500).json({ error: 'Failed to check title.' });
  }
});

/**
 * GET /api/admin/tests — List tests with pagination, search, status, org filter
 */
router.get('/tests', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var conditions = [];

    if (req.user.role === 'admin') {
      conditions.push({ $or: [{ orgId: req.user.orgId }, { orgId: null }] });
    } else if (req.query.orgId && req.query.orgId !== 'all') {
      conditions.push({ orgId: req.query.orgId });
    }

    if (req.query.status) {
      var now = new Date();
      if (req.query.status === 'draft') {
        conditions.push({ isAssigned: false, isDisabled: false });
      } else if (req.query.status === 'assigned') {
        conditions.push({ isAssigned: true, isDisabled: false, startTime: { $gt: now } });
      } else if (req.query.status === 'active') {
        conditions.push({ isAssigned: true, isDisabled: false, startTime: { $lte: now }, endTime: { $gte: now } });
      } else if (req.query.status === 'expired') {
        conditions.push({ isAssigned: true, isDisabled: false, endTime: { $lt: now } });
      } else if (req.query.status === 'disabled') {
        conditions.push({ isDisabled: true });
      }
    }

    if (req.query.search) {
      var search = req.query.search.trim();
      if (search) {
        var safeRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        conditions.push({ title: safeRegex });
      }
    }

    var filter = conditions.length > 1 ? { $and: conditions } : (conditions.length === 1 ? conditions[0] : {});

    var page = Math.max(1, parseInt(req.query.page) || 1);
    var limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    var skip = (page - 1) * limit;

    var total = await Test.countDocuments(filter);
    var tests = await Test.find(filter)
      .select('-sections.questions.correctAnswer -sections.questions.correctAnswers -sections.questions.explanation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      ok: true,
      tests: tests,
      total: total,
      page: page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[Admin] List tests error:', err);
    res.status(500).json({ error: 'Failed to list tests.' });
  }
});

/**
 * POST /api/admin/tests — Create a new test
 */
router.post('/tests', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var title = (req.body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Test title is required.' });

    var existing = await Test.findOne({ title: new RegExp('^' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') });
    if (existing) return res.status(400).json({ error: 'A test with this title already exists.' });

    var sections = req.body.sections || [];
    if (!sections.length) return res.status(400).json({ error: 'At least one section is required.' });

    for (var si = 0; si < sections.length; si++) {
      if (!sections[si].name || !sections[si].name.trim()) {
        return res.status(400).json({ error: 'Section ' + (si + 1) + ' name is required.' });
      }
      if (!sections[si].questions || !sections[si].questions.length) {
        return res.status(400).json({ error: 'Section "' + sections[si].name + '" must have at least one question.' });
      }
    }

    var orgIdValue = null;
    if (req.body.orgId && req.body.orgId !== 'global') {
      orgIdValue = req.body.orgId;
    }

    var test = await Test.create({
      title: title,
      description: (req.body.description || '').trim(),
      showResult: typeof req.body.showResult === 'boolean' ? req.body.showResult : true,
      showAnswer: typeof req.body.showAnswer === 'boolean' ? req.body.showAnswer : true,
      malpracticeLimit: typeof req.body.malpracticeLimit === 'number' ? Math.max(0, req.body.malpracticeLimit) : 3,
      passPercentage: typeof req.body.passPercentage === 'number' ? Math.max(0, Math.min(100, req.body.passPercentage)) : 30,
      sections: sections,
      createdBy: req.user.id,
      orgId: orgIdValue,
    });

    res.status(201).json({ ok: true, test: test });
  } catch (err) {
    console.error('[Admin] Create test error:', err);
    res.status(500).json({ error: 'Failed to create test.' });
  }
});

/**
 * GET /api/admin/tests/:id — Get single test details
 */
router.get('/tests/:id', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var test = await Test.findById(req.params.id).lean();
    if (!test) return res.status(404).json({ error: 'Test not found.' });
    res.json({ ok: true, test: test });
  } catch (err) {
    console.error('[Admin] Get test error:', err);
    res.status(500).json({ error: 'Failed to fetch test.' });
  }
});

/**
 * PUT /api/admin/tests/:id — Edit a test (only if not assigned or before start)
 */
router.put('/tests/:id', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found.' });

    if (test.isAssigned && test.startTime && new Date() >= test.startTime) {
      return res.status(400).json({ error: 'Cannot edit test after its start time.' });
    }

    var title = (req.body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Test title is required.' });

    var dup = await Test.findOne({
      title: new RegExp('^' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'),
      _id: { $ne: test._id }
    });
    if (dup) return res.status(400).json({ error: 'A test with this title already exists.' });

    var sections = req.body.sections || [];
    if (!sections.length) return res.status(400).json({ error: 'At least one section is required.' });

    for (var si = 0; si < sections.length; si++) {
      if (!sections[si].name || !sections[si].name.trim()) {
        return res.status(400).json({ error: 'Section ' + (si + 1) + ' name is required.' });
      }
      if (!sections[si].questions || !sections[si].questions.length) {
        return res.status(400).json({ error: 'Section "' + sections[si].name + '" must have at least one question.' });
      }
    }

    test.title = title;
    test.description = (req.body.description || '').trim();
    test.showResult = typeof req.body.showResult === 'boolean' ? req.body.showResult : true;
    test.showAnswer = typeof req.body.showAnswer === 'boolean' ? req.body.showAnswer : true;
    test.malpracticeLimit = typeof req.body.malpracticeLimit === 'number' ? Math.max(0, req.body.malpracticeLimit) : 3;
    test.passPercentage = typeof req.body.passPercentage === 'number' ? Math.max(0, Math.min(100, req.body.passPercentage)) : 30;
    test.sections = sections;

    if (req.body.orgId !== undefined) {
      test.orgId = (req.body.orgId && req.body.orgId !== 'global') ? req.body.orgId : null;
    }

    await test.save();
    res.json({ ok: true, test: test });
  } catch (err) {
    console.error('[Admin] Update test error:', err);
    res.status(500).json({ error: 'Failed to update test.' });
  }
});

/**
 * DELETE /api/admin/tests/:id — Delete a test (only before start)
 */
router.delete('/tests/:id', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found.' });

    if (test.isAssigned && test.startTime && new Date() >= test.startTime) {
      return res.status(400).json({ error: 'Cannot delete test after its start time.' });
    }

    await Test.deleteOne({ _id: test._id });
    res.json({ ok: true, message: 'Test deleted.' });
  } catch (err) {
    console.error('[Admin] Delete test error:', err);
    res.status(500).json({ error: 'Failed to delete test.' });
  }
});

/**
 * POST /api/admin/tests/:id/clone — Clone a test with a new title
 */
router.post('/tests/:id/clone', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var source = await Test.findById(req.params.id).lean();
    if (!source) return res.status(404).json({ error: 'Source test not found.' });

    var newTitle = (req.body.title || '').trim();
    if (!newTitle) return res.status(400).json({ error: 'New test title is required.' });

    var exists = await Test.findOne({ title: new RegExp('^' + newTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') });
    if (exists) return res.status(400).json({ error: 'A test with this title already exists.' });

    delete source._id;
    delete source.createdAt;
    delete source.updatedAt;
    delete source.__v;

    source.title = newTitle;
    source.startTime = null;
    source.endTime = null;
    source.isAssigned = false;
    source.isDisabled = false;
    source.createdBy = req.user.id;

    // Generate new _ids for sections and questions
    source.sections = (source.sections || []).map(function (sec) {
      delete sec._id;
      sec.questions = (sec.questions || []).map(function (q) {
        delete q._id;
        return q;
      });
      return sec;
    });

    var cloned = await Test.create(source);
    res.status(201).json({ ok: true, test: cloned });
  } catch (err) {
    console.error('[Admin] Clone test error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A test with this title already exists.' });
    }
    res.status(500).json({ error: 'Failed to clone test.' });
  }
});

/**
 * PUT /api/admin/tests/:id/assign — Set start/end time (validates gap >= totalDuration)
 */
router.put('/tests/:id/assign', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found.' });

    var startTime = req.body.startTime ? new Date(req.body.startTime) : null;
    var endTime = req.body.endTime ? new Date(req.body.endTime) : null;

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'Both start time and end time are required.' });
    }

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return res.status(400).json({ error: 'Invalid date format.' });
    }

    if (endTime <= startTime) {
      return res.status(400).json({ error: 'End time must be after start time.' });
    }

    var gapSec = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    if (test.totalDurationSec > 0 && gapSec < test.totalDurationSec) {
      var minMins = Math.ceil(test.totalDurationSec / 60);
      return res.status(400).json({
        error: 'The time window (' + Math.floor(gapSec / 60) + ' mins) must be at least the total test duration (' + minMins + ' mins).'
      });
    }

    test.startTime = startTime;
    test.endTime = endTime;
    test.isAssigned = true;

    await test.save();
    res.json({ ok: true, test: test });
  } catch (err) {
    console.error('[Admin] Assign test error:', err);
    res.status(500).json({ error: 'Failed to assign test.' });
  }
});

/**
 * PUT /api/admin/tests/:id/config — Update showResult / showAnswer (anytime)
 */
router.put('/tests/:id/config', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found.' });

    if (typeof req.body.showResult === 'boolean') test.showResult = req.body.showResult;
    if (typeof req.body.showAnswer === 'boolean') test.showAnswer = req.body.showAnswer;

    await test.save();
    res.json({ ok: true, test: test });
  } catch (err) {
    console.error('[Admin] Config test error:', err);
    res.status(500).json({ error: 'Failed to update test config.' });
  }
});

/**
 * PUT /api/admin/tests/:id/disable — Toggle disable (re-enable clears times if passed)
 */
router.put('/tests/:id/disable', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found.' });

    var wantDisabled = typeof req.body.isDisabled === 'boolean' ? req.body.isDisabled : !test.isDisabled;

    if (wantDisabled) {
      // Disabling: only allowed before start time
      if (test.isAssigned && test.startTime && new Date() >= test.startTime) {
        return res.status(400).json({ error: 'Cannot disable a test after its start time.' });
      }
      test.isDisabled = true;
    } else {
      // Re-enabling: if start/end time already passed, clear them
      var now = new Date();
      if (test.startTime && now >= test.startTime) {
        test.startTime = null;
        test.endTime = null;
        test.isAssigned = false;
      }
      test.isDisabled = false;
    }

    await test.save();
    res.json({ ok: true, test: test, message: test.isDisabled ? 'Test disabled.' : 'Test enabled.' });
  } catch (err) {
    console.error('[Admin] Disable test error:', err);
    res.status(500).json({ error: 'Failed to update test status.' });
  }
});


/**
 * POST /api/admin/attempts/:attemptId/force-submit — Force-submit an in_progress attempt (for expired tests)
 */
router.post('/attempts/:attemptId/force-submit', requireRole('admin', 'super_admin'), async function (req, res) {
  try {
    var attempt = await AssessmentResult.findById(req.params.attemptId);
    if (!attempt) return res.status(404).json({ error: 'Attempt result not found.' });

    if (attempt.status === 'completed') {
      return res.status(400).json({ error: 'Attempt is already completed and graded.' });
    }

    var test = await Test.findById(attempt.assessmentId);
    if (!test) return res.status(404).json({ error: 'Matching test config not found.' });

    var userAnswers = attempt.userAnswers || {};

    // Use centralized evaluation service
    var evalResult = evaluateTest(test.sections, userAnswers);

    attempt.status = 'completed';
    attempt.completedAt = new Date();
    attempt.correctCount = evalResult.correctCount;
    attempt.wrongCount = evalResult.wrongCount;
    attempt.percentage = evalResult.percentage;
    attempt.totalMarks = evalResult.totalMarks;
    attempt.earnedMarks = evalResult.earnedMarks;
    attempt.questions = evalResult.evaluatedQuestions;

    await attempt.save();

    res.json({ ok: true, message: 'Attempt force-submitted successfully.', attempt: attempt });
  } catch (err) {
    console.error('[Admin] Force submit attempt error:', err);
    res.status(500).json({ error: 'Failed to force submit attempt.' });
  }
});

module.exports = router;
