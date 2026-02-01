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
const { getMainMenu, getHelpKeyboard, getStatisticsKeyboard } = require('./keyboards/inline');

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
    // Handle main menu buttons
    switch (text) {
      case '📊 Графік':
      case '📋 Графік':
        await handleSchedule(bot, msg);
        break;
        
      case '⏱ Таймер':
      case '⏰ Таймер':
        await handleTimer(bot, msg);
        break;
        
      case '💡 Статус':
      case '⏭ Наступна подія':
        await handleNext(bot, msg);
        break;
        
      case '📈 Статистика':
      case '📊 Статистика':
        await bot.sendMessage(
          chatId,
          '📊 Статистика\n\nОберіть розділ:',
          getStatisticsKeyboard()
        );
        break;
        
      case '⚙️ Налаштування':
        // Clear any pending IP setup state
        const { ipSetupStates } = require('./handlers/settings');
        const telegramId = String(msg.from.id);
        const ipState = ipSetupStates.get(telegramId);
        if (ipState && ipState.timeout) {
          clearTimeout(ipState.timeout);
          ipSetupStates.delete(telegramId);
        }
        
        await handleSettings(bot, msg);
        break;
        
      case '❓ Допомога':
      case '❔ Допомога':
        await bot.sendMessage(
          chatId,
          '🤖 Допомога\n\nОберіть розділ:',
          getHelpKeyboard()
        );
        break;
        
      case '📊 Статистика':
        await bot.sendMessage(
          chatId,
          '📊 Статистика\n\nОберіть розділ:',
          getStatisticsKeyboard()
        );
        break;
        
      default:
        // Try IP setup conversation first
        const ipHandled = await handleIpConversation(bot, msg);
        if (ipHandled) break;
        
        // Handle channel conversation
        await handleConversation(bot, msg);
        break;
    }
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
    
    // Settings callbacks
    if (data.startsWith('settings_') || 
        data.startsWith('alert_') ||
        data.startsWith('ip_') ||
        data === 'confirm_deactivate' ||
        data === 'confirm_delete_data' ||
        data === 'back_to_settings' ||
        data === 'back_to_main') {
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
        data.startsWith('confirm_') ||
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
