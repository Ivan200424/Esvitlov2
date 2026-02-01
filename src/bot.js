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

// Store pending channel connections
const pendingChannels = new Map();

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
        '❓ <b>Допомога</b>\n\n' +
        'ℹ️ Тут ви можете дізнатися як\n' +
        'користуватися ботом.',
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
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
      
      // Determine bot status
      let botStatusIcon = '🟢';
      let botStatusText = 'Активний';
      if (!user.channel_id) {
        botStatusIcon = '🟡';
        botStatusText = 'Без каналу';
      } else if (!user.is_active) {
        botStatusIcon = '🔴';
        botStatusText = 'Пауза';
      }
      
      await bot.editMessageText(
        `⚙️ <b>Налаштування</b>\n\n` +
        `📍 Регіон: ${region}\n` +
        `⚡ Черга: ${user.queue}\n` +
        `📺 Канал: ${user.channel_id ? '✅ ' + user.channel_id : '❌ Не підключено'}\n` +
        `🌐 IP: ${user.router_ip ? '✅ ' + user.router_ip : '❌ Не налаштовано'}\n` +
        `🔔 Сповіщення: ${user.is_active ? '✅ Увімкнено' : '❌ Вимкнено'}\n` +
        `🤖 Статус: ${botStatusIcon} ${botStatusText}\n\n` +
        `ℹ️ Керуйте регіоном і чергою,\n` +
        `сповіщеннями, IP-моніторингом та каналом.`,
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
    
    // Admin callbacks (including pause mode)
    if (data.startsWith('admin_') || data.startsWith('pause_')) {
      await handleAdminCallback(bot, query);
      return;
    }
    
    // Handle inline button callbacks from channel schedule messages
    // These callbacks include user_id like: changes_123, timer_123, stats_123
    if (data.startsWith('changes_')) {
      try {
        const userId = parseInt(data.replace('changes_', ''));
        const usersDb = require('./database/users');
        const { getPreviousSchedule, getLastSchedule, compareSchedules } = require('./database/scheduleHistory');
        const { formatScheduleChanges } = require('./formatter');
        
        const user = usersDb.getUserById(userId);
        if (!user) {
          await bot.answerCallbackQuery(query.id, {
            text: '❌ Користувач не знайдений',
            show_alert: true
          });
          return;
        }
        
        const previousSchedule = getPreviousSchedule(userId);
        const lastSchedule = getLastSchedule(userId);
        
        if (!previousSchedule || !lastSchedule) {
          await bot.answerCallbackQuery(query.id, {
            text: '📊 Зміни в графіку:\n\nНемає попереднього графіка для порівняння',
            show_alert: true
          });
          return;
        }
        
        const changes = compareSchedules(previousSchedule.schedule_data, lastSchedule.schedule_data);
        
        if (!changes || (!changes.added.length && !changes.removed.length && !changes.modified.length)) {
          await bot.answerCallbackQuery(query.id, {
            text: '📊 Зміни в графіку:\n\nНемає змін',
            show_alert: true
          });
          return;
        }
        
        // Format changes message according to the new requirements
        const { formatTime } = require('./utils');
        const lines = [];
        lines.push('📊 Зміни в графіку:');
        lines.push('');
        
        // Added events
        if (changes.added.length > 0) {
          lines.push('🔴 Додано нове відключення:');
          changes.added.forEach(event => {
            const start = formatTime(event.start);
            const end = formatTime(event.end);
            lines.push(`• ${start}–${end}`);
          });
          lines.push('');
        }
        
        // Removed events
        if (changes.removed.length > 0) {
          lines.push('🟢 Скасовано:');
          changes.removed.forEach(event => {
            const start = formatTime(event.start);
            const end = formatTime(event.end);
            lines.push(`• ${start}–${end}`);
          });
          lines.push('');
        }
        
        // Modified events
        if (changes.modified.length > 0) {
          lines.push('🔄 Час змінено:');
          changes.modified.forEach(({ old, new: newEvent }) => {
            const oldStart = formatTime(old.start);
            const oldEnd = formatTime(old.end);
            const newStart = formatTime(newEvent.start);
            const newEnd = formatTime(newEvent.end);
            lines.push(`• ${oldStart}–${oldEnd} → ${newStart}–${newEnd}`);
          });
          lines.push('');
        }
        
        // Add summary if available
        if (changes.summary) {
          lines.push(`⏱ У підсумку: ${changes.summary}`);
        }
        
        const message = lines.join('\n');
        
        await bot.answerCallbackQuery(query.id, {
          text: message,
          show_alert: true
        });
      } catch (error) {
        console.error('Помилка обробки changes callback:', error);
        await bot.answerCallbackQuery(query.id, {
          text: '😅 Щось пішло не так. Спробуй ще раз!',
          show_alert: true
        });
      }
      return;
    }
    
    if (data.startsWith('timer_')) {
      try {
        const userId = parseInt(data.replace('timer_', ''));
        const usersDb = require('./database/users');
        const { fetchScheduleData } = require('./api');
        const { parseScheduleForQueue, findNextEvent } = require('./parser');
        const { formatTime } = require('./utils');
        
        const user = usersDb.getUserById(userId);
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
        
        // Format timer message according to the new requirements
        const lines = [];
        lines.push('⏱ Таймер');
        lines.push('');
        
        if (!nextEvent) {
          // No outages today
          lines.push('🎉 Сьогодні без відключень!');
          lines.push('');
          
          // Try to show tomorrow's schedule
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
          const tomorrowEnd = new Date(tomorrowStart);
          tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
          
          const tomorrowEvents = scheduleData.events.filter(event => {
            const eventStart = new Date(event.start);
            return eventStart >= tomorrowStart && eventStart < tomorrowEnd;
          });
          
          if (tomorrowEvents.length > 0) {
            lines.push('📅 Завтра:');
            tomorrowEvents.forEach(event => {
              const start = formatTime(event.start);
              const end = formatTime(event.end);
              lines.push(`• ${start}–${end}`);
            });
          } else {
            lines.push('ℹ️ Дані на завтра ще не опубліковані');
          }
        } else if (nextEvent.type === 'power_off') {
          // Light is currently on
          lines.push('🟢 Світло зараз є');
          lines.push('');
          
          const hours = Math.floor(nextEvent.minutes / 60);
          const mins = nextEvent.minutes % 60;
          let timeStr = '';
          if (hours > 0) {
            timeStr = `${hours} год`;
            if (mins > 0) timeStr += ` ${mins} хв`;
          } else {
            timeStr = `${mins} хв`;
          }
          
          lines.push(`⏳ Вимкнення через ${timeStr}`);
          const start = formatTime(nextEvent.time);
          const end = nextEvent.endTime ? formatTime(nextEvent.endTime) : '?';
          lines.push(`📅 Очікуємо: ${start}–${end}`);
          
          // Show other outages today
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const todayEnd = new Date(todayStart);
          todayEnd.setHours(23, 59, 59, 999);
          
          const otherOutages = scheduleData.events.filter(event => {
            const eventStart = new Date(event.start);
            return eventStart > new Date(nextEvent.time) && 
                   eventStart >= todayStart && 
                   eventStart <= todayEnd;
          });
          
          if (otherOutages.length > 0) {
            lines.push('');
            lines.push('Інші відключення сьогодні:');
            otherOutages.forEach(event => {
              const start = formatTime(event.start);
              const end = formatTime(event.end);
              lines.push(`• ${start}–${end}`);
            });
          }
        } else {
          // Light is currently off
          lines.push('🔴 Світла немає');
          lines.push('');
          
          const hours = Math.floor(nextEvent.minutes / 60);
          const mins = nextEvent.minutes % 60;
          let timeStr = '';
          if (hours > 0) {
            timeStr = `${hours} год`;
            if (mins > 0) timeStr += ` ${mins} хв`;
          } else {
            timeStr = `${mins} хв`;
          }
          
          lines.push(`⏳ До увімкнення: ${timeStr}`);
          const start = nextEvent.startTime ? formatTime(nextEvent.startTime) : '?';
          const end = formatTime(nextEvent.time);
          lines.push(`📅 Поточне: ${start}–${end}`);
        }
        
        const message = lines.join('\n');
        
        await bot.answerCallbackQuery(query.id, {
          text: message,
          show_alert: true
        });
      } catch (error) {
        console.error('Помилка обробки timer callback:', error);
        await bot.answerCallbackQuery(query.id, {
          text: '😅 Щось пішло не так. Спробуй ще раз!',
          show_alert: true
        });
      }
      return;
    }
    
    if (data.startsWith('stats_')) {
      try {
        const userId = parseInt(data.replace('stats_', ''));
        const usersDb = require('./database/users');
        const { getWeeklyStats } = require('./statistics');
        
        const user = usersDb.getUserById(userId);
        if (!user) {
          await bot.answerCallbackQuery(query.id, {
            text: '❌ Користувач не знайдений',
            show_alert: true
          });
          return;
        }
        
        const stats = getWeeklyStats(userId);
        
        // Format stats message according to the new requirements
        const lines = [];
        lines.push('📈 Статистика за 7 днів');
        lines.push('');
        
        if (stats.count === 0) {
          lines.push('📊 Дані ще не зібрані');
          lines.push('ℹ️ Статистика з\'явиться після першого');
          lines.push('зафіксованого відключення.');
          lines.push('');
          lines.push('💡 Підключіть IP-моніторинг для');
          lines.push('автоматичного збору даних.');
        } else {
          const totalHours = Math.floor(stats.totalMinutes / 60);
          const totalMins = stats.totalMinutes % 60;
          const avgHours = Math.floor(stats.avgMinutes / 60);
          const avgMins = stats.avgMinutes % 60;
          
          lines.push(`⚡ Відключень: ${stats.count}`);
          
          let totalStr = '';
          if (totalHours > 0) {
            totalStr = `${totalHours} год`;
            if (totalMins > 0) totalStr += ` ${totalMins} хв`;
          } else {
            totalStr = `${totalMins} хв`;
          }
          lines.push(`⏱ Без світла: ${totalStr}`);
          
          let avgStr = '';
          if (avgHours > 0) {
            avgStr = `${avgHours} год`;
            if (avgMins > 0) avgStr += ` ${avgMins} хв`;
          } else {
            avgStr = `${avgMins} хв`;
          }
          lines.push(`📈 Середнє: ${avgStr}`);
        }
        
        const message = lines.join('\n');
        
        await bot.answerCallbackQuery(query.id, {
          text: message,
          show_alert: true
        });
      } catch (error) {
        console.error('Помилка обробки stats callback:', error);
        await bot.answerCallbackQuery(query.id, {
          text: '😅 Щось пішло не так. Спробуй ще раз!',
          show_alert: true
        });
      }
      return;
    }
    
    // Channel callbacks (including auto-connect, test, and format)
    if (data.startsWith('channel_') ||
        data.startsWith('brand_') ||
        data.startsWith('test_') ||
        data.startsWith('format_')) {
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

// Handle my_chat_member events for auto-connecting channels
bot.on('my_chat_member', async (update) => {
  try {
    const chat = update.chat;
    const newStatus = update.new_chat_member.status;
    const oldStatus = update.old_chat_member.status;
    const userId = update.from.id; // User who added the bot
    
    // Перевіряємо що це канал і бот став адміном
    if (chat.type !== 'channel') return;
    if (newStatus !== 'administrator') return;
    if (oldStatus === 'administrator') return; // Вже був адміном
    
    const channelId = String(chat.id);
    const channelUsername = chat.username ? `@${chat.username}` : chat.title;
    const usersDb = require('./database/users');
    
    // Перевіряємо чи канал вже зайнятий іншим користувачем
    const existingUser = usersDb.getUserByChannelId(channelId);
    if (existingUser) {
      // Канал вже зайнятий - повідомляємо користувача
      console.log(`Channel ${channelId} already connected to user ${existingUser.telegram_id}`);
      
      try {
        await bot.sendMessage(
          userId,
          '⚠️ <b>Канал вже підключений</b>\n\n' +
          `Канал "${chat.title}" вже підключено до іншого користувача.\n\n` +
          'Кожен канал може бути підключений тільки до одного облікового запису.\n\n' +
          'Якщо це ваш канал — зверніться до підтримки.',
          { parse_mode: 'HTML' }
        );
      } catch (error) {
        console.error('Error sending occupied channel notification:', error);
      }
      return;
    }
    
    // Зберігаємо pending channel для підтвердження
    // Користувач має написати боту щоб підтвердити
    pendingChannels.set(channelId, {
      channelId,
      channelUsername,
      channelTitle: chat.title,
      timestamp: Date.now()
    });
    
    console.log(`Bot added as admin to channel: ${channelUsername} (${channelId}) by user ${userId}`);
    
  } catch (error) {
    console.error('Error in my_chat_member handler:', error);
  }
});

module.exports = bot;
module.exports.pendingChannels = pendingChannels;
