/**
 * Redux-like store for VocabZupfly auth state.
 * Persists auth state to IndexedDB.
 */
window.LQ = window.LQ || {};

LQ.Store = (function () {
  var _state = {
    user: null,
    isAuthenticated: false,
    loading: true,
  };

  var _listeners = [];

  function getState() {
    return _state;
  }

  function dispatch(action) {
    switch (action.type) {
      case 'SET_USER':
        _state = Object.assign({}, _state, {
          user: action.payload,
          isAuthenticated: true,
          loading: false,
        });
        // Persist to IndexedDB
        if (LQ.IDB) {
          LQ.IDB.set('user', action.payload);
          LQ.IDB.set('isAuthenticated', true);
        }
        break;

      case 'CLEAR_USER':
        _state = Object.assign({}, _state, {
          user: null,
          isAuthenticated: false,
          loading: false,
        });
        if (LQ.IDB) {
          LQ.IDB.delete('user');
          LQ.IDB.delete('isAuthenticated');
        }
        break;

      case 'SET_LOADING':
        _state = Object.assign({}, _state, {
          loading: !!action.payload,
        });
        break;

      default:
        console.warn('Unknown action:', action.type);
        return;
    }

    // Notify listeners
    _listeners.forEach(function (fn) {
      try { fn(_state); } catch (e) { console.error('Store listener error:', e); }
    });
  }

  function subscribe(fn) {
    _listeners.push(fn);
    return function unsubscribe() {
      var idx = _listeners.indexOf(fn);
      if (idx > -1) _listeners.splice(idx, 1);
    };
  }

  /**
   * Restore state from IndexedDB on startup.
   */
  async function restore() {
    try {
      var user = await LQ.IDB.get('user');
      var isAuth = await LQ.IDB.get('isAuthenticated');
      if (user && isAuth) {
        _state = Object.assign({}, _state, {
          user: user,
          isAuthenticated: true,
          loading: false,
        });
        return true;
      }
    } catch (e) {
      console.warn('Store restore failed:', e);
    }
    _state.loading = false;
    return false;
  }

  return {
    getState: getState,
    dispatch: dispatch,
    subscribe: subscribe,
    restore: restore,
  };
})();
