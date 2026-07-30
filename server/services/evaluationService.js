/**
 * evaluationService.js — Centralized test evaluation engine.
 *
 * Provides reusable functions to grade individual questions and full tests.
 * Used by both student submit and admin force-submit routes.
 */

'use strict';

/* ────────────────────────────────────────────────────────────
 *  Utility: normalize a string for comparison
 * ──────────────────────────────────────────────────────────── */
function norm(s) {
  if (Array.isArray(s)) s = s.join(' ');
  return (typeof s === 'string' || typeof s === 'number' ? String(s) : '')
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"–—]/g, '')
    .replace(/\s+/g, ' ');
}

/* ────────────────────────────────────────────────────────────
 *  Utility: resolve correct option index (handles A/B/C/D, text, or index)
 * ──────────────────────────────────────────────────────────── */
function getCorrectOptionIndex(correctAns, options) {
  if (!options || !options.length) return -1;
  var str = (correctAns !== undefined && correctAns !== null) ? String(correctAns).trim() : '';
  if (!str) return -1;

  // 1. Direct text match
  var directIdx = options.indexOf(str);
  if (directIdx >= 0) return directIdx;

  // 2. Letter format: "A", "B", "C", "D", "E"
  var upper = str.toUpperCase();
  if (upper.length === 1 && upper >= 'A' && upper <= 'Z') {
    var letterIdx = upper.charCodeAt(0) - 65;
    if (letterIdx >= 0 && letterIdx < options.length) return letterIdx;
  }

  // 3. Numeric string index: "0", "1", "2"
  var numIdx = parseInt(str, 10);
  if (!isNaN(numIdx) && numIdx >= 0 && numIdx < options.length) return numIdx;

  return -1;
}

/* ────────────────────────────────────────────────────────────
 *  evaluateQuestion(question, userAnswer)
 *
 *  Grades a single question against the user's answer.
 *
 *  Returns {
 *    isCorrect    : Boolean   — true only if fully correct
 *    earnedMarks  : Number    — marks earned (0 or q.marks for non-passage; sum of sub-marks for passage)
 *    maxMarks     : Number    — maximum possible marks
 *    gradedSubQs  : Array|undefined — graded subquestions (passage only)
 *  }
 * ──────────────────────────────────────────────────────────── */
function evaluateQuestion(q, userAns) {
  var qType = q.type || 'mcq';
  var isMultiMcq = qType === 'mcq_multi' || (qType === 'mcq' && q.mcqType === 'multiple');
  var maxMarks = q.marks || 1;
  var isCorrect = false;
  var earnedMarks = 0;
  var gradedSubQs;

  /* ── MCQ Multiple ── */
  if (isMultiMcq) {
    var expectedAnswers = (q.correctAnswer || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var expectedIndices = expectedAnswers
      .map(function (ans) { return getCorrectOptionIndex(ans, q.options); })
      .filter(function (i) { return i >= 0; })
      .sort(function (a, b) { return a - b; });
    var userIndices = Array.isArray(userAns) ? userAns.slice().sort(function (a, b) { return a - b; }) : [];
    isCorrect = expectedIndices.length > 0 &&
                expectedIndices.length === userIndices.length &&
                expectedIndices.every(function (v, i) { return v === userIndices[i]; });
    earnedMarks = isCorrect ? maxMarks : 0;

  /* ── MCQ Single ── */
  } else if (qType === 'mcq') {
    var expectedIdx = getCorrectOptionIndex(q.correctAnswer, q.options);
    var userIdx = typeof userAns === 'number' ? userAns : getCorrectOptionIndex(userAns, q.options);
    isCorrect = expectedIdx >= 0 && userIdx === expectedIdx;
    earnedMarks = isCorrect ? maxMarks : 0;

  /* ── FIB / fill_blank with multiple blanks ── */
  } else if ((qType === 'fib' || qType === 'fill_blank') && Array.isArray(q.correctAnswers) && q.correctAnswers.length > 1) {
    var expectedArr = q.correctAnswers.map(function (s) { return norm(s); });
    var userArr = Array.isArray(userAns) ? userAns.map(function (s) { return norm(s); }) : [];
    isCorrect = expectedArr.length > 0 &&
                expectedArr.length === userArr.length &&
                expectedArr.every(function (v, i) { return v === userArr[i]; });
    earnedMarks = isCorrect ? maxMarks : 0;

  /* ── FIB / fill_blank single blank ── */
  } else if (qType === 'fib' || qType === 'fill_blank') {
    var expected = norm(q.correctAnswer || (Array.isArray(q.correctAnswers) && q.correctAnswers[0] ? q.correctAnswers[0] : ''));
    var actual = norm(userAns);
    isCorrect = expected.length > 0 && expected === actual;
    earnedMarks = isCorrect ? maxMarks : 0;

  /* ── Passage with subquestions ── */
  } else if (qType === 'passage') {
    var subAnswers = (userAns && typeof userAns === 'object' && !Array.isArray(userAns)) ? userAns : {};
    var subQuestions = q.subQuestions || [];
    var totalSubMarks = 0;
    var earnedSubMarks = 0;

    gradedSubQs = subQuestions.map(function (sq, sqIdx) {
      var sqUserAns = subAnswers[sqIdx];
      var sqMaxMarks = sq.marks || (subQuestions.length > 0 ? maxMarks / subQuestions.length : 1);
      var sqResult = evaluateSubQuestion(sq, sqUserAns);

      totalSubMarks += sqMaxMarks;
      if (sqResult.isCorrect) earnedSubMarks += sqMaxMarks;

      return {
        questionText: sq.questionText || sq.text,
        type: sq.type,
        options: sq.options,
        correctAnswer: sq.correctAnswer,
        correctAnswers: sq.correctAnswers,
        marks: sqMaxMarks,
        userAnswer: sqUserAns,
        isCorrect: sqResult.isCorrect,
        explanation: sq.explanation || ''
      };
    });

    maxMarks = totalSubMarks > 0 ? totalSubMarks : maxMarks;
    earnedMarks = earnedSubMarks;
    // Passage is "correct" only if student earned all marks
    isCorrect = earnedMarks >= maxMarks && maxMarks > 0;

  /* ── Text-based fallback (speaking, listening, jumbled, story, read aloud) ── */
  } else {
    var exp = norm(q.correctAnswer || (Array.isArray(q.correctAnswers) && q.correctAnswers[0] ? q.correctAnswers[0] : '') || q.questionText || q.text || '');
    var act = norm(userAns);
    isCorrect = exp.length > 0 && exp === act;
    earnedMarks = isCorrect ? maxMarks : 0;
  }

  return {
    isCorrect: isCorrect,
    earnedMarks: Number(earnedMarks.toFixed(2)),
    maxMarks: Number(maxMarks.toFixed(2)),
    gradedSubQs: gradedSubQs
  };
}

/* ────────────────────────────────────────────────────────────
 *  evaluateSubQuestion(sq, userAns)
 *
 *  Grades a single passage sub-question.
 *  Returns { isCorrect: Boolean }
 * ──────────────────────────────────────────────────────────── */
function evaluateSubQuestion(sq, sqUserAns) {
  var sqType = (sq.type || sq.questionType || '').toLowerCase();
  var isExplicitMcq = sqType === 'mcq' || sqType === 'mcq_single' || sqType === 'mcq_multi' || sqType === 'single' || sqType === 'multiple';
  var isExplicitFib = sqType === 'fib' || sqType === 'fill_blank' || sqType === 'fill_in_blank' || sqType === 'fill_in_the_blank';
  var hasRealOptions = sq.options && sq.options.length > 0 && sq.options.some(function (opt) { return typeof opt === 'string' && opt.trim().length > 0; });
  var isSubqMcq = isExplicitMcq || (hasRealOptions && !isExplicitFib);
  var isMultiMcq = sqType === 'mcq_multi' || (sqType === 'mcq' && sq.mcqType === 'multiple');

  /* MCQ multi subquestion */
  if (isSubqMcq && isMultiMcq) {
    var expectedAnswers = (sq.correctAnswer || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var expectedIndices = expectedAnswers
      .map(function (ans) { return getCorrectOptionIndex(ans, sq.options); })
      .filter(function (i) { return i >= 0; })
      .sort(function (a, b) { return a - b; });
    var userIndices = Array.isArray(sqUserAns) ? sqUserAns.slice().sort(function (a, b) { return a - b; }) : [];
    return {
      isCorrect: expectedIndices.length > 0 &&
                 expectedIndices.length === userIndices.length &&
                 expectedIndices.every(function (v, i) { return v === userIndices[i]; })
    };
  }

  /* MCQ single subquestion (has options) */
  if (isSubqMcq && sq.options && sq.options.length > 0) {
    var expectedIdx = getCorrectOptionIndex(sq.correctAnswer, sq.options);
    var userIdx = typeof sqUserAns === 'number' ? sqUserAns : getCorrectOptionIndex(sqUserAns, sq.options);
    return { isCorrect: expectedIdx >= 0 && userIdx === expectedIdx };
  }

  /* FIB multi-blank subquestion */
  if (Array.isArray(sq.correctAnswers) && sq.correctAnswers.length > 1) {
    var expectedArr = sq.correctAnswers.map(function (s) { return norm(s); });
    var userArr = Array.isArray(sqUserAns) ? sqUserAns.map(function (s) { return norm(s); }) : [];
    return {
      isCorrect: expectedArr.length > 0 &&
                 expectedArr.length === userArr.length &&
                 expectedArr.every(function (v, i) { return v === userArr[i]; })
    };
  }

  /* FIB single-blank / text subquestion */
  var expected = norm(sq.correctAnswer || (Array.isArray(sq.correctAnswers) && sq.correctAnswers[0] ? sq.correctAnswers[0] : ''));
  var actual = norm(sqUserAns);
  return { isCorrect: expected.length > 0 && expected === actual };
}


/* ────────────────────────────────────────────────────────────
 *  evaluateTest(testSections, userAnswers)
 *
 *  Grades a complete test by flattening sections into questions
 *  and calling evaluateQuestion for each.
 *
 *  Returns {
 *    correctCount      : Number
 *    wrongCount        : Number
 *    totalMarks        : Number
 *    earnedMarks       : Number
 *    percentage         : Number  (marks-based)
 *    sectionStats      : Object   { sectionName: { total, correct, wrong, totalMarks, earnedMarks, percentage } }
 *    evaluatedQuestions : Array    graded question objects ready for DB storage
 *  }
 * ──────────────────────────────────────────────────────────── */
function evaluateTest(testSections, userAnswers) {
  var answers = userAnswers || {};
  var correctCount = 0;
  var wrongCount = 0;
  var totalMarks = 0;
  var earnedMarks = 0;
  var sectionStats = {};
  var evaluatedQuestions = [];

  // Flatten sections → questions with groupTitle
  var flatQuestions = [];
  (testSections || []).forEach(function (sec) {
    (sec.questions || []).forEach(function (q) {
      var qCopy = JSON.parse(JSON.stringify(q));
      qCopy.groupTitle = sec.name;
      flatQuestions.push(qCopy);
    });
  });

  flatQuestions.forEach(function (q, idx) {
    var userAns = answers[idx];
    var result = evaluateQuestion(q, userAns);

    var secName = q.groupTitle || 'Section';
    if (!sectionStats[secName]) {
      sectionStats[secName] = {
        name: secName,
        total: 0,
        correct: 0,
        wrong: 0,
        totalMarks: 0,
        earnedMarks: 0,
        percentage: 0
      };
    }

    var sec = sectionStats[secName];
    sec.total++;
    sec.totalMarks += result.maxMarks;
    sec.earnedMarks += result.earnedMarks;

    totalMarks += result.maxMarks;
    earnedMarks += result.earnedMarks;

    if (result.isCorrect) {
      correctCount++;
      sec.correct++;
    } else {
      wrongCount++;
      sec.wrong++;
    }

    var qGraded = {
      questionId: q.questionId || q._id,
      questionText: q.questionText,
      type: q.type,
      mcqType: q.mcqType,
      options: q.options,
      correctAnswer: q.correctAnswer,
      correctAnswers: q.correctAnswers,
      explanation: q.explanation,
      marks: result.maxMarks,
      earnedMarks: result.earnedMarks,
      userAnswer: userAns,
      isCorrect: result.isCorrect,
      groupTitle: q.groupTitle,
      subQuestions: result.gradedSubQs
    };

    evaluatedQuestions.push(qGraded);
  });

  // Compute per-section percentages
  Object.keys(sectionStats).forEach(function (key) {
    var s = sectionStats[key];
    s.percentage = s.totalMarks > 0 ? Number(((s.earnedMarks / s.totalMarks) * 100).toFixed(2)) : 0;
  });

  var percentage = totalMarks > 0 ? Number(((earnedMarks / totalMarks) * 100).toFixed(2)) : 0;

  return {
    correctCount: correctCount,
    wrongCount: wrongCount,
    totalMarks: Number(totalMarks.toFixed(2)),
    earnedMarks: Number(earnedMarks.toFixed(2)),
    percentage: percentage,
    sectionStats: sectionStats,
    evaluatedQuestions: evaluatedQuestions
  };
}

module.exports = {
  evaluateQuestion: evaluateQuestion,
  evaluateSubQuestion: evaluateSubQuestion,
  evaluateTest: evaluateTest
};
