window.LQ = window.LQ || {};
window.LQ.Config = {
  /** Bump when JS changes so browsers drop stale cached scripts */
  assetVersion: '20260519b',
  stateKey: 'lexiquest_v2',
  premiumCode: 'LEXIQUEST2026',
  dailyGoalDefault: 15,
  mockQuestionCount: 20,
  mockMinutes: 10,
  leagueSize: 30,
  /** Set Firebase config to enable cloud sync (optional) */
  firebase: null,
  // firebase: { apiKey:'', authDomain:'', projectId:'', appId:'' },
  /** POST endpoint for AI mnemonics { word, def } -> { text } */
  aiEndpoint: null,
  /**
   * AI tutor chat (Shiksha-style). POST body:
   * { type:'tutor', message, history, context } -> { text } or { reply }
   * Falls back to built-in tutor when null or request fails.
   */
  tutorEndpoint: null,
};
