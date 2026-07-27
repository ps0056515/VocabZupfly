const express = require('express');
const Word = require('../models/Word');
const WordList = require('../models/WordList');
const TenseContent = require('../models/TenseContent');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Require authentication for all student content APIs
router.use(authenticate);

/**
 * GET /api/words — Fetch all vocabulary words
 */
router.get('/words', async function (req, res) {
  try {
    const words = await Word.find().sort({ word: 1 }).lean();
    res.json(words);
  } catch (err) {
    console.error('[Student API] Get words error:', err);
    res.status(500).json({ error: 'Failed to load words' });
  }
});

/**
 * GET /api/word-lists — Fetch vocabulary word lists
 */
router.get('/word-lists', async function (req, res) {
  try {
    const lists = await WordList.find().sort({ listNum: 1 }).lean();
    let groupCount = 0;
    lists.forEach(function (l) {
      groupCount += (l.groups || []).length;
    });

    res.json({
      source: 'MongoDB',
      version: 1,
      listCount: lists.length,
      groupCount: groupCount,
      lists: lists
    });
  } catch (err) {
    console.error('[Student API] Get word lists error:', err);
    res.status(500).json({ error: 'Failed to load word lists' });
  }
});

/**
 * GET /api/tenses-content — Fetch all tenses content grouped by module/group
 */
router.get('/tenses-content', async function (req, res) {
  try {
    const items = await TenseContent.find().lean();
    const grouped = {};
    items.forEach(function (item) {
      if (!grouped[item.group]) {
        grouped[item.group] = [];
      }
      grouped[item.group].push(item);
    });
    res.json(grouped);
  } catch (err) {
    console.error('[Student API] Get tenses content error:', err);
    res.status(500).json({ error: 'Failed to load tenses content' });
  }
});

module.exports = router;
