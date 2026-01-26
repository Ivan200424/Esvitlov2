const { fetchScheduleData, fetchScheduleImage } = require('./api');
const { parseScheduleForQueue, findNextEvent } = require('./parser');
const { formatScheduleMessage } = require('./formatter');
const { getLastSchedule, getPreviousSchedule, addScheduleToHistory, compareSchedules } = require('./database/scheduleHistory');
const crypto = require('crypto');

// Публікувати графік з фото та кнопками
async function publishScheduleWithPhoto(bot, user, region, queue) {
  try {
    // Delete previous post if it exists
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
    if (previousSchedule && previousSchedule.hash !== scheduleHash) {
      changes = compareSchedules(previousSchedule.schedule_data, scheduleData);
      hasChanges = changes && (changes.added.length > 0 || changes.removed.length > 0 || changes.modified.length > 0);
    }
    
    // Форматуємо повідомлення
    const messageText = formatScheduleMessage(region, queue, scheduleData, nextEvent, changes);
    
    // Створюємо inline кнопки
    const buttons = [];
    
    // Add "Що змінилось" button if there are changes
    if (hasChanges) {
      buttons.push([
        { text: '🔍 Що змінилось', callback_data: `changes_${user.id}` },
        { text: '⏰ Таймер', callback_data: `timer_${user.id}` }
      ]);
    } else {
      buttons.push([
        { text: '⏰ Таймер', callback_data: `timer_${user.id}` }
      ]);
    }
    
    const inlineKeyboard = {
      inline_keyboard: buttons
    };
    
    try {
      // Завантажуємо зображення як Buffer
      const imageBuffer = await fetchScheduleImage(region, queue);
      
      // Відправляємо фото з підписом та кнопками
      const sentMessage = await bot.sendPhoto(user.channel_id, imageBuffer, {
        caption: messageText,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard
      }, { filename: 'schedule.png', contentType: 'image/png' });
      
      return sentMessage;
    } catch (imageError) {
      console.log(`Зображення недоступне для ${region}/${queue}, відправляємо тільки текст`);
      
      // Якщо не вдалося завантажити зображення, відправляємо тільки текст
      const sentMessage = await bot.sendMessage(user.channel_id, messageText, {
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard
      });
      
      return sentMessage;
    }
    
  } catch (error) {
    console.error('Помилка публікації графіка:', error);
    throw error;
  }
}

module.exports = {
  publishScheduleWithPhoto,
};
