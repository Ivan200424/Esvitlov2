const cron = require('node-cron');
const { fetchScheduleData } = require('./api');
const { parseScheduleForQueue, findNextEvent } = require('./parser');
const { formatPowerOffAlert, formatPowerOnAlert } = require('./formatter');
const { getMinutesDifference } = require('./utils');
const usersDb = require('./database/users');

let bot = null;
const sentAlerts = new Map(); // Кеш відправлених алертів

// Ініціалізація системи алертів
function initAlerts(botInstance) {
  bot = botInstance;
  console.log('🔔 Ініціалізація системи алертів...');
  
  // Перевірка алертів кожну хвилину
  cron.schedule('* * * * *', async () => {
    await checkAlerts();
  });
  
  // Очистка кешу відправлених алертів кожну годину
  cron.schedule('0 * * * *', () => {
    sentAlerts.clear();
    console.log('🗑️  Кеш алертів очищено');
  });
  
  console.log('✅ Система алертів запущена (перевірка кожну хвилину)');
}

// Перевірка всіх алертів
async function checkAlerts() {
  try {
    const users = usersDb.getAllActiveUsers();
    
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
      const notifyAt = user.notify_before_off;
      
      if (shouldSendAlert(minutesUntil, notifyAt, user, 'off')) {
        await sendAlert(user, 'off', minutesUntil, nextEvent.time);
      }
    }
    
    // Перевіряємо алерт на включення
    if (nextEvent.type === 'power_on' && user.alerts_on_enabled) {
      const notifyAt = user.notify_before_on;
      
      if (shouldSendAlert(minutesUntil, notifyAt, user, 'on')) {
        await sendAlert(user, 'on', minutesUntil, nextEvent.time);
      }
    }
    
  } catch (error) {
    // Ігноруємо помилки для окремих користувачів
  }
}

// Перевірити чи потрібно відправити алерт
function shouldSendAlert(minutesUntil, notifyAt, user, type) {
  // Перевіряємо чи час відповідає налаштуванню (з толеранcією ±1 хвилина)
  if (Math.abs(minutesUntil - notifyAt) > 1) {
    return false;
  }
  
  // Перевіряємо чи вже не відправляли цей алерт
  const alertKey = `${user.telegram_id}_${type}_${notifyAt}`;
  const now = Date.now();
  const lastSent = sentAlerts.get(alertKey);
  
  // Не відправляємо алерт частіше ніж раз на 10 хвилин
  if (lastSent && (now - lastSent) < 10 * 60 * 1000) {
    return false;
  }
  
  return true;
}

// Відправити алерт
async function sendAlert(user, type, minutes, time) {
  try {
    let message;
    
    if (type === 'off') {
      message = formatPowerOffAlert(minutes, time);
    } else {
      message = formatPowerOnAlert(minutes, time);
    }
    
    // Відправляємо в особисті повідомлення
    await bot.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
    
    // Якщо є канал, відправляємо туди
    if (user.channel_id) {
      try {
        await bot.sendMessage(user.channel_id, message, { parse_mode: 'HTML' });
      } catch (channelError) {
        console.error(`Не вдалося відправити алерт в канал ${user.channel_id}:`, channelError.message);
      }
    }
    
    // Зберігаємо інформацію про відправлений алерт
    const alertKey = `${user.telegram_id}_${type}_${user[`notify_before_${type}`]}`;
    sentAlerts.set(alertKey, Date.now());
    
    console.log(`🔔 Алерт відправлено: ${user.telegram_id} (${type}, ${minutes} хв)`);
    
  } catch (error) {
    console.error(`Помилка відправки алерту користувачу ${user.telegram_id}:`, error.message);
  }
}

module.exports = {
  initAlerts,
  checkAlerts,
};
