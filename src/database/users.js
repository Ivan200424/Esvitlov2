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

// Отримати користувача по channel_id
function getUserByChannelId(channelId) {
  const stmt = db.prepare('SELECT * FROM users WHERE channel_id = ?');
  return stmt.get(channelId);
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

// Оновити регіон та чергу користувача і скинути хеші
function updateUserRegionAndQueue(telegramId, region, queue) {
  const stmt = db.prepare(`
    UPDATE users 
    SET region = ?, 
        queue = ?, 
        last_hash = NULL, 
        last_published_hash = NULL,
        updated_at = CURRENT_TIMESTAMP
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

// Оновити last_published_hash користувача
function updateUserPublishedHash(id, hash) {
  const stmt = db.prepare(`
    UPDATE users 
    SET last_published_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  const result = stmt.run(hash, id);
  return result.changes > 0;
}

// Оновити обидва хеші користувача
function updateUserHashes(id, hash) {
  const stmt = db.prepare(`
    UPDATE users 
    SET last_hash = ?, last_published_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  const result = stmt.run(hash, hash, id);
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
  // First, get the user's internal ID
  const user = getUserByTelegramId(telegramId);
  if (!user) {
    return false;
  }
  
  const userId = user.id;
  
  // Delete all related records first to avoid FOREIGN KEY constraint failure
  // Delete from outage_history
  const deleteOutageStmt = db.prepare('DELETE FROM outage_history WHERE user_id = ?');
  deleteOutageStmt.run(userId);
  
  // Delete from power_history
  const deletePowerStmt = db.prepare('DELETE FROM power_history WHERE user_id = ?');
  deletePowerStmt.run(userId);
  
  // Delete from schedule_history
  const deleteScheduleStmt = db.prepare('DELETE FROM schedule_history WHERE user_id = ?');
  deleteScheduleStmt.run(userId);
  
  // Finally, delete the user
  const deleteUserStmt = db.prepare('DELETE FROM users WHERE telegram_id = ?');
  const result = deleteUserStmt.run(telegramId);
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

// Отримати користувачів з увімкненими алертами (DEPRECATED - no longer used)
// This function is kept for backward compatibility but returns empty array
function getUsersWithAlertsEnabled() {
  return [];
}

// Оновити channel_id та скинути інформацію про брендування
function resetUserChannel(telegramId, channelId) {
  const stmt = db.prepare(`
    UPDATE users 
    SET channel_id = ?,
        channel_title = NULL,
        channel_description = NULL,
        channel_photo_file_id = NULL,
        channel_user_title = NULL,
        channel_user_description = NULL,
        channel_status = 'active',
        updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  
  const result = stmt.run(channelId, telegramId);
  return result.changes > 0;
}

// Оновити брендування каналу
// Sets channel_branding_updated_at timestamp to track bot-made changes
// Returns: true if update succeeded, false otherwise
function updateChannelBranding(telegramId, brandingData) {
  const stmt = db.prepare(`
    UPDATE users 
    SET channel_title = ?,
        channel_description = ?,
        channel_photo_file_id = ?,
        channel_user_title = ?,
        channel_user_description = ?,
        channel_status = 'active',
        channel_branding_updated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  
  const result = stmt.run(
    brandingData.channelTitle,
    brandingData.channelDescription,
    brandingData.channelPhotoFileId,
    brandingData.userTitle,
    brandingData.userDescription || null,
    telegramId
  );
  return result.changes > 0;
}

// Оновити частково брендування каналу (з можливістю оновити лише окремі поля)
// Sets channel_branding_updated_at timestamp to track bot-made changes
// Returns: true if update succeeded, false if no fields to update or update failed
function updateChannelBrandingPartial(telegramId, brandingData) {
  const fields = [];
  const values = [];
  
  if (brandingData.channelTitle !== undefined) {
    fields.push('channel_title = ?');
    values.push(brandingData.channelTitle);
  }
  
  if (brandingData.channelDescription !== undefined) {
    fields.push('channel_description = ?');
    values.push(brandingData.channelDescription);
  }
  
  if (brandingData.channelPhotoFileId !== undefined) {
    fields.push('channel_photo_file_id = ?');
    values.push(brandingData.channelPhotoFileId);
  }
  
  if (brandingData.userTitle !== undefined) {
    fields.push('channel_user_title = ?');
    values.push(brandingData.userTitle);
  }
  
  if (brandingData.userDescription !== undefined) {
    fields.push('channel_user_description = ?');
    values.push(brandingData.userDescription);
  }
  
  if (fields.length === 0) {
    console.warn('updateChannelBrandingPartial викликано без полів для оновлення');
    return false;
  }
  
  // Always update the timestamp when branding is changed through bot
  fields.push('channel_branding_updated_at = CURRENT_TIMESTAMP');
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

// Оновити статус каналу
function updateChannelStatus(telegramId, status) {
  const stmt = db.prepare(`
    UPDATE users 
    SET channel_status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  
  const result = stmt.run(status, telegramId);
  return result.changes > 0;
}

// Отримати всіх активних користувачів з каналами
function getUsersWithActiveChannels() {
  const stmt = db.prepare(`
    SELECT * FROM users 
    WHERE channel_id IS NOT NULL 
    AND is_active = 1 
    AND channel_status = 'active'
  `);
  return stmt.all();
}

// Отримати всіх користувачів з каналами для перевірки
function getUsersWithChannelsForVerification() {
  const stmt = db.prepare(`
    SELECT * FROM users 
    WHERE channel_id IS NOT NULL 
    AND channel_title IS NOT NULL
    AND is_active = 1
  `);
  return stmt.all();
}

// Оновити налаштування формату користувача
function updateUserFormatSettings(telegramId, settings) {
  const fields = [];
  const values = [];
  
  if (settings.scheduleCaption !== undefined) {
    fields.push('schedule_caption = ?');
    values.push(settings.scheduleCaption);
  }
  
  if (settings.periodFormat !== undefined) {
    fields.push('period_format = ?');
    values.push(settings.periodFormat);
  }
  
  if (settings.powerOffText !== undefined) {
    fields.push('power_off_text = ?');
    values.push(settings.powerOffText);
  }
  
  if (settings.powerOnText !== undefined) {
    fields.push('power_on_text = ?');
    values.push(settings.powerOnText);
  }
  
  if (settings.deleteOldMessage !== undefined) {
    fields.push('delete_old_message = ?');
    values.push(settings.deleteOldMessage ? 1 : 0);
  }
  
  if (settings.pictureOnly !== undefined) {
    fields.push('picture_only = ?');
    values.push(settings.pictureOnly ? 1 : 0);
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

// Отримати налаштування формату користувача
function getUserFormatSettings(telegramId) {
  const stmt = db.prepare(`
    SELECT schedule_caption, period_format, power_off_text, power_on_text, 
           delete_old_message, picture_only, last_schedule_message_id
    FROM users WHERE telegram_id = ?
  `);
  return stmt.get(telegramId);
}

// Оновити ID останнього повідомлення з графіком
function updateLastScheduleMessageId(telegramId, messageId) {
  const stmt = db.prepare(`
    UPDATE users 
    SET last_schedule_message_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  
  const result = stmt.run(messageId, telegramId);
  return result.changes > 0;
}

// Оновити статус паузи каналу користувача
function updateUserChannelPaused(telegramId, paused) {
  const stmt = db.prepare(`
    UPDATE users 
    SET channel_paused = ?, updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  
  const result = stmt.run(paused ? 1 : 0, telegramId);
  return result.changes > 0;
}

// Оновити налаштування куди публікувати сповіщення про світло
function updateUserPowerNotifyTarget(telegramId, target) {
  // target: 'bot' | 'channel' | 'both'
  const stmt = db.prepare(`
    UPDATE users 
    SET power_notify_target = ?, updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  return stmt.run(target, telegramId).changes > 0;
}

// Оновити стан попереджень про графік
function updateScheduleAlertEnabled(telegramId, enabled) {
  const stmt = db.prepare(`
    UPDATE users 
    SET schedule_alert_enabled = ?, updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  return stmt.run(enabled ? 1 : 0, telegramId).changes > 0;
}

// Оновити час попередження про графік (у хвилинах)
function updateScheduleAlertMinutes(telegramId, minutes) {
  const stmt = db.prepare(`
    UPDATE users 
    SET schedule_alert_minutes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  return stmt.run(minutes, telegramId).changes > 0;
}

// Оновити куди надсилати попередження про графік
function updateScheduleAlertTarget(telegramId, target) {
  // target: 'bot', 'channel', 'both'
  const stmt = db.prepare(`
    UPDATE users 
    SET schedule_alert_target = ?, updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  return stmt.run(target, telegramId).changes > 0;
}

// Оновити всі налаштування попереджень про графік
function updateUserScheduleAlertSettings(telegramId, settings) {
  const fields = [];
  const values = [];
  
  if (settings.scheduleAlertEnabled !== undefined) {
    fields.push('schedule_alert_enabled = ?');
    values.push(settings.scheduleAlertEnabled ? 1 : 0);
  }
  
  if (settings.scheduleAlertMinutes !== undefined) {
    fields.push('schedule_alert_minutes = ?');
    values.push(settings.scheduleAlertMinutes);
  }
  
  if (settings.scheduleAlertTarget !== undefined) {
    fields.push('schedule_alert_target = ?');
    values.push(settings.scheduleAlertTarget);
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

// Оновити ID повідомлень (для авто-видалення попередніх повідомлень)
function updateUser(telegramId, updates) {
  const fields = [];
  const values = [];
  
  if (updates.last_start_message_id !== undefined) {
    fields.push('last_start_message_id = ?');
    values.push(updates.last_start_message_id);
  }
  
  if (updates.last_settings_message_id !== undefined) {
    fields.push('last_settings_message_id = ?');
    values.push(updates.last_settings_message_id);
  }
  
  if (updates.last_schedule_message_id !== undefined) {
    fields.push('last_schedule_message_id = ?');
    values.push(updates.last_schedule_message_id);
  }
  
  if (updates.last_timer_message_id !== undefined) {
    fields.push('last_timer_message_id = ?');
    values.push(updates.last_timer_message_id);
  }
  
  if (updates.channel_id !== undefined) {
    fields.push('channel_id = ?');
    values.push(updates.channel_id);
  }
  
  if (updates.channel_title !== undefined) {
    fields.push('channel_title = ?');
    values.push(updates.channel_title);
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

// Update snapshot hashes for today and tomorrow
function updateSnapshotHashes(telegramId, todayHash, tomorrowHash, tomorrowDate = null) {
  const stmt = db.prepare(`
    UPDATE users 
    SET today_snapshot_hash = ?, 
        tomorrow_snapshot_hash = ?,
        tomorrow_published_date = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  
  const result = stmt.run(todayHash, tomorrowHash, tomorrowDate, telegramId);
  return result.changes > 0;
}

// Get snapshot hashes for user
function getSnapshotHashes(telegramId) {
  const stmt = db.prepare(`
    SELECT today_snapshot_hash, tomorrow_snapshot_hash, tomorrow_published_date
    FROM users 
    WHERE telegram_id = ?
  `);
  
  return stmt.get(telegramId);
}

module.exports = {
  createUser,
  getUserByTelegramId,
  getUserById,
  getUserByChannelId,
  updateUserRegionQueue,
  updateUserRegionAndQueue,
  updateUserChannel,
  updateUserAlertSettings,
  updateUserHash,
  updateUserPublishedHash,
  updateUserHashes,
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
  getUsersWithRouterIp,
  getUsersWithAlertsEnabled,
  resetUserChannel,
  updateChannelBranding,
  updateChannelBrandingPartial,
  updateChannelStatus,
  getUsersWithActiveChannels,
  getUsersWithChannelsForVerification,
  updateUserFormatSettings,
  getUserFormatSettings,
  updateLastScheduleMessageId,
  updateUserChannelPaused,
  updateUserPowerNotifyTarget,
  updateScheduleAlertEnabled,
  updateScheduleAlertMinutes,
  updateScheduleAlertTarget,
  updateUserScheduleAlertSettings,
  updateUser,
  updateSnapshotHashes,
  getSnapshotHashes,
};
