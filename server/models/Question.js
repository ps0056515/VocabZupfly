/**
 * Mongoose model for Questions.
 */
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    tenseGroup: {
      type: String,
      default: null,
      trim: true,
    },
    wordList: {
      type: String,
      default: null,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
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
    marks: {
      type: Number,
      default: 1,
    },
    duration: {
      type: Number,
      required: true,
      default: 1,
    },
    durationType: {
      type: String,
      enum: ['seconds', 'minutes', 'hours'],
      required: true,
      default: 'minutes',
    },
    playLimit: {
      type: Number,
      default: 1,
    },
    subQuestions: [
      {
        type: {
          type: String,
          enum: ['mcq', 'fib'],
          default: 'mcq',
        },
        questionText: {
          type: String,
          required: true,
          trim: true,
        },
        mcqType: {
          type: String,
          enum: ['single', 'multiple'],
          default: 'single',
        },
        options: [
          {
            type: String,
            trim: true,
          },
        ],
        correctAnswer: {
          type: String,
          trim: true,
        },
        correctAnswers: [
          {
            type: String,
            trim: true,
          },
        ],
        marks: {
          type: Number,
          default: 1,
        },
        explanation: {
          type: String,
          default: '',
        },
      },
    ],
    options: [
      {
        type: String,
        trim: true,
      },
    ],
    correctAnswer: {
      type: String,
      trim: true,
    },
    correctAnswers: [
      {
        type: String,
        trim: true,
      },
    ],
    explanation: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
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

module.exports = mongoose.model('Question', questionSchema);
