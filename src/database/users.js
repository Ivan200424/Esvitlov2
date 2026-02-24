const { pool } = require('./db');
const logger = require('../logger').child({ module: 'users' });

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
    logger.error({ err: error }, 'Помилка створення користувача');
    throw error;
  }
}

// Зберегти користувача (створити або оновити через upsert)
async function saveUser(telegramId, username, region, queue) {
  try {
    const result = await pool.query(`
      INSERT INTO users (telegram_id, username, region, queue)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (telegram_id) 
      DO UPDATE SET 
        username = EXCLUDED.username,
        region = EXCLUDED.region,
        queue = EXCLUDED.queue,
        updated_at = NOW()
      RETURNING id
    `, [telegramId, username, region, queue]);

    return result.rows[0].id;
  } catch (error) {
    logger.error({ err: error }, 'Помилка збереження користувача');
    throw error;
  }
}

/**
 * @param {string} telegramId
 * @returns {Promise<import('../types').User|undefined>}
 */
async function getUserByTelegramId(telegramId) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
    return result.rows[0];
  } catch (error) {
    logger.error({ err: error }, 'Error getting user by telegram_id');
    throw error;
  }
}

/**
 * @param {number} id
 * @returns {Promise<import('../types').User|undefined>}
 */
async function getUserById(id) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  } catch (error) {
    logger.error({ err: error }, 'Error getting user by id');
    throw error;
  }
}

/**
 * @param {string} channelId
 * @returns {Promise<import('../types').User|undefined>}
 */
async function getUserByChannelId(channelId) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE channel_id = $1', [channelId]);
    return result.rows[0];
  } catch (error) {
    logger.error({ err: error }, 'Error getting user by channel_id');
    throw error;
  }
}

// Оновити регіон та чергу користувача
async function updateUserRegionQueue(telegramId, region, queue) {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET region = $1, queue = $2, updated_at = NOW()
      WHERE telegram_id = $3
    `, [region, queue, telegramId]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in updateUserRegionQueue');
    return false;
  }
}

// Оновити регіон та чергу користувача і скинути хеші
async function updateUserRegionAndQueue(telegramId, region, queue) {
  try {
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
  } catch (error) {
    logger.error({ err: error }, 'Error in updateUserRegionAndQueue');
    return false;
  }
}

// Оновити channel_id користувача
async function updateUserChannel(telegramId, channelId) {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET channel_id = $1, updated_at = NOW()
      WHERE telegram_id = $2
    `, [channelId, telegramId]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in updateUserChannel');
    return false;
  }
}

// Оновити налаштування сповіщень
async function updateUserAlertSettings(telegramId, settings) {
  try {
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
  } catch (error) {
    logger.error({ err: error }, 'Error in updateUserAlertSettings');
    return false;
  }
}

// Оновити last_hash користувача
async function updateUserHash(id, hash) {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET last_hash = $1, updated_at = NOW()
      WHERE id = $2
    `, [hash, id]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in updateUserHash');
    return false;
  }
}

// Оновити last_published_hash користувача
async function updateUserPublishedHash(id, hash) {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET last_published_hash = $1, updated_at = NOW()
      WHERE id = $2
    `, [hash, id]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in updateUserPublishedHash');
    return false;
  }
}

// Оновити обидва хеші користувача
async function updateUserHashes(id, hash) {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET last_hash = $1, last_published_hash = $2, updated_at = NOW()
      WHERE id = $3
    `, [hash, hash, id]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in updateUserHashes');
    return false;
  }
}

// Оновити last_post_id користувача
async function updateUserPostId(id, postId) {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET last_post_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [postId, id]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in updateUserPostId');
    return false;
  }
}

// Активувати/деактивувати користувача
async function setUserActive(telegramId, isActive) {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET is_active = $1, updated_at = NOW()
      WHERE telegram_id = $2
    `, [isActive ? true : false, telegramId]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in setUserActive');
    return false;
  }
}

// Отримати всіх користувачів по регіону
async function getUsersByRegion(region) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE region = $1 AND is_active = TRUE', [region]);
    return result.rows;
  } catch (error) {
    logger.error({ err: error }, 'Error in getUsersByRegion');
    return [];
  }
}

// Отримати всіх активних користувачів
async function getAllActiveUsers() {
  try {
    const result = await pool.query('SELECT * FROM users WHERE is_active = TRUE');
    return result.rows;
  } catch (error) {
    logger.error({ err: error }, 'Error in getAllActiveUsers');
    return [];
  }
}

// Отримати всіх користувачів
async function getAllUsers() {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows;
  } catch (error) {
    logger.error({ err: error }, 'Error in getAllUsers');
    return [];
  }
}

// Отримати останніх N користувачів
async function getRecentUsers(limit = 20) {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC LIMIT $1', [limit]);
    return result.rows;
  } catch (error) {
    logger.error({ err: error }, 'Error in getRecentUsers');
    return [];
  }
}

// Отримати статистику користувачів
async function getUserStats() {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = TRUE) as active,
        COUNT(*) FILTER (WHERE channel_id IS NOT NULL) as with_channels
      FROM users
    `);

    const byRegionResult = await pool.query(`
      SELECT region, COUNT(*) as count 
      FROM users WHERE is_active = TRUE 
      GROUP BY region
    `);

    return {
      total: parseInt(result.rows[0].total, 10),
      active: parseInt(result.rows[0].active, 10),
      withChannels: parseInt(result.rows[0].with_channels, 10),
      byRegion: byRegionResult.rows,
    };
  } catch (error) {
    logger.error({ err: error }, 'Error in getUserStats');
    return { total: 0, active: 0, withChannels: 0, byRegion: [] };
  }
}

// Видалити користувача
async function deleteUser(telegramId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query('SELECT id FROM users WHERE telegram_id = $1', [telegramId]);
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    const userId = userResult.rows[0].id;

    await client.query('DELETE FROM outage_history WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM power_history WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM schedule_history WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ err: error }, 'Error deleting user');
    return false;
  } finally {
    client.release();
  }
}

// Оновити router_ip користувача
async function updateUserRouterIp(telegramId, routerIp) {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET router_ip = $1, updated_at = NOW()
      WHERE telegram_id = $2
    `, [routerIp, telegramId]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in updateUserRouterIp');
    return false;
  }
}

// Оновити стан живлення користувача
async function updateUserPowerState(telegramId, state) {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET power_state = $1, power_changed_at = NOW(), updated_at = NOW()
      WHERE telegram_id = $2
    `, [state, telegramId]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in updateUserPowerState');
    return false;
  }
}

// Атомарно оновити стан живлення і повернути тривалість попереднього стану
async function changePowerStateAndGetDuration(telegramId, newState) {
  try {
    const result = await pool.query(`
      WITH old_state AS (
        SELECT power_changed_at AS old_changed_at
        FROM users 
        WHERE telegram_id = $2
      )
      UPDATE users 
      SET 
        power_state = $1, 
        power_changed_at = COALESCE(pending_power_change_at, NOW()),
        pending_power_state = NULL,
        pending_power_change_at = NULL,
        updated_at = NOW()
      WHERE telegram_id = $2
      RETURNING 
        power_changed_at,
        EXTRACT(EPOCH FROM (power_changed_at - (SELECT old_changed_at FROM old_state))) / 60 AS duration_minutes
    `, [newState, telegramId]);

    return result.rows[0];
  } catch (error) {
    logger.error({ err: error }, 'Error in changePowerStateAndGetDuration');
    return null;
  }
}

// Зберегти pending стан живлення в БД
async function setPendingPowerChange(telegramId, pendingState) {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET pending_power_state = $1, pending_power_change_at = NOW(), updated_at = NOW()
      WHERE telegram_id = $2
      RETURNING pending_power_change_at
    `, [pendingState, telegramId]);
    return result.rows[0];
  } catch (error) {
    logger.error({ err: error }, 'Error in setPendingPowerChange');
    return null;
  }
}

// Очистити pending стан живлення в БД
async function clearPendingPowerChange(telegramId) {
  try {
    await pool.query(`
      UPDATE users 
      SET pending_power_state = NULL, pending_power_change_at = NULL, updated_at = NOW()
      WHERE telegram_id = $1
    `, [telegramId]);
  } catch (error) {
    logger.error({ err: error }, 'Error in clearPendingPowerChange');
  }
}

// Отримати всіх користувачів з налаштованим router_ip
async function getUsersWithRouterIp() {
  try {
    const result = await pool.query("SELECT * FROM users WHERE router_ip IS NOT NULL AND router_ip != '' AND is_active = TRUE");
    return result.rows;
  } catch (error) {
    logger.error({ err: error }, 'Помилка getUsersWithRouterIp');
    return [];
  }
}

// Оновити channel_id та скинути інформацію про брендування
async function resetUserChannel(telegramId, channelId) {
  try {
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
  } catch (error) {
    logger.error({ err: error }, 'Error in resetUserChannel');
    return false;
  }
}

// Оновити брендування каналу
// Sets channel_branding_updated_at timestamp to track bot-made changes
// Returns: true if update succeeded, false otherwise
async function updateChannelBranding(telegramId, brandingData) {
  try {
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
  } catch (error) {
    logger.error({ err: error }, 'Error in updateChannelBranding');
    return false;
  }
}

// Оновити частково брендування каналу (з можливістю оновити лише окремі поля)
// Sets channel_branding_updated_at timestamp to track bot-made changes
// Returns: true if update succeeded, false if no fields to update or update failed
async function updateChannelBrandingPartial(telegramId, brandingData) {
  try {
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
      logger.warn('updateChannelBrandingPartial викликано без полів для оновлення');
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
  } catch (error) {
    logger.error({ err: error }, 'Error in updateChannelBrandingPartial');
    return false;
  }
}

// Оновити статус каналу
async function updateChannelStatus(telegramId, status) {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET channel_status = $1, updated_at = NOW()
      WHERE telegram_id = $2
    `, [status, telegramId]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in updateChannelStatus');
    return false;
  }
}

// Отримати всіх активних користувачів з каналами
async function getUsersWithActiveChannels() {
  try {
    const result = await pool.query(`
      SELECT * FROM users 
      WHERE channel_id IS NOT NULL 
      AND is_active = TRUE 
      AND channel_status = 'active'
    `);
    return result.rows;
  } catch (error) {
    logger.error({ err: error }, 'Error in getUsersWithActiveChannels');
    return [];
  }
}

// Отримати всіх користувачів з каналами для перевірки
async function getUsersWithChannelsForVerification() {
  try {
    const result = await pool.query(`
      SELECT * FROM users 
      WHERE channel_id IS NOT NULL 
      AND channel_title IS NOT NULL
      AND is_active = TRUE
    `);
    return result.rows;
  } catch (error) {
    logger.error({ err: error }, 'Error in getUsersWithChannelsForVerification');
    return [];
  }
}

// Оновити налаштування формату користувача
async function updateUserFormatSettings(telegramId, settings) {
  try {
    const fields = [];
    const values = [];

    if (settings.scheduleCaption !== undefined) {
      values.push(settings.scheduleCaption);
      fields.push(`schedule_caption = $${values.length}`);
    }

    if (settings.periodFormat !== undefined) {
      values.push(settings.periodFormat);
      fields.push(`period_format = $${values.length}`);
    }

    if (settings.powerOffText !== undefined) {
      values.push(settings.powerOffText);
      fields.push(`power_off_text = $${values.length}`);
    }

    if (settings.powerOnText !== undefined) {
      values.push(settings.powerOnText);
      fields.push(`power_on_text = $${values.length}`);
    }

    if (settings.deleteOldMessage !== undefined) {
      values.push(settings.deleteOldMessage ? true : false);
      fields.push(`delete_old_message = $${values.length}`);
    }

    if (settings.pictureOnly !== undefined) {
      values.push(settings.pictureOnly ? true : false);
      fields.push(`picture_only = $${values.length}`);
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
  } catch (error) {
    logger.error({ err: error }, 'Error in updateUserFormatSettings');
    return false;
  }
}

// Отримати налаштування формату користувача
async function getUserFormatSettings(telegramId) {
  try {
    const result = await pool.query(`
      SELECT schedule_caption, period_format, power_off_text, power_on_text, 
             delete_old_message, picture_only, last_schedule_message_id
      FROM users WHERE telegram_id = $1
    `, [telegramId]);
    return result.rows[0];
  } catch (error) {
    logger.error({ err: error }, 'Error in getUserFormatSettings');
    return null;
  }
}

// Оновити ID останнього повідомлення з графіком
async function updateLastScheduleMessageId(telegramId, messageId) {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET last_schedule_message_id = $1, updated_at = NOW()
      WHERE telegram_id = $2
    `, [messageId, telegramId]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in updateLastScheduleMessageId');
    return false;
  }
}

// Оновити статус паузи каналу користувача
async function updateUserChannelPaused(telegramId, paused) {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET channel_paused = $1, updated_at = NOW()
      WHERE telegram_id = $2
    `, [paused ? true : false, telegramId]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in updateUserChannelPaused');
    return false;
  }
}

// Оновити налаштування куди публікувати сповіщення про світло
async function updateUserPowerNotifyTarget(telegramId, target) {
  try {
    // target: 'bot' | 'channel' | 'both'
    const result = await pool.query(`
      UPDATE users 
      SET power_notify_target = $1, updated_at = NOW()
      WHERE telegram_id = $2
    `, [target, telegramId]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in updateUserPowerNotifyTarget');
    return false;
  }
}

// Оновити стан попереджень про графік
async function updateScheduleAlertEnabled(telegramId, enabled) {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET schedule_alert_enabled = $1, updated_at = NOW()
      WHERE telegram_id = $2
    `, [enabled ? true : false, telegramId]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in updateScheduleAlertEnabled');
    return false;
  }
}

// Оновити час попередження про графік (у хвилинах)
async function updateScheduleAlertMinutes(telegramId, minutes) {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET schedule_alert_minutes = $1, updated_at = NOW()
      WHERE telegram_id = $2
    `, [minutes, telegramId]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in updateScheduleAlertMinutes');
    return false;
  }
}

// Оновити куди надсилати попередження про графік
async function updateScheduleAlertTarget(telegramId, target) {
  try {
    // target: 'bot', 'channel', 'both'
    const result = await pool.query(`
      UPDATE users 
      SET schedule_alert_target = $1, updated_at = NOW()
      WHERE telegram_id = $2
    `, [target, telegramId]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in updateScheduleAlertTarget');
    return false;
  }
}

// Оновити всі налаштування попереджень про графік
async function updateUserScheduleAlertSettings(telegramId, settings) {
  try {
    const fields = [];
    const values = [];

    if (settings.scheduleAlertEnabled !== undefined) {
      values.push(settings.scheduleAlertEnabled ? true : false);
      fields.push(`schedule_alert_enabled = $${values.length}`);
    }

    if (settings.scheduleAlertMinutes !== undefined) {
      values.push(settings.scheduleAlertMinutes);
      fields.push(`schedule_alert_minutes = $${values.length}`);
    }

    if (settings.scheduleAlertTarget !== undefined) {
      values.push(settings.scheduleAlertTarget);
      fields.push(`schedule_alert_target = $${values.length}`);
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
  } catch (error) {
    logger.error({ err: error }, 'Error in updateUserScheduleAlertSettings');
    return false;
  }
}

// Оновити ID повідомлень (для авто-видалення попередніх повідомлень)
async function updateUser(telegramId, updates) {
  try {
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

    if (updates.last_menu_message_id !== undefined) {
      values.push(updates.last_menu_message_id);
      fields.push(`last_menu_message_id = $${values.length}`);
    }

    if (updates.channel_id !== undefined) {
      values.push(updates.channel_id);
      fields.push(`channel_id = $${values.length}`);
    }

    if (updates.channel_title !== undefined) {
      values.push(updates.channel_title);
      fields.push(`channel_title = $${values.length}`);
    }

    if (updates.channel_description !== undefined) {
      values.push(updates.channel_description);
      fields.push(`channel_description = $${values.length}`);
    }

    if (updates.channel_photo_file_id !== undefined) {
      values.push(updates.channel_photo_file_id);
      fields.push(`channel_photo_file_id = $${values.length}`);
    }

    if (updates.channel_user_title !== undefined) {
      values.push(updates.channel_user_title);
      fields.push(`channel_user_title = $${values.length}`);
    }

    if (updates.channel_user_description !== undefined) {
      values.push(updates.channel_user_description);
      fields.push(`channel_user_description = $${values.length}`);
    }

    if (updates.channel_status !== undefined) {
      values.push(updates.channel_status);
      fields.push(`channel_status = $${values.length}`);
    }

    if (updates.channel_paused !== undefined) {
      values.push(updates.channel_paused ? true : false);
      fields.push(`channel_paused = $${values.length}`);
    }

    if (updates.last_published_hash !== undefined) {
      values.push(updates.last_published_hash);
      fields.push(`last_published_hash = $${values.length}`);
    }

    if (updates.last_post_id !== undefined) {
      values.push(updates.last_post_id);
      fields.push(`last_post_id = $${values.length}`);
    }

    if (updates.last_hash !== undefined) {
      values.push(updates.last_hash);
      fields.push(`last_hash = $${values.length}`);
    }

    if (updates.router_ip !== undefined) {
      values.push(updates.router_ip);
      fields.push(`router_ip = $${values.length}`);
    }

    if (updates.notify_before_off !== undefined) {
      values.push(updates.notify_before_off);
      fields.push(`notify_before_off = $${values.length}`);
    }

    if (updates.notify_before_on !== undefined) {
      values.push(updates.notify_before_on);
      fields.push(`notify_before_on = $${values.length}`);
    }

    if (updates.alerts_off_enabled !== undefined) {
      values.push(updates.alerts_off_enabled ? true : false);
      fields.push(`alerts_off_enabled = $${values.length}`);
    }

    if (updates.alerts_on_enabled !== undefined) {
      values.push(updates.alerts_on_enabled ? true : false);
      fields.push(`alerts_on_enabled = $${values.length}`);
    }

    if (updates.is_active !== undefined) {
      values.push(updates.is_active ? true : false);
      fields.push(`is_active = $${values.length}`);
    }

    if (updates.power_notify_target !== undefined) {
      values.push(updates.power_notify_target);
      fields.push(`power_notify_target = $${values.length}`);
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
  } catch (error) {
    logger.error({ err: error }, 'Error in updateUser');
    return false;
  }
}

// Update snapshot hashes for today and tomorrow
async function updateSnapshotHashes(telegramId, todayHash, tomorrowHash, tomorrowDate = null) {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET today_snapshot_hash = $1, 
          tomorrow_snapshot_hash = $2,
          tomorrow_published_date = $3,
          updated_at = NOW()
      WHERE telegram_id = $4
    `, [todayHash, tomorrowHash, tomorrowDate, telegramId]);

    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in updateSnapshotHashes');
    return false;
  }
}

// Get snapshot hashes for user
async function getSnapshotHashes(telegramId) {
  try {
    const result = await pool.query(`
      SELECT today_snapshot_hash, tomorrow_snapshot_hash, tomorrow_published_date
      FROM users 
      WHERE telegram_id = $1
    `, [telegramId]);

    return result.rows[0];
  } catch (error) {
    logger.error({ err: error }, 'Error in getSnapshotHashes');
    return null;
  }
}

// NEW: Get all active users grouped by region+queue (for scheduler optimization)
async function getActiveUsersByRegionQueue() {
  try {
    const result = await pool.query(`
      SELECT * FROM users 
      WHERE is_active = TRUE 
      ORDER BY region, queue
    `);

    // Group by region+queue
    const groups = {};
    for (const user of result.rows) {
      const key = `${user.region}_${user.queue}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(user);
    }
    return groups;
  } catch (error) {
    logger.error({ err: error }, 'Error in getActiveUsersByRegionQueue');
    return {};
  }
}

// NEW: Batch update hashes for multiple users at once
async function batchUpdateHashes(updates) {
  // updates = [{ id, lastHash, lastPublishedHash }, ...]
  if (updates.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const { id, lastHash, lastPublishedHash } of updates) {
      await client.query(`
        UPDATE users SET last_hash = $1, last_published_hash = $2, updated_at = NOW()
        WHERE id = $3
      `, [lastHash, lastPublishedHash, id]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ err: error }, 'Error in batchUpdateHashes');
    throw error;
  } finally {
    client.release();
  }
}

// NEW: Get user count for health check
async function getUserCount() {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_active = TRUE');
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    logger.error({ err: error }, 'Error in getUserCount');
    return 0;
  }
}

/**
 * Отримати користувачів для міграції каналів
 * (канал підключений, але без брендування, ще не повідомлені, активні)
 * @returns {Promise<Array>}
 */
async function getUsersNeedingChannelMigration() {
  try {
    const result = await pool.query(`
      SELECT * FROM users 
      WHERE channel_id IS NOT NULL 
      AND (channel_title IS NULL OR channel_title = '')
      AND channel_status != 'blocked'
      AND (migration_notified IS NULL OR migration_notified = 0)
      AND is_active = true
    `);
    return result.rows;
  } catch (error) {
    logger.error({ err: error }, 'Error in getUsersNeedingChannelMigration');
    return [];
  }
}

/**
 * Позначити користувача як повідомленого про міграцію
 * @param {string} telegramId
 * @returns {Promise<boolean>}
 */
async function markUserMigrationNotified(telegramId) {
  try {
    const result = await pool.query(
      'UPDATE users SET migration_notified = 1 WHERE telegram_id = $1',
      [telegramId]
    );
    return result.rowCount > 0;
  } catch (error) {
    logger.error({ err: error }, 'Error in markUserMigrationNotified');
    return false;
  }
}

module.exports = {
  createUser,
  saveUser,
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
  changePowerStateAndGetDuration,
  setPendingPowerChange,
  clearPendingPowerChange,
  getUsersWithRouterIp,
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
  // New batch operations
  getActiveUsersByRegionQueue,
  batchUpdateHashes,
  getUserCount,
  getUsersNeedingChannelMigration,
  markUserMigrationNotified,
};
