const mongoose = require('mongoose');

const groupWordSchema = new mongoose.Schema({
  word: { type: String, trim: true, required: true },
  index: { type: Number },
  role: { type: String, default: 'normal' }
}, { _id: false });

const listGroupSchema = new mongoose.Schema({
  id: { type: String, trim: true },
  groupNum: { type: Number },
  title: { type: String, trim: true },
  words: [groupWordSchema]
}, { _id: false });

const wordListSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    listNum: {
      type: Number,
      default: 0,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    icon: {
      type: String,
      default: '📘',
    },
    color: {
      type: String,
      default: 'lavender',
    },
    listType: {
      type: String,
      enum: ['grouped', 'dictionary'],
      default: 'grouped',
    },
    groups: [listGroupSchema],
    words: [groupWordSchema], // Used for dictionary list type
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('WordList', wordListSchema);
