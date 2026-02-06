/**
 * Capacity Tracker
 * 
 * Tracks real-time resource usage and compares against defined limits.
 * Provides capacity metrics for monitoring and decision-making.
 */

const { capacityLimits, getCapacityPercentage, getAlertLevel, isCapacityExceeded, shouldThrottle } = require('../config/capacityLimits');
const { createLogger } = require('../utils/logger');

const logger = createLogger('CapacityTracker');

class CapacityTracker {
  constructor() {
    // Current usage counters
    this.usage = {
      users: {
        total: 0,
        concurrent: 0,
        wizardPerMinute: 0,
        actionsPerUser: new Map(), // userId -> count in current minute
      },
      channels: {
        total: 0,
        publishPerMinute: 0,
        concurrentOperations: 0,
      },
      ip: {
        total: 0,
        concurrentPings: 0,
        pingsPerMinute: 0,
      },
      schedulers: {
        activeJobs: 0,
        runningJobs: 0,
        overlaps: 0,
      },
      messages: {
        perMinute: 0,
        perChannelPerMinute: new Map(), // channelId -> count
        queueSize: 0,
        retries: 0,
      },
    };

    // Reset minute counters periodically
    this.minuteResetInterval = null;
    
    // Last alert times to prevent spam
    this.lastAlerts = new Map();
    this.alertCooldownMs = 5 * 60 * 1000; // 5 minutes
    
    // Emergency mode flag
    this.emergencyMode = false;
  }

  /**
   * Start periodic cleanup of minute-based counters
   */
  start() {
    if (this.minuteResetInterval) {
      return;
    }

    // Reset per-minute counters every minute
    this.minuteResetInterval = setInterval(() => {
      this.resetMinuteCounters();
    }, 60 * 1000);

    logger.info('Capacity tracker started');
  }

  /**
   * Stop the capacity tracker
   */
  stop() {
    if (this.minuteResetInterval) {
      clearInterval(this.minuteResetInterval);
      this.minuteResetInterval = null;
    }
    logger.info('Capacity tracker stopped');
  }

  /**
   * Reset all per-minute counters
   */
  resetMinuteCounters() {
    this.usage.users.wizardPerMinute = 0;
    this.usage.users.actionsPerUser.clear();
    this.usage.channels.publishPerMinute = 0;
    this.usage.ip.pingsPerMinute = 0;
    this.usage.messages.perMinute = 0;
    this.usage.messages.perChannelPerMinute.clear();
  }

  /**
   * Update user counts
   * @param {number} total - Total users
   * @param {number} concurrent - Concurrent active users
   */
  updateUserCounts(total, concurrent) {
    this.usage.users.total = total;
    this.usage.users.concurrent = concurrent;
  }

  /**
   * Track wizard start
   */
  trackWizardStart() {
    this.usage.users.wizardPerMinute++;
  }

  /**
   * Track user action
   * @param {string} userId - User ID
   */
  trackUserAction(userId) {
    const current = this.usage.users.actionsPerUser.get(userId) || 0;
    this.usage.users.actionsPerUser.set(userId, current + 1);
  }

  /**
   * Update channel count
   * @param {number} total - Total channels
   */
  updateChannelCount(total) {
    this.usage.channels.total = total;
  }

  /**
   * Track channel publish
   */
  trackChannelPublish(channelId) {
    this.usage.channels.publishPerMinute++;
    const current = this.usage.messages.perChannelPerMinute.get(channelId) || 0;
    this.usage.messages.perChannelPerMinute.set(channelId, current + 1);
  }

  /**
   * Track channel operation start/end
   * @param {boolean} started - True if starting, false if ending
   */
  trackChannelOperation(started) {
    if (started) {
      this.usage.channels.concurrentOperations++;
    } else {
      this.usage.channels.concurrentOperations = Math.max(0, this.usage.channels.concurrentOperations - 1);
    }
  }

  /**
   * Update IP monitoring count
   * @param {number} total - Total IPs being monitored
   */
  updateIPCount(total) {
    this.usage.ip.total = total;
  }

  /**
   * Track IP ping start/end
   * @param {boolean} started - True if starting, false if ending
   */
  trackIPPing(started) {
    if (started) {
      this.usage.ip.concurrentPings++;
      this.usage.ip.pingsPerMinute++;
    } else {
      this.usage.ip.concurrentPings = Math.max(0, this.usage.ip.concurrentPings - 1);
    }
  }

  /**
   * Update scheduler job count
   * @param {number} active - Active jobs
   * @param {number} running - Currently running jobs
   */
  updateSchedulerCounts(active, running) {
    this.usage.schedulers.activeJobs = active;
    this.usage.schedulers.runningJobs = running;
    this.usage.schedulers.overlaps = Math.max(0, running - 1);
  }

  /**
   * Track outgoing message
   * @param {string} channelId - Optional channel ID
   */
  trackMessage(channelId = null) {
    this.usage.messages.perMinute++;
    if (channelId) {
      const current = this.usage.messages.perChannelPerMinute.get(channelId) || 0;
      this.usage.messages.perChannelPerMinute.set(channelId, current + 1);
    }
  }

  /**
   * Update message queue size
   * @param {number} size - Queue size
   */
  updateMessageQueueSize(size) {
    this.usage.messages.queueSize = size;
  }

  /**
   * Track message retry
   */
  trackMessageRetry() {
    this.usage.messages.retries++;
  }

  /**
   * Get capacity status for a specific resource
   * @param {string} category - Category (users, channels, ip, etc.)
   * @param {string} metric - Metric name
   * @returns {Object} Capacity status
   */
  getCapacityStatus(category, metric) {
    const current = this.getCurrentUsage(category, metric);
    const max = this.getMaxLimit(category, metric);
    const percentage = getCapacityPercentage(current, max);
    const alertLevel = getAlertLevel(percentage);
    
    return {
      current,
      max,
      percentage,
      percentageFormatted: `${(percentage * 100).toFixed(1)}%`,
      alertLevel,
      exceeded: isCapacityExceeded(current, max),
      shouldThrottle: shouldThrottle(current, max),
    };
  }

  /**
   * Get current usage for a metric
   * @param {string} category - Category
   * @param {string} metric - Metric name
   * @returns {number} Current usage
   */
  getCurrentUsage(category, metric) {
    if (!this.usage[category]) {
      throw new Error(`Unknown category: ${category}`);
    }
    
    const value = this.usage[category][metric];
    if (value === undefined) {
      throw new Error(`Unknown metric ${metric} in category ${category}`);
    }
    
    // Handle Map types
    if (value instanceof Map) {
      return value.size;
    }
    
    return value;
  }

  /**
   * Get max limit for a metric
   * @param {string} category - Category
   * @param {string} metric - Metric name (maps to capacityLimits key)
   * @returns {number} Max limit
   */
  getMaxLimit(category, metric) {
    // Map usage metric names to capacity limit names
    const metricMap = {
      users: {
        total: 'maxTotal',
        concurrent: 'maxConcurrent',
        wizardPerMinute: 'maxWizardPerMinute',
      },
      channels: {
        total: 'maxTotal',
        publishPerMinute: 'maxPublishPerMinute',
        concurrentOperations: 'maxConcurrentOperations',
      },
      ip: {
        total: 'maxTotal',
        concurrentPings: 'maxConcurrentPings',
        pingsPerMinute: 'maxPingsPerMinute',
      },
      schedulers: {
        activeJobs: 'maxJobs',
        overlaps: 'maxOverlaps',
      },
      messages: {
        perMinute: 'maxPerMinute',
        queueSize: 'maxQueueSize',
      },
    };

    if (!metricMap[category] || !metricMap[category][metric]) {
      throw new Error(`No limit mapping for ${category}.${metric}`);
    }

    const limitKey = metricMap[category][metric];
    return capacityLimits[category][limitKey];
  }

  /**
   * Get all capacity statuses
   * @returns {Object} All capacity statuses
   */
  getAllCapacityStatuses() {
    return {
      users: {
        total: this.getCapacityStatus('users', 'total'),
        concurrent: this.getCapacityStatus('users', 'concurrent'),
        wizardPerMinute: this.getCapacityStatus('users', 'wizardPerMinute'),
      },
      channels: {
        total: this.getCapacityStatus('channels', 'total'),
        publishPerMinute: this.getCapacityStatus('channels', 'publishPerMinute'),
        concurrentOperations: this.getCapacityStatus('channels', 'concurrentOperations'),
      },
      ip: {
        total: this.getCapacityStatus('ip', 'total'),
        concurrentPings: this.getCapacityStatus('ip', 'concurrentPings'),
        pingsPerMinute: this.getCapacityStatus('ip', 'pingsPerMinute'),
      },
      schedulers: {
        activeJobs: this.getCapacityStatus('schedulers', 'activeJobs'),
        overlaps: this.getCapacityStatus('schedulers', 'overlaps'),
      },
      messages: {
        perMinute: this.getCapacityStatus('messages', 'perMinute'),
        queueSize: this.getCapacityStatus('messages', 'queueSize'),
      },
    };
  }

  /**
   * Check if should send alert (respects cooldown)
   * @param {string} alertKey - Alert identifier
   * @returns {boolean} True if should send
   */
  shouldSendAlert(alertKey) {
    const lastTime = this.lastAlerts.get(alertKey);
    if (!lastTime) {
      return true;
    }
    
    const elapsed = Date.now() - lastTime;
    return elapsed >= this.alertCooldownMs;
  }

  /**
   * Mark alert as sent
   * @param {string} alertKey - Alert identifier
   */
  markAlertSent(alertKey) {
    this.lastAlerts.set(alertKey, Date.now());
  }

  /**
   * Check if user can perform action
   * @param {string} userId - User ID
   * @returns {Object} Result with allowed flag and reason
   */
  canUserAct(userId) {
    const actionsThisMinute = this.usage.users.actionsPerUser.get(userId) || 0;
    const maxActions = capacityLimits.users.maxActionsPerUserPerMinute;
    
    if (actionsThisMinute >= maxActions) {
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        message: '⏳ Забагато дій за хвилину. Спробуйте через кілька секунд.',
      };
    }

    return { allowed: true };
  }

  /**
   * Check if can start wizard
   * @returns {Object} Result with allowed flag and reason
   */
  canStartWizard() {
    const status = this.getCapacityStatus('users', 'wizardPerMinute');
    
    if (status.exceeded) {
      return {
        allowed: false,
        reason: 'wizard_capacity_exceeded',
        message: '⏳ Система перевантажена. Спробуйте через хвилину.',
      };
    }

    return { allowed: true };
  }

  /**
   * Check if can publish to channel
   * @param {string} channelId - Channel ID
   * @returns {Object} Result with allowed flag and reason
   */
  canPublishToChannel(channelId) {
    // Check global publish limit
    const globalStatus = this.getCapacityStatus('channels', 'publishPerMinute');
    if (globalStatus.exceeded) {
      return {
        allowed: false,
        reason: 'global_publish_limit',
        message: '⏳ Досягнуто ліміт публікацій. Повідомлення буде відправлено пізніше.',
      };
    }

    // Check per-channel limit
    const channelCount = this.usage.messages.perChannelPerMinute.get(channelId) || 0;
    const maxPerChannel = capacityLimits.messages.maxPerChannelPerMinute;
    
    if (channelCount >= maxPerChannel) {
      return {
        allowed: false,
        reason: 'channel_publish_limit',
        message: '⏳ Досягнуто ліміт публікацій для цього каналу.',
      };
    }

    return { allowed: true };
  }

  /**
   * Enable emergency mode
   */
  enableEmergencyMode() {
    if (!this.emergencyMode) {
      this.emergencyMode = true;
      logger.warn('🚨 EMERGENCY MODE ENABLED - System at capacity limits');
    }
  }

  /**
   * Disable emergency mode
   */
  disableEmergencyMode() {
    if (this.emergencyMode) {
      this.emergencyMode = false;
      logger.info('✅ Emergency mode disabled - Capacity restored');
    }
  }

  /**
   * Check if in emergency mode
   * @returns {boolean} True if in emergency mode
   */
  isEmergencyMode() {
    return this.emergencyMode;
  }

  /**
   * Get usage summary for logging
   * @returns {Object} Usage summary
   */
  getUsageSummary() {
    return {
      users: {
        total: this.usage.users.total,
        concurrent: this.usage.users.concurrent,
        wizardPerMinute: this.usage.users.wizardPerMinute,
      },
      channels: {
        total: this.usage.channels.total,
        publishPerMinute: this.usage.channels.publishPerMinute,
        concurrentOps: this.usage.channels.concurrentOperations,
      },
      ip: {
        total: this.usage.ip.total,
        concurrentPings: this.usage.ip.concurrentPings,
        pingsPerMinute: this.usage.ip.pingsPerMinute,
      },
      schedulers: {
        activeJobs: this.usage.schedulers.activeJobs,
        runningJobs: this.usage.schedulers.runningJobs,
      },
      messages: {
        perMinute: this.usage.messages.perMinute,
        queueSize: this.usage.messages.queueSize,
      },
      emergencyMode: this.emergencyMode,
    };
  }
}

// Singleton instance
const capacityTracker = new CapacityTracker();

module.exports = capacityTracker;
