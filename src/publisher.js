const { fetchScheduleData, getImageUrl } = require('./api');
const { parseScheduleForQueue, findNextEvent } = require('./parser');
const { formatScheduleMessage } = require('./formatter');
const axios = require('axios');

// Публікувати графік з фото та кнопками
async function publishScheduleWithPhoto(bot, user, region, queue) {
  try {
    // Отримуємо дані графіка
    const data = await fetchScheduleData(region);
    const scheduleData = parseScheduleForQueue(data, queue);
    const nextEvent = findNextEvent(scheduleData);
    
    // Форматуємо повідомлення
    const messageText = formatScheduleMessage(region, queue, scheduleData, nextEvent);
    
    // Створюємо inline кнопки
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '⏰ Таймер', callback_data: `timer_${user.id}` },
          { text: '📊 Статистика', callback_data: `stats_${user.id}` }
        ]
      ]
    };
    
    // Отримуємо URL зображення
    const imageUrl = getImageUrl(region, queue);
    
    try {
      // Спробуємо завантажити зображення
      const response = await axios.get(imageUrl, { 
        responseType: 'arraybuffer',
        timeout: 10000,
        validateStatus: (status) => status === 200
      });
      
      // Перевірка що це дійсно зображення
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error('Response is not an image');
      }
      
      const imageBuffer = Buffer.from(response.data);
      
      // Відправляємо фото з підписом та кнопками
      const sentMessage = await bot.sendPhoto(user.channel_id, imageBuffer, {
        caption: messageText,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard
      });
      
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
