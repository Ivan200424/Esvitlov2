const db = require('./db');

// Створити нового користувача
function createUser(telegramId, username, region, queue) {
  const stmt = db.prepare(`
    INSERT INTO users (telegram_id, username, region, queue)
    VALUES (?, ?, ?, ?)
  `);
  
  try {
    const result = stmt.run(telegramId, username, region, queue);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('Помилка створення користувача:', error.message);
    throw error;
  }
}

// Отримати користувача по telegram_id
function getUserByTelegramId(telegramId) {
  const stmt = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
  return stmt.get(telegramId);
}

// Отримати користувача по ID
function getUserById(id) {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id);
}

// Оновити регіон та чергу користувача
function updateUserRegionQueue(telegramId, region, queue) {
  const stmt = db.prepare(`
    UPDATE users 
    SET region = ?, queue = ?, updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  
  const result = stmt.run(region, queue, telegramId);
  return result.changes > 0;
}

// Оновити channel_id користувача
function updateUserChannel(telegramId, channelId) {
  const stmt = db.prepare(`
    UPDATE users 
    SET channel_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  
  const result = stmt.run(channelId, telegramId);
  return result.changes > 0;
}

// Оновити налаштування сповіщень
function updateUserAlertSettings(telegramId, settings) {
  const fields = [];
  const values = [];
  
  if (settings.notifyBeforeOff !== undefined) {
    fields.push('notify_before_off = ?');
    values.push(settings.notifyBeforeOff);
  }
  
  if (settings.notifyBeforeOn !== undefined) {
    fields.push('notify_before_on = ?');
    values.push(settings.notifyBeforeOn);
  }
  
  if (settings.alertsOffEnabled !== undefined) {
    fields.push('alerts_off_enabled = ?');
    values.push(settings.alertsOffEnabled ? 1 : 0);
  }
  
  if (settings.alertsOnEnabled !== undefined) {
    fields.push('alerts_on_enabled = ?');
    values.push(settings.alertsOnEnabled ? 1 : 0);
  }
  
  if (fields.length === 0) return false;
  
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(telegramId);
  
  const stmt = db.prepare(`
    UPDATE users 
    SET ${fields.join(', ')}
    WHERE telegram_id = ?
  `);
  
  const result = stmt.run(...values);
  return result.changes > 0;
}

// Оновити last_hash користувача
function updateUserHash(id, hash) {
  const stmt = db.prepare(`
    UPDATE users 
    SET last_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  const result = stmt.run(hash, id);
  return result.changes > 0;
}

// Оновити last_post_id користувача
function updateUserPostId(id, postId) {
  const stmt = db.prepare(`
    UPDATE users 
    SET last_post_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  const result = stmt.run(postId, id);
  return result.changes > 0;
}

// Активувати/деактивувати користувача
function setUserActive(telegramId, isActive) {
  const stmt = db.prepare(`
    UPDATE users 
    SET is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  
  const result = stmt.run(isActive ? 1 : 0, telegramId);
  return result.changes > 0;
}

// Отримати всіх користувачів по регіону
function getUsersByRegion(region) {
  const stmt = db.prepare('SELECT * FROM users WHERE region = ? AND is_active = 1');
  return stmt.all(region);
}

// Отримати всіх активних користувачів
function getAllActiveUsers() {
  const stmt = db.prepare('SELECT * FROM users WHERE is_active = 1');
  return stmt.all();
}

// Отримати всіх користувачів
function getAllUsers() {
  const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
  return stmt.all();
}

// Отримати останніх N користувачів
function getRecentUsers(limit = 20) {
  const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ?');
  return stmt.all(limit);
}

// Отримати статистику користувачів
function getUserStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const active = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
  const withChannels = db.prepare('SELECT COUNT(*) as count FROM users WHERE channel_id IS NOT NULL').get().count;
  
  const byRegion = db.prepare(`
    SELECT region, COUNT(*) as count 
    FROM users 
    WHERE is_active = 1 
    GROUP BY region
  `).all();
  
  return {
    total,
    active,
    withChannels,
    byRegion,
  };
}

// Видалити користувача
function deleteUser(telegramId) {
  const stmt = db.prepare('DELETE FROM users WHERE telegram_id = ?');
  const result = stmt.run(telegramId);
  return result.changes > 0;
}

// Оновити router_ip користувача
function updateUserRouterIp(telegramId, routerIp) {
  const stmt = db.prepare(`
    UPDATE users 
    SET router_ip = ?, updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  
  const result = stmt.run(routerIp, telegramId);
  return result.changes > 0;
}

// Оновити стан живлення користувача
function updateUserPowerState(telegramId, state, changedAt) {
  const stmt = db.prepare(`
    UPDATE users 
    SET power_state = ?, power_changed_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  
  const result = stmt.run(state, changedAt, telegramId);
  return result.changes > 0;
}

// Оновити період алерту користувача
function updateUserAlertPeriod(telegramId, type, period, messageId = null) {
  const periodField = type === 'off' ? 'last_alert_off_period' : 'last_alert_on_period';
  const messageField = type === 'off' ? 'alert_off_message_id' : 'alert_on_message_id';
  
  const stmt = db.prepare(`
    UPDATE users 
    SET ${periodField} = ?, ${messageField} = ?, updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  
  const result = stmt.run(period, messageId, telegramId);
  return result.changes > 0;
}

// Отримати всіх користувачів з налаштованим router_ip
function getUsersWithRouterIp() {
  try {
    const stmt = db.prepare("SELECT * FROM users WHERE router_ip IS NOT NULL AND router_ip != '' AND is_active = 1");
    return stmt.all();
  } catch (error) {
    console.error('Помилка getUsersWithRouterIp:', error.message);
    return []; // Повертаємо порожній масив при помилці
  }
}

// Отримати користувачів з увімкненими алертами
function getUsersWithAlertsEnabled() {
  const stmt = db.prepare(`
    SELECT * FROM users 
    WHERE is_active = 1 
    AND (alerts_off_enabled = 1 OR alerts_on_enabled = 1)
  `);
  return stmt.all();
}

module.exports = {
  createUser,
  getUserByTelegramId,
  getUserById,
  updateUserRegionQueue,
  updateUserChannel,
  updateUserAlertSettings,
  updateUserHash,
  updateUserPostId,
  setUserActive,
  getUsersByRegion,
  getAllActiveUsers,
  getAllUsers,
  getRecentUsers,
  getUserStats,
  deleteUser,
  updateUserRouterIp,
  updateUserPowerState,
  updateUserAlertPeriod,
  getUsersWithRouterIp,
  getUsersWithAlertsEnabled,
};
