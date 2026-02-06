/**
 * Event Emitter for Event-Driven Architecture
 * 
 * Provides pub-sub pattern for decoupling components
 * Enables scalable, event-driven communication between services
 */

const { Logger } = require('./Logger');

class EventEmitter {
  constructor(name = 'EventEmitter') {
    this.listeners = new Map();
    this.logger = new Logger({ component: name });
    this.eventHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Subscribe to an event
   * @param {string} eventName - Name of the event
   * @param {Function} handler - Handler function
   * @param {Object} options - Options {once: boolean}
   * @returns {Function} Unsubscribe function
   */
  on(eventName, handler, options = {}) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }

    const listener = {
      handler,
      once: options.once || false,
      context: options.context || null
    };

    this.listeners.get(eventName).push(listener);

    this.logger.debug('Event listener registered', {
      event: eventName,
      once: listener.once
    });

    // Return unsubscribe function
    return () => this.off(eventName, handler);
  }

  /**
   * Subscribe to an event (one-time)
   * @param {string} eventName - Name of the event
   * @param {Function} handler - Handler function
   * @returns {Function} Unsubscribe function
   */
  once(eventName, handler) {
    return this.on(eventName, handler, { once: true });
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Name of the event
   * @param {Function} handler - Handler function to remove
   */
  off(eventName, handler) {
    if (!this.listeners.has(eventName)) {
      return;
    }

    const listeners = this.listeners.get(eventName);
    const index = listeners.findIndex(l => l.handler === handler);

    if (index !== -1) {
      listeners.splice(index, 1);
      this.logger.debug('Event listener removed', { event: eventName });
    }

    // Clean up empty listener arrays
    if (listeners.length === 0) {
      this.listeners.delete(eventName);
    }
  }

  /**
   * Emit an event
   * @param {string} eventName - Name of the event
   * @param {Object} data - Event data
   * @returns {Promise<void>}
   */
  async emit(eventName, data = {}) {
    const eventData = {
      name: eventName,
      timestamp: Date.now(),
      data
    };

    // Add to history for debugging
    this._addToHistory(eventData);

    this.logger.info('Event emitted', {
      event: eventName,
      dataKeys: Object.keys(data)
    });

    if (!this.listeners.has(eventName)) {
      this.logger.debug('No listeners for event', { event: eventName });
      return;
    }

    const listeners = [...this.listeners.get(eventName)];
    const onceListeners = [];

    // Execute all handlers
    for (const listener of listeners) {
      try {
        await listener.handler(eventData.data);

        if (listener.once) {
          onceListeners.push(listener);
        }
      } catch (error) {
        this.logger.error('Error in event handler', error, {
          event: eventName,
          handler: listener.handler.name || 'anonymous'
        });
      }
    }

    // Remove one-time listeners
    for (const listener of onceListeners) {
      this.off(eventName, listener.handler);
    }
  }

  /**
   * Emit event synchronously (fire and forget)
   * @param {string} eventName - Name of the event
   * @param {Object} data - Event data
   */
  emitSync(eventName, data = {}) {
    this.emit(eventName, data).catch(error => {
      this.logger.error('Error emitting event', error, { event: eventName });
    });
  }

  /**
   * Remove all listeners for an event
   * @param {string} eventName - Name of the event (optional, removes all if not provided)
   */
  removeAllListeners(eventName = null) {
    if (eventName) {
      this.listeners.delete(eventName);
      this.logger.debug('All listeners removed for event', { event: eventName });
    } else {
      this.listeners.clear();
      this.logger.debug('All listeners removed');
    }
  }

  /**
   * Get listener count for an event
   * @param {string} eventName - Name of the event
   * @returns {number}
   */
  listenerCount(eventName) {
    return this.listeners.has(eventName) 
      ? this.listeners.get(eventName).length 
      : 0;
  }

  /**
   * Get all event names with listeners
   * @returns {string[]}
   */
  eventNames() {
    return Array.from(this.listeners.keys());
  }

  /**
   * Add event to history for debugging
   * @private
   */
  _addToHistory(eventData) {
    this.eventHistory.push(eventData);

    // Keep history size manageable
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * Get recent event history (for debugging)
   * @param {number} limit - Number of events to return
   * @returns {Array}
   */
  getHistory(limit = 10) {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Clear event history
   */
  clearHistory() {
    this.eventHistory = [];
  }
}

// Global event bus instance
const eventBus = new EventEmitter('GlobalEventBus');

// Define standard event names as constants
const Events = {
  // Schedule events
  SCHEDULE_CHANGED: 'schedule_changed',
  SCHEDULE_PUBLISHED: 'schedule_published',
  SCHEDULE_CHECK_START: 'schedule_check_start',
  SCHEDULE_CHECK_END: 'schedule_check_end',
  
  // Power events
  POWER_OFF: 'power_off',
  POWER_ON: 'power_on',
  POWER_STATE_CHANGED: 'power_state_changed',
  POWER_CHECK_FAILED: 'power_check_failed',
  
  // Pause events
  PAUSE_ENABLED: 'pause_enabled',
  PAUSE_DISABLED: 'pause_disabled',
  
  // Channel events
  CHANNEL_CONNECTED: 'channel_connected',
  CHANNEL_DISCONNECTED: 'channel_disconnected',
  CHANNEL_BLOCKED: 'channel_blocked',
  
  // User events
  USER_REGISTERED: 'user_registered',
  USER_SETTINGS_CHANGED: 'user_settings_changed',
  
  // System events
  SCHEDULER_STARTED: 'scheduler_started',
  SCHEDULER_STOPPED: 'scheduler_stopped',
  SCHEDULER_INTERVAL_CHANGED: 'scheduler_interval_changed',
  BOT_STARTED: 'bot_started',
  BOT_STOPPING: 'bot_stopping',
  BOT_ERROR: 'bot_error'
};

module.exports = {
  EventEmitter,
  eventBus,
  Events
};
