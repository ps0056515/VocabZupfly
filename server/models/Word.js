const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema(
  {
    word: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    phonetic: {
      type: String,
      default: '',
      trim: true,
    },
    pos: {
      type: String,
      default: 'noun',
      trim: true,
    },
    def: {
      type: String,
      default: '',
      trim: true,
    },
    example: {
      type: String,
      default: '',
      trim: true,
    },
    syn: {
      type: String,
      default: '',
      trim: true,
    },
    ant: {
      type: String,
      default: '',
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    premium: {
      type: Boolean,
      default: false,
    },
    stub: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Word', wordSchema);
