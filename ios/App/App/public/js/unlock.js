window.LQ = window.LQ || {};

LQ.applyAllFeatures = function () {
  if (!LQ.Config.enableAllFeatures) return;
  const S = LQ.S;
  if (!S) return;

  S.premium = true;
  S.onboardingComplete = true;
  S.examFocus = LQ.Config.examFocusDefault || 'ALL';
  S.notifOn = true;
  S.placementLevel = 'advanced';
  S.goalTarget = S.goalTarget || 25;

  LQ.saveState();
  if (LQ.syncHomeUI) LQ.syncHomeUI();
  if (LQ.renderLearningPath) LQ.renderLearningPath();
};

LQ.setExamFocus = function (exam) {
  if (!LQ.S) return;
  LQ.S.examFocus = exam;
  LQ.saveState();
  if (LQ.renderSettings) LQ.renderSettings();
  if (LQ.renderLearningPath) LQ.renderLearningPath();
  LQ.toast('Exam focus: ' + exam);
};

window.setExamFocus = LQ.setExamFocus;
