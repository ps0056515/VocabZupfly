window.LQ = window.LQ || {};

(function () {
  const DB_NAME = 'VocabZupfly_AssessmentDB';
  const DB_VERSION = 2;

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported in this environment');
        return resolve(null);
      }
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('assessments')) {
          const store = db.createObjectStore('assessments', { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
        if (!db.objectStoreNames.contains('attempts')) {
          const attStore = db.createObjectStore('attempts', { keyPath: 'id' });
          attStore.createIndex('assessmentId', 'assessmentId', { unique: false });
        }
        if (!db.objectStoreNames.contains('practice_attempts')) {
          const paStore = db.createObjectStore('practice_attempts', { keyPath: 'id' });
          paStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      req.onsuccess = function (e) {
        const db = e.target.result;
        // Handle dynamic upgrade path if someone already had v1 and upgrades to v2 without trigger
        if (db.version === 2 && !db.objectStoreNames.contains('practice_attempts')) {
          // Note: Native browser will handle this in onupgradeneeded automatically due to version bump
        }
        resolve(db);
      };
      req.onerror = function (e) {
        console.error('IndexedDB open error:', e.target.error);
        resolve(null);
      };
    });
    return dbPromise;
  }

  const AssessmentDB = {
    async saveAssessment(data) {
      const db = await openDB();
      if (!db) return null;
      return new Promise((resolve, reject) => {
        const tx = db.transaction('assessments', 'readwrite');
        const store = tx.objectStore('assessments');
        const req = store.put(data);
        req.onsuccess = () => resolve(data);
        req.onerror = () => reject(req.error);
      });
    },

    async getAssessment(id) {
      const db = await openDB();
      if (!db) return null;
      return new Promise((resolve, reject) => {
        const tx = db.transaction('assessments', 'readonly');
        const store = tx.objectStore('assessments');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },

    async getAllAssessments() {
      const db = await openDB();
      if (!db) return [];
      return new Promise((resolve, reject) => {
        const tx = db.transaction('assessments', 'readonly');
        const store = tx.objectStore('assessments');
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    },

    async deleteAssessment(id) {
      const db = await openDB();
      if (!db) return false;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['assessments', 'attempts'], 'readwrite');
        tx.objectStore('assessments').delete(id);
        const req = tx.objectStore('attempts').delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    },

    async saveAttempt(attemptData) {
      const db = await openDB();
      if (!db) return null;
      return new Promise((resolve, reject) => {
        const tx = db.transaction('attempts', 'readwrite');
        const store = tx.objectStore('attempts');
        const req = store.put(attemptData);
        req.onsuccess = () => resolve(attemptData);
        req.onerror = () => reject(req.error);
      });
    },

    async getAttempt(id) {
      const db = await openDB();
      if (!db) return null;
      return new Promise((resolve, reject) => {
        const tx = db.transaction('attempts', 'readonly');
        const store = tx.objectStore('attempts');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },

    async savePracticeAttempt(attemptData) {
      const db = await openDB();
      if (!db) return null;
      return new Promise((resolve, reject) => {
        const tx = db.transaction('practice_attempts', 'readwrite');
        const store = tx.objectStore('practice_attempts');
        const req = store.put(attemptData);
        req.onsuccess = () => resolve(attemptData);
        req.onerror = () => reject(req.error);
      });
    },

    async getPracticeAttempt(id) {
      const db = await openDB();
      if (!db) return null;
      return new Promise((resolve, reject) => {
        const tx = db.transaction('practice_attempts', 'readonly');
        const store = tx.objectStore('practice_attempts');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },

    async getAllPracticeAttempts() {
      const db = await openDB();
      if (!db) return [];
      return new Promise((resolve, reject) => {
        const tx = db.transaction('practice_attempts', 'readonly');
        const store = tx.objectStore('practice_attempts');
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    }
  };

  LQ.AssessmentDB = AssessmentDB;
})();
