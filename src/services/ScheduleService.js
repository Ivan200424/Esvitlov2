/**
 * Schedule Service - Business Logic for Schedule Management
 * 
 * Separates schedule business logic from handlers
 * Handles parsing, change detection, and publication decisions
 */

const { logger } = require('../core/Logger');
const { eventBus, Events } = require('../core/EventEmitter');
const { fetchScheduleData, fetchScheduleImage } = require('../api');
const { parseScheduleForQueue } = require('../parser');
const { calculateSchedulePeriodsHash, formatTime, formatDurationFromMs } = require('../utils');
const usersDb = require('../database/users');

class ScheduleService {
  constructor() {
    this.log = logger.child({ service: 'ScheduleService' });
    this.DAY_NAMES = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота'];
  }

  /**
   * Get date string in format YYYY-MM-DD
   * @private
   */
  _getDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Split events into today and tomorrow
   * @private
   */
  _splitEventsByDay(events) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);
    
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);
    
    const todayEvents = events.filter(event => {
      const eventStart = new Date(event.start);
      return eventStart >= todayStart && eventStart <= todayEnd;
    });
    
    const tomorrowEvents = events.filter(event => {
      const eventStart = new Date(event.start);
      return eventStart >= tomorrowStart && eventStart <= tomorrowEnd;
    });
    
    return { todayEvents, tomorrowEvents };
  }

  /**
   * Handle day transition (midnight 00:00)
   */
  handleDayTransition(user) {
    const now = new Date();
    const todayDateStr = this._getDateString(now);
    
    if (user.last_published_date_tomorrow && user.last_published_date_today !== todayDateStr) {
      this.log.info('Day transition detected', {
        userId: user.telegram_id,
        oldDate: user.last_published_date_today,
        newDate: todayDateStr
      });

      usersDb.shiftScheduleToToday(user.id);
      
      // Update user object for current check
      user.schedule_hash_today = user.schedule_hash_tomorrow;
      user.last_published_date_today = user.last_published_date_tomorrow;
      user.schedule_hash_tomorrow = null;
      user.last_published_date_tomorrow = null;
      
      return true;
    }
    
    return false;
  }

  /**
   * Determine what changed and what to publish
   */
  determinePublicationScenario(user, todayHash, tomorrowHash, todayDateStr, tomorrowDateStr) {
    const todayIsNew = !user.schedule_hash_today;
    const todayChanged = user.schedule_hash_today && user.schedule_hash_today !== todayHash;
    const todayUnchanged = user.schedule_hash_today === todayHash;
    
    const tomorrowIsNew = !user.schedule_hash_tomorrow && tomorrowHash;
    const tomorrowChanged = user.schedule_hash_tomorrow && user.schedule_hash_tomorrow !== tomorrowHash;
    const tomorrowUnchanged = user.schedule_hash_tomorrow === tomorrowHash;
    
    // CRITICAL: Do not publish if nothing changed
    if (todayUnchanged && (tomorrowUnchanged || !tomorrowHash)) {
      return { shouldPublish: false, reason: 'Графіки не змінилися' };
    }
    
    // Determine scenarios according to requirements
    let scenario = null;
    
    if (todayIsNew && !tomorrowHash) {
      scenario = 'today_first';
    } else if (todayIsNew && tomorrowHash) {
      scenario = 'today_first_with_tomorrow';
    } else if (todayChanged && !tomorrowChanged && !tomorrowIsNew) {
      scenario = 'today_updated';
    } else if (tomorrowIsNew && todayUnchanged) {
      scenario = 'tomorrow_appeared';
    } else if (tomorrowChanged && todayUnchanged) {
      scenario = 'tomorrow_updated';
    } else if (tomorrowIsNew && todayChanged) {
      scenario = 'both_changed';
    } else if (todayChanged && tomorrowChanged) {
      scenario = 'both_changed';
    } else if (todayChanged) {
      scenario = 'today_updated';
    } else if (tomorrowChanged) {
      scenario = 'tomorrow_updated';
    } else if (tomorrowIsNew) {
      scenario = 'tomorrow_appeared';
    }
    
    return {
      shouldPublish: scenario !== null,
      scenario,
      todayIsNew,
      todayChanged,
      todayUnchanged,
      tomorrowIsNew,
      tomorrowChanged,
      tomorrowUnchanged
    };
  }

  /**
   * Format schedule notification message
   */
  formatScheduleNotification(scenario, todayEvents, tomorrowEvents, region, queue, user) {
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowDate = new Date(todayDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    
    const todayDayName = this.DAY_NAMES[todayDate.getDay()];
    const tomorrowDayName = this.DAY_NAMES[tomorrowDate.getDay()];
    
    const todayDateStr = `${String(todayDate.getDate()).padStart(2, '0')}.${String(todayDate.getMonth() + 1).padStart(2, '0')}.${todayDate.getFullYear()}`;
    const tomorrowDateStr = `${String(tomorrowDate.getDate()).padStart(2, '0')}.${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}.${tomorrowDate.getFullYear()}`;
    
    const lines = [];
    
    // Helper to format event list
    const formatEvents = (events) => {
      const eventLines = [];
      let totalMinutes = 0;
      
      events.forEach(event => {
        const start = formatTime(event.start);
        const end = formatTime(event.end);
        const durationMs = new Date(event.end) - new Date(event.start);
        const durationStr = formatDurationFromMs(durationMs);
        totalMinutes += durationMs / 60000;
        eventLines.push(`🪫 ${start} - ${end} (~${durationStr})`);
      });
      
      // Add total duration
      const totalHours = Math.floor(totalMinutes / 60);
      const totalMins = Math.floor(totalMinutes % 60);
      let totalStr = '';
      if (totalHours > 0) {
        totalStr = `${totalHours} год`;
        if (totalMins > 0) totalStr += ` ${totalMins} хв`;
      } else {
        totalStr = `${totalMins} хв`;
      }
      eventLines.push(`\nЗагалом без світла: ~${totalStr}`);
      
      return eventLines.join('\n');
    };
    
    // Format based on scenario
    switch (scenario) {
      case 'today_first':
      case 'today_first_with_tomorrow':
        lines.push(`📊 Графік відключень на сьогодні, ${todayDateStr} (${todayDayName}), для черги ${queue}:`);
        lines.push('');
        if (todayEvents.length > 0) {
          lines.push(formatEvents(todayEvents));
        } else {
          lines.push('✅ Відключень не заплановано');
        }
        
        if (scenario === 'today_first_with_tomorrow' && tomorrowEvents && tomorrowEvents.length > 0) {
          lines.push('');
          lines.push('─────────────────');
          lines.push('');
          lines.push(`💡 Зʼявився графік відключень на завтра, ${tomorrowDateStr} (${tomorrowDayName}), для черги ${queue}:`);
          lines.push('');
          lines.push(formatEvents(tomorrowEvents));
        }
        break;
        
      case 'today_updated':
        lines.push(`💡 Оновлено графік відключень на сьогодні, ${todayDateStr} (${todayDayName}), для черги ${queue}:`);
        lines.push('');
        if (todayEvents.length > 0) {
          lines.push(formatEvents(todayEvents));
        } else {
          lines.push('✅ Відключень не заплановано');
        }
        break;
        
      case 'tomorrow_appeared':
        lines.push(`💡 Зʼявився графік відключень на завтра, ${tomorrowDateStr} (${tomorrowDayName}), для черги ${queue}:`);
        lines.push('');
        if (tomorrowEvents.length > 0) {
          lines.push(formatEvents(tomorrowEvents));
        } else {
          lines.push('✅ Відключень не заплановано');
        }
        lines.push('');
        lines.push('─────────────────');
        lines.push('');
        lines.push('💡 Графік на сьогодні — без змін');
        break;
        
      case 'tomorrow_updated':
        lines.push(`💡 Оновлено графік відключень на завтра, ${tomorrowDateStr} (${tomorrowDayName}), для черги ${queue}:`);
        lines.push('');
        if (tomorrowEvents.length > 0) {
          lines.push(formatEvents(tomorrowEvents));
        } else {
          lines.push('✅ Відключень не заплановано');
        }
        lines.push('');
        lines.push('─────────────────');
        lines.push('');
        lines.push('💡 Графік на сьогодні — без змін');
        break;
        
      case 'both_changed':
        if (tomorrowEvents && tomorrowEvents.length > 0) {
          lines.push(`💡 Оновлено графік відключень на завтра, ${tomorrowDateStr} (${tomorrowDayName}), для черги ${queue}:`);
          lines.push('');
          lines.push(formatEvents(tomorrowEvents));
          lines.push('');
          lines.push('─────────────────');
          lines.push('');
        }
        
        lines.push(`💡 Оновлено графік відключень на сьогодні, ${todayDateStr} (${todayDayName}), для черги ${queue}:`);
        lines.push('');
        if (todayEvents.length > 0) {
          lines.push(formatEvents(todayEvents));
        } else {
          lines.push('✅ Відключень не заплановано');
        }
        break;
        
      default:
        return null;
    }
    
    return lines.join('\n');
  }

  /**
   * Fetch and parse schedule for a user
   * @returns {Object|null} Parsed schedule data or null if no data
   */
  async fetchUserSchedule(user) {
    try {
      const data = await fetchScheduleData(user.region);
      const scheduleData = parseScheduleForQueue(data, user.queue);
      
      if (!scheduleData.hasData) {
        this.log.debug('No schedule data available', {
          userId: user.telegram_id,
          region: user.region,
          queue: user.queue
        });
        return null;
      }
      
      return scheduleData;
    } catch (error) {
      this.log.error('Failed to fetch user schedule', error, {
        userId: user.telegram_id,
        region: user.region,
        queue: user.queue
      });
      return null;
    }
  }

  /**
   * Check schedule for a specific user
   * @returns {Object|null} Publication data or null if nothing to publish
   */
  async checkUserSchedule(user) {
    // Skip blocked channels
    if (user.channel_status === 'blocked') {
      this.log.debug('Skipping blocked channel', {
        userId: user.telegram_id
      });
      return null;
    }
    
    // Handle day transition
    this.handleDayTransition(user);
    
    // Fetch schedule
    const scheduleData = await this.fetchUserSchedule(user);
    if (!scheduleData) {
      return null;
    }
    
    // Split events by day
    const { todayEvents, tomorrowEvents } = this._splitEventsByDay(scheduleData.events);
    
    // Calculate hashes
    const todayHash = calculateSchedulePeriodsHash(todayEvents);
    const tomorrowHash = calculateSchedulePeriodsHash(tomorrowEvents);
    
    // Get current date strings
    const now = new Date();
    const todayDateStr = this._getDateString(now);
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowDateStr = this._getDateString(tomorrowDate);
    
    // Determine what to publish
    const decision = this.determinePublicationScenario(
      user,
      todayHash,
      tomorrowHash,
      todayDateStr,
      tomorrowDateStr
    );
    
    if (!decision.shouldPublish) {
      this.log.debug('No publication needed', {
        userId: user.telegram_id,
        reason: decision.reason
      });
      return null;
    }
    
    this.log.info('Schedule change detected', {
      userId: user.telegram_id,
      scenario: decision.scenario
    });
    
    // Format message
    const message = this.formatScheduleNotification(
      decision.scenario,
      todayEvents,
      tomorrowEvents,
      user.region,
      user.queue,
      user
    );
    
    if (!message) {
      this.log.error('Failed to format message', null, {
        userId: user.telegram_id,
        scenario: decision.scenario
      });
      return null;
    }
    
    // Emit event
    eventBus.emitSync(Events.SCHEDULE_CHANGED, {
      userId: user.telegram_id,
      region: user.region,
      queue: user.queue,
      scenario: decision.scenario
    });
    
    return {
      user,
      message,
      todayHash,
      tomorrowHash,
      todayDateStr,
      tomorrowDateStr,
      scenario: decision.scenario
    };
  }

  /**
   * Update user schedule hashes after publication
   */
  updateScheduleHashes(user, todayHash, tomorrowHash, todayDateStr, tomorrowDateStr) {
    try {
      usersDb.updateUserScheduleHashes(
        user.id,
        todayHash,
        tomorrowHash,
        todayDateStr,
        tomorrowDateStr
      );
      
      this.log.debug('Schedule hashes updated', {
        userId: user.telegram_id
      });
    } catch (error) {
      this.log.error('Failed to update schedule hashes', error, {
        userId: user.telegram_id
      });
    }
  }
}

// Export singleton instance
const scheduleService = new ScheduleService();

module.exports = {
  ScheduleService,
  scheduleService
};
