/**
 * Enhanced IP Monitor v2.0
 * 
 * Requirements:
 * - Check every 10 seconds
 * - 2-minute debounce before state changes
 * - No spam messages
 * - Proper state transitions (ON/OFF)
 * - Integration with idempotent publisher
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const db = require('../database/db');
const idempotentPublisher = require('./idempotentPublisher');
const messageTemplates = require('./messageTemplates');

// Configuration
const CHECK_INTERVAL_MS = 10 * 1000; // 10 seconds
const DEBOUNCE_MS = 2 * 60 * 1000; // 2 minutes
const PING_TIMEOUT_MS = 5 * 1000; // 5 seconds

// User IP monitoring states
// Map<userId, {ip, lastCheck, currentState, pendingState, pendingTime, lastPublished}>
const monitoringStates = new Map();

// Monitoring intervals
const monitoringIntervals = new Map();

// Active flag
let isActive = false;

/**
 * Initialize IP monitoring
 */
function init() {
  console.log('💡 Initializing IP Monitor v2.0...');
  console.log(`  Check interval: ${CHECK_INTERVAL_MS / 1000}s`);
  console.log(`  Debounce time: ${DEBOUNCE_MS / 1000}s`);
  isActive = true;
  console.log('✅ IP Monitor initialized');
}

/**
 * Stop all monitoring
 */
function stop() {
  console.log('⏹️  Stopping IP Monitor...');
  isActive = false;
  
  // Clear all intervals
  for (const [userId, intervalId] of monitoringIntervals.entries()) {
    clearInterval(intervalId);
  }
  
  monitoringIntervals.clear();
  console.log('✅ IP Monitor stopped');
}

/**
 * Start monitoring for a user
 * 
 * @param {Object} params - Parameters
 * @param {string} params.userId - User ID
 * @param {string} params.ip - IP address to monitor
 * @param {Object} params.bot - Telegram bot instance
 * @param {string} [params.chatId] - Chat ID for notifications (defaults to userId)
 */
function startMonitoring({ userId, ip, bot, chatId }) {
  if (!isActive) {
    console.warn(`⚠️  IP Monitor not active, cannot start monitoring for user ${userId}`);
    return;
  }
  
  // Stop existing monitoring if any
  stopMonitoring(userId);
  
  // Initialize state
  monitoringStates.set(userId, {
    ip,
    bot,
    chatId: chatId || userId,
    lastCheck: null,
    currentState: null, // null = unknown, 'online', 'offline'
    pendingState: null,
    pendingTime: null,
    lastPublished: null,
    checkCount: 0,
    lastStateChange: null
  });
  
  console.log(`🔍 Started IP monitoring for user ${userId}: ${ip}`);
  
  // Start checking immediately
  checkIP(userId);
  
  // Schedule periodic checks
  const intervalId = setInterval(() => {
    checkIP(userId);
  }, CHECK_INTERVAL_MS);
  
  monitoringIntervals.set(userId, intervalId);
}

/**
 * Stop monitoring for a user
 * 
 * @param {string} userId - User ID
 */
function stopMonitoring(userId) {
  const intervalId = monitoringIntervals.get(userId);
  if (intervalId) {
    clearInterval(intervalId);
    monitoringIntervals.delete(userId);
  }
  
  monitoringStates.delete(userId);
  console.log(`⏹️  Stopped IP monitoring for user ${userId}`);
}

/**
 * Check IP connectivity
 * 
 * @param {string} userId - User ID
 */
async function checkIP(userId) {
  const state = monitoringStates.get(userId);
  if (!state || !isActive) {
    return;
  }
  
  try {
    const isOnline = await pingIP(state.ip);
    const now = Date.now();
    
    state.lastCheck = now;
    state.checkCount++;
    
    // Determine the detected state
    const detectedState = isOnline ? 'online' : 'offline';
    
    // First check - initialize current state
    if (state.currentState === null) {
      state.currentState = detectedState;
      console.log(`ℹ️  Initial state for user ${userId}: ${detectedState}`);
      return;
    }
    
    // Check if state is different from current
    if (detectedState !== state.currentState) {
      // State change detected
      
      if (state.pendingState === null) {
        // Start debounce period
        state.pendingState = detectedState;
        state.pendingTime = now;
        console.log(`⏳ Pending state change for user ${userId}: ${state.currentState} → ${detectedState}`);
      } else if (state.pendingState === detectedState) {
        // Still in debounce, check if time has passed
        const elapsedMs = now - state.pendingTime;
        
        if (elapsedMs >= DEBOUNCE_MS) {
          // Debounce period passed, confirm state change
          await confirmStateChange(userId, state, detectedState);
        } else {
          // Still waiting
          const remainingMs = DEBOUNCE_MS - elapsedMs;
          console.log(`⏳ Debounce for user ${userId}: ${Math.round(remainingMs / 1000)}s remaining`);
        }
      } else {
        // Detected state changed again during debounce (flapping)
        // Reset debounce
        state.pendingState = detectedState;
        state.pendingTime = now;
        console.log(`🔄 Flapping detected for user ${userId}, reset debounce`);
      }
    } else {
      // State matches current, cancel any pending change
      if (state.pendingState !== null) {
        console.log(`↩️  State reverted for user ${userId}, cancelled pending change`);
        state.pendingState = null;
        state.pendingTime = null;
      }
    }
    
  } catch (error) {
    console.error(`❌ Error checking IP for user ${userId}:`, error);
  }
}

/**
 * Confirm state change and publish notification
 * 
 * @param {string} userId - User ID
 * @param {Object} state - Monitoring state
 * @param {string} newState - New state ('online' or 'offline')
 */
async function confirmStateChange(userId, state, newState) {
  const oldState = state.currentState;
  const now = Date.now();
  
  // Calculate duration in previous state
  let duration = 0;
  if (state.lastStateChange) {
    duration = Math.floor((now - state.lastStateChange) / 1000); // seconds
  }
  
  // Update state
  state.currentState = newState;
  state.pendingState = null;
  state.pendingTime = null;
  state.lastStateChange = now;
  
  console.log(`✅ Confirmed state change for user ${userId}: ${oldState} → ${newState}`);
  
  // Format time and duration
  const time = new Date().toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv'
  });
  
  const durationStr = formatDuration(duration);
  
  // Publish notification using idempotent publisher
  try {
    const published = await idempotentPublisher.publishPowerState({
      bot: state.bot,
      chatId: state.chatId,
      userId,
      state: newState === 'online' ? 'on' : 'off',
      time,
      duration: durationStr,
      nextEvent: null // TODO: Get from schedule
    });
    
    if (published) {
      state.lastPublished = now;
      console.log(`📤 Published power ${newState} notification for user ${userId}`);
    }
  } catch (error) {
    console.error(`❌ Error publishing power state for user ${userId}:`, error);
  }
  
  // Save to database (power history)
  try {
    if (db.savePowerHistory) {
      await db.savePowerHistory(userId, newState === 'online' ? 'power_on' : 'power_off', now, duration);
    }
  } catch (error) {
    console.error(`❌ Error saving power history for user ${userId}:`, error);
  }
}

/**
 * Ping an IP address
 * 
 * @param {string} ip - IP address
 * @returns {Promise<boolean>} True if online, false if offline
 */
async function pingIP(ip) {
  try {
    // Use ping command (works on Linux/Mac/Windows)
    const command = process.platform === 'win32'
      ? `ping -n 1 -w ${PING_TIMEOUT_MS} ${ip}`
      : `ping -c 1 -W ${Math.floor(PING_TIMEOUT_MS / 1000)} ${ip}`;
    
    const { stdout } = await execPromise(command);
    
    // Check if ping was successful
    const isOnline = process.platform === 'win32'
      ? stdout.includes('TTL=') || stdout.includes('TTL:')
      : stdout.includes(' 0% packet loss') || stdout.includes('1 received');
    
    return isOnline;
    
  } catch (error) {
    // Ping command failed - IP is offline
    return false;
  }
}

/**
 * Format duration in Ukrainian
 * 
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds} сек`;
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} хв`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours} год`;
  }
  
  return `${hours} год ${remainingMinutes} хв`;
}

/**
 * Get monitoring status for a user
 * 
 * @param {string} userId - User ID
 * @returns {Object|null} Monitoring status or null
 */
function getStatus(userId) {
  const state = monitoringStates.get(userId);
  if (!state) {
    return null;
  }
  
  return {
    ip: state.ip,
    currentState: state.currentState,
    pendingState: state.pendingState,
    checkCount: state.checkCount,
    lastCheck: state.lastCheck,
    isDebouncing: state.pendingState !== null,
    debounceRemaining: state.pendingState !== null
      ? Math.max(0, DEBOUNCE_MS - (Date.now() - state.pendingTime))
      : 0
  };
}

/**
 * Get all monitoring statistics
 * 
 * @returns {Object} Statistics
 */
function getStats() {
  return {
    totalMonitored: monitoringStates.size,
    isActive,
    checkIntervalMs: CHECK_INTERVAL_MS,
    debounceMs: DEBOUNCE_MS
  };
}

/**
 * Restore monitoring from database on startup
 * 
 * @param {Object} bot - Telegram bot instance
 */
async function restoreMonitoring(bot) {
  console.log('🔄 Restoring IP monitoring from database...');
  
  try {
    const users = await db.getAllUsers();
    let restoredCount = 0;
    
    for (const user of users) {
      if (user.router_ip && user.is_active) {
        startMonitoring({
          userId: user.telegram_id,
          ip: user.router_ip,
          bot,
          chatId: user.channel_id || user.telegram_id
        });
        restoredCount++;
      }
    }
    
    console.log(`✅ Restored IP monitoring for ${restoredCount} users`);
    
  } catch (error) {
    console.error('❌ Error restoring IP monitoring:', error);
  }
}

module.exports = {
  init,
  stop,
  startMonitoring,
  stopMonitoring,
  getStatus,
  getStats,
  restoreMonitoring,
  
  // Exposed for testing
  pingIP,
  formatDuration,
  
  // Constants
  CHECK_INTERVAL_MS,
  DEBOUNCE_MS
};
