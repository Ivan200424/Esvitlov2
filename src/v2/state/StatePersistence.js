/**
 * State Persistence Layer
 * 
 * NEW implementation for v2 bot rewrite.
 * Handles saving and restoring user states from database.
 */

const db = require('../../database/db');

/**
 * Save user state to database
 * @param {string} userId - User ID
 * @param {string} stateName - State name
 * @param {Object} context - State context
 */
function saveState(userId, stateName, context) {
  try {
    const serializedContext = JSON.stringify(context);
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO user_states (user_id, state_type, state_data, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    stmt.run(userId, stateName, serializedContext);
  } catch (error) {
    console.error(`Error saving state for user ${userId}:`, error);
  }
}

/**
 * Load user state from database
 * @param {string} userId - User ID
 * @returns {Object|null} - State data or null
 */
function loadState(userId) {
  try {
    const stmt = db.prepare(`
      SELECT state_type, state_data, created_at
      FROM user_states
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(userId);
    
    if (!row) {
      return null;
    }

    return {
      stateName: row.state_type,
      context: JSON.parse(row.state_data),
      timestamp: new Date(row.created_at).getTime()
    };
  } catch (error) {
    console.error(`Error loading state for user ${userId}:`, error);
    return null;
  }
}

/**
 * Delete user state from database
 * @param {string} userId - User ID
 */
function deleteState(userId) {
  try {
    const stmt = db.prepare('DELETE FROM user_states WHERE user_id = ?');
    stmt.run(userId);
  } catch (error) {
    console.error(`Error deleting state for user ${userId}:`, error);
  }
}

/**
 * Load all user states from database
 * @returns {Map<string, Object>} - Map of userId to state data
 */
function loadAllStates() {
  const states = new Map();
  
  try {
    const stmt = db.prepare(`
      SELECT user_id, state_type, state_data, created_at
      FROM user_states
      WHERE created_at > datetime('now', '-1 hour')
    `);
    const rows = stmt.all();
    
    for (const row of rows) {
      try {
        states.set(row.user_id, {
          stateName: row.state_type,
          context: JSON.parse(row.state_data),
          timestamp: new Date(row.created_at).getTime()
        });
      } catch (error) {
        console.error(`Error parsing state for user ${row.user_id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error loading all states:', error);
  }
  
  return states;
}

/**
 * Clean up old states (older than 1 hour)
 */
function cleanupOldStates() {
  try {
    const stmt = db.prepare(`
      DELETE FROM user_states
      WHERE created_at < datetime('now', '-1 hour')
    `);
    const result = stmt.run();
    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} old states`);
    }
  } catch (error) {
    console.error('Error cleaning up old states:', error);
  }
}

module.exports = {
  saveState,
  loadState,
  deleteState,
  loadAllStates,
  cleanupOldStates
};
