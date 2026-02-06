/**
 * IP State Constants for v2
 * Provides clear state definitions for IP monitoring
 */

const IP_STATES = {
  ONLINE: 'online',        // Device is reachable and stable
  OFFLINE: 'offline',      // Device is unreachable and stable
  UNSTABLE: 'unstable',    // Device is flapping between states
  UNKNOWN: 'unknown',      // State not yet determined or monitoring disabled
};

const IP_STATE_LABELS = {
  [IP_STATES.ONLINE]: '🟢 Онлайн',
  [IP_STATES.OFFLINE]: '🔴 Офлайн',
  [IP_STATES.UNSTABLE]: '🟡 Нестабільно',
  [IP_STATES.UNKNOWN]: '⚪ Невідомо',
};

/**
 * Determine IP state based on user state object
 */
function getIpState(userState) {
  if (!userState) return IP_STATES.UNKNOWN;
  
  // If there's a pending state that's different from current, we're unstable
  if (userState.pendingState !== null && userState.pendingState !== userState.currentState) {
    return IP_STATES.UNSTABLE;
  }
  
  // If we have a stable state
  if (userState.currentState === 'on') return IP_STATES.ONLINE;
  if (userState.currentState === 'off') return IP_STATES.OFFLINE;
  
  return IP_STATES.UNKNOWN;
}

/**
 * Get human-readable state label
 */
function getIpStateLabel(state) {
  return IP_STATE_LABELS[state] || IP_STATE_LABELS[IP_STATES.UNKNOWN];
}

/**
 * Format last ping time
 */
function formatLastPing(timestamp) {
  if (!timestamp) return 'невідомо';
  
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  
  if (diffSec < 60) return `${diffSec} сек тому`;
  if (diffMin < 60) return `${diffMin} хв тому`;
  if (diffHour < 24) return `${diffHour} год тому`;
  
  const diffDays = Math.floor(diffHour / 24);
  return `${diffDays} дн тому`;
}

module.exports = {
  IP_STATES,
  IP_STATE_LABELS,
  getIpState,
  getIpStateLabel,
  formatLastPing,
};
