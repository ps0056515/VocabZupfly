window.LQ = window.LQ || {};
LQ.Firebase = { ready: false, sync: function () {} };

LQ.initFirebase = function () {
  const cfg = LQ.Config.firebase;
  if (!cfg || !window.firebase) return;
  try {
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    LQ.Firebase.auth = firebase.auth();
    LQ.Firebase.db = firebase.firestore();
    LQ.Firebase.ready = true;
    LQ.Firebase.sync = async function () {
      const user = LQ.Firebase.auth.currentUser;
      if (!user || !LQ.S) return;
      await LQ.Firebase.db.collection('users').doc(user.uid).set(
        {
          state: {
            xp: LQ.S.xp,
            level: LQ.S.level,
            mastery: LQ.S.mastery,
            srs: LQ.S.srs,
            streakCount: LQ.S.streakCount,
            premium: LQ.S.premium,
            updatedAt: Date.now(),
          },
        },
        { merge: true }
      );
    };
    LQ.Firebase.signIn = async function () {
      const cred = await LQ.Firebase.auth.signInAnonymously();
      LQ.S.uid = cred.user.uid;
      LQ.saveState();
      const doc = await LQ.Firebase.db.collection('users').doc(cred.user.uid).get();
      if (doc.exists && doc.data().state) {
        Object.assign(LQ.S, doc.data().state);
        LQ.saveState();
        LQ.syncHomeUI();
        LQ.toast('☁️ Progress synced');
      }
      return cred.user;
    };
  } catch (e) {
    console.warn('Firebase init failed', e);
  }
};
