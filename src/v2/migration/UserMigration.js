/**
 * User Data Migration Layer
 * 
 * NEW implementation for v2 bot rewrite.
 * 
 * CRITICAL: This ensures backward compatibility.
 * Existing users MUST NOT lose their data:
 * - region
 * - queue
 * - channel_id
 * - router_ip
 * - notification settings
 * - IP monitoring settings
 */

const usersDb = require('../../database/users');

/**
 * Check if user exists in database
 * @param {string} userId - Telegram user ID
 * @returns {Object|null} - User data or null
 */
function getUserData(userId) {
  return usersDb.getUserByTelegramId(userId);
}

/**
 * Check if user is fully configured
 * @param {Object} user - User object from database
 * @returns {boolean} - true if user has region and queue
 */
function isUserConfigured(user) {
  return !!(user && user.region && user.queue);
}

/**
 * Get user configuration summary
 * @param {Object} user - User object from database
 * @returns {Object} - Configuration summary
 */
function getUserConfigSummary(user) {
  if (!user) {
    return {
      exists: false,
      configured: false
    };
  }

  return {
    exists: true,
    configured: isUserConfigured(user),
    region: user.region,
    queue: user.queue,
    hasChannel: !!user.channel_id,
    channelId: user.channel_id,
    channelTitle: user.channel_title,
    hasRouterIp: !!user.router_ip,
    routerIp: user.router_ip,
    isActive: user.is_active,
    notificationSettings: {
      notifyBeforeOff: user.notify_before_off,
      notifyBeforeOn: user.notify_before_on,
      alertsOffEnabled: user.alerts_off_enabled,
      alertsOnEnabled: user.alerts_on_enabled,
      powerNotifyTarget: user.power_notify_target || 'bot'
    },
    formatSettings: {
      scheduleCaption: user.schedule_caption,
      periodFormat: user.period_format,
      powerOffText: user.power_off_text,
      powerOnText: user.power_on_text,
      deleteOldMessage: user.delete_old_message,
      pictureOnly: user.picture_only
    },
    powerState: {
      currentState: user.power_state,
      lastState: user.last_power_state,
      changedAt: user.power_changed_at
    }
  };
}

/**
 * Create new user in database
 * @param {string} userId - Telegram user ID
 * @param {string} username - Telegram username
 * @param {string} region - Region code
 * @param {string} queue - Queue number
 * @returns {number} - New user ID
 */
function createUser(userId, username, region, queue) {
  return usersDb.createUser(userId, username, region, queue);
}

/**
 * Update user region and queue
 * @param {string} userId - Telegram user ID
 * @param {string} region - Region code
 * @param {string} queue - Queue number
 * @returns {boolean} - true if updated
 */
function updateUserRegionQueue(userId, region, queue) {
  return usersDb.updateUserRegionAndQueue(userId, region, queue);
}

/**
 * Activate/deactivate user
 * @param {string} userId - Telegram user ID
 * @param {boolean} isActive - Active status
 * @returns {boolean} - true if updated
 */
function setUserActive(userId, isActive) {
  return usersDb.setUserActive(userId, isActive);
}

/**
 * Get all fields that must be preserved during migration
 * @param {Object} user - User object from database
 * @returns {Object} - Preserved fields
 */
function getPreservedFields(user) {
  if (!user) {
    return null;
  }

  return {
    // Core identification
    telegramId: user.telegram_id,
    username: user.username,
    
    // Location settings (IMMUTABLE)
    region: user.region,
    queue: user.queue,
    
    // Channel settings (IMMUTABLE)
    channelId: user.channel_id,
    channelTitle: user.channel_title,
    channelDescription: user.channel_description,
    channelPhotoFileId: user.channel_photo_file_id,
    channelUserTitle: user.channel_user_title,
    channelUserDescription: user.channel_user_description,
    channelStatus: user.channel_status,
    channelPaused: user.channel_paused,
    
    // IP monitoring settings (IMMUTABLE)
    routerIp: user.router_ip,
    
    // Notification settings (IMMUTABLE)
    notifyBeforeOff: user.notify_before_off,
    notifyBeforeOn: user.notify_before_on,
    alertsOffEnabled: user.alerts_off_enabled,
    alertsOnEnabled: user.alerts_on_enabled,
    powerNotifyTarget: user.power_notify_target,
    
    // Schedule alert settings (IMMUTABLE)
    scheduleAlertEnabled: user.schedule_alert_enabled,
    scheduleAlertMinutes: user.schedule_alert_minutes,
    scheduleAlertTarget: user.schedule_alert_target,
    
    // Format settings (IMMUTABLE)
    scheduleCaption: user.schedule_caption,
    periodFormat: user.period_format,
    powerOffText: user.power_off_text,
    powerOnText: user.power_on_text,
    deleteOldMessage: user.delete_old_message,
    pictureOnly: user.picture_only,
    
    // State tracking (IMMUTABLE)
    powerState: user.power_state,
    lastPowerState: user.last_power_state,
    powerChangedAt: user.power_changed_at,
    lastHash: user.last_hash,
    lastPublishedHash: user.last_published_hash,
    todaySnapshotHash: user.today_snapshot_hash,
    tomorrowSnapshotHash: user.tomorrow_snapshot_hash,
    tomorrowPublishedDate: user.tomorrow_published_date,
    
    // Status
    isActive: user.is_active,
    
    // Timestamps
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

/**
 * Verify that no critical data was lost
 * @param {Object} before - User data before migration
 * @param {Object} after - User data after migration
 * @returns {Object} - Verification result
 */
function verifyMigration(before, after) {
  const errors = [];
  const warnings = [];

  if (!after) {
    errors.push('User data not found after migration');
    return { success: false, errors, warnings };
  }

  // Check critical fields
  const criticalFields = [
    'region', 'queue', 'channel_id', 'router_ip',
    'power_notify_target', 'is_active'
  ];

  for (const field of criticalFields) {
    if (before[field] && before[field] !== after[field]) {
      errors.push(`Field ${field} changed: ${before[field]} → ${after[field]}`);
    }
  }

  // Check notification settings
  if (before.notify_before_off !== after.notify_before_off) {
    warnings.push(`notify_before_off changed: ${before.notify_before_off} → ${after.notify_before_off}`);
  }

  return {
    success: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  getUserData,
  isUserConfigured,
  getUserConfigSummary,
  createUser,
  updateUserRegionQueue,
  setUserActive,
  getPreservedFields,
  verifyMigration
};
