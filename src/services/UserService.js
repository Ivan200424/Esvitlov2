/**
 * User Service
 * 
 * Handles all user-related business logic.
 * This service is Telegram-agnostic and can be used independently.
 * 
 * Responsibilities:
 * - User CRUD operations
 * - User settings management
 * - User preferences
 * - User validation
 */

const usersDb = require('../database/users');
const { REGIONS } = require('../constants/regions');

class UserService {
  /**
   * Get user by Telegram ID
   * @param {string} telegramId - Telegram user ID
   * @returns {object|null} User object or null if not found
   */
  getUserByTelegramId(telegramId) {
    return usersDb.getUserByTelegramId(telegramId);
  }

  /**
   * Get user by channel ID
   * @param {string} channelId - Channel ID
   * @returns {object|null} User object or null if not found
   */
  getUserByChannelId(channelId) {
    return usersDb.getUserByChannelId(channelId);
  }

  /**
   * Check if user exists
   * @param {string} telegramId - Telegram user ID
   * @returns {boolean} True if user exists
   */
  userExists(telegramId) {
    return !!this.getUserByTelegramId(telegramId);
  }

  /**
   * Create or update user
   * @param {object} userData - User data
   * @returns {object} Created/updated user
   */
  saveUser(userData) {
    const { telegramId, username, region, queue } = userData;
    
    // Validate required fields
    if (!telegramId || !region || !queue) {
      throw new Error('Missing required fields: telegramId, region, queue');
    }

    // Validate region
    if (!REGIONS[region]) {
      throw new Error(`Invalid region: ${region}`);
    }

    // Save to database
    usersDb.saveUser(telegramId, username, region, queue);
    
    return this.getUserByTelegramId(telegramId);
  }

  /**
   * Update user settings
   * @param {string} telegramId - Telegram user ID
   * @param {object} settings - Settings to update
   * @returns {object} Updated user
   */
  updateUserSettings(telegramId, settings) {
    const user = this.getUserByTelegramId(telegramId);
    
    if (!user) {
      throw new Error(`User not found: ${telegramId}`);
    }

    // Update allowed settings
    const allowedSettings = [
      'notify_before_off',
      'notify_before_on',
      'alerts_off_enabled',
      'alerts_on_enabled',
      'router_ip'
    ];

    const updates = {};
    for (const key of allowedSettings) {
      if (settings[key] !== undefined) {
        updates[key] = settings[key];
      }
    }

    // Apply updates
    if (Object.keys(updates).length > 0) {
      usersDb.updateUser(telegramId, updates);
    }

    return this.getUserByTelegramId(telegramId);
  }

  /**
   * Deactivate user
   * @param {string} telegramId - Telegram user ID
   */
  deactivateUser(telegramId) {
    usersDb.updateUser(telegramId, { is_active: false });
  }

  /**
   * Activate user
   * @param {string} telegramId - Telegram user ID
   */
  activateUser(telegramId) {
    usersDb.updateUser(telegramId, { is_active: true });
  }

  /**
   * Delete user data
   * @param {string} telegramId - Telegram user ID
   */
  deleteUser(telegramId) {
    usersDb.deleteUser(telegramId);
  }

  /**
   * Get users by region
   * @param {string} region - Region code
   * @returns {Array} Array of users
   */
  getUsersByRegion(region) {
    return usersDb.getUsersByRegion(region);
  }

  /**
   * Get all active users
   * @returns {Array} Array of active users
   */
  getAllActiveUsers() {
    return usersDb.getAllUsers().filter(user => user.is_active);
  }

  /**
   * Get user statistics
   * @returns {object} User statistics
   */
  getUserStats() {
    const allUsers = usersDb.getAllUsers();
    
    return {
      total: allUsers.length,
      active: allUsers.filter(u => u.is_active).length,
      withChannel: allUsers.filter(u => u.channel_id).length,
      withIpMonitoring: allUsers.filter(u => u.router_ip).length,
      byRegion: this._countByRegion(allUsers)
    };
  }

  /**
   * Private helper to count users by region
   * @param {Array} users - Array of users
   * @returns {object} Count by region
   */
  _countByRegion(users) {
    const counts = {};
    for (const user of users) {
      counts[user.region] = (counts[user.region] || 0) + 1;
    }
    return counts;
  }
}

// Export singleton instance
module.exports = new UserService();
