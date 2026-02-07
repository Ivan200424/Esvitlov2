// Schedule module - handles schedule commands
import * as storage from '../../services/storage.js';
import * as scheduleService from '../../services/schedules.js';
import * as parser from '../../services/parser.js';
import * as formatter from '../../services/formatter.js';
import { REGIONS } from '../../config/constants.js';
import * as keyboards from '../../ui/keyboards/inline.js';
import { InputFile } from 'grammy';

export async function handleSchedule(ctx) {
  const telegramId = String(ctx.from.id);
  
  try {
    const user = storage.getUserByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply('❌ Спочатку налаштуйте бота за допомогою /start');
      return;
    }
    
    const scheduleData = await scheduleService.fetchScheduleData(user.region);
    const parsedData = parser.parseScheduleForQueue(scheduleData, user.queue);
    const nextEvent = parser.getNextEvent(parsedData);
    const regionName = REGIONS[user.region]?.name || user.region;
    
    if (!parsedData.hasData) {
      await ctx.reply(
        `📊 Графік для ${regionName}, черга ${user.queue}\n\n` +
        'ℹ️ Немає даних про відключення',
        keyboards.getMainMenu()
      );
      return;
    }
    
    // Format and send schedule message
    const message = formatter.formatScheduleMessage(
      user.region,
      user.queue,
      parsedData,
      nextEvent
    );
    
    // Try to fetch and send image
    try {
      const imageBuffer = await scheduleService.fetchScheduleImage(user.region, user.queue);
      const imageFile = new InputFile(Buffer.from(imageBuffer));
      
      await ctx.replyWithPhoto(imageFile, {
        caption: message,
        parse_mode: 'HTML',
        ...keyboards.getMainMenu()
      });
    } catch (imageError) {
      // If image fails, send text only
      console.log('Image fetch failed, sending text only');
      await ctx.reply(message, {
        parse_mode: 'HTML',
        ...keyboards.getMainMenu()
      });
    }
  } catch (error) {
    console.error('Error in handleSchedule:', error);
    await ctx.reply('❌ Помилка отримання графіка', keyboards.getErrorKeyboard());
  }
}

export async function handleNext(ctx) {
  const telegramId = String(ctx.from.id);
  
  try {
    const user = storage.getUserByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply('❌ Спочатку налаштуйте бота за допомогою /start');
      return;
    }
    
    const scheduleData = await scheduleService.fetchScheduleData(user.region);
    const parsedData = parser.parseScheduleForQueue(scheduleData, user.queue);
    const nextEvent = parser.getNextEvent(parsedData);
    
    if (!nextEvent) {
      await ctx.reply(
        '⏱ <b>Наступне відключення</b>\n\n' +
        'ℹ️ Запланованих відключень немає',
        {
          parse_mode: 'HTML',
          ...keyboards.getMainMenu()
        }
      );
      return;
    }
    
    const message = formatter.formatNextEventMessage(nextEvent);
    await ctx.reply(message, {
      parse_mode: 'HTML',
      ...keyboards.getMainMenu()
    });
  } catch (error) {
    console.error('Error in handleNext:', error);
    await ctx.reply('❌ Помилка', keyboards.getErrorKeyboard());
  }
}

export async function handleTimer(ctx) {
  const telegramId = String(ctx.from.id);
  
  try {
    const user = storage.getUserByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply('❌ Спочатку налаштуйте бота за допомогою /start');
      return;
    }
    
    const scheduleData = await scheduleService.fetchScheduleData(user.region);
    const parsedData = parser.parseScheduleForQueue(scheduleData, user.queue);
    const nextEvent = parser.getNextEvent(parsedData);
    
    if (!nextEvent) {
      await ctx.reply(
        '⏱ <b>Таймер</b>\n\n' +
        'ℹ️ Запланованих відключень немає',
        {
          parse_mode: 'HTML',
          ...keyboards.getMainMenu()
        }
      );
      return;
    }
    
    const message = formatter.formatTimerMessage(nextEvent);
    await ctx.reply(message, {
      parse_mode: 'HTML',
      ...keyboards.getMainMenu()
    });
  } catch (error) {
    console.error('Error in handleTimer:', error);
    await ctx.reply('❌ Помилка', keyboards.getErrorKeyboard());
  }
}
