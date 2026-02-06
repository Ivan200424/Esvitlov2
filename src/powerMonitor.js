const config = require('./config');
const usersDb = require('./database/users');
const { addOutageRecord } = require('./statistics');
const { formatExactDuration, formatTime, formatInterval } = require('./utils');
const { formatTemplate } = require('./formatter');
const db = require('./database/db');

// Get monitoring manager
let metricsCollector = null;
try {
  metricsCollector = require('./monitoring/metricsCollector');
} catch (e) {
  // Monitoring not available yet, will work without it
}

let bot = null;
let monitoringInterval = null;
let periodicSaveInterval = null; // Інтервал для періодичного збереження станів
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
async function checkRouterAvailability(routerAddress = null) {
  const addressToCheck = routerAddress || config.ROUTER_HOST;
  
  if (!addressToCheck) {
    return null; // Моніторинг вимкнено
  }
  
  // Розділяємо на хост і порт
  let host = addressToCheck;
  let port = config.ROUTER_PORT || 80;
  
  // Перевіряємо чи є порт в адресі
  const portMatch = addressToCheck.match(/^(.+):(\d+)$/);
  if (portMatch) {
    host = portMatch[1];
    port = parseInt(portMatch[2], 10);
  }
  
  // Track ping start for capacity monitoring
  let capacityTracker;
  try {
    capacityTracker = require('./monitoring/capacityTracker');
    capacityTracker.trackIPPing(true);
  } catch (e) {
    // Capacity tracker not available yet
  }
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`http://${host}:${port}`, {
      signal: controller.signal,
      method: 'HEAD'
    });
    
    clearTimeout(timeout);
    return true; // Роутер доступний = світло є
  } catch (error) {
    return false; // Роутер недоступний = світла нема
  } finally {
    // Track ping end for capacity monitoring
    if (capacityTracker) {
      capacityTracker.trackIPPing(false);
    }
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
      lastPingTime: null, // Track last ping time
      lastPingSuccess: null, // Track if last ping was successful
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
async function handlePowerStateChange(user, newState, oldState, userState, originalChangeTime = null) {
  try {
    const now = new Date();
    
    // Track IP monitoring event
    if (metricsCollector) {
      if (oldState === 'off' && newState === 'on') {
        metricsCollector.trackIPEvent('offlineToOnline');
      }
    }
    
    // Використовуємо переданий час або поточний
    const changeTime = originalChangeTime 
      ? new Date(originalChangeTime) 
      : now;
    
    const changedAt = changeTime.toISOString();
    
    // Оновлюємо стан в БД
    usersDb.updateUserPowerState(user.telegram_id, newState, changedAt);
    
    // Якщо є попередній стан, обчислюємо тривалість
    let durationText = '';
    
    if (userState.lastStableAt) {
      const totalDurationMs = changeTime - new Date(userState.lastStableAt);
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
    const kyivTime = new Date(changeTime.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
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
        // Default message - NEW FORMAT
        message = `🔴 <b>${timeStr} Світло зникло</b>\n`;
        message += `🕓 Воно було ${durationText || '—'}`;
        message += scheduleText; // Додаємо інфо про наступне включення
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
        // Default message - NEW FORMAT
        message = `🟢 <b>${timeStr} Світло з'явилося</b>\n`;
        message += `🕓 Його не було ${durationText || '—'}`;
        message += scheduleText; // Додаємо інфо про наступне відключення
      }
    }
    
    // Отримуємо налаштування куди публікувати
    const notifyTarget = user.power_notify_target || 'both';
    
    // Відправляємо в особистий чат користувача
    if (notifyTarget === 'bot' || notifyTarget === 'both') {
      try {
        await bot.api.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
        console.log(`📱 Повідомлення про зміну стану відправлено користувачу ${user.telegram_id}`);
      } catch (error) {
        console.error(`Помилка відправки повідомлення користувачу ${user.telegram_id}:`, error.message);
        // Track error
        if (metricsCollector) {
          metricsCollector.trackError(error, { 
            context: 'power_notification', 
            userId: user.telegram_id 
          });
        }
      }
    }
    
    // Відправляємо в канал користувача, якщо він налаштований і відрізняється від особистого чату
    if (user.channel_id && user.channel_id !== user.telegram_id && (notifyTarget === 'channel' || notifyTarget === 'both')) {
      // Check if channel is paused
      if (user.channel_paused) {
        console.log(`Канал користувача ${user.telegram_id} зупинено, пропускаємо публікацію в канал`);
      } else {
        try {
          await bot.api.sendMessage(user.channel_id, message, { parse_mode: 'HTML' });
          console.log(`📢 Повідомлення про зміну стану відправлено в канал ${user.channel_id}`);
        } catch (error) {
          console.error(`Помилка відправки повідомлення в канал ${user.channel_id}:`, error.message);
          // Track channel error
          if (metricsCollector) {
            metricsCollector.trackChannelEvent('publishErrors');
            metricsCollector.trackError(error, { 
              context: 'channel_power_notification', 
              channelId: user.channel_id 
            });
          }
        }
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
    
    // Get or create user state before processing availability result
    // This ensures we have a state object to update with ping information
    const userState = getUserState(user.id);
    
    // Update last ping time
    userState.lastPingTime = new Date().toISOString();
    userState.lastPingSuccess = isAvailable !== null;
    
    if (isAvailable === null) {
      return; // Не вдалося перевірити
    }
    
    const newState = isAvailable ? 'on' : 'off';
    
    // Перша перевірка - читаємо останній стан з БД
    if (userState.isFirstCheck) {
      // Читаємо з БД останній збережений стан
      if (user.power_state && user.power_changed_at) {
        userState.currentState = user.power_state;
        userState.lastStableState = user.power_state;
        userState.lastStableAt = user.power_changed_at;
        userState.isFirstCheck = false;
        console.log(`User ${user.id}: Відновлено стан з БД: ${user.power_state} з ${user.power_changed_at}`);
      } else {
        // Немає збереженого стану - встановлюємо поточний
        userState.currentState = newState;
        userState.lastStableState = newState;
        userState.lastStableAt = new Date().toISOString();
        userState.isFirstCheck = false;
        userState.consecutiveChecks = 0;
        
        // Оновлюємо БД
        usersDb.updateUserPowerState(user.telegram_id, newState, userState.lastStableAt);
      }
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
      const originalChangeTime = userState.pendingStateTime; // Зберігаємо перед скиданням!
      
      userState.currentState = newState;
      userState.consecutiveChecks = 0;
      userState.debounceTimer = null;
      userState.pendingState = null;
      userState.pendingStateTime = null;
      
      // Обробляємо зміну стану з правильним часом
      await handlePowerStateChange(user, newState, oldState, userState, originalChangeTime);
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
  
  // Відновлюємо стани з БД (асинхронно, не блокуємо запуск)
  restoreUserStates().catch(error => {
    console.error('Помилка відновлення станів:', error);
  });
  
  // Запускаємо періодичну перевірку
  monitoringInterval = setInterval(async () => {
    await checkAllUsers();
  }, config.POWER_CHECK_INTERVAL * 1000);
  
  // Запускаємо періодичне збереження станів (кожні 5 хвилин)
  periodicSaveInterval = setInterval(async () => {
    await saveAllUserStates();
  }, 5 * 60 * 1000);
  
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
  if (periodicSaveInterval) {
    clearInterval(periodicSaveInterval);
    periodicSaveInterval = null;
    console.log('💾 Періодичне збереження станів зупинено');
  }
}

// Зберегти стан користувача в БД
function saveUserStateToDb(userId, state) {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO user_power_states 
      (telegram_id, current_state, pending_state, pending_state_time, 
       last_stable_state, last_stable_at, instability_start, switch_count, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
      userId,
      state.currentState,
      state.pendingState,
      state.pendingStateTime,
      state.lastStableState,
      state.lastStableAt,
      state.instabilityStart,
      state.switchCount || 0
    );
  } catch (error) {
    console.error(`Помилка збереження стану користувача ${userId}:`, error.message);
  }
}

// Зберегти всі стани користувачів
async function saveAllUserStates() {
  try {
    let savedCount = 0;
    for (const [userId, state] of userStates) {
      saveUserStateToDb(userId, state);
      savedCount++;
    }
    console.log(`💾 Збережено ${savedCount} станів користувачів`);
    return savedCount;
  } catch (error) {
    console.error('Помилка збереження станів:', error.message);
    throw error;
  }
}

// Відновити стани користувачів з БД
async function restoreUserStates() {
  try {
    const rows = db.prepare(`
      SELECT * FROM user_power_states 
      WHERE updated_at > datetime('now', '-1 hour')
    `).all();
    
    for (const row of rows) {
      userStates.set(row.telegram_id, {
        currentState: row.current_state,
        pendingState: row.pending_state,
        pendingStateTime: row.pending_state_time,
        lastStableState: row.last_stable_state,
        lastStableAt: row.last_stable_at,
        instabilityStart: row.instability_start,
        switchCount: row.switch_count || 0,
        consecutiveChecks: 0,
        isFirstCheck: false,
        debounceTimer: null  // Таймери не відновлюємо
      });
    }
    
    console.log(`🔄 Відновлено ${rows.length} станів користувачів`);
    return rows.length;
  } catch (error) {
    console.error('Помилка відновлення станів:', error.message);
    return 0;
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

// Get IP monitoring status for user
function getUserIpStatus(userId) {
  const userState = userStates.get(userId);
  if (!userState) {
    return {
      state: 'unknown',
      label: '⚪ Невідомо',
      lastPing: null,
      lastPingSuccess: null,
    };
  }
  
  const { getIpState, getIpStateLabel, formatLastPing } = require('./constants/ipStates');
  const state = getIpState(userState);
  
  return {
    state,
    label: getIpStateLabel(state),
    lastPing: userState.lastPingTime ? formatLastPing(userState.lastPingTime) : null,
    lastPingSuccess: userState.lastPingSuccess,
    currentState: userState.currentState,
    pendingState: userState.pendingState,
  };
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
  saveAllUserStates,
  saveUserStateToDb,
  restoreUserStates,
  getUserIpStatus,
};