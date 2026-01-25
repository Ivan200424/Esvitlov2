const usersDb = require('../database/users');
const { fetchScheduleData, fetchScheduleImage } = require('../api');
const { parseScheduleForQueue, findNextEvent } = require('../parser');
const { formatScheduleMessage, formatNextEventMessage, formatTimerMessage } = require('../formatter');

// Обробник команди /schedule
async function handleSchedule(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  
  try {
    // Отримуємо користувача
    const user = usersDb.getUserByTelegramId(telegramId);
    
    if (!user) {
      await bot.sendMessage(chatId, '❌ Спочатку налаштуйте бота командою /start');
      return;
    }
    
    // Показуємо індикатор завантаження
    await bot.sendChatAction(chatId, 'typing');
    
    // Отримуємо дані графіка
    const data = await fetchScheduleData(user.region);
    const scheduleData = parseScheduleForQueue(data, user.queue);
    const nextEvent = findNextEvent(scheduleData);
    
    // Форматуємо та відправляємо повідомлення
    const message = formatScheduleMessage(user.region, user.queue, scheduleData, nextEvent);
    
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    
    // Спробуємо відправити зображення графіка
    try {
      const imageBuffer = await fetchScheduleImage(user.region, user.queue);
      await bot.sendPhoto(chatId, imageBuffer, {
        caption: `📊 Графік для черги ${user.queue}`,
      }, { filename: 'schedule.png', contentType: 'image/png' });
    } catch (imgError) {
      // Якщо зображення недоступне, просто ігноруємо
      console.log('Зображення графіка недоступне:', imgError.message);
    }
    
  } catch (error) {
    console.error('Помилка в handleSchedule:', error);
    await bot.sendMessage(chatId, '❌ Не вдалося отримати графік. Спробуйте пізніше.');
  }
}

// Обробник команди /next
async function handleNext(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  
  try {
    const user = usersDb.getUserByTelegramId(telegramId);
    
    if (!user) {
      await bot.sendMessage(chatId, '❌ Спочатку налаштуйте бота командою /start');
      return;
    }
    
    await bot.sendChatAction(chatId, 'typing');
    
    const data = await fetchScheduleData(user.region);
    const scheduleData = parseScheduleForQueue(data, user.queue);
    const nextEvent = findNextEvent(scheduleData);
    
    const message = formatNextEventMessage(nextEvent);
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Помилка в handleNext:', error);
    await bot.sendMessage(chatId, '❌ Не вдалося отримати інформацію. Спробуйте пізніше.');
  }
}

// Обробник команди /timer
async function handleTimer(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  
  try {
    const user = usersDb.getUserByTelegramId(telegramId);
    
    if (!user) {
      await bot.sendMessage(chatId, '❌ Спочатку налаштуйте бота командою /start');
      return;
    }
    
    await bot.sendChatAction(chatId, 'typing');
    
    const data = await fetchScheduleData(user.region);
    const scheduleData = parseScheduleForQueue(data, user.queue);
    const nextEvent = findNextEvent(scheduleData);
    
    const message = formatTimerMessage(nextEvent);
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Помилка в handleTimer:', error);
    await bot.sendMessage(chatId, '❌ Не вдалося отримати інформацію. Спробуйте пізніше.');
  }
}

module.exports = {
  handleSchedule,
  handleNext,
  handleTimer,
};
