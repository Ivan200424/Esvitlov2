const config = require('./config');

let currentPowerState = null; // 'on' | 'off' | null
let lastStateChangeAt = null;
let consecutiveChecks = 0;
let isFirstCheck = true;
const DEBOUNCE_COUNT = 2;

async function checkRouterAvailability() {
  const { ROUTER_HOST, ROUTER_PORT } = config;
  
  if (!ROUTER_HOST) {
    return null; // Моніторинг вимкнено
  }
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`http://${ROUTER_HOST}:${ROUTER_PORT}`, {
      signal: controller.signal,
      method: 'HEAD'
    });
    
    clearTimeout(timeout);
    return true; // Роутер доступний = світло є
  } catch (error) {
    return false; // Роутер недоступний = світла нема
  }
}

function getPowerState() {
  return {
    state: currentPowerState,
    changedAt: lastStateChangeAt
  };
}

function updatePowerState(isAvailable) {
  const newState = isAvailable ? 'on' : 'off';
  
  // Перша перевірка
  if (isFirstCheck) {
    currentPowerState = newState;
    lastStateChangeAt = Date.now();
    isFirstCheck = false;
    consecutiveChecks = 1;
    return { changed: false, state: currentPowerState };
  }
  
  // Дебаунс: чекаємо DEBOUNCE_COUNT підряд однакових результатів
  if (currentPowerState === newState) {
    consecutiveChecks = 1;
    return { changed: false, state: currentPowerState };
  }
  
  consecutiveChecks++;
  
  if (consecutiveChecks >= DEBOUNCE_COUNT) {
    const oldState = currentPowerState;
    currentPowerState = newState;
    lastStateChangeAt = Date.now();
    consecutiveChecks = 1;
    return { changed: true, state: currentPowerState, oldState };
  }
  
  return { changed: false, state: currentPowerState };
}

function resetPowerMonitor() {
  currentPowerState = null;
  lastStateChangeAt = null;
  consecutiveChecks = 0;
  isFirstCheck = true;
}

module.exports = {
  checkRouterAvailability,
  getPowerState,
  updatePowerState,
  resetPowerMonitor,
};
