/**
 * Centralized State Manager
 * 
 * This module provides centralized state management for the bot.
 * All in-memory state should be managed through this module.
 * 
 * Key principles:
 * - Single source of truth for state
 * - Consistent API for all state operations
 * - Automatic cleanup of stale states
 * - DB persistence integration
 */

const { saveUserState, getUserState, deleteUserState, getAllUserStates } = require('../database/db');

// State stores by type
const states = {
  wizard: new Map(),           // Wizard states (from handlers/start.js)
  conversation: new Map(),     // Conversation states (from handlers/channel.js)
  ipSetup: new Map(),          // IP setup states (from handlers/settings.js)
  pendingChannels: new Map(),  // Pending channel connections (from bot.js)
  powerMonitor: new Map(),     // Power monitoring states (from powerMonitor.js)
  lastMenuMessages: new Map(), // Last menu message IDs (from handlers/start.js)
  channelInstructions: new Map() // Channel instruction message IDs (from bot.js)
};

// State expiration times (in milliseconds)
const EXPIRATION_TIMES = {
  wizard: 60 * 60 * 1000,           // 1 hour
  conversation: 60 * 60 * 1000,     // 1 hour
  ipSetup: 60 * 60 * 1000,          // 1 hour
  pendingChannels: 60 * 60 * 1000,  // 1 hour
  powerMonitor: null,                // Never expires (persistent)
  lastMenuMessages: 60 * 60 * 1000, // 1 hour
  channelInstructions: 60 * 60 * 1000 // 1 hour
};

// Cleanup interval reference
let cleanupInterval = null;

/**
 * Initialize state manager
 * Starts automatic cleanup and restores persisted states
 */
function initStateManager() {
  console.log('🔄 Initializing state manager...');
  
  // Start automatic cleanup
  startCleanup();
  
  // Restore persisted states
  restoreStates();
  
  console.log('✅ State manager initialized');
}

/**
 * Start automatic cleanup of expired states
 */
function startCleanup() {
  if (cleanupInterval) {
    return; // Already running
  }
  
  // Run cleanup every hour
  cleanupInterval = setInterval(() => {
    cleanupExpiredStates();
  }, 60 * 60 * 1000);
}

/**
 * Stop automatic cleanup
 */
function stopCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Clean up expired states
 */
function cleanupExpiredStates() {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [stateType, store] of Object.entries(states)) {
    const expirationTime = EXPIRATION_TIMES[stateType];
    
    if (!expirationTime) {
      continue; // Skip states that don't expire
    }
    
    for (const [key, value] of store.entries()) {
      // Check if state has timestamp and is expired
      if (value && value.timestamp && (now - value.timestamp) > expirationTime) {
        store.delete(key);
        cleanedCount++;
        
        // Also delete from DB if it's a persisted state
        if (['wizard', 'conversation', 'ipSetup'].includes(stateType)) {
          deleteUserState(key, stateType);
        }
      }
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired states`);
  }
}

/**
 * Restore states from database
 */
function restoreStates() {
  const stateTypes = ['wizard', 'conversation', 'ipSetup'];
  let totalRestored = 0;
  
  for (const stateType of stateTypes) {
    const stateRecords = getAllUserStates(stateType);
    
    for (const { telegram_id, state_data } of stateRecords) {
      try {
        const data = JSON.parse(state_data);
        // Add timestamp if missing
        if (!data.timestamp) {
          data.timestamp = Date.now();
        }
        states[stateType].set(telegram_id, data);
        totalRestored++;
      } catch (error) {
        console.error(`Error restoring ${stateType} state for ${telegram_id}:`, error);
      }
    }
  }
  
  console.log(`✅ Restored ${totalRestored} persisted states`);
}

/**
 * Get state for a user
 * @param {string} stateType - Type of state (wizard, conversation, etc.)
 * @param {string} userId - User identifier
 * @returns {object|null} State object or null if not found
 */
function getState(stateType, userId) {
  try {
    if (!states[stateType]) {
      console.error(`❌ Invalid state type: ${stateType}`);
      return null;
    }
    
    if (!userId) {
      console.error(`❌ Cannot get state ${stateType}: userId is undefined`);
      return null;
    }
    
    return states[stateType].get(String(userId)) || null;
  } catch (error) {
    console.error(`❌ Error getting state ${stateType} for user ${userId}:`, error);
    return null;
  }
}

/**
 * Set state for a user
 * @param {string} stateType - Type of state
 * @param {string} userId - User identifier
 * @param {object} data - State data
 * @param {boolean} persist - Whether to persist to database (default: true for wizard, conversation, ipSetup)
 */
function setState(stateType, userId, data, persist = null) {
  try {
    if (!states[stateType]) {
      console.error(`❌ Invalid state type: ${stateType}`);
      return;
    }
    
    if (!userId) {
      console.error(`❌ Cannot set state ${stateType}: userId is undefined`);
      return;
    }
    
    // Add timestamp
    const stateData = { ...data, timestamp: Date.now() };
    
    // Set in memory
    states[stateType].set(String(userId), stateData);
    
    // Determine if we should persist
    const shouldPersist = persist !== null 
      ? persist 
      : ['wizard', 'conversation', 'ipSetup'].includes(stateType);
    
    // Persist to DB if needed (persist the timestamped data for consistency)
    if (shouldPersist) {
      saveUserState(String(userId), stateType, stateData);
    }
  } catch (error) {
    console.error(`❌ Error setting state ${stateType} for user ${userId}:`, error);
  }
}

/**
 * Clear state for a user
 * @param {string} stateType - Type of state
 * @param {string} userId - User identifier
 */
function clearState(stateType, userId) {
  try {
    if (!states[stateType]) {
      console.error(`❌ Invalid state type: ${stateType}`);
      return;
    }
    
    if (!userId) {
      console.error(`❌ Cannot clear state ${stateType}: userId is undefined`);
      return;
    }
    
    states[stateType].delete(String(userId));
    
    // Also delete from DB if it's a persisted state
    if (['wizard', 'conversation', 'ipSetup'].includes(stateType)) {
      deleteUserState(String(userId), stateType);
    }
  } catch (error) {
    console.error(`❌ Error clearing state ${stateType} for user ${userId}:`, error);
  }
}

/**
 * Check if user has active state
 * @param {string} stateType - Type of state
 * @param {string} userId - User identifier
 * @returns {boolean} True if user has active state
 */
function hasState(stateType, userId) {
  try {
    if (!states[stateType]) {
      console.error(`❌ Invalid state type: ${stateType}`);
      return false;
    }
    
    if (!userId) {
      return false;
    }
    
    return states[stateType].has(String(userId));
  } catch (error) {
    console.error(`❌ Error checking state ${stateType} for user ${userId}:`, error);
    return false;
  }
}

/**
 * Get all states of a specific type
 * @param {string} stateType - Type of state
 * @returns {Map} Map of all states
 */
function getAllStates(stateType) {
  if (!states[stateType]) {
    throw new Error(`Invalid state type: ${stateType}`);
  }
  
  return states[stateType];
}

/**
 * Clear all states of a specific type
 * @param {string} stateType - Type of state
 */
function clearAllStates(stateType) {
  if (!states[stateType]) {
    throw new Error(`Invalid state type: ${stateType}`);
  }
  
  states[stateType].clear();
}

/**
 * Get state statistics
 * @returns {object} Statistics about current states
 */
function getStateStats() {
  const stats = {};
  
  for (const [stateType, store] of Object.entries(states)) {
    stats[stateType] = store.size;
  }
  
  return stats;
}

module.exports = {
  initStateManager,
  stopCleanup,
  getState,
  setState,
  clearState,
  hasState,
  getAllStates,
  clearAllStates,
  getStateStats,
  cleanupExpiredStates
};
