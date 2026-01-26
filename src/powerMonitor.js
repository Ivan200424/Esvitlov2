const config = require('./config');
const usersDb = require('./database/users');
const { addOutageRecord } = require('./statistics');
const { formatExactDuration, formatTime, formatInterval } = require('./utils');

let bot = null;
let monitoringInterval = null;
const DEBOUNCE_COUNT = 5; // 5 перевірок = 5 * 2 секунди = 10 секунд
const userStates = new Map(); // Зберігання стану для кожного користувача

// Структура стану користувача:
// {
//   currentState: 'on' | 'off' | null,
//   lastChangeAt: timestamp,
//   consecutiveChecks: number,
//   isFirstCheck: boolean
// }

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

// Отримати або створити стан користувача
function getUserState(userId) {
  if (!userStates.has(userId)) {
    userStates.set(userId, {
      currentState: null,
      lastChangeAt: null,
      consecutiveChecks: 0,
      isFirstCheck: true
    });
  }
  return userStates.get(userId);
}

// Отримати наступний заплановану подію з графіка
async function getNextScheduledTime(user) {
  try {
    const { fetchScheduleData } = require('./api');
    const { parseScheduleForQueue, findNextEvent } = require('./parser');
    
    const data = await fetchScheduleData(user.region);
    const scheduleData = parseScheduleForQueue(data, user.queue);
    const nextEvent = findNextEvent(scheduleData);
    
    return nextEvent;
  } catch (error) {
    console.error('Error getting next scheduled time:', error);
    return null;
  }
}

// Обробка зміни стану живлення
async function handlePowerStateChange(user, newState, oldState, userState) {
  try {
    const now = new Date();
    const changedAt = now.toISOString();
    const timeStr = formatTime(now);
    
    // Оновлюємо стан в БД
    usersDb.updateUserPowerState(user.telegram_id, newState, changedAt);
    
    // Якщо є попередній стан, обчислюємо тривалість
    let durationText = '';
    if (userState.lastChangeAt) {
      const durationMs = now - new Date(userState.lastChangeAt);
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      durationText = formatExactDuration(durationMinutes);
    }
    
    // Отримуємо наступну заплановану подію
    const nextEvent = await getNextScheduledTime(user);
    let scheduleText = '';
    
    if (nextEvent) {
      const eventTime = formatTime(nextEvent.time);
      if (newState === 'off') {
        // Світло зникло - показуємо коли очікується включення
        if (nextEvent.type === 'power_on') {
          scheduleText = `\n🗓 Світло має з'явитися: <b>${eventTime}</b>`;
        } else if (nextEvent.endTime) {
          // Якщо це відключення, показуємо час закінчення
          const endTime = formatTime(nextEvent.endTime);
          scheduleText = `\n🗓 Світло має з'явитися: <b>${endTime}</b>`;
        }
      } else {
        // Світло з'явилося - показуємо наступне відключення
        if (nextEvent.type === 'power_off') {
          if (nextEvent.endTime) {
            const endTime = formatTime(nextEvent.endTime);
            scheduleText = `\n🗓 Наступне планове: <b>${eventTime} - ${endTime}</b>`;
          } else {
            scheduleText = `\n🗓 Наступне планове: <b>${eventTime}</b>`;
          }
        }
      }
    }
    
    // Формуємо повідомлення
    let message = '';
    if (newState === 'off') {
      message = `🔴 <b>${timeStr} Світло зникло</b>`;
      if (durationText) {
        message += `\n🕓 Воно було ${durationText}`;
      }
      message += scheduleText;
      
      // Якщо є попередній стан 'on', зберігаємо запис про відключення
      if (oldState === 'on' && userState.lastChangeAt) {
        addOutageRecord(user.id, userState.lastChangeAt, changedAt);
      }
    } else {
      message = `🟢 <b>${timeStr} Світло з'явилося</b>`;
      if (durationText) {
        message += `\n🕓 Його не було ${durationText}`;
      }
      message += scheduleText;
    }
    
    // Відправляємо в канал користувача, якщо він налаштований
    if (user.channel_id) {
      try {
        await bot.sendMessage(user.channel_id, message, { parse_mode: 'HTML' });
        console.log(`📢 Повідомлення про зміну стану відправлено в канал ${user.channel_id}`);
      } catch (error) {
        console.error(`Помилка відправки повідомлення в канал ${user.channel_id}:`, error.message);
      }
    }
    
    // Оновлюємо стан користувача
    userState.lastChangeAt = changedAt;
    
  } catch (error) {
    console.error('Error handling power state change:', error);
  }
}

// Перевірка стану живлення для одного користувача
async function checkUserPower(user) {
  try {
    const isAvailable = await checkRouterAvailability(user.router_ip);
    
    if (isAvailable === null) {
      return; // Не вдалося перевірити
    }
    
    const newState = isAvailable ? 'on' : 'off';
    const userState = getUserState(user.id);
    
    // Перша перевірка
    if (userState.isFirstCheck) {
      userState.currentState = newState;
      userState.lastChangeAt = new Date().toISOString();
      userState.isFirstCheck = false;
      userState.consecutiveChecks = 0;
      
      // Оновлюємо БД
      usersDb.updateUserPowerState(user.telegram_id, newState, userState.lastChangeAt);
      return;
    }
    
    // Дебаунс: чекаємо DEBOUNCE_COUNT підряд однакових результатів
    if (userState.currentState === newState) {
      // Стан не змінився, скидаємо лічильник
      userState.consecutiveChecks = 0;
      return;
    }
    
    // Стан відрізняється від поточного, збільшуємо лічильник
    userState.consecutiveChecks++;
    
    if (userState.consecutiveChecks >= DEBOUNCE_COUNT) {
      // Достатньо послідовних перевірок з новим станом
      const oldState = userState.currentState;
      userState.currentState = newState;
      userState.consecutiveChecks = 0;
      
      // Обробляємо зміну стану
      await handlePowerStateChange(user, newState, oldState, userState);
    }
    
  } catch (error) {
    console.error(`Помилка перевірки живлення для користувача ${user.telegram_id}:`, error.message);
  }
}

// Перевірка всіх користувачів
async function checkAllUsers() {
  try {
    const users = usersDb.getUsersWithRouterIp();
    
    if (!users || users.length === 0) {
      return;
    }
    
    // Перевіряємо кожного користувача
    for (const user of users) {
      await checkUserPower(user);
    }
    
  } catch (error) {
    console.error('Помилка при перевірці користувачів:', error.message);
  }
}

// Запуск моніторингу живлення
function startPowerMonitoring(botInstance) {
  bot = botInstance;
  
  console.log('⚡ Запуск системи моніторингу живлення...');
  console.log(`   Інтервал перевірки: ${formatInterval(config.POWER_CHECK_INTERVAL)}`);
  console.log(`   Debounce: ${DEBOUNCE_COUNT} перевірок (${formatInterval(DEBOUNCE_COUNT * config.POWER_CHECK_INTERVAL)})`);
  
  // Запускаємо періодичну перевірку
  monitoringInterval = setInterval(async () => {
    await checkAllUsers();
  }, config.POWER_CHECK_INTERVAL * 1000);
  
  // Перша перевірка відразу
  checkAllUsers();
  
  console.log('✅ Система моніторингу живлення запущена');
}

// Зупинка моніторингу
function stopPowerMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('⚡ Моніторинг живлення зупинено');
  }
}

// Для сумісності з попереднім кодом
function getPowerState() {
  return {
    state: null,
    changedAt: null
  };
}

function updatePowerState(isAvailable) {
  return { changed: false, state: null };
}

function resetPowerMonitor() {
  userStates.clear();
}

module.exports = {
  checkRouterAvailability,
  getPowerState,
  updatePowerState,
  resetPowerMonitor,
  startPowerMonitoring,
  stopPowerMonitoring,
  getNextScheduledTime,
  handlePowerStateChange,
};
