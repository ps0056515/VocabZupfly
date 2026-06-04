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



  /** AI tutor chat — set URL to enable remote API; null = built-in tutor only */
  tutorEndpoint: null,

  /** AI mnemonic hints — set URL to enable; null = built-in hints only */
  aiEndpoint: null,

  /** Remote tutor/API timeout (ms) when endpoints are set */
  aiTimeoutMs: 2500,

  /**
   * Content CMS — same port as dev server: /cms/ (npm run dev).
   */
  cmsAdminPath: '/cms/',
  cmsApiKey: 'lexiquest-cms-dev',
  showCmsLink: true,

  /** e.g. 'https://your-cdn.com/lexiquest/content' — null = bundled data/ only */
  contentBaseUrl: null,
  /** Bump when remote content changes (matches data/content-manifest.json version) */
  contentVersion: null,
};

