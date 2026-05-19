window.LQ = window.LQ || {};
window.LQ.Config = {
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
};
