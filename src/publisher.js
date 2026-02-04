const { fetchScheduleData, fetchScheduleImage } = require('./api');
const { parseScheduleForQueue, findNextEvent } = require('./parser');
const { formatScheduleMessage, formatTemplate } = require('./formatter');
const { getLastSchedule, getPreviousSchedule, addScheduleToHistory, compareSchedules } = require('./database/scheduleHistory');
const usersDb = require('./database/users');
const { REGIONS } = require('./constants/regions');
const crypto = require('crypto');

// Day name constants
const DAY_NAMES = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота'];
const SHORT_DAY_NAMES = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

// Helper function to get bot ID (cached in bot.options.id)
async function ensureBotId(bot) {
  if (!bot.options.id) {
    const botInfo = await bot.getMe();
    bot.options.id = botInfo.id;
  }
  return bot.options.id;
}

// Визначити тип оновлення графіка
function getUpdateType(previousSchedule, currentSchedule) {
  // Split events into today and tomorrow
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  
  // Get tomorrow events from current schedule
  const currentTomorrowEvents = currentSchedule.events ? currentSchedule.events.filter(event => {
    const eventStart = new Date(event.start);
    return eventStart >= tomorrowStart && eventStart < tomorrowEnd;
  }) : [];
  
  // Get tomorrow events from previous schedule
  const previousTomorrowEvents = previousSchedule && previousSchedule.events ? previousSchedule.events.filter(event => {
    const eventStart = new Date(event.start);
    return eventStart >= tomorrowStart && eventStart < tomorrowEnd;
  }) : [];
  
  // Get today events from current schedule
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);
  const currentTodayEvents = currentSchedule.events ? currentSchedule.events.filter(event => {
    const eventStart = new Date(event.start);
    return eventStart >= todayStart && eventStart <= todayEnd;
  }) : [];
  
  // Get today events from previous schedule
  const previousTodayEvents = previousSchedule && previousSchedule.events ? previousSchedule.events.filter(event => {
    const eventStart = new Date(event.start);
    return eventStart >= todayStart && eventStart <= todayEnd;
  }) : [];
  
  const hadTomorrow = previousTomorrowEvents.length > 0;
  const hasTomorrow = currentTomorrowEvents.length > 0;
  const todayChanged = JSON.stringify(previousTodayEvents) !== JSON.stringify(currentTodayEvents);
  
  return {
    tomorrowAppeared: !hadTomorrow && hasTomorrow,
    todayUpdated: todayChanged,
    todayUnchanged: !todayChanged,
  };
}

// Публікувати графік з фото та кнопками
async function publishScheduleWithPhoto(bot, user, region, queue) {
  try {
    // Check if channel is paused
    if (user.channel_paused) {
      console.log(`Канал користувача ${user.telegram_id} зупинено, пропускаємо публікацію графіка`);
      return;
    }
    
    // Validate channel before publishing
    try {
      // Check if channel exists and bot has access
      const chatInfo = await bot.getChat(user.channel_id);
      
      // Check if bot has necessary permissions
      const botId = await ensureBotId(bot);
      const botMember = await bot.getChatMember(user.channel_id, botId);
      
      if (botMember.status !== 'administrator' || !botMember.can_post_messages) {
        console.log(`Бот не має прав на публікацію в канал ${user.channel_id}, оновлюємо статус`);
        usersDb.updateChannelStatus(user.telegram_id, 'blocked');
        
        // Notify user about the issue
        try {
          await bot.sendMessage(
            user.telegram_id,
            `⚠️ <b>Канал недоступний</b>\n\n` +
            `Бот не має доступу до вашого каналу або прав на публікацію.\n\n` +
            `🔴 <b>Моніторинг зупинено.</b>\n\n` +
            `Переконайтесь, що бот є адміністратором з правами на публікацію,\n` +
            `і налаштуйте канал заново командою /setchannel`,
            { parse_mode: 'HTML' }
          );
        } catch (notifyError) {
          console.error(`Не вдалося повідомити користувача ${user.telegram_id}:`, notifyError.message);
        }
        
        return;
      }
    } catch (validationError) {
      // Channel not found or not accessible
      console.error(`Канал ${user.channel_id} недоступний:`, validationError.message);
      usersDb.updateChannelStatus(user.telegram_id, 'blocked');
      
      // Notify user about the issue
      try {
        await bot.sendMessage(
          user.telegram_id,
          `⚠️ <b>Канал недоступний</b>\n\n` +
          `Не вдалося отримати доступ до вашого каналу.\n` +
          `Можливо, бот був видалений або канал видалено.\n\n` +
          `🔴 <b>Моніторинг зупинено.</b>\n\n` +
          `Налаштуйте канал заново командою /setchannel`,
          { parse_mode: 'HTML' }
        );
      } catch (notifyError) {
        console.error(`Не вдалося повідомити користувача ${user.telegram_id}:`, notifyError.message);
      }
      
      return;
    }
    
    // Delete previous schedule message if delete_old_message is enabled
    if (user.delete_old_message && user.last_schedule_message_id) {
      try {
        await bot.deleteMessage(user.channel_id, user.last_schedule_message_id);
        console.log(`Видалено попереднє повідомлення ${user.last_schedule_message_id} з каналу ${user.channel_id}`);
      } catch (deleteError) {
        // Ignore errors if message was already deleted or doesn't exist
        console.log(`Не вдалося видалити попереднє повідомлення: ${deleteError.message}`);
      }
    }
    
    // Also delete previous post if it exists (legacy)
    if (user.last_post_id) {
      try {
        await bot.deleteMessage(user.channel_id, user.last_post_id);
        console.log(`Видалено попередній пост ${user.last_post_id} з каналу ${user.channel_id}`);
      } catch (deleteError) {
        // Ignore errors if message was already deleted or doesn't exist
        console.log(`Не вдалося видалити попередній пост: ${deleteError.message}`);
      }
    }
    
    // Отримуємо дані графіка
    const data = await fetchScheduleData(region);
    const scheduleData = parseScheduleForQueue(data, queue);
    const nextEvent = findNextEvent(scheduleData);
    
    // Calculate hash for schedule
    const scheduleHash = crypto.createHash('md5').update(JSON.stringify(scheduleData.events)).digest('hex');
    
    // Save schedule to history
    addScheduleToHistory(user.id, region, queue, scheduleData, scheduleHash);
    
    // Get previous schedule for comparison
    const previousSchedule = getPreviousSchedule(user.id);
    
    // Compare schedules if previous exists
    let hasChanges = false;
    let changes = null;
    let updateType = null;
    if (previousSchedule && previousSchedule.hash !== scheduleHash) {
      changes = compareSchedules(previousSchedule.schedule_data, scheduleData);
      hasChanges = changes && (changes.added.length > 0 || changes.removed.length > 0 || changes.modified.length > 0);
      updateType = getUpdateType(previousSchedule.schedule_data, scheduleData);
    }
    
    // Форматуємо повідомлення
    let messageText = formatScheduleMessage(region, queue, scheduleData, nextEvent, changes, updateType, true);
    
    // Apply custom caption template if set
    if (user.schedule_caption) {
      const now = new Date();
      
      const variables = {
        d: `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`,
        dm: `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}`,
        dd: 'сьогодні',
        sdw: SHORT_DAY_NAMES[now.getDay()],
        fdw: DAY_NAMES[now.getDay()],
        queue: queue,
        region: REGIONS[region]?.name || region
      };
      
      messageText = formatTemplate(user.schedule_caption, variables);
    }
    
    // Створюємо inline кнопки
    const buttons = [];
    
    // Always show the same buttons layout
    buttons.push([
      { text: '⏰ Таймер', callback_data: `timer_${user.id}` },
      { text: '📊 Статистика', callback_data: `stats_${user.id}` }
    ]);
    
    const inlineKeyboard = {
      inline_keyboard: buttons
    };
    
    let sentMessage;
    
    try {
      // Завантажуємо зображення як Buffer
      const imageBuffer = await fetchScheduleImage(region, queue);
      
      // Check if picture_only mode is enabled
      if (user.picture_only) {
        // Відправляємо тільки фото без підпису
        sentMessage = await bot.sendPhoto(user.channel_id, imageBuffer, {
          reply_markup: inlineKeyboard
        }, { filename: 'schedule.png', contentType: 'image/png' });
      } else {
        // Відправляємо фото з підписом та кнопками
        sentMessage = await bot.sendPhoto(user.channel_id, imageBuffer, {
          caption: messageText,
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard
        }, { filename: 'schedule.png', contentType: 'image/png' });
      }
    } catch (imageError) {
      console.log(`Зображення недоступне для ${region}/${queue}, відправляємо тільки текст`);
      
      // Якщо не вдалося завантажити зображення, відправляємо тільки текст
      sentMessage = await bot.sendMessage(user.channel_id, messageText, {
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard
      });
    }
    
    // Save the message_id for potential deletion later
    if (sentMessage && sentMessage.message_id) {
      usersDb.updateLastScheduleMessageId(user.telegram_id, sentMessage.message_id);
    }
    
    return sentMessage;
    
  } catch (error) {
    console.error('Помилка публікації графіка:', error);
    throw error;
  }
}

module.exports = {
  publishScheduleWithPhoto,
  getUpdateType,
};
