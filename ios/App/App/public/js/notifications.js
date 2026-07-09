window.LQ = window.LQ || {};

LQ.scheduleDailyNotif = async function () {
  if (!LQ.S.notifOn) return;
  const cap = window.Capacitor;
  const LN = cap && cap.Plugins && cap.Plugins.LocalNotifications;
  if (!LN) return;
  try {
    await LN.requestPermissions();
    const at = new Date();
    at.setHours(LQ.S.notifHour || 9, 0, 0, 0);
    if (at < new Date()) at.setDate(at.getDate() + 1);
    await LN.schedule({
      notifications: [
        {
          id: 1,
          title: 'LexiQuest',
          body: '🔥 Keep your streak — study 10 words today!',
          schedule: { at: at },
        },
      ],
    });
  } catch (e) {}
};

LQ.initNotifications = function () {
  if (LQ.S.notifOn) LQ.scheduleDailyNotif();
};
