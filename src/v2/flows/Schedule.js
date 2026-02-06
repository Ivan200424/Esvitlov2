/**
 * Schedule Flow
 * 
 * NEW implementation for v2 bot rewrite.
 * Handles schedule and timer display.
 */

const { getScheduleKeyboard, getTimerKeyboard, getErrorKeyboard } = require('../keyboards/InlineKeyboard');
const { getUserData } = require('../migration/UserMigration');

/**
 * Show schedule to user
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {string} userId - User ID
 * @param {number} editMessageId - Message ID to edit (optional)
 */
async function showSchedule(bot, chatId, userId, editMessageId = null) {
  try {
    // Get user data
    const userData = getUserData(userId);
    
    if (!userData || !userData.region || !userData.queue) {
      const message = '⚠️ Спочатку налаштуйте регіон та чергу\nВведіть /start';
      
      if (editMessageId) {
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: editMessageId,
          parse_mode: 'HTML'
        });
      } else {
        await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
      }
      return;
    }

    // Fetch schedule data
    const { fetchScheduleData, fetchScheduleImage } = require('../../api');
    const { parseScheduleForQueue, findNextEvent } = require('../../parser');
    const { formatScheduleMessage } = require('../../formatter');

    const data = await fetchScheduleData(userData.region);
    const scheduleData = parseScheduleForQueue(data, userData.queue);
    const nextEvent = findNextEvent(scheduleData);

    // Check if data exists
    if (!scheduleData || !scheduleData.events || scheduleData.events.length === 0) {
      const message =
        '📊 <b>Графік</b>\n\n' +
        'ℹ️ Дані ще не опубліковані.\n' +
        'Спробуйте пізніше.';

      if (editMessageId) {
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: editMessageId,
          parse_mode: 'HTML',
          reply_markup: getScheduleKeyboard()
        });
      } else {
        await bot.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          reply_markup: getScheduleKeyboard()
        });
      }
      return;
    }

    // Format message
    const message = formatScheduleMessage(
      userData.region,
      userData.queue,
      scheduleData,
      nextEvent
    );

    // Try to get and send image
    try {
      const imageBuffer = await fetchScheduleImage(userData.region, userData.queue);

      if (editMessageId) {
        // Delete old message and send new one with photo
        await bot.deleteMessage(chatId, editMessageId);
      }

      await bot.sendPhoto(
        chatId,
        imageBuffer,
        {
          caption: message,
          parse_mode: 'HTML',
          reply_markup: getScheduleKeyboard()
        },
        { filename: 'schedule.png', contentType: 'image/png' }
      );
    } catch (imgError) {
      // If image unavailable, just send text
      console.log('Schedule image unavailable:', imgError.message);

      if (editMessageId) {
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: editMessageId,
          parse_mode: 'HTML',
          reply_markup: getScheduleKeyboard()
        });
      } else {
        await bot.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          reply_markup: getScheduleKeyboard()
        });
      }
    }
  } catch (error) {
    console.error('Error showing schedule:', error);

    const message = '❌ Помилка отримання графіка.\nСпробуйте пізніше.';

    if (editMessageId) {
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: editMessageId,
        parse_mode: 'HTML',
        reply_markup: getErrorKeyboard()
      });
    } else {
      await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: getErrorKeyboard()
      });
    }
  }
}

/**
 * Show timer to user
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {string} userId - User ID
 * @param {number} editMessageId - Message ID to edit (optional)
 */
async function showTimer(bot, chatId, userId, editMessageId = null) {
  try {
    // Get user data
    const userData = getUserData(userId);

    if (!userData || !userData.region || !userData.queue) {
      const message = '⚠️ Спочатку налаштуйте регіон та чергу\nВведіть /start';

      if (editMessageId) {
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: editMessageId,
          parse_mode: 'HTML'
        });
      } else {
        await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
      }
      return;
    }

    // Fetch schedule data
    const { fetchScheduleData } = require('../../api');
    const { parseScheduleForQueue, findNextEvent } = require('../../parser');
    const { formatTimerMessage } = require('../../formatter');

    const data = await fetchScheduleData(userData.region);
    const scheduleData = parseScheduleForQueue(data, userData.queue);
    const nextEvent = findNextEvent(scheduleData);

    // Format timer message
    const message = formatTimerMessage(nextEvent);

    if (editMessageId) {
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: editMessageId,
        parse_mode: 'HTML',
        reply_markup: getTimerKeyboard()
      });
    } else {
      await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: getTimerKeyboard()
      });
    }
  } catch (error) {
    console.error('Error showing timer:', error);

    const message = '❌ Помилка отримання таймера.\nСпробуйте пізніше.';

    if (editMessageId) {
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: editMessageId,
        parse_mode: 'HTML',
        reply_markup: getErrorKeyboard()
      });
    } else {
      await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: getErrorKeyboard()
      });
    }
  }
}

/**
 * Handle schedule callback queries
 * @param {Object} bot - Telegram bot instance
 * @param {Object} query - Callback query
 */
async function handleScheduleCallback(bot, query) {
  const action = query.data.replace('schedule:', '').replace('timer:', '');
  const chatId = query.message.chat.id;
  const userId = String(query.from.id);

  switch (action) {
    case 'refresh':
      if (query.data.startsWith('schedule:')) {
        await showSchedule(bot, chatId, userId, query.message.message_id);
      } else {
        await showTimer(bot, chatId, userId, query.message.message_id);
      }
      break;

    case 'timer':
      await showTimer(bot, chatId, userId, query.message.message_id);
      break;

    case 'schedule':
      await showSchedule(bot, chatId, userId, query.message.message_id);
      break;

    default:
      await bot.answerCallbackQuery(query.id, {
        text: '❓ Невідома дія',
        show_alert: false
      });
  }
}

module.exports = {
  showSchedule,
  showTimer,
  handleScheduleCallback
};
