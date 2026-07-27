const mongoose = require('mongoose');

const tenseQuestionSchema = new mongoose.Schema({
  q: { type: String, required: true },
  options: [{ type: String }],
  answer: { type: Number }
}, { _id: false });

const tenseContentSchema = new mongoose.Schema(
  {
    group: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      default: 'reading',
      trim: true,
    },
    text: {
      type: String,
      default: '',
      trim: true,
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    story: {
      type: String,
      default: '',
      trim: true,
    },
    topic: {
      type: String,
      default: '',
      trim: true,
    },
    questions: [tenseQuestionSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TenseContent', tenseContentSchema);
