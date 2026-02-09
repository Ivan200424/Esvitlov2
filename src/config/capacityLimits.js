/**
 * Capacity Limits Configuration
 * 
 * Defines safe operating boundaries for the system to prevent degradation and crashes.
 * These limits ensure controlled growth and predictable behavior under load.
 * 
 * Principles:
 * - System must know its limits
 * - Never exceed defined boundaries
 * - Alert when approaching limits
 * - Graceful degradation at capacity
 * 
 * Priority: DB → ENV → Default
 */

/**
 * Get capacity value with priority: DB → ENV → Default
 * @param {string} settingKey - Database setting key
 * @param {string} envKey - Environment variable key
 * @param {number|string} defaultValue - Default value
 * @returns {number} The capacity value
 */
function getCapacityValue(settingKey, envKey, defaultValue) {
  // 1. Try to read from DB first
  try {
    // Only try to read from DB if not in test mode
    if (process.env.NODE_ENV !== 'test') {
      const db = require('../database/db');
      if (db.getSetting) {
        const dbValue = db.getSetting(settingKey);
        if (dbValue !== null && dbValue !== undefined) {
          const parsed = parseFloat(dbValue);
          if (!isNaN(parsed)) return parsed;
        }
      }
    }
  } catch (error) {
    // Database might not be initialized yet, fallback to env
  }
  
  // 2. Try environment variable
  if (process.env[envKey] !== undefined) {
    const parsed = parseFloat(process.env[envKey]);
    if (!isNaN(parsed)) return parsed;
  }
  
  // 3. Use default value
  return typeof defaultValue === 'string' ? parseFloat(defaultValue) : defaultValue;
}

/**
 * Get boolean capacity value with priority: DB → ENV → Default
 */
function getCapacityBoolean(settingKey, envKey, defaultValue) {
  // 1. Try DB
  try {
    if (process.env.NODE_ENV !== 'test') {
      const db = require('../database/db');
      if (db.getSetting) {
        const dbValue = db.getSetting(settingKey);
        if (dbValue !== null && dbValue !== undefined) {
          return dbValue === 'true' || dbValue === '1' || dbValue === 1;
        }
      }
    }
  } catch (error) {
    // Database might not be initialized yet
  }
  
  // 2. Try ENV
  if (process.env[envKey] !== undefined) {
    return process.env[envKey] !== 'false' && process.env[envKey] !== '0';
  }
  
  // 3. Default
  return defaultValue;
}

// Read limits from DB → environment variables → sensible defaults
const capacityLimits = {
  // ================================================
  // USERS
  // ================================================
  users: {
    // Maximum total users the system can handle
    maxTotal: getCapacityValue('capacity_max_total_users', 'MAX_TOTAL_USERS', 10000),
    
    // Maximum concurrent active users (users doing something right now)
    maxConcurrent: getCapacityValue('capacity_max_concurrent_users', 'MAX_CONCURRENT_USERS', 500),
    
    // Maximum wizard sessions per minute (rate limit for new setup wizards)
    maxWizardPerMinute: getCapacityValue('capacity_max_wizard_per_minute', 'MAX_WIZARD_PER_MINUTE', 30),
    
    // Maximum actions per user per minute (prevents abuse)
    maxActionsPerUserPerMinute: getCapacityValue('capacity_max_actions_per_user_per_min', 'MAX_ACTIONS_PER_USER_PER_MIN', 20),
  },

  // ================================================
  // CHANNELS
  // ================================================
  channels: {
    // Maximum total connected channels
    maxTotal: getCapacityValue('capacity_max_total_channels', 'MAX_TOTAL_CHANNELS', 5000),
    
    // Maximum channels per user
    maxPerUser: getCapacityValue('capacity_max_channels_per_user', 'MAX_CHANNELS_PER_USER', 3),
    
    // Maximum channel publish operations per minute (system-wide)
    maxPublishPerMinute: getCapacityValue('capacity_max_channel_publish_per_min', 'MAX_CHANNEL_PUBLISH_PER_MIN', 100),
    
    // Maximum concurrent channel operations
    maxConcurrentOperations: getCapacityValue('capacity_max_concurrent_channel_ops', 'MAX_CONCURRENT_CHANNEL_OPS', 50),
  },

  // ================================================
  // IP MONITORING (Most resource-intensive component)
  // ================================================
  ip: {
    // Maximum total active IPs being monitored
    maxTotal: getCapacityValue('capacity_max_total_ips', 'MAX_TOTAL_IPS', 2000),
    
    // Maximum IPs per user
    maxPerUser: getCapacityValue('capacity_max_ips_per_user', 'MAX_IPS_PER_USER', 3),
    
    // Minimum ping interval in seconds (prevents too frequent checks)
    minPingIntervalSeconds: getCapacityValue('capacity_min_ping_interval_sec', 'MIN_PING_INTERVAL_SEC', 2),
    
    // Maximum concurrent ping operations
    maxConcurrentPings: getCapacityValue('capacity_max_concurrent_pings', 'MAX_CONCURRENT_PINGS', 100),
    
    // Maximum pings per minute (system-wide)
    maxPingsPerMinute: getCapacityValue('capacity_max_pings_per_minute', 'MAX_PINGS_PER_MINUTE', 3000),
  },

  // ================================================
  // SCHEDULERS
  // ================================================
  schedulers: {
    // Maximum active scheduler jobs
    maxJobs: getCapacityValue('capacity_max_scheduler_jobs', 'MAX_SCHEDULER_JOBS', 10),
    
    // Minimum interval between job executions (seconds)
    minIntervalSeconds: getCapacityValue('capacity_min_scheduler_interval_sec', 'MIN_SCHEDULER_INTERVAL_SEC', 10),
    
    // Maximum job execution time before warning (seconds)
    maxExecutionTimeSeconds: getCapacityValue('capacity_max_job_execution_time_sec', 'MAX_JOB_EXECUTION_TIME_SEC', 60),
    
    // Maximum overlapping job executions
    maxOverlaps: getCapacityValue('capacity_max_scheduler_overlaps', 'MAX_SCHEDULER_OVERLAPS', 2),
  },

  // ================================================
  // MESSAGES (Outgoing throughput)
  // ================================================
  messages: {
    // Maximum outgoing messages per minute (global)
    maxPerMinute: getCapacityValue('capacity_max_messages_per_minute', 'MAX_MESSAGES_PER_MINUTE', 1000),
    
    // Maximum messages per channel per minute
    maxPerChannelPerMinute: getCapacityValue('capacity_max_msg_per_channel_per_min', 'MAX_MSG_PER_CHANNEL_PER_MIN', 20),
    
    // Maximum retry attempts for failed messages
    maxRetries: getCapacityValue('capacity_max_message_retries', 'MAX_MESSAGE_RETRIES', 3),
    
    // Message queue size limit
    maxQueueSize: getCapacityValue('capacity_max_message_queue_size', 'MAX_MESSAGE_QUEUE_SIZE', 5000),
  },

  // ================================================
  // ALERT THRESHOLDS (Percentage of max capacity)
  // ================================================
  alerts: {
    // Warning level - start monitoring closely
    warningThreshold: getCapacityValue('capacity_alert_warning_threshold', 'ALERT_WARNING_THRESHOLD', 0.8), // 80%
    
    // Critical level - prepare for action
    criticalThreshold: getCapacityValue('capacity_alert_critical_threshold', 'ALERT_CRITICAL_THRESHOLD', 0.9), // 90%
    
    // Emergency level - take immediate action
    emergencyThreshold: getCapacityValue('capacity_alert_emergency_threshold', 'ALERT_EMERGENCY_THRESHOLD', 1.0), // 100%
  },

  // ================================================
  // EMERGENCY BEHAVIORS
  // ================================================
  emergency: {
    // Enable automatic pause when limits exceeded
    autoPauseEnabled: getCapacityBoolean('capacity_emergency_auto_pause', 'EMERGENCY_AUTO_PAUSE', true),
    
    // Reduce scheduler frequency multiplier (e.g., 2 = double interval)
    schedulerSlowdownMultiplier: getCapacityValue('capacity_emergency_scheduler_slowdown', 'EMERGENCY_SCHEDULER_SLOWDOWN', 2.0),
    
    // Disable non-critical features
    disableNonCritical: getCapacityBoolean('capacity_emergency_disable_non_critical', 'EMERGENCY_DISABLE_NON_CRITICAL', true),
    
    // Non-critical features that can be disabled
    nonCriticalFeatures: [
      'statistics',
      'analytics',
      'growth_metrics',
    ],
  },
};

/**
 * Get limit value for a specific resource
 * @param {string} category - Category (users, channels, ip, etc.)
 * @param {string} limitName - Limit name
 * @returns {number} Limit value
 */
function getLimit(category, limitName) {
  if (!capacityLimits[category]) {
    throw new Error(`Unknown capacity category: ${category}`);
  }
  if (capacityLimits[category][limitName] === undefined) {
    throw new Error(`Unknown limit ${limitName} in category ${category}`);
  }
  return capacityLimits[category][limitName];
}

/**
 * Calculate capacity percentage
 * @param {number} current - Current value
 * @param {number} max - Maximum value
 * @returns {number} Percentage (0-1)
 */
function getCapacityPercentage(current, max) {
  if (max === 0) return 0;
  return current / max;
}

/**
 * Get alert level for current capacity
 * @param {number} percentage - Capacity percentage (0-1)
 * @returns {string|null} Alert level or null if below warning threshold
 */
function getAlertLevel(percentage) {
  if (percentage >= capacityLimits.alerts.emergencyThreshold) {
    return 'emergency';
  }
  if (percentage >= capacityLimits.alerts.criticalThreshold) {
    return 'critical';
  }
  if (percentage >= capacityLimits.alerts.warningThreshold) {
    return 'warning';
  }
  return null;
}

/**
 * Check if capacity is exceeded
 * @param {number} current - Current value
 * @param {number} max - Maximum value
 * @returns {boolean} True if exceeded
 */
function isCapacityExceeded(current, max) {
  return current >= max;
}

/**
 * Check if we should throttle based on capacity
 * @param {number} current - Current value
 * @param {number} max - Maximum value
 * @returns {boolean} True if should throttle
 */
function shouldThrottle(current, max) {
  const percentage = getCapacityPercentage(current, max);
  return percentage >= capacityLimits.alerts.criticalThreshold;
}

/**
 * Validate all capacity limits
 */
function validateLimits() {
  const errors = [];
  
  // Check that all limits are positive numbers
  function validateCategory(category, obj) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object') {
        validateCategory(`${category}.${key}`, value);
      } else if (typeof value === 'number' && value <= 0) {
        errors.push(`${category}.${key} must be positive (got ${value})`);
      }
    }
  }
  
  validateCategory('capacityLimits', capacityLimits);
  
  // Check alert thresholds are in correct order
  const { warningThreshold, criticalThreshold, emergencyThreshold } = capacityLimits.alerts;
  if (warningThreshold >= criticalThreshold) {
    errors.push('Warning threshold must be less than critical threshold');
  }
  if (criticalThreshold >= emergencyThreshold) {
    errors.push('Critical threshold must be less than emergency threshold');
  }
  
  if (errors.length > 0) {
    throw new Error(`Capacity limits validation failed:\n${errors.join('\n')}`);
  }
}

// Validate on load
try {
  validateLimits();
} catch (error) {
  console.error('❌ Capacity limits validation failed:', error.message);
  process.exit(1);
}

module.exports = {
  capacityLimits,
  getLimit,
  getCapacityPercentage,
  getAlertLevel,
  isCapacityExceeded,
  shouldThrottle,
  validateLimits,
  getCapacityValue,
  getCapacityBoolean,
};
