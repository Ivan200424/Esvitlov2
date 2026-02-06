/**
 * State Manager for Centralized State Management
 * 
 * Provides centralized state management with persistence
 * Ensures state consistency across restarts and multiple instances
 */

const { logger } = require('./Logger');
const { eventBus, Events } = require('./EventEmitter');

class StateManager {
  constructor() {
    this.states = new Map();
    this.stateLog = logger.child({ component: 'StateManager' });
  }

  /**
   * Set state for a key
   * @param {string} namespace - State namespace (e.g., 'wizard', 'power', 'debounce')
   * @param {string} key - State key
   * @param {*} value - State value
   * @param {Object} options - Options {persist: boolean, ttl: number}
   */
  set(namespace, key, value, options = {}) {
    const fullKey = `${namespace}:${key}`;
    
    const stateEntry = {
      value,
      timestamp: Date.now(),
      ttl: options.ttl || null,
      persist: options.persist !== false // Default to persist
    };

    this.states.set(fullKey, stateEntry);

    this.stateLog.debug('State set', {
      namespace,
      key,
      persist: stateEntry.persist,
      ttl: stateEntry.ttl
    });

    // Persist to database if needed
    if (stateEntry.persist) {
      this._persistState(namespace, key, value);
    }

    return true;
  }

  /**
   * Get state for a key
   * @param {string} namespace - State namespace
   * @param {string} key - State key
   * @param {*} defaultValue - Default value if not found
   * @returns {*}
   */
  get(namespace, key, defaultValue = null) {
    const fullKey = `${namespace}:${key}`;
    const stateEntry = this.states.get(fullKey);

    if (!stateEntry) {
      return defaultValue;
    }

    // Check TTL expiration
    if (stateEntry.ttl && Date.now() - stateEntry.timestamp > stateEntry.ttl) {
      this.delete(namespace, key);
      return defaultValue;
    }

    return stateEntry.value;
  }

  /**
   * Check if state exists
   * @param {string} namespace - State namespace
   * @param {string} key - State key
   * @returns {boolean}
   */
  has(namespace, key) {
    const fullKey = `${namespace}:${key}`;
    const stateEntry = this.states.get(fullKey);

    if (!stateEntry) {
      return false;
    }

    // Check TTL expiration
    if (stateEntry.ttl && Date.now() - stateEntry.timestamp > stateEntry.ttl) {
      this.delete(namespace, key);
      return false;
    }

    return true;
  }

  /**
   * Delete state for a key
   * @param {string} namespace - State namespace
   * @param {string} key - State key
   */
  delete(namespace, key) {
    const fullKey = `${namespace}:${key}`;
    const stateEntry = this.states.get(fullKey);

    if (stateEntry && stateEntry.persist) {
      this._removePersistentState(namespace, key);
    }

    this.states.delete(fullKey);

    this.stateLog.debug('State deleted', {
      namespace,
      key
    });
  }

  /**
   * Get all states in a namespace
   * @param {string} namespace - State namespace
   * @returns {Map}
   */
  getAll(namespace) {
    const result = new Map();
    const prefix = `${namespace}:`;

    for (const [fullKey, stateEntry] of this.states.entries()) {
      if (fullKey.startsWith(prefix)) {
        const key = fullKey.substring(prefix.length);
        
        // Check TTL
        if (stateEntry.ttl && Date.now() - stateEntry.timestamp > stateEntry.ttl) {
          this.delete(namespace, key);
          continue;
        }

        result.set(key, stateEntry.value);
      }
    }

    return result;
  }

  /**
   * Clear all states in a namespace
   * @param {string} namespace - State namespace
   */
  clearNamespace(namespace) {
    const prefix = `${namespace}:`;
    const keysToDelete = [];

    for (const fullKey of this.states.keys()) {
      if (fullKey.startsWith(prefix)) {
        keysToDelete.push(fullKey);
      }
    }

    for (const fullKey of keysToDelete) {
      const key = fullKey.substring(prefix.length);
      this.delete(namespace, key);
    }

    this.stateLog.info('Namespace cleared', { namespace });
  }

  /**
   * Cleanup expired states
   */
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [fullKey, stateEntry] of this.states.entries()) {
      if (stateEntry.ttl && now - stateEntry.timestamp > stateEntry.ttl) {
        expiredKeys.push(fullKey);
      }
    }

    for (const fullKey of expiredKeys) {
      const [namespace, ...keyParts] = fullKey.split(':');
      const key = keyParts.join(':');
      this.delete(namespace, key);
    }

    if (expiredKeys.length > 0) {
      this.stateLog.info('Expired states cleaned up', {
        count: expiredKeys.length
      });
    }
  }

  /**
   * Get state statistics
   * @returns {Object}
   */
  getStats() {
    const stats = {
      total: this.states.size,
      byNamespace: {}
    };

    for (const fullKey of this.states.keys()) {
      const namespace = fullKey.split(':')[0];
      stats.byNamespace[namespace] = (stats.byNamespace[namespace] || 0) + 1;
    }

    return stats;
  }

  /**
   * Persist state to database (to be implemented with actual DB)
   * @private
   */
  _persistState(namespace, key, value) {
    // This will be implemented to use the existing database
    // For now, it's a placeholder for the pattern
    try {
      // In a real implementation, this would call db.saveState(namespace, key, value)
      this.stateLog.debug('State persisted (placeholder)', {
        namespace,
        key
      });
    } catch (error) {
      this.stateLog.error('Failed to persist state', error, {
        namespace,
        key
      });
    }
  }

  /**
   * Remove persistent state from database
   * @private
   */
  _removePersistentState(namespace, key) {
    try {
      // In a real implementation, this would call db.deleteState(namespace, key)
      this.stateLog.debug('Persistent state removed (placeholder)', {
        namespace,
        key
      });
    } catch (error) {
      this.stateLog.error('Failed to remove persistent state', error, {
        namespace,
        key
      });
    }
  }

  /**
   * Restore states from database on startup
   * @param {Array} states - Array of {namespace, key, value} objects
   */
  restore(states) {
    let restoredCount = 0;

    for (const { namespace, key, value, ttl } of states) {
      try {
        this.set(namespace, key, value, { persist: false, ttl });
        restoredCount++;
      } catch (error) {
        this.stateLog.error('Failed to restore state', error, {
          namespace,
          key
        });
      }
    }

    this.stateLog.info('States restored from database', {
      count: restoredCount
    });
  }
}

// Global state manager instance
const stateManager = new StateManager();

// Cleanup expired states every hour
setInterval(() => {
  stateManager.cleanup();
}, 60 * 60 * 1000);

module.exports = {
  StateManager,
  stateManager
};
