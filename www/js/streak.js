window.LQ = window.LQ || {};

LQ.todayKey = function () {
  return new Date().toISOString().slice(0, 10);
};

LQ.recordStudyDay = function () {
  const today = LQ.todayKey();
  if (LQ.S.lastStudyDate === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = yesterday.toISOString().slice(0, 10);
  if (LQ.S.lastStudyDate === yKey) LQ.S.streakCount = (LQ.S.streakCount || 0) + 1;
  else LQ.S.streakCount = 1;
  LQ.S.lastStudyDate = today;
  if (!LQ.S.streakWeek) LQ.S.streakWeek = [];
  const d = new Date().getDay();
  const idx = d === 0 ? 6 : d - 1;
  LQ.S.streakWeek[idx] = true;
};

LQ.renderStreakUI = function () {
  const banner = document.querySelector('.streak-banner');
  if (!banner) return;
  const h3 = banner.querySelector('h3');
  const p = banner.querySelector('.streak-text p');
  const days = banner.querySelectorAll('.sday');
  const n = LQ.S.streakCount || 0;
  if (h3) h3.textContent = (n || 1) + '-Day Streak!';
  if (p) p.textContent = n ? 'Keep it going — study today' : "Start today's streak";
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  days.forEach((el, i) => {
    el.textContent = labels[i];
    el.classList.toggle('done', !!(LQ.S.streakWeek && LQ.S.streakWeek[i]));
  });
};
