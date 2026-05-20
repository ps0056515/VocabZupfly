window.LQ = window.LQ || {};

window.LQ.Config = {

  /** Bump when JS changes so browsers drop stale cached scripts */

  assetVersion: '20260519e',

  stateKey: 'lexiquest_v2',

  premiumCode: 'LEXIQUEST2026',

  dailyGoalDefault: 15,

  mockQuestionCount: 20,

  mockMinutes: 10,

  leagueSize: 30,



  /**

   * Master switch: unlocks premium deck, all lessons, ALL exam words,

   * skips onboarding, turns notifications on, enables AI routes.

   * Set false for production store builds.

   */

  enableAllFeatures: true,

  examFocusDefault: 'ALL',



  /** Set Firebase config to enable cloud sync (optional) */

  firebase: null,

  // firebase: { apiKey:'', authDomain:'', projectId:'', appId:'' },



  /** AI mnemonic hints — uses built-in tutor when fetch fails */

  aiEndpoint: 'http://127.0.0.1:8787/tutor',

  /**

   * AI tutor chat. POST { type:'tutor', message, history, context } -> { text }

   * Run: npm run tutor:api

   */

  tutorEndpoint: 'http://127.0.0.1:8787/tutor',

};

