const cron = require('node-cron');
const { fetchScheduleData } = require('./api');
const { parseScheduleForQueue, findNextEvent } = require('./parser');
const { formatPowerOffAlert, formatPowerOnAlert } = require('./formatter');
const { formatTime, formatDurationFromMs } = require('./utils');
const usersDb = require('./database/users');

let bot = null;

// Ініціалізація системи алертів
function startAlertSystem(botInstance) {
  bot = botInstance;
  console.log('🔔 Запуск системи алертів...');
  
  // Перевірка алертів кожну хвилину
  cron.schedule('* * * * *', async () => {
    await checkAndSendAlerts();
  });
  
  console.log('✅ Система алертів запущена (перевірка кожну хвилину)');
}

// Перевірка та відправка всіх алертів
async function checkAndSendAlerts() {
  try {
    const users = usersDb.getUsersWithAlertsEnabled();
    
    for (const user of users) {
      try {
        await checkUserAlerts(user);
      } catch (error) {
        console.error(`Помилка перевірки алертів для користувача ${user.telegram_id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Помилка при перевірці алертів:', error);
  }
}

// Перевірка алертів для конкретного користувача
async function checkUserAlerts(user) {
  try {
    // Отримуємо дані графіка
    const data = await fetchScheduleData(user.region);
    const scheduleData = parseScheduleForQueue(data, user.queue);
    const nextEvent = findNextEvent(scheduleData);
    
    if (!nextEvent) {
      return;
    }
    
    const minutesUntil = nextEvent.minutes;
    
    // Перевіряємо алерт на відключення
    if (nextEvent.type === 'power_off' && user.alerts_off_enabled) {
      await checkAndSendAlertOff(user, minutesUntil, nextEvent);
    }
    
    // Перевіряємо алерт на включення (коли зараз немає світла)
    if (nextEvent.type === 'power_on' && user.alerts_on_enabled) {
      await checkAndSendAlertOn(user, minutesUntil, nextEvent);
    }
    
  } catch (error) {
    // Ігноруємо помилки для окремих користувачів
  }
}

// Перевірити та відправити алерт перед відключенням
async function checkAndSendAlertOff(user, minutesUntil, nextEvent) {
  // Перевіряємо чи увімкнено попередження про графік
  if (!user.schedule_alert_enabled) {
    return;
  }
  
  // Перевіряємо чи час відповідає налаштуванням користувача
  const alertMinutes = user.schedule_alert_minutes || 15;
  
  // Перевіряємо чи час відповідає налаштуванню (з толерансією ±1 хвилина)
  if (Math.abs(minutesUntil - alertMinutes) > 1) {
    return;
  }
  
  // Формуємо ключ періоду для перевірки дублікатів
  const eventTime = new Date(nextEvent.time);
  const periodKey = `${eventTime.getHours()}:${eventTime.getMinutes()}`;
  
  // Перевіряємо чи вже не відправляли алерт для цього періоду
  if (user.last_alert_off_period === periodKey) {
    return;
  }
  
  // Формуємо дані для алерту
  const startTime = formatTime(nextEvent.time);
  const endTime = formatTime(nextEvent.endTime);
  const durationMs = new Date(nextEvent.endTime) - new Date(nextEvent.time);
  const durationText = formatDurationFromMs(durationMs);
  const isPossible = nextEvent.isPossible || false;
  
  // Формуємо та відправляємо повідомлення
  const message = formatPowerOffAlert(minutesUntil, startTime, endTime, durationText, isPossible);
  
  // Куди надсилати
  const alertTarget = user.schedule_alert_target || 'both';
  
  let sentMsgId = null;
  let hasSuccess = false;
  
  // Відправляємо в бот користувача
  if (alertTarget === 'bot' || alertTarget === 'both') {
    try {
      const sentMsg = await bot.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
      sentMsgId = sentMsg.message_id;
      hasSuccess = true;
      console.log(`🔔 Алерт про відключення відправлено в бот користувачу ${user.telegram_id}`);
    } catch (error) {
      console.error(`Помилка відправки алерту в бот користувачу ${user.telegram_id}:`, error.message);
    }
  }
  
  // Відправляємо в канал користувача
  if (user.channel_id && (alertTarget === 'channel' || alertTarget === 'both')) {
    try {
      const sentMsg = await bot.sendMessage(user.channel_id, message, { parse_mode: 'HTML' });
      sentMsgId = sentMsgId || sentMsg.message_id;
      hasSuccess = true;
      console.log(`🔔 Алерт про відключення відправлено в канал ${user.channel_id}`);
    } catch (error) {
      console.error(`Помилка відправки алерту в канал ${user.channel_id}:`, error.message);
    }
  }
  
  // Зберігаємо інформацію про відправлений алерт, якщо хоча б одна відправка успішна
  if (hasSuccess) {
    usersDb.updateUserAlertPeriod(user.telegram_id, 'off', periodKey, sentMsgId);
  }
}

// Перевірити та відправити алерт перед включенням
async function checkAndSendAlertOn(user, minutesUntil, nextEvent) {
  // Перевіряємо чи увімкнено попередження про графік
  if (!user.schedule_alert_enabled) {
    return;
  }
  
  // Перевіряємо чи час відповідає налаштуванням користувача
  const alertMinutes = user.schedule_alert_minutes || 15;
  
  // Перевіряємо чи час відповідає налаштуванню (з толерансією ±1 хвилина)
  if (Math.abs(minutesUntil - alertMinutes) > 1) {
    return;
  }
  
  // Формуємо ключ періоду для перевірки дублікатів
  const eventTime = new Date(nextEvent.time);
  const periodKey = `${eventTime.getHours()}:${eventTime.getMinutes()}`;
  
  // Перевіряємо чи вже не відправляли алерт для цього періоду
  if (user.last_alert_on_period === periodKey) {
    return;
  }
  
  // Формуємо дані для алерту
  const startTime = formatTime(nextEvent.startTime);
  const endTime = formatTime(nextEvent.time);
  const durationMs = new Date(nextEvent.time) - new Date(nextEvent.startTime);
  const durationText = formatDurationFromMs(durationMs);
  
  // Формуємо та відправляємо повідомлення
  const message = formatPowerOnAlert(minutesUntil, startTime, endTime, durationText);
  
  // Куди надсилати
  const alertTarget = user.schedule_alert_target || 'both';
  
  let sentMsgId = null;
  let hasSuccess = false;
  
  // Відправляємо в бот користувача
  if (alertTarget === 'bot' || alertTarget === 'both') {
    try {
      const sentMsg = await bot.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
      sentMsgId = sentMsg.message_id;
      hasSuccess = true;
      console.log(`🔔 Алерт про включення відправлено в бот користувачу ${user.telegram_id}`);
    } catch (error) {
      console.error(`Помилка відправки алерту в бот користувачу ${user.telegram_id}:`, error.message);
    }
  }
  
  // Відправляємо в канал користувача
  if (user.channel_id && (alertTarget === 'channel' || alertTarget === 'both')) {
    try {
      const sentMsg = await bot.sendMessage(user.channel_id, message, { parse_mode: 'HTML' });
      sentMsgId = sentMsgId || sentMsg.message_id;
      hasSuccess = true;
      console.log(`🔔 Алерт про включення відправлено в канал ${user.channel_id}`);
    } catch (error) {
      console.error(`Помилка відправки алерту в канал ${user.channel_id}:`, error.message);
    }
  }
  
  // Зберігаємо інформацію про відправлений алерт, якщо хоча б одна відправка успішна
  if (hasSuccess) {
    usersDb.updateUserAlertPeriod(user.telegram_id, 'on', periodKey, sentMsgId);
  }
}

// Для сумісності зі старим кодом
function initAlerts(botInstance) {
  startAlertSystem(botInstance);
}

function checkAlerts() {
  return checkAndSendAlerts();
}

module.exports = {
  initAlerts,
  checkAlerts,
  startAlertSystem,
  checkAndSendAlertOff,
  checkAndSendAlertOn,
};
