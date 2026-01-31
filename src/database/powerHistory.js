const db = require('./db');

/**
 * Додати запис про подію зміни стану живлення
 * @param {number} userId - ID користувача
 * @param {string} eventType - Тип події: 'power_on' або 'power_off'
 * @param {number} timestamp - Unix timestamp події
 * @param {number} durationSeconds - Тривалість попереднього стану в секундах
 */
function addPowerEvent(userId, eventType, timestamp, durationSeconds = null) {
  try {
    const stmt = db.prepare(`
      INSERT INTO power_history (user_id, event_type, timestamp, duration_seconds)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(userId, eventType, timestamp, durationSeconds);
    return true;
  } catch (error) {
    console.error('Error adding power event:', error);
    return false;
  }
}

/**
 * Отримати історію подій для користувача
 * @param {number} userId - ID користувача
 * @param {number} limit - Максимальна кількість записів
 */
function getPowerHistory(userId, limit = 100) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM power_history
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    
    return stmt.all(userId, limit);
  } catch (error) {
    console.error('Error getting power history:', error);
    return [];
  }
}

/**
 * Отримати історію подій за період
 * @param {number} userId - ID користувача
 * @param {number} startTimestamp - Початковий timestamp
 * @param {number} endTimestamp - Кінцевий timestamp
 */
function getPowerHistoryByPeriod(userId, startTimestamp, endTimestamp) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM power_history
      WHERE user_id = ? AND timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `);
    
    return stmt.all(userId, startTimestamp, endTimestamp);
  } catch (error) {
    console.error('Error getting power history by period:', error);
    return [];
  }
}

/**
 * Очистити стару історію (старше N днів)
 * @param {number} daysToKeep - Кількість днів для збереження
 */
function cleanupOldHistory(daysToKeep = 30) {
  try {
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - (daysToKeep * 24 * 60 * 60);
    
    const stmt = db.prepare(`
      DELETE FROM power_history
      WHERE timestamp < ?
    `);
    
    const result = stmt.run(cutoffTimestamp);
    console.log(`Видалено ${result.changes} старих записів з power_history`);
    return result.changes;
  } catch (error) {
    console.error('Error cleaning up old history:', error);
    return 0;
  }
}

module.exports = {
  addPowerEvent,
  getPowerHistory,
  getPowerHistoryByPeriod,
  cleanupOldHistory,
};
