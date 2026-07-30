/**
 * Mongoose model for Tests (assessment test with sections and snapshotted questions).
 */
const mongoose = require('mongoose');

const testQuestionSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['mcq', 'fib', 'reading_listening', 'listen_repeat', 'jumbled_sentence', 'story_retelling', 'passage'],
      default: 'mcq',
    },
    mcqType: {
      type: String,
      enum: ['single', 'multiple'],
      default: 'single',
    },
    options: [{ type: String, trim: true }],
    correctAnswer: { type: String, trim: true, default: '' },
    correctAnswers: [{ type: String, trim: true }],
    subQuestions: { type: Array, default: [] },
    playLimit: { type: Number, default: 1 },
    marks: { type: Number, default: 1 },
    duration: { type: Number, default: 1 },
    durationType: {
      type: String,
      enum: ['seconds', 'minutes', 'hours'],
      default: 'minutes',
    },
    explanation: { type: String, default: '' },
    difficulty: { type: String, default: 'medium' },
    category: { type: String, default: 'General' },
  },
  { _id: true }
);

const testSectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    questions: [testQuestionSchema],
  },
  { _id: true }
);

const testSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    showResult: {
      type: Boolean,
      default: true,
    },
    showAnswer: {
      type: Boolean,
      default: true,
    },
    malpracticeLimit: {
      type: Number,
      default: 3,
      min: 0,
    },
    passPercentage: {
      type: Number,
      default: 30,
      min: 0,
      max: 100,
    },
    sections: [testSectionSchema],

    totalMarks: {
      type: Number,
      default: 0,
    },
    totalDurationSec: {
      type: Number,
      default: 0,
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },

    startTime: {
      type: Date,
      default: null,
    },
    endTime: {
      type: Date,
      default: null,
    },
    isAssigned: {
      type: Boolean,
      default: false,
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Pre-save hook: compute totalMarks, totalDurationSec, totalQuestions from sections.
 */
testSchema.pre('save', function (next) {
  var totalMarks = 0;
  var totalDurationSec = 0;
  var totalQuestions = 0;

  (this.sections || []).forEach(function (section) {
    (section.questions || []).forEach(function (q) {
      totalMarks += q.marks || 0;
      totalQuestions += 1;

      var dur = q.duration || 0;
      var dtype = q.durationType || 'minutes';
      if (dtype === 'hours') {
        totalDurationSec += dur * 3600;
      } else if (dtype === 'minutes') {
        totalDurationSec += dur * 60;
      } else {
        totalDurationSec += dur;
      }
    });
  });

  this.totalMarks = totalMarks;
  this.totalDurationSec = totalDurationSec;
  this.totalQuestions = totalQuestions;
  next();
});

module.exports = mongoose.model('Test', testSchema);
