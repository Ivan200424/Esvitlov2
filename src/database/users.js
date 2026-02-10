const { pool } = require('./db');

// Створити нового користувача
async function createUser(telegramId, username, region, queue) {
  try {
    const result = await pool.query(`
      INSERT INTO users (telegram_id, username, region, queue)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [telegramId, username, region, queue]);
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Помилка створення користувача:', error.message);
    throw error;
  }
}

// Отримати користувача по telegram_id
async function getUserByTelegramId(telegramId) {
  const result = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  return result.rows[0];
}

// Отримати користувача по ID
async function getUserById(id) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

// Отримати користувача по channel_id
async function getUserByChannelId(channelId) {
  const result = await pool.query('SELECT * FROM users WHERE channel_id = $1', [channelId]);
  return result.rows[0];
}

// Оновити регіон та чергу користувача
async function updateUserRegionQueue(telegramId, region, queue) {
  const result = await pool.query(`
    UPDATE users 
    SET region = $1, queue = $2, updated_at = NOW()
    WHERE telegram_id = $3
  `, [region, queue, telegramId]);
  
  return result.rowCount > 0;
}

// Оновити регіон та чергу користувача і скинути хеші
async function updateUserRegionAndQueue(telegramId, region, queue) {
  const result = await pool.query(`
    UPDATE users 
    SET region = $1, 
        queue = $2, 
        last_hash = NULL, 
        last_published_hash = NULL,
        updated_at = NOW()
    WHERE telegram_id = $3
  `, [region, queue, telegramId]);
  
  return result.rowCount > 0;
}

// Оновити channel_id користувача
async function updateUserChannel(telegramId, channelId) {
  const result = await pool.query(`
    UPDATE users 
    SET channel_id = $1, updated_at = NOW()
    WHERE telegram_id = $2
  `, [channelId, telegramId]);
  
  return result.rowCount > 0;
}

// Оновити налаштування сповіщень
async function updateUserAlertSettings(telegramId, settings) {
  const fields = [];
  const values = [];
  
  if (settings.notifyBeforeOff !== undefined) {
    values.push(settings.notifyBeforeOff);
    fields.push(`notify_before_off = $${values.length}`);
  }
  
  if (settings.notifyBeforeOn !== undefined) {
    values.push(settings.notifyBeforeOn);
    fields.push(`notify_before_on = $${values.length}`);
  }
  
  if (settings.alertsOffEnabled !== undefined) {
    values.push(settings.alertsOffEnabled ? true : false);
    fields.push(`alerts_off_enabled = $${values.length}`);
  }
  
  if (settings.alertsOnEnabled !== undefined) {
    values.push(settings.alertsOnEnabled ? true : false);
    fields.push(`alerts_on_enabled = $${values.length}`);
  }
  
  if (fields.length === 0) return false;
  
  fields.push('updated_at = NOW()');
  values.push(telegramId);
  
  const result = await pool.query(`
    UPDATE users 
    SET ${fields.join(', ')}
    WHERE telegram_id = $${values.length}
  `, values);
  
  return result.rowCount > 0;
}

// Оновити last_hash користувача
async function updateUserHash(id, hash) {
  const result = await pool.query(`
    UPDATE users 
    SET last_hash = $1, updated_at = NOW()
    WHERE id = $2
  `, [hash, id]);
  
  return result.rowCount > 0;
}

// Оновити last_published_hash користувача
async function updateUserPublishedHash(id, hash) {
  const result = await pool.query(`
    UPDATE users 
    SET last_published_hash = $1, updated_at = NOW()
    WHERE id = $2
  `, [hash, id]);
  
  return result.rowCount > 0;
}

// Оновити обидва хеші користувача
async function updateUserHashes(id, hash) {
  const result = await pool.query(`
    UPDATE users 
    SET last_hash = $1, last_published_hash = $2, updated_at = NOW()
    WHERE id = $3
  `, [hash, hash, id]);
  
  return result.rowCount > 0;
}

// Оновити last_post_id користувача
async function updateUserPostId(id, postId) {
  const result = await pool.query(`
    UPDATE users 
    SET last_post_id = $1, updated_at = NOW()
    WHERE id = $2
  `, [postId, id]);
  
  return result.rowCount > 0;
}

// Активувати/деактивувати користувача
async function setUserActive(telegramId, isActive) {
  const result = await pool.query(`
    UPDATE users 
    SET is_active = $1, updated_at = NOW()
    WHERE telegram_id = $2
  `, [isActive ? true : false, telegramId]);
  
  return result.rowCount > 0;
}

// Отримати всіх користувачів по регіону
async function getUsersByRegion(region) {
  const result = await pool.query('SELECT * FROM users WHERE region = $1 AND is_active = TRUE', [region]);
  return result.rows;
}

// Отримати всіх активних користувачів
async function getAllActiveUsers() {
  const result = await pool.query('SELECT * FROM users WHERE is_active = TRUE');
  return result.rows;
}

// Отримати всіх користувачів
async function getAllUsers() {
  const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
  return result.rows;
}

// Отримати останніх N користувачів
async function getRecentUsers(limit = 20) {
  const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC LIMIT $1', [limit]);
  return result.rows;
}

// Отримати статистику користувачів
async function getUserStats() {
  const totalResult = await pool.query('SELECT COUNT(*) as count FROM users');
  const total = parseInt(totalResult.rows[0].count);
  
  const activeResult = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_active = TRUE');
  const active = parseInt(activeResult.rows[0].count);
  
  const withChannelsResult = await pool.query('SELECT COUNT(*) as count FROM users WHERE channel_id IS NOT NULL');
  const withChannels = parseInt(withChannelsResult.rows[0].count);
  
  const byRegionResult = await pool.query(`
    SELECT region, COUNT(*) as count 
    FROM users 
    WHERE is_active = TRUE 
    GROUP BY region
  `);
  
  return {
    total,
    active,
    withChannels,
    byRegion: byRegionResult.rows,
  };
}

// Видалити користувача
async function deleteUser(telegramId) {
  // First, get the user's internal ID
  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return false;
  }
  
  const userId = user.id;
  
  // Delete all related records first to avoid FOREIGN KEY constraint failure
  await pool.query('DELETE FROM outage_history WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM power_history WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM schedule_history WHERE user_id = $1', [userId]);
  
  // Finally, delete the user
  const result = await pool.query('DELETE FROM users WHERE telegram_id = $1', [telegramId]);
  return result.rowCount > 0;
}

// Оновити router_ip користувача
async function updateUserRouterIp(telegramId, routerIp) {
  const result = await pool.query(`
    UPDATE users 
    SET router_ip = $1, updated_at = NOW()
    WHERE telegram_id = $2
  `, [routerIp, telegramId]);
  
  return result.rowCount > 0;
}

// Оновити стан живлення користувача
async function updateUserPowerState(telegramId, state, changedAt) {
  const result = await pool.query(`
    UPDATE users 
    SET power_state = $1, power_changed_at = $2, updated_at = NOW()
    WHERE telegram_id = $3
  `, [state, changedAt, telegramId]);
  
  return result.rowCount > 0;
}

// Отримати всіх користувачів з налаштованим router_ip
async function getUsersWithRouterIp() {
  try {
    const result = await pool.query("SELECT * FROM users WHERE router_ip IS NOT NULL AND router_ip != '' AND is_active = TRUE");
    return result.rows;
  } catch (error) {
    console.error('Помилка getUsersWithRouterIp:', error.message);
    return [];
  }
}

// Отримати користувачів з увімкненими алертами (DEPRECATED - no longer used)
// This function is kept for backward compatibility but returns empty array
async function getUsersWithAlertsEnabled() {
  return [];
}

// Оновити channel_id та скинути інформацію про брендування
async function resetUserChannel(telegramId, channelId) {
  const result = await pool.query(`
    UPDATE users 
    SET channel_id = $1,
        channel_title = NULL,
        channel_description = NULL,
        channel_photo_file_id = NULL,
        channel_user_title = NULL,
        channel_user_description = NULL,
        channel_status = 'active',
        updated_at = NOW()
    WHERE telegram_id = $2
  `, [channelId, telegramId]);
  
  return result.rowCount > 0;
}

// Оновити брендування каналу
// Sets channel_branding_updated_at timestamp to track bot-made changes
// Returns: true if update succeeded, false otherwise
async function updateChannelBranding(telegramId, brandingData) {
  const result = await pool.query(`
    UPDATE users 
    SET channel_title = $1,
        channel_description = $2,
        channel_photo_file_id = $3,
        channel_user_title = $4,
        channel_user_description = $5,
        channel_status = 'active',
        channel_branding_updated_at = NOW(),
        updated_at = NOW()
    WHERE telegram_id = $6
  `, [
    brandingData.channelTitle,
    brandingData.channelDescription,
    brandingData.channelPhotoFileId,
    brandingData.userTitle,
    brandingData.userDescription || null,
    telegramId
  ]);
  
  return result.rowCount > 0;
}

// Оновити частково брендування каналу (з можливістю оновити лише окремі поля)
// Sets channel_branding_updated_at timestamp to track bot-made changes
// Returns: true if update succeeded, false if no fields to update or update failed
async function updateChannelBrandingPartial(telegramId, brandingData) {
  const fields = [];
  const values = [];
  
  if (brandingData.channelTitle !== undefined) {
    values.push(brandingData.channelTitle);
    fields.push(`channel_title = $${values.length}`);
  }
  
  if (brandingData.channelDescription !== undefined) {
    values.push(brandingData.channelDescription);
    fields.push(`channel_description = $${values.length}`);
  }
  
  if (brandingData.channelPhotoFileId !== undefined) {
    values.push(brandingData.channelPhotoFileId);
    fields.push(`channel_photo_file_id = $${values.length}`);
  }
  
  if (brandingData.userTitle !== undefined) {
    values.push(brandingData.userTitle);
    fields.push(`channel_user_title = $${values.length}`);
  }
  
  if (brandingData.userDescription !== undefined) {
    values.push(brandingData.userDescription);
    fields.push(`channel_user_description = $${values.length}`);
  }
  
  if (fields.length === 0) {
    console.warn('updateChannelBrandingPartial викликано без полів для оновлення');
    return false;
  }
  
  // Always update the timestamp when branding is changed through bot
  fields.push('channel_branding_updated_at = NOW()');
  fields.push('updated_at = NOW()');
  values.push(telegramId);
  
  const result = await pool.query(`
    UPDATE users 
    SET ${fields.join(', ')}
    WHERE telegram_id = $${values.length}
  `, values);
  
  return result.rowCount > 0;
}

// Оновити статус каналу
async function updateChannelStatus(telegramId, status) {
  const result = await pool.query(`
    UPDATE users 
    SET channel_status = $1, updated_at = NOW()
    WHERE telegram_id = $2
  `, [status, telegramId]);
  
  return result.rowCount > 0;
}

// Отримати всіх активних користувачів з каналами
async function getUsersWithActiveChannels() {
  const result = await pool.query(`
    SELECT * FROM users 
    WHERE channel_id IS NOT NULL 
    AND is_active = TRUE 
    AND channel_status = 'active'
  `);
  return result.rows;
}

// Отримати всіх користувачів з каналами для перевірки
async function getUsersWithChannelsForVerification() {
  const result = await pool.query(`
    SELECT * FROM users 
    WHERE channel_id IS NOT NULL 
    AND channel_title IS NOT NULL
    AND is_active = TRUE
  `);
  return result.rows;
}

// Оновити налаштування формату користувача
async function updateUserFormatSettings(telegramId, settings) {
  const fields = [];
  const values = [];
  
  if (settings.scheduleCaption !== undefined) {
    values.push(settings.scheduleCaption);
    fields.push(`schedule_caption = ${values.length}`);
  }
  
  if (settings.periodFormat !== undefined) {
    values.push(settings.periodFormat);
    fields.push(`period_format = ${values.length}`);
  }
  
  if (settings.powerOffText !== undefined) {
    values.push(settings.powerOffText);
    fields.push(`power_off_text = ${values.length}`);
  }
  
  if (settings.powerOnText !== undefined) {
    values.push(settings.powerOnText);
    fields.push(`power_on_text = ${values.length}`);
  }
  
  if (settings.deleteOldMessage !== undefined) {
    values.push(settings.deleteOldMessage ? true : false);
    fields.push(`delete_old_message = ${values.length}`);
  }
  
  if (settings.pictureOnly !== undefined) {
    values.push(settings.pictureOnly ? true : false);
    fields.push(`picture_only = ${values.length}`);
  }
  
  if (fields.length === 0) return false;
  
  fields.push('updated_at = NOW()');
  values.push(telegramId);
  
  const result = await pool.query(`
    UPDATE users 
    SET ${fields.join(', ')}
    WHERE telegram_id = ${values.length}
  `, values);
  
  return result.rowCount > 0;
}

// Отримати налаштування формату користувача
async function getUserFormatSettings(telegramId) {
  const result = await pool.query(`
    SELECT schedule_caption, period_format, power_off_text, power_on_text, 
           delete_old_message, picture_only, last_schedule_message_id
    FROM users WHERE telegram_id = $1
  `, [telegramId]);
  return result.rows[0];
}

// Оновити ID останнього повідомлення з графіком
async function updateLastScheduleMessageId(telegramId, messageId) {
  const result = await pool.query(`
    UPDATE users 
    SET last_schedule_message_id = $1, updated_at = NOW()
    WHERE telegram_id = $2
  `, [messageId, telegramId]);
  
  return result.rowCount > 0;
}

// Оновити статус паузи каналу користувача
async function updateUserChannelPaused(telegramId, paused) {
  const result = await pool.query(`
    UPDATE users 
    SET channel_paused = $1, updated_at = NOW()
    WHERE telegram_id = $2
  `, [paused ? true : false, telegramId]);
  
  return result.rowCount > 0;
}

// Оновити налаштування куди публікувати сповіщення про світло
async function updateUserPowerNotifyTarget(telegramId, target) {
  // target: 'bot' | 'channel' | 'both'
  const result = await pool.query(`
    UPDATE users 
    SET power_notify_target = $1, updated_at = NOW()
    WHERE telegram_id = $2
  `, [target, telegramId]);
  
  return result.rowCount > 0;
}

// Оновити стан попереджень про графік
async function updateScheduleAlertEnabled(telegramId, enabled) {
  const result = await pool.query(`
    UPDATE users 
    SET schedule_alert_enabled = $1, updated_at = NOW()
    WHERE telegram_id = $2
  `, [enabled ? true : false, telegramId]);
  
  return result.rowCount > 0;
}

// Оновити час попередження про графік (у хвилинах)
async function updateScheduleAlertMinutes(telegramId, minutes) {
  const result = await pool.query(`
    UPDATE users 
    SET schedule_alert_minutes = $1, updated_at = NOW()
    WHERE telegram_id = $2
  `, [minutes, telegramId]);
  
  return result.rowCount > 0;
}

// Оновити куди надсилати попередження про графік
async function updateScheduleAlertTarget(telegramId, target) {
  // target: 'bot', 'channel', 'both'
  const result = await pool.query(`
    UPDATE users 
    SET schedule_alert_target = $1, updated_at = NOW()
    WHERE telegram_id = $2
  `, [target, telegramId]);
  
  return result.rowCount > 0;
}

// Оновити всі налаштування попереджень про графік
async function updateUserScheduleAlertSettings(telegramId, settings) {
  const fields = [];
  const values = [];
  
  if (settings.scheduleAlertEnabled !== undefined) {
    values.push(settings.scheduleAlertEnabled ? 1 : 0);
    fields.push(`schedule_alert_enabled = ${values.length}`);
  }
  
  if (settings.scheduleAlertMinutes !== undefined) {
    values.push(settings.scheduleAlertMinutes);
    fields.push(`schedule_alert_minutes = ${values.length}`);
  }
  
  if (settings.scheduleAlertTarget !== undefined) {
    values.push(settings.scheduleAlertTarget);
    fields.push(`schedule_alert_target = ${values.length}`);
  }
  
  if (fields.length === 0) return false;
  
  fields.push('updated_at = NOW()');
  values.push(telegramId);
  
  const result = await pool.query(`
    UPDATE users 
    SET ${fields.join(', ')}
    WHERE telegram_id = ${values.length}
  `, values);
  
  return result.rowCount > 0;
}

// Оновити ID повідомлень (для авто-видалення попередніх повідомлень)
async function updateUser(telegramId, updates) {
  const fields = [];
  const values = [];
  
  if (updates.last_start_message_id !== undefined) {
    values.push(updates.last_start_message_id);
    fields.push(`last_start_message_id = $${values.length}`);
  }
  
  if (updates.last_settings_message_id !== undefined) {
    values.push(updates.last_settings_message_id);
    fields.push(`last_settings_message_id = $${values.length}`);
  }
  
  if (updates.last_schedule_message_id !== undefined) {
    values.push(updates.last_schedule_message_id);
    fields.push(`last_schedule_message_id = $${values.length}`);
  }
  
  if (updates.last_timer_message_id !== undefined) {
    values.push(updates.last_timer_message_id);
    fields.push(`last_timer_message_id = $${values.length}`);
  }
  
  if (updates.channel_id !== undefined) {
    values.push(updates.channel_id);
    fields.push(`channel_id = $${values.length}`);
  }
  
  if (updates.channel_title !== undefined) {
    values.push(updates.channel_title);
    fields.push(`channel_title = $${values.length}`);
  }
  
  if (fields.length === 0) return false;
  
  fields.push('updated_at = NOW()');
  values.push(telegramId);
  
  const result = await pool.query(`
    UPDATE users 
    SET ${fields.join(', ')}
    WHERE telegram_id = $${values.length}
  `, values);
  
  return result.rowCount > 0;
}

// Update snapshot hashes for today and tomorrow
async function updateSnapshotHashes(telegramId, todayHash, tomorrowHash, tomorrowDate = null) {
  const result = await pool.query(`
    UPDATE users 
    SET today_snapshot_hash = $1, 
        tomorrow_snapshot_hash = $2,
        tomorrow_published_date = $3,
        updated_at = NOW()
    WHERE telegram_id = $4
  `, [todayHash, tomorrowHash, tomorrowDate, telegramId]);
  
  return result.rowCount > 0;
}

// Get snapshot hashes for user
async function getSnapshotHashes(telegramId) {
  const result = await pool.query(`
    SELECT today_snapshot_hash, tomorrow_snapshot_hash, tomorrow_published_date
    FROM users 
    WHERE telegram_id = $1
  `, [telegramId]);
  
  return result.rows[0];
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
