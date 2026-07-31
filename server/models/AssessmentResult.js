const mongoose = require('mongoose');

const AssessmentResultSchema = new mongoose.Schema({
  userEmail: {
    type: String,
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  assessmentId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'practice'
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  correctCount: {
    type: Number,
    default: 0
  },
  wrongCount: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    default: 0
  },
  earnedMarks: {
    type: Number,
    default: 0
  },
  totalMarks: {
    type: Number,
    default: 0
  },
  questions: {
    type: Array,
    default: []
  },
  userAnswers: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed'],
    default: 'in_progress'
  },
  startTimeMs: {
    type: Number,
    required: true
  },
  currentIndex: {
    type: Number,
    default: 0
  },
  completedAt: {
    type: Date
  },
  malpracticeCount: {
    type: Number,
    default: 0
  },
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null
  }
});

module.exports = mongoose.model('AssessmentResult', AssessmentResultSchema);
