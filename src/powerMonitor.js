const config = require('./config');
const usersDb = require('./database/users');
const { addOutageRecord } = require('./statistics');
const { formatExactDuration, formatTime, formatInterval } = require('./utils');
const { formatTemplate } = require('./formatter');

let bot = null;
let monitoringInterval = null;
const userStates = new Map(); // Зберігання стану для кожного користувача

// Структура стану користувача:
// {
//   currentState: 'on' | 'off' | null,
//   lastChangeAt: timestamp,
//   consecutiveChecks: number,
//   isFirstCheck: boolean,
//   // Нові поля для debounce:
//   pendingState: 'on' | 'off' | null, // Стан, який очікує підтвердження
//   pendingStateTime: timestamp, // Час початку очікування нового стану
//   debounceTimer: timeout, // Таймер для debounce
//   instabilityStart: timestamp, // Час початку нестабільності
//   switchCount: number, // Кількість перемикань під час нестабільності
//   lastStableState: 'on' | 'off' | null, // Останній стабільний стан
//   lastStableAt: timestamp, // Час останнього стабільного стану
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
      isFirstCheck: true,
      pendingState: null,
      pendingStateTime: null,
      debounceTimer: null,
      instabilityStart: null,
      switchCount: 0,
      lastStableState: null,
      lastStableAt: null,
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
    
    // Використовуємо час першої зміни стану (pendingStateTime), а не поточний час
    const originalChangeTime = userState.pendingStateTime 
      ? new Date(userState.pendingStateTime) 
      : now;
    
    const changedAt = originalChangeTime.toISOString();
    
    // Оновлюємо стан в БД
    usersDb.updateUserPowerState(user.telegram_id, newState, changedAt);
    
    // Якщо є попередній стан, обчислюємо тривалість
    let durationText = '';
    
    if (userState.lastStableAt) {
      const totalDurationMs = originalChangeTime - new Date(userState.lastStableAt);
      const totalDurationMinutes = Math.floor(totalDurationMs / (1000 * 60));
      durationText = formatExactDuration(totalDurationMinutes);
    }
    
    // Отримуємо графік для визначення чи це запланований період
    const nextEvent = await getNextScheduledTime(user);
    const { fetchScheduleData } = require('./api');
    const { parseScheduleForQueue, isCurrentlyOff } = require('./parser');
    
    let isScheduledOutage = false;
    try {
      const data = await fetchScheduleData(user.region);
      const scheduleData = parseScheduleForQueue(data, user.queue);
      isScheduledOutage = isCurrentlyOff(scheduleData);
    } catch (error) {
      console.error('Error checking schedule:', error);
    }
    
    let scheduleText = '';
    
    if (newState === 'off') {
      // Світло зникло
      // Показуємо "Світло має з'явитися" тільки якщо це запланований період
      if (isScheduledOutage && nextEvent) {
        const eventTime = formatTime(nextEvent.time);
        if (nextEvent.type === 'power_on') {
          scheduleText = `\n🗓 Світло має з'явитися: <b>${eventTime}</b>`;
        } else if (nextEvent.endTime) {
          const endTime = formatTime(nextEvent.endTime);
          scheduleText = `\n🗓 Світло має з'явитися: <b>${endTime}</b>`;
        }
      } else {
        // Позапланове відключення
        scheduleText = '\n⚠️ Позапланове відключення';
      }
    } else {
      // Світло з'явилося - показуємо наступне відключення
      if (nextEvent && nextEvent.type === 'power_off') {
        if (nextEvent.endTime) {
          const eventTime = formatTime(nextEvent.time);
          const endTime = formatTime(nextEvent.endTime);
          scheduleText = `\n🗓 Наступне планове: <b>${eventTime} - ${endTime}</b>`;
        } else {
          const eventTime = formatTime(nextEvent.time);
          scheduleText = `\n🗓 Наступне планове: <b>${eventTime}</b>`;
        }
      }
    }
    
    // Формуємо повідомлення в простому форматі згідно вимог
    let message = '';
    const kyivTime = new Date(originalChangeTime.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
    const timeStr = `${String(kyivTime.getHours()).padStart(2, '0')}:${String(kyivTime.getMinutes()).padStart(2, '0')}`;
    const dateStr = `${String(kyivTime.getDate()).padStart(2, '0')}.${String(kyivTime.getMonth() + 1).padStart(2, '0')}.${kyivTime.getFullYear()}`;
    
    if (newState === 'off') {
      // Світло зникло - use custom template if available
      if (user.power_off_text) {
        message = formatTemplate(user.power_off_text, {
          time: timeStr,
          date: dateStr,
          duration: durationText || ''
        });
      } else {
        // Default message
        message = `🔴 Світла немає\n\n`;
        message += `🕐 Час: ${timeStr}`;
        if (durationText) {
          message += `\n⏱ Було: ${durationText}`;
        }
      }
      
      // Якщо є попередній стан 'on', зберігаємо запис про відключення
      if (oldState === 'on' && userState.lastStableAt) {
        addOutageRecord(user.id, userState.lastStableAt, changedAt);
      }
    } else {
      // Світло з'явилося - use custom template if available
      if (user.power_on_text) {
        message = formatTemplate(user.power_on_text, {
          time: timeStr,
          date: dateStr,
          duration: durationText || ''
        });
      } else {
        // Default message
        message = `🟢 Світло є\n\n`;
        message += `🕐 Час: ${timeStr}`;
        if (durationText) {
          message += `\n⏱ Не було: ${durationText}`;
        }
      }
    }
    
    // Відправляємо повідомлення в особистий чат користувача
    try {
      await bot.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
      console.log(`📱 Повідомлення про зміну стану відправлено користувачу ${user.telegram_id}`);
    } catch (error) {
      console.error(`Помилка відправки повідомлення користувачу ${user.telegram_id}:`, error.message);
    }
    
    // Відправляємо в канал користувача, якщо він налаштований і відрізняється від особистого чату
    if (user.channel_id && user.channel_id !== user.telegram_id) {
      try {
        await bot.sendMessage(user.channel_id, message, { parse_mode: 'HTML' });
        console.log(`📢 Повідомлення про зміну стану відправлено в канал ${user.channel_id}`);
      } catch (error) {
        console.error(`Помилка відправки повідомлення в канал ${user.channel_id}:`, error.message);
      }
    }
    
    // Оновлюємо стан користувача
    userState.lastStableAt = changedAt;
    userState.lastStableState = newState;
    
    // Скидаємо лічильники нестабільності
    userState.instabilityStart = null;
    userState.switchCount = 0;
    
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
      userState.lastStableState = newState;
      userState.lastStableAt = new Date().toISOString();
      userState.isFirstCheck = false;
      userState.consecutiveChecks = 0;
      
      // Оновлюємо БД
      usersDb.updateUserPowerState(user.telegram_id, newState, userState.lastStableAt);
      return;
    }
    
    // Якщо стан такий же як поточний стабільний - скидаємо все
    if (userState.currentState === newState) {
      userState.consecutiveChecks = 0;
      
      // Якщо був pending стан, скасовуємо його
      if (userState.pendingState !== null && userState.pendingState !== newState) {
        console.log(`User ${user.id}: Скасування pending стану ${userState.pendingState} -> повернення до ${newState}`);
        
        // Скасовуємо таймер
        if (userState.debounceTimer) {
          clearTimeout(userState.debounceTimer);
          userState.debounceTimer = null;
        }
        
        // Рахуємо як ще одне перемикання
        userState.switchCount++;
        
        userState.pendingState = null;
        userState.pendingStateTime = null;
      }
      
      return;
    }
    
    // Стан відрізняється від поточного
    // Перевіряємо чи це той самий pending стан що вже очікує
    if (userState.pendingState === newState) {
      // Продовжуємо очікувати - нічого не робимо
      return;
    }
    
    // Новий стан відрізняється і від поточного, і від pending (якщо він є)
    // Це означає зміну стану
    
    // Скасовуємо попередній таймер, якщо він є
    if (userState.debounceTimer) {
      clearTimeout(userState.debounceTimer);
      userState.debounceTimer = null;
    }
    
    // Якщо це перша зміна стану (початок нестабільності)
    if (userState.pendingState === null) {
      userState.instabilityStart = new Date().toISOString();
      userState.switchCount = 1;
      console.log(`User ${user.id}: Початок нестабільності, перемикання з ${userState.currentState} на ${newState}`);
    } else {
      // Ще одне перемикання під час нестабільності
      userState.switchCount++;
      console.log(`User ${user.id}: Перемикання #${userState.switchCount} на ${newState}`);
    }
    
    // Встановлюємо новий pending стан
    userState.pendingState = newState;
    userState.pendingStateTime = new Date().toISOString();
    
    // Отримуємо час debounce з конфігурації
    const debounceMinutes = config.POWER_DEBOUNCE_MINUTES || 5;
    const debounceMs = debounceMinutes * 60 * 1000;
    
    console.log(`User ${user.id}: Очікування стабільності ${newState} протягом ${debounceMinutes} хв`);
    
    // Створюємо таймер для підтвердження зміни
    userState.debounceTimer = setTimeout(async () => {
      console.log(`User ${user.id}: Debounce завершено, підтвердження стану ${newState}`);
      
      // Стан був стабільний протягом debounce часу
      const oldState = userState.currentState;
      userState.currentState = newState;
      userState.consecutiveChecks = 0;
      userState.debounceTimer = null;
      userState.pendingState = null;
      userState.pendingStateTime = null;
      
      // Обробляємо зміну стану
      await handlePowerStateChange(user, newState, oldState, userState);
    }, debounceMs);
    
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
  
  const debounceMinutes = config.POWER_DEBOUNCE_MINUTES || 5;
  
  console.log('⚡ Запуск системи моніторингу живлення...');
  console.log(`   Інтервал перевірки: ${formatInterval(config.POWER_CHECK_INTERVAL)}`);
  console.log(`   Debounce: ${debounceMinutes} хв (очікування стабільного стану)`);
  
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
  // Очищаємо всі таймери перед скиданням
  userStates.forEach((state) => {
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }
  });
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