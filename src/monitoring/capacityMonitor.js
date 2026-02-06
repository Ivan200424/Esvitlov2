/**
 * Capacity Monitor
 * 
 * Monitors capacity usage and triggers alerts when limits are approached or exceeded.
 * Integrates with existing alert system and implements emergency responses.
 */

const capacityTracker = require('./capacityTracker');
const metricsCollector = require('./metricsCollector');
const { alertManager, ALERT_LEVELS, ALERT_TYPES } = require('./alertManager');
const { capacityLimits } = require('../config/capacityLimits');
const { createLogger } = require('../utils/logger');
const { getSetting, setSetting } = require('../database/db');

const logger = createLogger('CapacityMonitor');

class CapacityMonitor {
  constructor() {
    this.monitoringInterval = null;
    this.checkIntervalMs = 60 * 1000; // Check every minute
    this.isInitialized = false;
    
    // Emergency actions reference
    this.emergencyActions = {
      pauseScheduler: null,
      slowdownScheduler: null,
    };
  }

  /**
   * Initialize capacity monitor
   * @param {Object} options - Configuration options
   */
  init(options = {}) {
    if (this.isInitialized) {
      logger.warn('Capacity monitor already initialized');
      return;
    }

    this.checkIntervalMs = options.checkIntervalMs || this.checkIntervalMs;
    this.emergencyActions = options.emergencyActions || this.emergencyActions;

    this.isInitialized = true;
    logger.info('Capacity monitor initialized', { 
      checkIntervalMs: this.checkIntervalMs 
    });
  }

  /**
   * Start capacity monitoring
   */
  start() {
    if (!this.isInitialized) {
      throw new Error('Capacity monitor not initialized');
    }

    if (this.monitoringInterval) {
      logger.warn('Capacity monitor already running');
      return;
    }

    // Start capacity tracker
    capacityTracker.start();

    // Run initial check
    this.checkCapacity();

    // Schedule periodic checks
    this.monitoringInterval = setInterval(() => {
      this.checkCapacity();
    }, this.checkIntervalMs);

    logger.info('Capacity monitor started');
  }

  /**
   * Stop capacity monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    capacityTracker.stop();
    logger.info('Capacity monitor stopped');
  }

  /**
   * Check all capacity metrics
   */
  checkCapacity() {
    try {
      // Update current usage from database
      this.updateCurrentUsage();

      // Get all capacity statuses
      const statuses = capacityTracker.getAllCapacityStatuses();

      // Check each category
      this.checkUserCapacity(statuses.users);
      this.checkChannelCapacity(statuses.channels);
      this.checkIPCapacity(statuses.ip);
      this.checkSchedulerCapacity(statuses.schedulers);
      this.checkMessageCapacity(statuses.messages);

      // Check if we need to enter or exit emergency mode
      this.checkEmergencyMode(statuses);

      // Log capacity summary periodically (every 5 minutes)
      if (Date.now() % (5 * 60 * 1000) < this.checkIntervalMs) {
        this.logCapacitySummary(statuses);
      }

    } catch (error) {
      logger.error('Error checking capacity', { error: error.message });
      metricsCollector.trackError(error, { context: 'capacity_check' });
    }
  }

  /**
   * Update current usage from database and system state
   */
  updateCurrentUsage() {
    try {
      const usersDb = require('../database/users');
      
      // Update user counts
      const allUsers = usersDb.getAllUsers();
      capacityTracker.updateUserCounts(allUsers.length, 0); // TODO: Track concurrent users
      
      // Update channel count
      const usersWithChannels = allUsers.filter(u => u.channel_id).length;
      capacityTracker.updateChannelCount(usersWithChannels);
      
      // Update IP count
      const usersWithIPs = allUsers.filter(u => u.router_ip).length;
      capacityTracker.updateIPCount(usersWithIPs);
      
    } catch (error) {
      logger.error('Error updating current usage', { error: error.message });
    }
  }

  /**
   * Check user capacity
   * @param {Object} statuses - User capacity statuses
   */
  checkUserCapacity(statuses) {
    // Check total users
    this.checkMetricCapacity(
      'users_total',
      'Користувачі (всього)',
      statuses.total,
      ALERT_TYPES.BUSINESS
    );

    // Check concurrent users
    this.checkMetricCapacity(
      'users_concurrent',
      'Користувачі (одночасно)',
      statuses.concurrent,
      ALERT_TYPES.BUSINESS
    );

    // Check wizard rate
    this.checkMetricCapacity(
      'users_wizard_rate',
      'Wizard запуски/хв',
      statuses.wizardPerMinute,
      ALERT_TYPES.APPLICATION
    );
  }

  /**
   * Check channel capacity
   * @param {Object} statuses - Channel capacity statuses
   */
  checkChannelCapacity(statuses) {
    // Check total channels
    this.checkMetricCapacity(
      'channels_total',
      'Канали (всього)',
      statuses.total,
      ALERT_TYPES.BUSINESS
    );

    // Check publish rate
    this.checkMetricCapacity(
      'channels_publish_rate',
      'Публікації в канали/хв',
      statuses.publishPerMinute,
      ALERT_TYPES.CHANNEL
    );

    // Check concurrent operations
    this.checkMetricCapacity(
      'channels_concurrent_ops',
      'Одночасні операції каналів',
      statuses.concurrentOperations,
      ALERT_TYPES.CHANNEL
    );
  }

  /**
   * Check IP monitoring capacity
   * @param {Object} statuses - IP capacity statuses
   */
  checkIPCapacity(statuses) {
    // Check total IPs
    this.checkMetricCapacity(
      'ip_total',
      'IP адреси (моніторинг)',
      statuses.total,
      ALERT_TYPES.IP
    );

    // Check concurrent pings
    this.checkMetricCapacity(
      'ip_concurrent_pings',
      'Одночасні пінги',
      statuses.concurrentPings,
      ALERT_TYPES.IP
    );

    // Check ping rate
    this.checkMetricCapacity(
      'ip_ping_rate',
      'Пінги/хв',
      statuses.pingsPerMinute,
      ALERT_TYPES.IP
    );
  }

  /**
   * Check scheduler capacity
   * @param {Object} statuses - Scheduler capacity statuses
   */
  checkSchedulerCapacity(statuses) {
    // Check active jobs
    this.checkMetricCapacity(
      'scheduler_jobs',
      'Scheduler jobs',
      statuses.activeJobs,
      ALERT_TYPES.APPLICATION
    );

    // Check overlaps
    this.checkMetricCapacity(
      'scheduler_overlaps',
      'Scheduler перекриття',
      statuses.overlaps,
      ALERT_TYPES.APPLICATION
    );
  }

  /**
   * Check message capacity
   * @param {Object} statuses - Message capacity statuses
   */
  checkMessageCapacity(statuses) {
    // Check message rate
    this.checkMetricCapacity(
      'messages_rate',
      'Повідомлення/хв',
      statuses.perMinute,
      ALERT_TYPES.APPLICATION
    );

    // Check queue size
    this.checkMetricCapacity(
      'messages_queue',
      'Черга повідомлень',
      statuses.queueSize,
      ALERT_TYPES.APPLICATION
    );
  }

  /**
   * Check a single metric capacity and generate alerts if needed
   * @param {string} metricKey - Unique metric identifier
   * @param {string} metricName - Human-readable metric name
   * @param {Object} status - Capacity status
   * @param {string} alertType - Alert type
   */
  checkMetricCapacity(metricKey, metricName, status, alertType) {
    if (!status.alertLevel) {
      return; // Below warning threshold
    }

    const alertKey = `capacity_${metricKey}_${status.alertLevel}`;
    
    // Check if we should send alert (respects cooldown)
    if (!capacityTracker.shouldSendAlert(alertKey)) {
      return;
    }

    // Map alert level to ALERT_LEVELS
    const alertLevelMap = {
      'warning': ALERT_LEVELS.WARN,
      'critical': ALERT_LEVELS.CRITICAL,
      'emergency': ALERT_LEVELS.CRITICAL,
    };

    const alertLevel = alertLevelMap[status.alertLevel] || ALERT_LEVELS.WARN;

    // Generate alert message
    let title = `⚠️ Наближення до ліміту: ${metricName}`;
    let message = `Використано ${status.percentageFormatted} (${status.current}/${status.max})`;
    let recommendation = '';

    if (status.alertLevel === 'warning') {
      title = `⚠️ Попередження: ${metricName}`;
      recommendation = 'Рекомендується моніторити ситуацію';
    } else if (status.alertLevel === 'critical') {
      title = `🔴 Критично: ${metricName}`;
      recommendation = 'Необхідно вжити заходів для зниження навантаження';
    } else if (status.alertLevel === 'emergency') {
      title = `🚨 АВАРІЯ: ${metricName}`;
      message = `ЛІМІТ ПЕРЕВИЩЕНО: ${status.percentageFormatted} (${status.current}/${status.max})`;
      recommendation = 'Система в аварійному режимі. Термінові дії потрібні!';
    }

    // Generate alert
    alertManager.generateAlert(
      alertType,
      alertLevel,
      title,
      message,
      {
        metric: metricKey,
        current: status.current,
        max: status.max,
        percentage: status.percentage,
        exceeded: status.exceeded,
      },
      recommendation
    );

    // Mark alert as sent
    capacityTracker.markAlertSent(alertKey);

    logger.warn('Capacity alert generated', {
      metric: metricKey,
      level: status.alertLevel,
      current: status.current,
      max: status.max,
    });
  }

  /**
   * Check if emergency mode should be enabled/disabled
   * @param {Object} statuses - All capacity statuses
   */
  checkEmergencyMode(statuses) {
    // Check if any critical metric is at emergency level
    let shouldEnableEmergency = false;

    for (const [category, metrics] of Object.entries(statuses)) {
      for (const [metric, status] of Object.entries(metrics)) {
        if (status.alertLevel === 'emergency') {
          shouldEnableEmergency = true;
          logger.warn('Emergency threshold exceeded', {
            category,
            metric,
            current: status.current,
            max: status.max,
          });
        }
      }
    }

    // Enable/disable emergency mode
    if (shouldEnableEmergency && !capacityTracker.isEmergencyMode()) {
      this.enableEmergencyMode();
    } else if (!shouldEnableEmergency && capacityTracker.isEmergencyMode()) {
      this.disableEmergencyMode();
    }
  }

  /**
   * Enable emergency mode and take protective actions
   */
  enableEmergencyMode() {
    capacityTracker.enableEmergencyMode();

    // Track state transition
    metricsCollector.trackStateTransition('emergency_mode_enabled', {
      timestamp: new Date().toISOString(),
      usage: capacityTracker.getUsageSummary(),
    });

    // Generate emergency alert
    alertManager.generateAlert(
      ALERT_TYPES.SYSTEM,
      ALERT_LEVELS.CRITICAL,
      '🚨 АВАРІЙНИЙ РЕЖИМ УВІМКНЕНО',
      'Система досягла критичних лімітів навантаження',
      {
        usage: capacityTracker.getUsageSummary(),
      },
      'Система автоматично знижує навантаження. Моніторте ситуацію.'
    );

    // Take emergency actions if configured
    if (capacityLimits.emergency.autoPauseEnabled) {
      this.pauseNonCriticalOperations();
    }

    if (capacityLimits.emergency.disableNonCritical) {
      this.disableNonCriticalFeatures();
    }
  }

  /**
   * Disable emergency mode and restore normal operations
   */
  disableEmergencyMode() {
    capacityTracker.disableEmergencyMode();

    // Track state transition
    metricsCollector.trackStateTransition('emergency_mode_disabled', {
      timestamp: new Date().toISOString(),
      usage: capacityTracker.getUsageSummary(),
    });

    // Generate recovery alert
    alertManager.generateAlert(
      ALERT_TYPES.SYSTEM,
      ALERT_LEVELS.INFO,
      '✅ Аварійний режим вимкнено',
      'Навантаження повернулось до нормального рівня',
      {
        usage: capacityTracker.getUsageSummary(),
      },
      'Система відновила нормальну роботу'
    );

    // Restore operations
    this.restoreNormalOperations();
  }

  /**
   * Pause non-critical operations
   */
  pauseNonCriticalOperations() {
    logger.warn('🚨 Pausing non-critical operations due to capacity limits');
    
    // This could be expanded to pause specific features
    // For now, just log the action
    metricsCollector.trackStateTransition('pause_non_critical', {
      timestamp: new Date().toISOString(),
      reason: 'capacity_limit',
    });
  }

  /**
   * Disable non-critical features
   */
  disableNonCriticalFeatures() {
    logger.warn('🚨 Disabling non-critical features due to capacity limits');
    
    for (const feature of capacityLimits.emergency.nonCriticalFeatures) {
      logger.info('Disabling feature', { feature });
      // Set feature flags in database or config
      // This is a placeholder - actual implementation depends on feature architecture
    }
  }

  /**
   * Restore normal operations
   */
  restoreNormalOperations() {
    logger.info('✅ Restoring normal operations');
    
    metricsCollector.trackStateTransition('restore_normal', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log capacity summary
   * @param {Object} statuses - All capacity statuses
   */
  logCapacitySummary(statuses) {
    const summary = {
      users: {
        total: `${statuses.users.total.current}/${statuses.users.total.max}`,
        concurrent: `${statuses.users.concurrent.current}/${statuses.users.concurrent.max}`,
      },
      channels: {
        total: `${statuses.channels.total.current}/${statuses.channels.total.max}`,
        publishRate: `${statuses.channels.publishPerMinute.current}/${statuses.channels.publishPerMinute.max}/min`,
      },
      ip: {
        total: `${statuses.ip.total.current}/${statuses.ip.total.max}`,
        pingRate: `${statuses.ip.pingsPerMinute.current}/${statuses.ip.pingsPerMinute.max}/min`,
      },
      messages: {
        rate: `${statuses.messages.perMinute.current}/${statuses.messages.perMinute.max}/min`,
        queue: `${statuses.messages.queueSize.current}/${statuses.messages.queueSize.max}`,
      },
      emergencyMode: capacityTracker.isEmergencyMode(),
    };

    logger.info('📊 Capacity Summary', summary);
  }

  /**
   * Get current capacity report
   * @returns {Object} Capacity report
   */
  getCapacityReport() {
    const statuses = capacityTracker.getAllCapacityStatuses();
    
    return {
      timestamp: new Date().toISOString(),
      emergencyMode: capacityTracker.isEmergencyMode(),
      statuses,
      limits: capacityLimits,
      usage: capacityTracker.getUsageSummary(),
    };
  }
}

// Singleton instance
const capacityMonitor = new CapacityMonitor();

module.exports = capacityMonitor;
