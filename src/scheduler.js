const cron = require('node-cron');
const { fetchScheduleData } = require('./api');
const { parseScheduleForQueue, findNextEvent } = require('./parser');
const { calculateHash, formatInterval } = require('./utils');
const usersDb = require('./database/users');
const config = require('./config');
const { REGION_CODES } = require('./constants/regions');

let bot = null;

// Ініціалізація планувальника
function initScheduler(botInstance) {
  bot = botInstance;
  console.log('📅 Ініціалізація планувальника...');
  
  // Перевірка графіків - використовуємо секунди з конфігу
  const intervalSeconds = config.checkIntervalSeconds;
  
  // Якщо інтервал >= 60 секунд і ділиться на 60 націло, використовуємо cron в хвилинах
  // Інакше використовуємо setInterval
  if (intervalSeconds >= 60 && intervalSeconds % 60 === 0) {
    const intervalMinutes = intervalSeconds / 60;
    const cronExpression = `*/${intervalMinutes} * * * *`;
    
    cron.schedule(cronExpression, async () => {
      console.log(`🔄 Перевірка графіків... (кожні ${formatInterval(intervalSeconds)})`);
      await checkAllSchedules();
    });
  } else {
    // Для інтервалів < 60 секунд або не кратних 60, використовуємо setInterval
    setInterval(async () => {
      console.log(`🔄 Перевірка графіків... (кожні ${formatInterval(intervalSeconds)})`);
      await checkAllSchedules();
    }, intervalSeconds * 1000);
  }
  
  console.log(`✅ Планувальник запущено (перевірка кожні ${formatInterval(intervalSeconds)})`);
}

// Перевірка всіх графіків
async function checkAllSchedules() {
  try {
    for (const region of REGION_CODES) {
      await checkRegionSchedule(region);
    }
  } catch (error) {
    console.error('Помилка при перевірці графіків:', error);
  }
}

// Перевірка графіка конкретного регіону
async function checkRegionSchedule(region) {
  try {
    // Отримуємо дані для регіону
    const data = await fetchScheduleData(region);
    
    // Отримуємо всіх користувачів для цього регіону
    const users = usersDb.getUsersByRegion(region);
    
    if (users.length === 0) {
      return;
    }
    
    console.log(`Перевірка ${region}: знайдено ${users.length} користувачів`);
    
    for (const user of users) {
      try {
        await checkUserSchedule(user, data);
      } catch (error) {
        console.error(`Помилка перевірки графіка для користувача ${user.telegram_id}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error(`Помилка при перевірці графіка для ${region}:`, error.message);
  }
}

// Перевірка графіка для конкретного користувача
async function checkUserSchedule(user, data) {
  try {
    // Skip blocked channels
    if (user.channel_status === 'blocked') {
      console.log(`[${user.telegram_id}] Пропущено - канал заблоковано`);
      return;
    }
    
    const queueKey = `GPV${user.queue}`;
    
    // Отримуємо timestamps для сьогодні та завтра
    const availableTimestamps = Object.keys(data?.fact?.data || {}).map(Number).sort((a, b) => a - b);
    const todayTimestamp = availableTimestamps[0] || null;
    const tomorrowTimestamp = availableTimestamps.length > 1 ? availableTimestamps[1] : null;
    
    const newHash = calculateHash(data, queueKey, todayTimestamp, tomorrowTimestamp);
    
    // Перевіряємо чи хеш змінився з останньої перевірки
    const hasChanged = newHash !== user.last_hash;
    
    // ВАЖЛИВО: Якщо хеш не змінився - нічого не робимо (запобігає дублікатам при перезапуску)
    if (!hasChanged) {
      return;
    }
    
    // Перевіряємо чи графік вже опублікований з цим хешем
    if (newHash === user.last_published_hash) {
      // Оновлюємо last_hash для синхронізації
      usersDb.updateUserHash(user.id, newHash);
      return;
    }
    
    // Парсимо графік
    const scheduleData = parseScheduleForQueue(data, user.queue);
    const nextEvent = findNextEvent(scheduleData);
    
    // Отримуємо налаштування куди публікувати
    const notifyTarget = user.power_notify_target || 'both';
    
    console.log(`[${user.telegram_id}] Графік оновлено, публікуємо (target: ${notifyTarget})`);
    
    // Відправляємо в особистий чат користувача
    if (notifyTarget === 'bot' || notifyTarget === 'both') {
      try {
        const { formatScheduleMessage } = require('./formatter');
        const { fetchScheduleImage } = require('./api');
        
        const message = formatScheduleMessage(user.region, user.queue, scheduleData, nextEvent);
        
        // Спробуємо з фото
        try {
          const imageBuffer = await fetchScheduleImage(user.region, user.queue);
          await bot.sendPhoto(user.telegram_id, imageBuffer, {
            caption: message,
            parse_mode: 'HTML'
          }, { filename: 'schedule.png', contentType: 'image/png' });
        } catch (imgError) {
          // Без фото
          await bot.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
        }
        
        console.log(`📱 Графік відправлено користувачу ${user.telegram_id}`);
      } catch (error) {
        console.error(`Помилка відправки графіка користувачу ${user.telegram_id}:`, error.message);
      }
    }
    
    // Відправляємо в канал
    if (user.channel_id && (notifyTarget === 'channel' || notifyTarget === 'both')) {
      try {
        const { publishScheduleWithPhoto } = require('./publisher');
        const sentMsg = await publishScheduleWithPhoto(bot, user, user.region, user.queue);
        usersDb.updateUserPostId(user.id, sentMsg.message_id);
        console.log(`📢 Графік опубліковано в канал ${user.channel_id}`);
      } catch (channelError) {
        console.error(`Не вдалося відправити в канал ${user.channel_id}:`, channelError.message);
      }
    }
    
    // Оновлюємо хеші після публікації
    usersDb.updateUserHashes(user.id, newHash);
    
  } catch (error) {
    console.error(`Помилка checkUserSchedule для користувача ${user.telegram_id}:`, error);
  }
}

module.exports = {
  initScheduler,
  checkAllSchedules,
};
