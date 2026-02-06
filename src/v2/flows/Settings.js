/**
 * Settings Flow
 * 
 * NEW implementation for v2 bot rewrite.
 * Handles user settings and preferences.
 */

const { getSettingsKeyboard, getNavigationKeyboard } = require('../keyboards/InlineKeyboard');
const { getUserData } = require('../migration/UserMigration');

/**
 * Show settings menu
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {string} userId - User ID
 * @param {number} editMessageId - Message ID to edit (optional)
 */
async function showSettings(bot, chatId, userId, editMessageId = null) {
  const message =
    '⚙️ <b>Налаштування</b>\n\n' +
    'Оберіть розділ для налаштування:';

  const keyboard = getSettingsKeyboard();

  try {
    if (editMessageId) {
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: editMessageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    } else {
      await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    }
  } catch (error) {
    console.error('Error showing settings:', error);
  }
}

/**
 * Show region and queue settings
 */
async function showRegionQueueSettings(bot, query) {
  const userId = String(query.from.id);
  const userData = getUserData(userId);

  if (!userData) {
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Користувач не знайдений',
      show_alert: true
    });
    return;
  }

  const { REGIONS } = require('../../constants/regions');
  const regionName = REGIONS[userData.region] || userData.region;

  const message =
    '📍 <b>Регіон та черга</b>\n\n' +
    `📍 <b>Регіон:</b> ${regionName}\n` +
    `⚡️ <b>Черга:</b> ${userData.queue}\n\n` +
    'Для зміни регіону або черги\n' +
    'скористайтесь командою /reset';

  await bot.editMessageText(message, {
    chat_id: query.message.chat.id,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: getNavigationKeyboard('settings:back')
  });
}

/**
 * Show notification settings
 */
async function showNotificationSettings(bot, query) {
  const userId = String(query.from.id);
  const userData = getUserData(userId);

  if (!userData) {
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Користувач не знайдений',
      show_alert: true
    });
    return;
  }

  let notifyText = 'У бот';
  if (userData.power_notify_target === 'channel') {
    notifyText = 'У канал';
  } else if (userData.power_notify_target === 'both') {
    notifyText = 'У бот і канал';
  }

  const message =
    '🔔 <b>Налаштування сповіщень</b>\n\n' +
    `📍 <b>Куди надсилати:</b> ${notifyText}\n\n` +
    'Налаштування сповіщень можна змінити\n' +
    'під час повторного проходження /reset';

  await bot.editMessageText(message, {
    chat_id: query.message.chat.id,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: getNavigationKeyboard('settings:back')
  });
}

/**
 * Show IP monitoring settings
 */
async function showIpMonitoringSettings(bot, query) {
  const userId = String(query.from.id);
  const userData = getUserData(userId);

  if (!userData) {
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Користувач не знайдений',
      show_alert: true
    });
    return;
  }

  let message;
  if (userData.router_ip) {
    message =
      '🌐 <b>IP моніторинг</b>\n\n' +
      `✅ <b>Статус:</b> Увімкнено\n` +
      `📍 <b>IP адреса:</b> ${userData.router_ip}\n\n` +
      'Бот відстежує доступність вашого\n' +
      'роутера для визначення наявності світла.';
  } else {
    message =
      '🌐 <b>IP моніторинг</b>\n\n' +
      `❌ <b>Статус:</b> Вимкнено\n\n` +
      'IP моніторинг дозволяє боту визначати\n' +
      'наявність світла за доступністю вашого\n' +
      'роутера.\n\n' +
      'Для налаштування зверніться до адміна.';
  }

  await bot.editMessageText(message, {
    chat_id: query.message.chat.id,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: getNavigationKeyboard('settings:back')
  });
}

/**
 * Show channel settings
 */
async function showChannelSettings(bot, query) {
  const userId = String(query.from.id);
  const userData = getUserData(userId);

  if (!userData) {
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Користувач не знайдений',
      show_alert: true
    });
    return;
  }

  let message;
  if (userData.channel_id) {
    message =
      '📢 <b>Налаштування каналу</b>\n\n' +
      `✅ <b>Статус:</b> Підключено\n` +
      `📍 <b>Канал:</b> ${userData.channel_title || 'Не вказано'}\n\n` +
      'Бот публікує графіки та сповіщення\n' +
      'у ваш канал.';
  } else {
    message =
      '📢 <b>Налаштування каналу</b>\n\n' +
      `❌ <b>Статус:</b> Не підключено\n\n` +
      'Підключіть канал для автоматичної\n' +
      'публікації графіків та сповіщень.\n\n' +
      'Функція поки що недоступна.';
  }

  await bot.editMessageText(message, {
    chat_id: query.message.chat.id,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: getNavigationKeyboard('settings:back')
  });
}

/**
 * Show format settings
 */
async function showFormatSettings(bot, query) {
  const message =
    '🎨 <b>Формат повідомлень</b>\n\n' +
    'Налаштування формату повідомлень\n' +
    'поки що недоступні.\n\n' +
    'Використовується стандартний формат.';

  await bot.editMessageText(message, {
    chat_id: query.message.chat.id,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: getNavigationKeyboard('settings:back')
  });
}

/**
 * Handle settings callback queries
 * @param {Object} bot - Telegram bot instance
 * @param {Object} query - Callback query
 */
async function handleSettingsCallback(bot, query) {
  const action = query.data.replace('settings:', '');
  const chatId = query.message.chat.id;
  const userId = String(query.from.id);

  switch (action) {
    case 'region_queue':
      await showRegionQueueSettings(bot, query);
      break;

    case 'notifications':
      await showNotificationSettings(bot, query);
      break;

    case 'ip_monitoring':
      await showIpMonitoringSettings(bot, query);
      break;

    case 'channel':
      await showChannelSettings(bot, query);
      break;

    case 'format':
      await showFormatSettings(bot, query);
      break;

    case 'back':
      await showSettings(bot, chatId, userId, query.message.message_id);
      break;

    default:
      await bot.answerCallbackQuery(query.id, {
        text: '❓ Невідома дія',
        show_alert: false
      });
  }
}

module.exports = {
  showSettings,
  handleSettingsCallback
};
