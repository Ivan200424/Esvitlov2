/**
 * Main Menu UI
 * 
 * NEW implementation for v2 bot rewrite.
 * 
 * Main menu is text-based and shows user status.
 * Uses Reply keyboard for navigation (always visible).
 * Uses Inline keyboard for quick actions.
 */

const { getMainReplyKeyboard } = require('../keyboards/ReplyKeyboard');
const { getMainMenuInlineKeyboard } = require('../keyboards/InlineKeyboard');
const { getUserConfigSummary } = require('../migration/UserMigration');
const { REGIONS } = require('../../constants/regions');

/**
 * Format main menu message
 * @param {Object} config - User configuration
 * @returns {string} - Formatted message
 */
function formatMainMenuMessage(config) {
  let message = '🏠 <b>Головне меню</b>\n\n';

  if (config.configured) {
    // Show region and queue
    const regionName = REGIONS[config.region] || config.region;
    message += `📍 <b>Регіон:</b> ${regionName}\n`;
    message += `⚡️ <b>Черга:</b> ${config.queue}\n\n`;

    // Show channel status
    if (config.hasChannel) {
      message += `📢 <b>Канал:</b> підключено\n`;
      if (config.channelTitle) {
        message += `   ${config.channelTitle}\n`;
      }
    } else {
      message += `📢 <b>Канал:</b> не підключено\n`;
    }

    // Show IP monitoring status
    if (config.hasRouterIp) {
      message += `🌐 <b>IP моніторинг:</b> увімкнено\n`;
      message += `   ${config.routerIp}\n`;
    } else {
      message += `🌐 <b>IP моніторинг:</b> вимкнено\n`;
    }

    // Show notification status
    const notifyTarget = config.notificationSettings.powerNotifyTarget;
    let targetText = 'у бот';
    if (notifyTarget === 'channel') {
      targetText = 'у канал';
    } else if (notifyTarget === 'both') {
      targetText = 'у бот і канал';
    }
    message += `\n🔔 <b>Сповіщення:</b> ${targetText}\n`;

    // Show power state if IP monitoring is active
    if (config.hasRouterIp && config.powerState.currentState) {
      const stateIcon = config.powerState.currentState === 'on' ? '✅' : '❌';
      const stateText = config.powerState.currentState === 'on' ? 'Є' : 'Немає';
      message += `\n💡 <b>Світло зараз:</b> ${stateIcon} ${stateText}\n`;
    }
  } else {
    message += '⚠️ Налаштування не завершені\n';
    message += 'Використайте /start для налаштування';
  }

  return message;
}

/**
 * Show main menu to user
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {string} userId - User ID
 * @param {number} editMessageId - Message ID to edit (optional)
 */
async function showMainMenu(bot, chatId, userId, editMessageId = null) {
  try {
    // Get user configuration
    const config = getUserConfigSummary(userId);

    // Format message
    const message = formatMainMenuMessage(config);

    // Get keyboards
    const replyKeyboard = getMainReplyKeyboard();
    const inlineKeyboard = getMainMenuInlineKeyboard(config.hasChannel);

    // Send or edit message
    if (editMessageId) {
      try {
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: editMessageId,
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard
        });
      } catch (error) {
        // If edit fails, send new message
        await bot.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          reply_markup: {
            ...inlineKeyboard,
            ...replyKeyboard
          }
        });
      }
    } else {
      await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: {
          ...inlineKeyboard,
          ...replyKeyboard
        }
      });
    }
  } catch (error) {
    console.error('Error showing main menu:', error);
    await bot.sendMessage(
      chatId,
      '❌ Помилка відображення меню.\nСпробуйте ще раз: /start',
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Handle main menu inline button callbacks
 * @param {Object} bot - Telegram bot instance
 * @param {Object} query - Callback query
 */
async function handleMainMenuCallback(bot, query) {
  const action = query.data.replace('main:', '');
  const chatId = query.message.chat.id;
  const userId = String(query.from.id);

  switch (action) {
    case 'menu':
      await showMainMenu(bot, chatId, userId, query.message.message_id);
      break;

    case 'schedule':
      const { showSchedule } = require('../flows/Schedule');
      await showSchedule(bot, chatId, userId, query.message.message_id);
      break;

    case 'timer':
      const { showTimer } = require('../flows/Schedule');
      await showTimer(bot, chatId, userId, query.message.message_id);
      break;

    case 'statistics':
      const { showStatistics } = require('../flows/Statistics');
      await showStatistics(bot, chatId, userId, query.message.message_id);
      break;

    case 'help':
      const { showHelp } = require('./Help');
      await showHelp(bot, chatId, userId, query.message.message_id);
      break;

    case 'settings':
      const { showSettings } = require('../flows/Settings');
      await showSettings(bot, chatId, userId, query.message.message_id);
      break;

    case 'pause':
      // TODO: Implement channel pause
      await bot.answerCallbackQuery(query.id, {
        text: '⏸ Канал призупинено',
        show_alert: false
      });
      break;

    default:
      await bot.answerCallbackQuery(query.id, {
        text: '❓ Невідома дія',
        show_alert: false
      });
  }
}

module.exports = {
  formatMainMenuMessage,
  showMainMenu,
  handleMainMenuCallback
};
