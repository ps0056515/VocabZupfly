window.LQ = window.LQ || {};

(function () {
  const DB_NAME = 'VocabZupfly_AssessmentDB';
  const DB_VERSION = 3;

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
        if (!db.objectStoreNames.contains('temp_media')) {
          const mediaStore = db.createObjectStore('temp_media', { keyPath: 'key' });
          mediaStore.createIndex('userTest', 'userTest', { unique: false });
        }
      };
      req.onsuccess = function (e) {
        resolve(e.target.result);
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

    async saveTempMedia(key, userTestPrefix, data) {
      const db = await openDB();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction('temp_media', 'readwrite');
        const store = tx.objectStore('temp_media');
        store.put({ key: key, userTest: userTestPrefix, data: data, timestamp: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    },

    async getTempMedia(key) {
      const db = await openDB();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction('temp_media', 'readonly');
        const store = tx.objectStore('temp_media');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      });
    },

    async deleteTempMediaForUserTest(userTestPrefix) {
      const db = await openDB();
      if (!db) return false;
      return new Promise((resolve) => {
        const tx = db.transaction('temp_media', 'readwrite');
        const store = tx.objectStore('temp_media');
        const index = store.index('userTest');
        const req = index.openCursor(IDBKeyRange.only(userTestPrefix));
        req.onsuccess = function (e) {
          const cursor = e.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    }
  };

  LQ.AssessmentDB = AssessmentDB;
})();
