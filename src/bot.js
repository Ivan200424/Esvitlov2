const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');

// Import handlers
const { handleStart, handleWizardCallback } = require('./handlers/start');
const { handleSchedule, handleNext, handleTimer } = require('./handlers/schedule');
const { handleSettings, handleSettingsCallback, handleIpConversation } = require('./handlers/settings');
const { 
  handleAdmin, 
  handleAdminCallback, 
  handleStats, 
  handleSystem, 
  handleBroadcast,
  handleSetInterval,
  handleSetDebounce,
  handleGetDebounce
} = require('./handlers/admin');
const { 
  handleChannel, 
  handleSetChannel, 
  handleConversation, 
  handleChannelCallback, 
  handleCancelChannel 
} = require('./handlers/channel');
const { getMainMenu, getHelpKeyboard, getStatisticsKeyboard, getSettingsKeyboard } = require('./keyboards/inline');
const { REGIONS } = require('./constants/regions');

// Create bot instance
const bot = new TelegramBot(config.botToken, { polling: true });

console.log('🤖 Telegram Bot ініціалізовано');

// Help messages (must be under 200 characters for show_alert: true)
const help_howto = `📖 Як користуватись:\n\n1. Обери регіон та чергу\n2. Підключи канал (опційно)\n3. Додай IP роутера (опційно)\n4. Готово! Бот сповіщатиме про відключення`;
const help_faq = `❓ Чому не приходять сповіщення?\n→ Перевір налаштування\n\n❓ Як працює IP моніторинг?\n→ Бот пінгує роутер для визначення наявності світла`;

// Command handlers
bot.onText(/^\/start$/, (msg) => handleStart(bot, msg));
bot.onText(/^\/schedule$/, (msg) => handleSchedule(bot, msg));
bot.onText(/^\/next$/, (msg) => handleNext(bot, msg));
bot.onText(/^\/timer$/, (msg) => handleTimer(bot, msg));
bot.onText(/^\/settings$/, (msg) => handleSettings(bot, msg));
bot.onText(/^\/channel$/, (msg) => handleChannel(bot, msg));
bot.onText(/^\/setchannel/, (msg) => handleSetChannel(bot, msg));
bot.onText(/^\/cancel$/, (msg) => handleCancelChannel(bot, msg));
bot.onText(/^\/admin$/, (msg) => handleAdmin(bot, msg));
bot.onText(/^\/stats$/, (msg) => handleStats(bot, msg));
bot.onText(/^\/system$/, (msg) => handleSystem(bot, msg));
bot.onText(/^\/broadcast (.+)/, (msg, match) => handleBroadcast(bot, msg, match));
bot.onText(/^\/setinterval (\d+)/, (msg, match) => handleSetInterval(bot, msg, match));
bot.onText(/^\/setdebounce (\d+)/, (msg, match) => handleSetDebounce(bot, msg, match));
bot.onText(/^\/getdebounce$/, (msg) => handleGetDebounce(bot, msg));

// Handle text button presses from main menu
bot.on('message', async (msg) => {
  // Skip if it's a command
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }
  
  const chatId = msg.chat.id;
  const text = msg.text;
  
  try {
    // Main menu buttons are now handled via inline keyboard callbacks
    // Keeping only conversation handlers for IP setup and channel setup
    
    // Try IP setup conversation first
    const ipHandled = await handleIpConversation(bot, msg);
    if (ipHandled) return;
    
    // Handle channel conversation
    await handleConversation(bot, msg);
    
  } catch (error) {
    console.error('Помилка обробки повідомлення:', error);
  }
});

// Handle callback queries
bot.on('callback_query', async (query) => {
  const data = query.data;
  
  try {
    // Wizard callbacks (region selection, group selection, etc.)
    if (data.startsWith('region_') || 
        data.startsWith('queue_') || 
        data === 'confirm_setup' ||
        data === 'back_to_region' ||
        data === 'restore_profile' ||
        data === 'create_new_profile') {
      await handleWizardCallback(bot, query);
      return;
    }
    
    // Menu callbacks
    if (data === 'menu_schedule') {
      await handleSchedule(bot, { ...query.message, from: query.from });
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'menu_timer') {
      // Show timer as popup instead of sending a new message
      try {
        const usersDb = require('./database/users');
        const { fetchScheduleData } = require('./api');
        const { parseScheduleForQueue, findNextEvent } = require('./parser');
        const { formatTimerMessage } = require('./formatter');
        
        const telegramId = String(query.from.id);
        const user = usersDb.getUserByTelegramId(telegramId);
        
        if (!user) {
          await bot.answerCallbackQuery(query.id, {
            text: '❌ Користувач не знайдений',
            show_alert: true
          });
          return;
        }
        
        const data = await fetchScheduleData(user.region);
        const scheduleData = parseScheduleForQueue(data, user.queue);
        const nextEvent = findNextEvent(scheduleData);
        
        const message = formatTimerMessage(nextEvent);
        // Remove HTML tags for popup
        const cleanMessage = message.replace(/<[^>]*>/g, '');
        
        await bot.answerCallbackQuery(query.id, {
          text: cleanMessage,
          show_alert: true
        });
      } catch (error) {
        console.error('Помилка отримання таймера:', error);
        await bot.answerCallbackQuery(query.id, {
          text: '😅 Щось пішло не так. Спробуй ще раз!',
          show_alert: true
        });
      }
      return;
    }

    if (data === 'menu_stats') {
      // Show statistics as popup
      try {
        const usersDb = require('./database/users');
        const { getWeeklyStats, formatStatsPopup } = require('./statistics');
        
        const telegramId = String(query.from.id);
        const user = usersDb.getUserByTelegramId(telegramId);
        
        if (!user) {
          await bot.answerCallbackQuery(query.id, {
            text: '❌ Користувач не знайдений',
            show_alert: true
          });
          return;
        }
        
        const stats = getWeeklyStats(user.id);
        const message = formatStatsPopup(stats);
        
        await bot.answerCallbackQuery(query.id, {
          text: message,
          show_alert: true
        });
      } catch (error) {
        console.error('Помилка отримання статистики:', error);
        await bot.answerCallbackQuery(query.id, {
          text: '😅 Щось пішло не так. Спробуй ще раз!',
          show_alert: true
        });
      }
      return;
    }

    if (data === 'menu_help') {
      await bot.editMessageText(
        '🤖 Допомога\n\nОберіть розділ:',
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: getHelpKeyboard().reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'menu_settings') {
      const usersDb = require('./database/users');
      const telegramId = String(query.from.id);
      const user = usersDb.getUserByTelegramId(telegramId);
      
      if (!user) {
        await bot.answerCallbackQuery(query.id, { text: '❌ Спочатку налаштуйте бота командою /start' });
        return;
      }
      
      const isAdmin = config.adminIds.includes(telegramId) || telegramId === config.ownerId;
      const region = REGIONS[user.region]?.name || user.region;
      
      await bot.editMessageText(
        `⚙️ <b>Налаштування</b>\n\n` +
        `📍 Регіон: ${region}\n` +
        `⚡️ Черга: ${user.queue}\n` +
        `📺 Канал: ${user.channel_id ? '✅' : '❌'}\n` +
        `🌐 IP: ${user.router_ip ? '✅' : '❌'}\n` +
        `🔔 Сповіщення: ${user.is_active ? '✅' : '❌'}\n\n` +
        `Обери опцію:`,
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getSettingsKeyboard(isAdmin).reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'menu_status') {
      // Show bot status as popup
      const usersDb = require('./database/users');
      const telegramId = String(query.from.id);
      const user = usersDb.getUserByTelegramId(telegramId);
      
      if (!user) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Користувач не знайдений',
          show_alert: true
        });
        return;
      }
      
      let statusMessage = '🟢 Бот активний\n\n';
      if (!user.channel_id) {
        statusMessage = '🟡 Бот працює, але канал не підключено\n\n';
      } else if (!user.is_active) {
        statusMessage = '🔴 Бот на паузі (сповіщення вимкнено)\n\n';
      }
      
      statusMessage += `📍 Регіон: ${REGIONS[user.region]?.name || user.region}\n`;
      statusMessage += `⚡ Черга: ${user.queue}\n`;
      statusMessage += `📺 Канал: ${user.channel_id ? '✅ Підключено' : '❌ Не підключено'}\n`;
      statusMessage += `🌐 IP моніторинг: ${user.router_ip ? '✅ Активний' : '❌ Не налаштовано'}\n`;
      statusMessage += `🔔 Сповіщення: ${user.is_active ? '✅ Увімкнено' : '❌ Вимкнено'}`;
      
      await bot.answerCallbackQuery(query.id, {
        text: statusMessage,
        show_alert: true
      });
      return;
    }

    if (data === 'back_to_main') {
      const usersDb = require('./database/users');
      const telegramId = String(query.from.id);
      const user = usersDb.getUserByTelegramId(telegramId);
      
      if (user) {
        const region = REGIONS[user.region]?.name || user.region;
        
        // Determine bot status
        let botStatus = 'active';
        if (!user.channel_id) {
          botStatus = 'no_channel';
        } else if (!user.is_active) {
          botStatus = 'paused';
        }
        
        await bot.editMessageText(
          `👋 Привіт! Я СвітлоЧек 🤖\n\n` +
          `📍 ${region} | Черга ${user.queue}\n` +
          `🔔 Сповіщення: ${user.is_active ? '✅' : '❌'}\n\n` +
          `Використовуй меню нижче:`,
          {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            reply_markup: getMainMenu(botStatus).reply_markup,
          }
        );
      }
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Settings callbacks
    if (data.startsWith('settings_') || 
        data.startsWith('alert_') ||
        data.startsWith('ip_') ||
        data === 'confirm_deactivate' ||
        data === 'confirm_delete_data' ||
        data === 'back_to_settings') {
      await handleSettingsCallback(bot, query);
      return;
    }
    
    // Admin callbacks
    if (data.startsWith('admin_')) {
      await handleAdminCallback(bot, query);
      return;
    }
    
    // Channel callbacks
    if (data.startsWith('channel_') ||
        data.startsWith('brand_') ||
        data.startsWith('changes_') ||
        data.startsWith('timer_')) {
      await handleChannelCallback(bot, query);
      return;
    }
    
    // Help callbacks
    if (data === 'help_howto') {
      await bot.answerCallbackQuery(query.id, {
        text: help_howto,
        show_alert: true
      });
      return;
    }
    
    if (data === 'help_faq') {
      await bot.answerCallbackQuery(query.id, {
        text: help_faq,
        show_alert: true
      });
      return;
    }
    
    // Statistics callbacks
    if (data.startsWith('stats_')) {
      const usersDb = require('./database/users');
      const { getWeeklyStats, formatStatsPopup } = require('./statistics');
      
      try {
        const telegramId = String(query.from.id);
        const user = usersDb.getUserByTelegramId(telegramId);
        
        if (!user) {
          await bot.answerCallbackQuery(query.id, {
            text: '❌ Користувач не знайдений',
            show_alert: true
          });
          return;
        }
        
        const stats = getWeeklyStats(user.id);
        const message = formatStatsPopup(stats);
        
        await bot.answerCallbackQuery(query.id, {
          text: message,
          show_alert: true
        });
      } catch (error) {
        console.error('Помилка отримання статистики:', error);
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Помилка отримання статистики',
          show_alert: true
        });
      }
      return;
    }
    
    // Default: just acknowledge
    await bot.answerCallbackQuery(query.id);
    
  } catch (error) {
    console.error('Помилка обробки callback query:', error);
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Виникла помилка',
      show_alert: false
    });
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Помилка polling:', error.message);
});

bot.on('error', (error) => {
  console.error('Помилка бота:', error.message);
});

module.exports = bot;
