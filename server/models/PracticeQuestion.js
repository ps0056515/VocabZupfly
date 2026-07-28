const mongoose = require('mongoose');

const practiceQuestionSchema = new mongoose.Schema(
  {
    listId: {
      type: String,
      required: true,
      trim: true,
    },
    groupId: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'normal',
      trim: true,
    },
    type: {
      type: String,
      enum: ['mcq', 'mcq_multi', 'fib'],
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    options: [
      {
        type: String,
        trim: true,
      }
    ],
    correctAnswer: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PracticeQuestion', practiceQuestionSchema);
