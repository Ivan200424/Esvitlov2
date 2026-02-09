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
 */

// Read limits from environment variables with sensible defaults
const capacityLimits = {
  // ================================================
  // USERS
  // ================================================
  users: {
    // Maximum total users the system can handle
    maxTotal: parseInt(process.env.MAX_TOTAL_USERS || '10000', 10),
    
    // Maximum concurrent active users (users doing something right now)
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_USERS || '500', 10),
    
    // Maximum wizard sessions per minute (rate limit for new setup wizards)
    maxWizardPerMinute: parseInt(process.env.MAX_WIZARD_PER_MINUTE || '30', 10),
    
    // Maximum actions per user per minute (prevents abuse)
    maxActionsPerUserPerMinute: parseInt(process.env.MAX_ACTIONS_PER_USER_PER_MIN || '20', 10),
  },

  // ================================================
  // CHANNELS
  // ================================================
  channels: {
    // Maximum total connected channels
    maxTotal: parseInt(process.env.MAX_TOTAL_CHANNELS || '5000', 10),
    
    // Maximum channels per user
    maxPerUser: parseInt(process.env.MAX_CHANNELS_PER_USER || '3', 10),
    
    // Maximum channel publish operations per minute (system-wide)
    maxPublishPerMinute: parseInt(process.env.MAX_CHANNEL_PUBLISH_PER_MIN || '100', 10),
    
    // Maximum concurrent channel operations
    maxConcurrentOperations: parseInt(process.env.MAX_CONCURRENT_CHANNEL_OPS || '50', 10),
  },

  // ================================================
  // IP MONITORING (Most resource-intensive component)
  // ================================================
  ip: {
    // Maximum total active IPs being monitored
    maxTotal: parseInt(process.env.MAX_TOTAL_IPS || '2000', 10),
    
    // Maximum IPs per user
    maxPerUser: parseInt(process.env.MAX_IPS_PER_USER || '3', 10),
    
    // Minimum ping interval in seconds (prevents too frequent checks)
    minPingIntervalSeconds: parseInt(process.env.MIN_PING_INTERVAL_SEC || '2', 10),
    
    // Maximum concurrent ping operations
    maxConcurrentPings: parseInt(process.env.MAX_CONCURRENT_PINGS || '100', 10),
    
    // Maximum pings per minute (system-wide)
    maxPingsPerMinute: parseInt(process.env.MAX_PINGS_PER_MINUTE || '3000', 10),
  },

  // ================================================
  // SCHEDULERS
  // ================================================
  schedulers: {
    // Maximum active scheduler jobs
    maxJobs: parseInt(process.env.MAX_SCHEDULER_JOBS || '10', 10),
    
    // Minimum interval between job executions (seconds)
    minIntervalSeconds: parseInt(process.env.MIN_SCHEDULER_INTERVAL_SEC || '10', 10),
    
    // Maximum job execution time before warning (seconds)
    maxExecutionTimeSeconds: parseInt(process.env.MAX_JOB_EXECUTION_TIME_SEC || '60', 10),
    
    // Maximum overlapping job executions
    maxOverlaps: parseInt(process.env.MAX_SCHEDULER_OVERLAPS || '2', 10),
  },

  // ================================================
  // MESSAGES (Outgoing throughput)
  // ================================================
  messages: {
    // Maximum outgoing messages per minute (global)
    maxPerMinute: parseInt(process.env.MAX_MESSAGES_PER_MINUTE || '1000', 10),
    
    // Maximum messages per channel per minute
    maxPerChannelPerMinute: parseInt(process.env.MAX_MSG_PER_CHANNEL_PER_MIN || '20', 10),
    
    // Maximum retry attempts for failed messages
    maxRetries: parseInt(process.env.MAX_MESSAGE_RETRIES || '3', 10),
    
    // Message queue size limit
    maxQueueSize: parseInt(process.env.MAX_MESSAGE_QUEUE_SIZE || '5000', 10),
  },

  // ================================================
  // ALERT THRESHOLDS (Percentage of max capacity)
  // ================================================
  alerts: {
    // Warning level - start monitoring closely
    warningThreshold: parseFloat(process.env.ALERT_WARNING_THRESHOLD || '0.8'), // 80%
    
    // Critical level - prepare for action
    criticalThreshold: parseFloat(process.env.ALERT_CRITICAL_THRESHOLD || '0.9'), // 90%
    
    // Emergency level - take immediate action
    emergencyThreshold: parseFloat(process.env.ALERT_EMERGENCY_THRESHOLD || '1.0'), // 100%
  },

  // ================================================
  // EMERGENCY BEHAVIORS
  // ================================================
  emergency: {
    // Enable automatic pause when limits exceeded
    autoPauseEnabled: process.env.EMERGENCY_AUTO_PAUSE !== 'false',
    
    // Reduce scheduler frequency multiplier (e.g., 2 = double interval)
    schedulerSlowdownMultiplier: parseFloat(process.env.EMERGENCY_SCHEDULER_SLOWDOWN || '2.0'),
    
    // Disable non-critical features
    disableNonCritical: process.env.EMERGENCY_DISABLE_NON_CRITICAL !== 'false',
    
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
};
