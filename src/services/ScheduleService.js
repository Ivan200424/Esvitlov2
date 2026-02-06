/**
 * Schedule Service
 * 
 * Handles schedule-related business logic.
 * This service is Telegram-agnostic and focuses on:
 * - Fetching schedule data
 * - Parsing schedules
 * - Detecting schedule changes
 * - Computing next events
 * 
 * Separates data operations from presentation/notification
 */

const { fetchScheduleData } = require('../api');
const { parseScheduleForQueue, findNextEvent } = require('../parser');
const { calculateHash } = require('../utils');
const { getScheduleHistory, addScheduleHistory } = require('../database/scheduleHistory');

class ScheduleService {
  /**
   * Get schedule for a specific queue
   * @param {string} region - Region code
   * @param {string} queue - Queue number
   * @returns {object} Parsed schedule data
   */
  async getScheduleForQueue(region, queue) {
    const data = await fetchScheduleData(region);
    return parseScheduleForQueue(data, queue);
  }

  /**
   * Get next event for a queue
   * @param {string} region - Region code
   * @param {string} queue - Queue number
   * @returns {object|null} Next event or null
   */
  async getNextEvent(region, queue) {
    const scheduleData = await this.getScheduleForQueue(region, queue);
    return findNextEvent(scheduleData);
  }

  /**
   * Calculate schedule hash for change detection
   * @param {object} data - Raw schedule data
   * @param {string} queue - Queue key (e.g., 'GPV1')
   * @param {number} todayTimestamp - Today's timestamp
   * @param {number} tomorrowTimestamp - Tomorrow's timestamp
   * @returns {string} Hash of schedule
   */
  calculateScheduleHash(data, queue, todayTimestamp, tomorrowTimestamp) {
    return calculateHash(data, queue, todayTimestamp, tomorrowTimestamp);
  }

  /**
   * Check if schedule has changed for user
   * @param {object} user - User object
   * @param {object} data - Raw schedule data
   * @returns {object} Change detection result { hasChanged, newHash, oldHash }
   */
  async detectScheduleChange(user, data) {
    const queueKey = `GPV${user.queue}`;
    
    // Get available timestamps
    const availableTimestamps = Object.keys(data?.fact?.data || {})
      .map(Number)
      .sort((a, b) => a - b);
    
    const todayTimestamp = availableTimestamps[0] || null;
    const tomorrowTimestamp = availableTimestamps.length > 1 
      ? availableTimestamps[1] 
      : null;
    
    const newHash = this.calculateScheduleHash(
      data,
      queueKey,
      todayTimestamp,
      tomorrowTimestamp
    );
    
    const hasChanged = newHash !== user.last_hash;
    
    return {
      hasChanged,
      newHash,
      oldHash: user.last_hash,
      todayTimestamp,
      tomorrowTimestamp
    };
  }

  /**
   * Get schedule history for a user
   * @param {number} userId - User ID (database ID, not telegram_id)
   * @param {number} days - Number of days to fetch
   * @returns {Array} Schedule history entries
   */
  getScheduleHistory(userId, days = 7) {
    return getScheduleHistory(userId, days);
  }

  /**
   * Record schedule change in history
   * @param {number} userId - User ID (database ID)
   * @param {string} region - Region code
   * @param {string} queue - Queue number
   * @param {string} hash - Schedule hash
   * @param {object} data - Schedule data to store
   */
  recordScheduleChange(userId, region, queue, hash, data) {
    addScheduleHistory(userId, region, queue, hash, data);
  }

  /**
   * Get all regions that need checking
   * @returns {Array} Array of region codes
   */
  getRegionsToCheck() {
    const { REGION_CODES } = require('../constants/regions');
    return REGION_CODES;
  }

  /**
   * Batch fetch schedules for multiple regions
   * @param {Array} regions - Array of region codes
   * @returns {object} Map of region -> schedule data
   */
  async batchFetchSchedules(regions) {
    const results = {};
    
    for (const region of regions) {
      try {
        results[region] = await fetchScheduleData(region);
      } catch (error) {
        console.error(`Error fetching schedule for ${region}:`, error.message);
        results[region] = null;
      }
    }
    
    return results;
  }
}

// Export singleton instance
module.exports = new ScheduleService();
