/**
 * Growth Metrics Tracking Module
 * Tracks and manages user growth metrics according to the Growth Roadmap
 */

const { getSetting, setSetting } = require('./database/db');
const usersDb = require('./database/users');

// Growth stages definition
const GROWTH_STAGES = {
  STAGE_0: { id: 0, name: 'Закрите Тестування', maxUsers: 50 },
  STAGE_1: { id: 1, name: 'Відкритий Тест', maxUsers: 300 },
  STAGE_2: { id: 2, name: 'Контрольований Ріст', maxUsers: 1000 },
  STAGE_3: { id: 3, name: 'Активний Ріст', maxUsers: 5000 },
  STAGE_4: { id: 4, name: 'Масштаб', maxUsers: Infinity }
};

/**
 * Get current growth stage
 * @returns {Object} Current stage info
 */
function getCurrentStage() {
  const stageId = parseInt(getSetting('growth_stage', '0'), 10);
  return Object.values(GROWTH_STAGES).find(s => s.id === stageId) || GROWTH_STAGES.STAGE_0;
}

/**
 * Set growth stage
 * @param {number} stageId - Stage ID (0-4)
 * @returns {boolean} Success
 */
function setGrowthStage(stageId) {
  const stage = Object.values(GROWTH_STAGES).find(s => s.id === stageId);
  if (!stage) return false;
  
  setSetting('growth_stage', String(stageId));
  logGrowthEvent('stage_change', {
    previous_stage: getCurrentStage().id,
    new_stage: stageId,
    stage_name: stage.name,
    timestamp: new Date().toISOString()
  });
  
  return true;
}

/**
 * Check if registration is enabled
 * @returns {boolean} Registration enabled
 */
function isRegistrationEnabled() {
  return getSetting('registration_enabled', '1') === '1';
}

/**
 * Set registration enabled/disabled
 * @param {boolean} enabled
 */
function setRegistrationEnabled(enabled) {
  setSetting('registration_enabled', enabled ? '1' : '0');
  logGrowthEvent('registration_toggle', {
    enabled,
    timestamp: new Date().toISOString()
  });
}

/**
 * Check if current stage user limit is reached
 * @returns {Object} { reached: boolean, current: number, max: number, remaining: number }
 */
function checkUserLimit() {
  const stage = getCurrentStage();
  const stats = usersDb.getUserStats();
  const current = stats.total;
  const max = stage.maxUsers;
  const remaining = max - current;
  
  return {
    reached: current >= max,
    current,
    max,
    remaining: remaining > 0 ? remaining : 0,
    percentage: max !== Infinity ? Math.round((current / max) * 100) : 0
  };
}

/**
 * Check if user limit warning threshold is reached (80%)
 * @returns {boolean}
 */
function shouldWarnUserLimit() {
  const limit = checkUserLimit();
  return limit.percentage >= 80 && !limit.reached;
}

/**
 * Get growth metrics for current stage
 * @returns {Object} Growth metrics
 */
function getGrowthMetrics() {
  const stage = getCurrentStage();
  const stats = usersDb.getUserStats();
  const limit = checkUserLimit();
  
  // Calculate wizard completion rate
  const wizardCompletionRate = stats.total > 0 
    ? Math.round((stats.active / stats.total) * 100) 
    : 0;
  
  // Calculate channel adoption rate
  const channelAdoptionRate = stats.total > 0
    ? Math.round((stats.withChannels / stats.total) * 100)
    : 0;
  
  // Get registration status
  const registrationEnabled = isRegistrationEnabled();
  
  return {
    stage: {
      id: stage.id,
      name: stage.name,
      maxUsers: stage.maxUsers
    },
    users: {
      total: stats.total,
      active: stats.active,
      withChannels: stats.withChannels,
      limit: limit
    },
    rates: {
      wizardCompletion: wizardCompletionRate,
      channelAdoption: channelAdoptionRate
    },
    registration: {
      enabled: registrationEnabled
    },
    warnings: {
      limitWarning: shouldWarnUserLimit(),
      limitReached: limit.reached
    }
  };
}

/**
 * Get metrics specific to current stage
 * @returns {Object} Stage-specific metrics
 */
function getStageSpecificMetrics() {
  const stage = getCurrentStage();
  const stats = usersDb.getUserStats();
  
  const metrics = {
    stageId: stage.id,
    stageName: stage.name
  };
  
  // Stage 0: Closed Testing - Focus on UX and stability
  if (stage.id === 0) {
    metrics.focus = [
      { name: 'Wizard Completion', value: stats.active, total: stats.total },
      { name: 'Manual Complaints', value: 0, comment: 'Track manually' },
      { name: 'Bugs in Logs', value: 0, comment: 'Track manually' }
    ];
  }
  
  // Stage 1: Open Test - Focus on real-world scenarios
  if (stage.id === 1) {
    metrics.focus = [
      { name: 'Duplicate Messages', value: 0, comment: 'Should be 0' },
      { name: 'Avg Response Time', value: 0, unit: 'ms', comment: 'Track manually' },
      { name: 'Restarts', value: 0, comment: 'Track manually' },
      { name: 'IP Monitoring Users', value: 0, comment: 'Track manually' }
    ];
  }
  
  // Stage 2: Controlled Growth - Focus on scaling
  if (stage.id === 2) {
    metrics.focus = [
      { name: 'CPU Usage', value: 0, unit: '%', comment: 'Track manually' },
      { name: 'Memory Usage', value: process.memoryUsage().heapUsed, unit: 'bytes' },
      { name: 'Active Schedulers', value: 0, comment: 'Track manually' },
      { name: 'Telegram API Errors', value: 0, comment: 'Track manually' }
    ];
  }
  
  // Stage 3: Active Growth - Focus on peaks
  if (stage.id === 3) {
    metrics.focus = [
      { name: 'Latency', value: 0, unit: 'ms', comment: 'Track manually' },
      { name: 'Retry Count', value: 0, comment: 'Track manually' },
      { name: 'Message Queue', value: 0, comment: 'Track manually' },
      { name: 'Lost Events', value: 0, comment: 'Must be 0' }
    ];
  }
  
  // Stage 4: Scale - Focus on reliability
  if (stage.id === 4) {
    const uptime = process.uptime();
    metrics.focus = [
      { name: 'Uptime', value: Math.round(uptime / 3600), unit: 'hours' },
      { name: 'Error Rate', value: 0, unit: '%', comment: 'Track manually' },
      { name: 'Mean Time to Incident', value: 0, unit: 'hours', comment: 'Track manually' }
    ];
  }
  
  return metrics;
}

/**
 * Log growth-related event
 * @param {string} eventType - Type of event
 * @param {Object} data - Event data
 */
function logGrowthEvent(eventType, data) {
  const timestamp = new Date().toISOString();
  const logEntry = JSON.stringify({
    type: 'growth_event',
    event: eventType,
    data,
    timestamp
  });
  
  console.log(`📈 GROWTH EVENT: ${logEntry}`);
  
  // Store in settings as recent events (keep last 100)
  try {
    const recentEvents = JSON.parse(getSetting('growth_events', '[]'));
    recentEvents.push({ eventType, data, timestamp });
    
    // Keep only last 100 events
    if (recentEvents.length > 100) {
      recentEvents.shift();
    }
    
    setSetting('growth_events', JSON.stringify(recentEvents));
  } catch (error) {
    console.error('Error storing growth event:', error);
  }
}

/**
 * Log user registration event
 * @param {string} telegramId
 * @param {Object} userData
 */
function logUserRegistration(telegramId, userData) {
  logGrowthEvent('user_registration', {
    telegram_id: telegramId,
    region: userData.region,
    queue: userData.queue,
    stage: getCurrentStage().id,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log wizard completion
 * @param {string} telegramId
 */
function logWizardCompletion(telegramId) {
  logGrowthEvent('wizard_completion', {
    telegram_id: telegramId,
    stage: getCurrentStage().id,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log channel connection
 * @param {string} telegramId
 * @param {string} channelId
 */
function logChannelConnection(telegramId, channelId) {
  logGrowthEvent('channel_connection', {
    telegram_id: telegramId,
    channel_id: channelId,
    stage: getCurrentStage().id,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log IP monitoring setup
 * @param {string} telegramId
 */
function logIpMonitoringSetup(telegramId) {
  logGrowthEvent('ip_monitoring_setup', {
    telegram_id: telegramId,
    stage: getCurrentStage().id,
    timestamp: new Date().toISOString()
  });
}

/**
 * Get recent growth events
 * @param {number} limit - Maximum number of events to return
 * @returns {Array} Recent events
 */
function getRecentGrowthEvents(limit = 20) {
  try {
    const events = JSON.parse(getSetting('growth_events', '[]'));
    return events.slice(-limit).reverse();
  } catch (error) {
    console.error('Error getting growth events:', error);
    return [];
  }
}

/**
 * Check if growth should be stopped (anti-chaos check)
 * @returns {Object} { shouldStop: boolean, reasons: Array }
 */
function checkGrowthHealth() {
  const reasons = [];
  
  // Check if pause mode is active (system instability)
  const isPaused = getSetting('bot_paused', '0') === '1';
  if (isPaused) {
    reasons.push('Бот на паузі (можлива нестабільність)');
  }
  
  // Check if user limit is reached
  const limit = checkUserLimit();
  if (limit.reached) {
    reasons.push(`Досягнуто ліміт користувачів (${limit.current}/${limit.max})`);
  }
  
  // Check if registration is disabled
  if (!isRegistrationEnabled()) {
    reasons.push('Реєстрація вимкнена адміністратором');
  }
  
  return {
    shouldStop: reasons.length > 0,
    reasons,
    healthy: reasons.length === 0
  };
}

module.exports = {
  GROWTH_STAGES,
  getCurrentStage,
  setGrowthStage,
  isRegistrationEnabled,
  setRegistrationEnabled,
  checkUserLimit,
  shouldWarnUserLimit,
  getGrowthMetrics,
  getStageSpecificMetrics,
  logGrowthEvent,
  logUserRegistration,
  logWizardCompletion,
  logChannelConnection,
  logIpMonitoringSetup,
  getRecentGrowthEvents,
  checkGrowthHealth
};
