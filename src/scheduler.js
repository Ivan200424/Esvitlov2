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
    
    // Відправляємо оновлення в особисті повідомлення
    try {
      const message = formatScheduleUpdateMessage(user.region, user.queue);
      await bot.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
      
      // Відправляємо графік
      const scheduleMessage = formatScheduleMessage(user.region, user.queue, scheduleData, nextEvent);
      await bot.sendMessage(user.telegram_id, scheduleMessage, { parse_mode: 'HTML' });
      
      // Спробуємо відправити зображення
      try {
        const imageUrl = getImageUrl(user.region, user.queue);
        await bot.sendPhoto(user.telegram_id, imageUrl, {
          caption: `📊 Оновлений графік для GPV${user.queue}`,
        });
      } catch (imgError) {
        // Ігноруємо помилки з зображенням
      }
      
    } catch (msgError) {
      console.error(`Не вдалося відправити повідомлення користувачу ${user.telegram_id}:`, msgError.message);
    }
    
    // Якщо є канал, відправляємо туди
    if (user.channel_id) {
      try {
        const message = formatScheduleUpdateMessage(user.region, user.queue);
        await bot.sendMessage(user.channel_id, message, { parse_mode: 'HTML' });
        
        const scheduleMessage = formatScheduleMessage(user.region, user.queue, scheduleData, nextEvent);
        const sentMsg = await bot.sendMessage(user.channel_id, scheduleMessage, { parse_mode: 'HTML' });
        
        // Зберігаємо ID останнього поста
        usersDb.updateUserPostId(user.id, sentMsg.message_id);
        
        // Спробуємо відправити зображення
        try {
          const imageUrl = getImageUrl(user.region, user.queue);
          await bot.sendPhoto(user.channel_id, imageUrl, {
            caption: `📊 Оновлений графік для GPV${user.queue}`,
          });
        } catch (imgError) {
          // Ігноруємо помилки з зображенням
        }
        
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
