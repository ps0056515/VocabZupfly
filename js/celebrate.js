window.LQ = window.LQ || {};

LQ.showLessonComplete = function (xpEarned, opts) {
  opts = opts || {};
  const overlay = document.getElementById('celebrate-overlay');
  if (!overlay) return;
  const title = document.getElementById('cel-title');
  const sub = document.getElementById('cel-sub');
  const xpEl = document.getElementById('cel-xp');
  if (title) title.textContent = opts.title || 'Lesson complete!';
  if (sub) sub.textContent = opts.sub || 'Great work — keep your streak alive.';
  if (xpEl) xpEl.textContent = '+' + xpEarned + ' XP';
  overlay.classList.add('open');
  LQ.fireConfetti();
};

LQ.closeCelebrate = function () {
  const overlay = document.getElementById('celebrate-overlay');
  if (overlay) overlay.classList.remove('open');
  LQ.stopConfetti();
  if (LQ._celebrateDone) {
    const fn = LQ._celebrateDone;
    LQ._celebrateDone = null;
    fn();
  }
};

LQ.fireConfetti = function () {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = (canvas.width = window.innerWidth);
  const h = (canvas.height = window.innerHeight);
  const colors = ['#C8F53C', '#4ECFF8', '#FF6B6B', '#B8A9FF', '#FFD166', '#3DD68C'];
  if (LQ._confettiParts) LQ._confettiParts.length = 0;
  else LQ._confettiParts = [];
  for (let i = 0; i < 120; i++) {
    LQ._confettiParts.push({
      x: Math.random() * w,
      y: Math.random() * h * -0.2,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 4 + 2,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 12,
      size: 6 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
  let frames = 0;
  clearInterval(LQ._confettiTimer);
  LQ._confettiTimer = setInterval(function () {
    ctx.clearRect(0, 0, w, h);
    LQ._confettiParts.forEach(function (p) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    });
    frames++;
    if (frames > 180) LQ.stopConfetti();
  }, 32);
};

LQ.stopConfetti = function () {
  clearInterval(LQ._confettiTimer);
  const canvas = document.getElementById('confetti-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
};

window.closeCelebrate = function () {
  LQ.closeCelebrate();
};
