const cron = require('node-cron');
const { fetchScheduleData, getImageUrl } = require('./api');
const { parseScheduleForQueue, findNextEvent } = require('./parser');
const { formatScheduleMessage, formatScheduleUpdateMessage } = require('./formatter');
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
    const queueKey = `GPV${user.queue}`;
    const newHash = calculateHash(data, queueKey);
    
    // Діагностичне логування
    console.log(`[${user.telegram_id}] Перевірка хешів: current=${newHash}, last_hash=${user.last_hash}, last_published_hash=${user.last_published_hash}`);
    
    // Перевіряємо чи графік вже опублікований з цим хешем
    if (newHash === user.last_published_hash) {
      console.log(`[${user.telegram_id}] Графік вже опублікований, пропускаємо`);
      // Графік вже опублікований, оновлюємо тільки last_hash якщо потрібно
      if (newHash !== user.last_hash) {
        usersDb.updateUserHash(user.id, newHash);
      }
      return;
    }
    
    // Перевіряємо чи хеш змінився з останньої перевірки
    const hasChanged = newHash !== user.last_hash;
    
    // Якщо є канал - публікуємо (графік ще не опублікований, бо пройшли перевірку вище)
    if (user.channel_id) {
      if (hasChanged) {
        console.log(`[${user.telegram_id}] Графік оновлено, публікуємо`);
      } else {
        console.log(`[${user.telegram_id}] Графік не змінився, але не був опублікований раніше - публікуємо`);
      }
    } else {
      // Немає каналу, тільки оновлюємо хеш якщо змінився
      if (!hasChanged) {
        return;
      }
      console.log(`[${user.telegram_id}] Графік оновлено (без каналу)`);
    }
    
    // Парсимо графік
    const scheduleData = parseScheduleForQueue(data, user.queue);
    const nextEvent = findNextEvent(scheduleData);
    
    // Якщо є канал, відправляємо туди
    if (user.channel_id) {
      try {
        const { publishScheduleWithPhoto } = require('./publisher');
        
        // Публікуємо графік з фото та кнопками
        const sentMsg = await publishScheduleWithPhoto(bot, user, user.region, user.queue);
        
        // Зберігаємо ID останнього поста
        usersDb.updateUserPostId(user.id, sentMsg.message_id);
        
        // Оновлюємо обидва хеші після успішної публікації
        usersDb.updateUserHashes(user.id, newHash);
        
      } catch (channelError) {
        console.error(`Не вдалося відправити в канал ${user.channel_id}:`, channelError.message);
        // Оновлюємо тільки last_hash, але не last_published_hash
        usersDb.updateUserHash(user.id, newHash);
      }
    } else {
      // Немає каналу, оновлюємо обидва хеші
      usersDb.updateUserHashes(user.id, newHash);
    }
    
  } catch (error) {
    console.error(`Помилка checkUserSchedule для користувача ${user.telegram_id}:`, error);
  }
}

module.exports = {
  initScheduler,
  checkAllSchedules,
};
