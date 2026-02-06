/**
 * State Machine Base Class
 * 
 * This is a NEW implementation from scratch for the v2 bot rewrite.
 * DO NOT reuse old state machine logic.
 * 
 * Each state MUST implement ALL required lifecycle methods.
 */

class State {
  constructor(name) {
    this.name = name;
  }

  /**
   * Called when entering this state
   * @param {Object} context - State context data
   * @returns {Promise<void>}
   */
  async enter(context) {
    throw new Error(`State ${this.name} must implement enter()`);
  }

  /**
   * Handle text input while in this state
   * @param {Object} bot - Telegram bot instance
   * @param {Object} msg - Telegram message object
   * @param {Object} context - State context data
   * @returns {Promise<boolean>} - true if handled, false otherwise
   */
  async handleText(bot, msg, context) {
    // Default: ignore text input
    return false;
  }

  /**
   * Handle callback query while in this state
   * @param {Object} bot - Telegram bot instance
   * @param {Object} query - Telegram callback query
   * @param {Object} context - State context data
   * @returns {Promise<boolean>} - true if handled, false otherwise
   */
  async handleCallback(bot, query, context) {
    // Default: ignore callbacks
    return false;
  }

  /**
   * Cancel the current state
   * @param {Object} bot - Telegram bot instance
   * @param {number} chatId - Chat ID
   * @param {Object} context - State context data
   * @returns {Promise<void>}
   */
  async cancel(bot, chatId, context) {
    throw new Error(`State ${this.name} must implement cancel()`);
  }

  /**
   * Handle state timeout
   * @param {Object} bot - Telegram bot instance
   * @param {number} chatId - Chat ID
   * @param {Object} context - State context data
   * @returns {Promise<void>}
   */
  async timeout(bot, chatId, context) {
    // Default: cancel on timeout
    await this.cancel(bot, chatId, context);
  }

  /**
   * Called when exiting this state
   * @param {Object} context - State context data
   * @returns {Promise<void>}
   */
  async exit(context) {
    // Default: no cleanup needed
  }
}

/**
 * State Machine Manager
 * Manages user states and transitions
 */
class StateMachine {
  constructor() {
    // Map of state names to State instances
    this.states = new Map();
    
    // Map of user IDs to their current state data
    this.userStates = new Map();
    
    // State timeout in milliseconds (30 minutes)
    this.stateTimeout = 30 * 60 * 1000;
  }

  /**
   * Register a state
   * @param {State} state - State instance
   */
  registerState(state) {
    if (!(state instanceof State)) {
      throw new Error('State must be an instance of State class');
    }
    this.states.set(state.name, state);
  }

  /**
   * Get current state for user
   * @param {string} userId - User ID
   * @returns {Object|null} - State data or null
   */
  getUserState(userId) {
    return this.userStates.get(userId) || null;
  }

  /**
   * Set user state
   * @param {string} userId - User ID
   * @param {string} stateName - State name
   * @param {Object} context - Additional context data
   * @returns {Promise<void>}
   */
  async setUserState(userId, stateName, context = {}) {
    const state = this.states.get(stateName);
    if (!state) {
      throw new Error(`State ${stateName} not registered`);
    }

    // Exit previous state if exists
    const currentStateData = this.userStates.get(userId);
    if (currentStateData) {
      const currentState = this.states.get(currentStateData.stateName);
      if (currentState) {
        await currentState.exit(currentStateData.context);
      }
    }

    // Create new state data
    const stateData = {
      stateName,
      context: { ...context, userId },
      timestamp: Date.now()
    };

    this.userStates.set(userId, stateData);

    // Enter new state
    await state.enter(stateData.context);

    // Set timeout
    this.scheduleTimeout(userId);
  }

  /**
   * Clear user state
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async clearUserState(userId) {
    const stateData = this.userStates.get(userId);
    if (stateData) {
      const state = this.states.get(stateData.stateName);
      if (state) {
        await state.exit(stateData.context);
      }
      this.userStates.delete(userId);
    }
  }

  /**
   * Handle text message for user's current state
   * @param {Object} bot - Telegram bot instance
   * @param {Object} msg - Telegram message
   * @returns {Promise<boolean>} - true if handled
   */
  async handleText(bot, msg) {
    const userId = String(msg.from.id);
    const stateData = this.userStates.get(userId);
    
    if (!stateData) {
      return false;
    }

    const state = this.states.get(stateData.stateName);
    if (!state) {
      return false;
    }

    // Update timestamp
    stateData.timestamp = Date.now();

    return await state.handleText(bot, msg, stateData.context);
  }

  /**
   * Handle callback query for user's current state
   * @param {Object} bot - Telegram bot instance
   * @param {Object} query - Telegram callback query
   * @returns {Promise<boolean>} - true if handled
   */
  async handleCallback(bot, query) {
    const userId = String(query.from.id);
    const stateData = this.userStates.get(userId);
    
    if (!stateData) {
      return false;
    }

    const state = this.states.get(stateData.stateName);
    if (!state) {
      return false;
    }

    // Update timestamp
    stateData.timestamp = Date.now();

    return await state.handleCallback(bot, query, stateData.context);
  }

  /**
   * Cancel user's current state
   * @param {Object} bot - Telegram bot instance
   * @param {string} userId - User ID
   * @param {number} chatId - Chat ID
   * @returns {Promise<void>}
   */
  async cancelUserState(bot, userId, chatId) {
    const stateData = this.userStates.get(userId);
    if (!stateData) {
      return;
    }

    const state = this.states.get(stateData.stateName);
    if (state) {
      await state.cancel(bot, chatId, stateData.context);
    }

    await this.clearUserState(userId);
  }

  /**
   * Schedule timeout check for user state
   * @param {string} userId - User ID
   */
  scheduleTimeout(userId) {
    setTimeout(async () => {
      const stateData = this.userStates.get(userId);
      if (!stateData) {
        return;
      }

      // Check if state has expired
      const age = Date.now() - stateData.timestamp;
      if (age >= this.stateTimeout) {
        const state = this.states.get(stateData.stateName);
        if (state) {
          // We don't have chatId here, so timeout handler should not send messages
          // Just clean up the state
          await state.exit(stateData.context);
        }
        this.userStates.delete(userId);
      }
    }, this.stateTimeout);
  }

  /**
   * Clean up expired states (run periodically)
   */
  cleanupExpiredStates() {
    const now = Date.now();
    for (const [userId, stateData] of this.userStates.entries()) {
      const age = now - stateData.timestamp;
      if (age >= this.stateTimeout) {
        this.clearUserState(userId).catch(err => {
          console.error(`Error cleaning up state for user ${userId}:`, err);
        });
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  startCleanup() {
    setInterval(() => {
      this.cleanupExpiredStates();
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}

module.exports = { State, StateMachine };
