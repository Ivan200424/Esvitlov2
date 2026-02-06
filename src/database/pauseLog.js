/**
 * Pause Log Management
 * Tracks pause/resume events for audit and history
 */

const db = require('./db');

/**
 * Add a pause event to the log
 */
function logPauseEvent(adminId, eventType, pauseType = null, message = null, reason = null) {
  try {
    const stmt = db.prepare(`
      INSERT INTO pause_log (admin_id, event_type, pause_type, message, reason, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(adminId, eventType, pauseType, message, reason);
    return true;
  } catch (error) {
    console.error('Error logging pause event:', error);
    return false;
  }
}

/**
 * Get recent pause events
 */
function getPauseLog(limit = 20) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM pause_log
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    return stmt.all(limit);
  } catch (error) {
    console.error('Error getting pause log:', error);
    return [];
  }
}

/**
 * Get pause log statistics
 */
function getPauseLogStats() {
  try {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_events,
        SUM(CASE WHEN event_type = 'pause' THEN 1 ELSE 0 END) as pause_count,
        SUM(CASE WHEN event_type = 'resume' THEN 1 ELSE 0 END) as resume_count,
        MAX(created_at) as last_event_at
      FROM pause_log
    `);
    
    return stmt.get();
  } catch (error) {
    console.error('Error getting pause log stats:', error);
    return { total_events: 0, pause_count: 0, resume_count: 0, last_event_at: null };
  }
}

/**
 * Clean old pause log entries (older than 30 days)
 */
function cleanOldPauseLog() {
  try {
    const stmt = db.prepare(`
      DELETE FROM pause_log
      WHERE created_at < datetime('now', '-30 days')
    `);
    
    const result = stmt.run();
    console.log(`🧹 Cleaned ${result.changes} old pause log entries`);
    return result.changes;
  } catch (error) {
    console.error('Error cleaning pause log:', error);
    return 0;
  }
}

module.exports = {
  logPauseEvent,
  getPauseLog,
  getPauseLogStats,
  cleanOldPauseLog,
};
