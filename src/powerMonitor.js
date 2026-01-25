const config = require('./config');

let currentPowerState = null; // 'on' | 'off' | null
let lastStateChangeAt = null;
let consecutiveChecks = 0;
let isFirstCheck = true;
const DEBOUNCE_COUNT = 2;

// Перевірка доступності роутера за IP
async function checkRouterAvailability(routerIp = null) {
  const ipToCheck = routerIp || config.ROUTER_HOST;
  
  if (!ipToCheck) {
    return null; // Моніторинг вимкнено
  }
  
  // Валідація IP-адреси
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ipToCheck)) {
    console.error('Invalid IP address format:', ipToCheck);
    return null;
  }
  
  const octets = ipToCheck.split('.').map(Number);
  if (octets.some(octet => octet < 0 || octet > 255)) {
    console.error('Invalid IP address octets:', ipToCheck);
    return null;
  }
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`http://${ipToCheck}:${config.ROUTER_PORT || 80}`, {
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
    consecutiveChecks = 0;
    return { changed: false, state: currentPowerState };
  }
  
  // Дебаунс: чекаємо DEBOUNCE_COUNT підряд однакових результатів
  if (currentPowerState === newState) {
    // Стан не змінився, скидаємо лічильник
    consecutiveChecks = 0;
    return { changed: false, state: currentPowerState };
  }
  
  // Стан відрізняється від поточного, збільшуємо лічильник
  consecutiveChecks++;
  
  if (consecutiveChecks >= DEBOUNCE_COUNT) {
    // Достатньо послідовних перевірок з новим станом
    const oldState = currentPowerState;
    currentPowerState = newState;
    lastStateChangeAt = Date.now();
    consecutiveChecks = 0;
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
