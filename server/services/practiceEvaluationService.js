/**
 * practiceEvaluationService.js — Centralized practice evaluation engine.
 *
 * Provides reusable functions to grade individual practice questions.
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

  var cleanStr = str;
  var match = str.match(/^([A-Za-z0-9]+)/);
  if (match) {
    cleanStr = match[1];
  }

  // 2. Letter format: "A", "B", "C", "D", "E"
  var upper = cleanStr.toUpperCase();
  if (upper.length === 1 && upper >= 'A' && upper <= 'Z') {
    var letterIdx = upper.charCodeAt(0) - 65;
    if (letterIdx >= 0 && letterIdx < options.length) return letterIdx;
  }

  // 3. Numeric string index: "0", "1", "2"
  var numIdx = parseInt(cleanStr, 10);
  if (!isNaN(numIdx) && numIdx >= 0 && numIdx < options.length) return numIdx;

  return -1;
}

/* ────────────────────────────────────────────────────────────
 *  evaluateQuestion(question, userAnswer)
 * ──────────────────────────────────────────────────────────── */
function evaluateQuestion(q, userAns) {
  var qType = q.type || 'mcq';
  var isMultiMcq = qType === 'mcq_multi' || (qType === 'mcq' && q.mcqType === 'multiple');
  var maxMarks = q.marks || 1;
  var isCorrect = false;
  var earnedMarks = 0;
  var gradedSubQs;

  // 1. Resolve MCQ Multiple
  if (isMultiMcq) {
    var expectedIndices = [];
    if (Array.isArray(q.correctAnswerIndices) && q.correctAnswerIndices.length > 0) {
      expectedIndices = q.correctAnswerIndices;
    } else if (q.correctAnswer) {
      var expectedAnswers = (q.correctAnswer || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      expectedIndices = expectedAnswers
        .map(function (ans) { return getCorrectOptionIndex(ans, q.options); })
        .filter(function (i) { return i >= 0; });
    }
    expectedIndices = expectedIndices.slice().sort(function (a, b) { return a - b; });
    var userIndices = Array.isArray(userAns) ? userAns.slice().sort(function (a, b) { return a - b; }) : [];
    isCorrect = expectedIndices.length > 0 &&
                expectedIndices.length === userIndices.length &&
                expectedIndices.every(function (v, i) { return v === userIndices[i]; });
    earnedMarks = isCorrect ? maxMarks : 0;

  // 2. Resolve MCQ Single
  } else if (qType === 'mcq') {
    var expectedIdx = -1;
    if (q.correctAnswerIndex !== undefined && q.correctAnswerIndex !== null) {
      expectedIdx = Number(q.correctAnswerIndex);
    } else {
      expectedIdx = getCorrectOptionIndex(q.correctAnswer, q.options);
    }
    var userIdx = typeof userAns === 'number' ? userAns : getCorrectOptionIndex(userAns, q.options);
    isCorrect = expectedIdx >= 0 && userIdx === expectedIdx;
    earnedMarks = isCorrect ? maxMarks : 0;

  // 3. Resolve FIB with multiple blanks
  } else if ((qType === 'fib' || qType === 'fill_blank') && Array.isArray(q.correctAnswers) && q.correctAnswers.length > 1) {
    var expectedArr = q.correctAnswers.map(function (s) { return norm(s); });
    var userArr = Array.isArray(userAns) ? userAns.map(function (s) { return norm(s); }) : [];
    isCorrect = expectedArr.length > 0 &&
                expectedArr.length === userArr.length &&
                expectedArr.every(function (v, i) { return v === userArr[i]; });
    earnedMarks = isCorrect ? maxMarks : 0;

  // 4. Resolve FIB single blank
  } else if (qType === 'fib' || qType === 'fill_blank') {
    var expected = norm(q.correctAnswerText || q.correctAnswer || (Array.isArray(q.correctAnswers) && q.correctAnswers[0] ? q.correctAnswers[0] : ''));
    var actual = norm(userAns);
    isCorrect = expected.length > 0 && expected === actual;
    earnedMarks = isCorrect ? maxMarks : 0;

  // 5. Fallback Text/Jumbled/etc.
  } else {
    var exp = norm(q.correctAnswerText || q.correctAnswer || (Array.isArray(q.correctAnswers) && q.correctAnswers[0] ? q.correctAnswers[0] : '') || q.text || q.title || '');
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
    var userArr = Array.isArray(sqUserAns) ? userArr.map(function (s) { return norm(s); }) : [];
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

module.exports = {
  evaluateQuestion: evaluateQuestion,
  evaluateSubQuestion: evaluateSubQuestion
};
