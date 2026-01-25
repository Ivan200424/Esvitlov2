const cron = require('node-cron');
const { fetchScheduleData, getImageUrl } = require('./api');
const { parseScheduleForQueue, findNextEvent } = require('./parser');
const { formatScheduleMessage, formatScheduleUpdateMessage } = require('./formatter');
const { calculateHash } = require('./utils');
const usersDb = require('./database/users');
const config = require('./config');
const { REGION_CODES } = require('./constants/regions');

let bot = null;

// Ініціалізація планувальника
function initScheduler(botInstance) {
  bot = botInstance;
  console.log('📅 Ініціалізація планувальника...');
  
  // Перевірка графіків кожні 3 хвилини (або згідно конфігу)
  const interval = config.checkIntervalMinutes;
  const cronExpression = `*/${interval} * * * *`;
  
  cron.schedule(cronExpression, async () => {
    console.log(`🔄 Перевірка графіків... (кожні ${interval} хв)`);
    await checkAllSchedules();
  });
  
  console.log(`✅ Планувальник запущено (перевірка кожні ${interval} хв)`);
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
    
    // Якщо хеш не змінився, графік не оновлювався
    if (newHash === user.last_hash) {
      return;
    }
    
    console.log(`Графік оновлено для користувача ${user.telegram_id} (${user.region}, ${user.queue})`);
    
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
        
      } catch (channelError) {
        console.error(`Не вдалося відправити в канал ${user.channel_id}:`, channelError.message);
      }
    }
    
    // Оновлюємо хеш
    usersDb.updateUserHash(user.id, newHash);
    
  } catch (error) {
    console.error(`Помилка checkUserSchedule для користувача ${user.telegram_id}:`, error);
  }
}

module.exports = {
  initScheduler,
  checkAllSchedules,
};
