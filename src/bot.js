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
const { getMainMenu, getHelpKeyboard, getStatisticsKeyboard, getSettingsKeyboard, getErrorKeyboard } = require('./keyboards/inline');
const { REGIONS } = require('./constants/regions');
const { formatErrorMessage } = require('./formatter');

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
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Skip if no text
  if (!text) return;
  
  // Check if it's an unknown command (starts with / but wasn't handled)
  if (text.startsWith('/')) {
    // List of known commands
    const knownCommands = [
      '/start', '/schedule', '/next', '/timer', '/settings', 
      '/channel', '/cancel', '/admin', '/stats', '/system',
      '/broadcast', '/setinterval', '/setdebounce', '/getdebounce'
    ];
    
    // Extract command without parameters
    const command = text.split(' ')[0].toLowerCase();
    
    // If it's not a known command, show error
    if (!knownCommands.includes(command)) {
      await bot.sendMessage(
        chatId,
        '❓ Невідома команда.\n\nДоступні команди:\n/start - Почати роботу з ботом',
        { parse_mode: 'HTML' }
      );
    }
    return;
  }
  
  try {
    // Main menu buttons are now handled via inline keyboard callbacks
    // Keeping only conversation handlers for IP setup and channel setup
    
    // Try IP setup conversation first
    const ipHandled = await handleIpConversation(bot, msg);
    if (ipHandled) return;
    
    // Handle channel conversation
    const channelHandled = await handleConversation(bot, msg);
    if (channelHandled) return;
    
    // If text was not handled by any conversation - show fallback message
    await bot.sendMessage(
      chatId,
      '❓ Не розумію вашу команду.\n\nВикористовуйте кнопки меню або напишіть /start',
      { parse_mode: 'HTML' }
    );
    
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
        data === 'create_new_profile' ||
        data === 'wizard_notify_bot' ||
        data === 'wizard_notify_channel' ||
        data === 'wizard_notify_back' ||
        data.startsWith('wizard_channel_confirm_')) {
      await handleWizardCallback(bot, query);
      return;
    }
    
    // Menu callbacks
    if (data === 'menu_schedule') {
      try {
        const usersDb = require('./database/users');
        const { fetchScheduleData, fetchScheduleImage } = require('./api');
        const { parseScheduleForQueue, findNextEvent } = require('./parser');
        const { formatScheduleMessage } = require('./formatter');
        
        const telegramId = String(query.from.id);
        const user = usersDb.getUserByTelegramId(telegramId);
        
        if (!user) {
          await bot.answerCallbackQuery(query.id, {
            text: '❌ Користувач не знайдений',
            show_alert: true
          });
          return;
        }
        
        // Get schedule data
        const data = await fetchScheduleData(user.region);
        const scheduleData = parseScheduleForQueue(data, user.queue);
        const nextEvent = findNextEvent(scheduleData);
        
        // Check if data exists
        if (!scheduleData || !scheduleData.events || scheduleData.events.length === 0) {
          await bot.editMessageText(
            '📊 <b>Графік</b>\n\n' +
            'ℹ️ Дані ще не опубліковані.\n' +
            'Спробуйте пізніше.',
            {
              chat_id: query.message.chat.id,
              message_id: query.message.message_id,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '⤴︎ Меню', callback_data: 'back_to_main' }]
                ]
              }
            }
          );
          await bot.answerCallbackQuery(query.id);
          return;
        }
        
        // Format message
        const message = formatScheduleMessage(user.region, user.queue, scheduleData, nextEvent);
        
        // Try to get and send image with edit
        try {
          const imageBuffer = await fetchScheduleImage(user.region, user.queue);
          
          // Delete the old message and send new one with photo
          await bot.deleteMessage(query.message.chat.id, query.message.message_id);
          await bot.sendPhoto(query.message.chat.id, imageBuffer, {
            caption: message,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⏱ Таймер', callback_data: 'menu_timer' },
                  { text: '⤴︎ Меню', callback_data: 'back_to_main' }
                ]
              ]
            }
          }, { filename: 'schedule.png', contentType: 'image/png' });
        } catch (imgError) {
          // If image unavailable, just edit text
          console.log('Schedule image unavailable:', imgError.message);
          await bot.editMessageText(
            message,
            {
              chat_id: query.message.chat.id,
              message_id: query.message.message_id,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '⏱ Таймер', callback_data: 'menu_timer' },
                    { text: '⤴︎ Меню', callback_data: 'back_to_main' }
                  ]
                ]
              }
            }
          );
        }
      } catch (error) {
        console.error('Помилка отримання графіка:', error);
        
        await bot.editMessageText(
          formatErrorMessage(),
          {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: getErrorKeyboard().reply_markup
          }
        );
      }
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
      
      // Build Live Status message
      let message = '';
      
      // Power status section
      const hasPowerState = user.power_state !== null && user.power_state !== undefined;
      const hasIp = user.router_ip !== null && user.router_ip !== undefined;
      const hasChannel = user.channel_id !== null && user.channel_id !== undefined;
      const notificationsEnabled = user.is_active && (user.alerts_off_enabled || user.alerts_on_enabled);
      
      if (!hasIp) {
        // No IP configured
        message += '⚪ Світло зараз: Невідомо\n\n';
      } else if (hasPowerState) {
        // Has IP and power state
        const powerOn = user.power_state === 'on';
        message += powerOn ? '🟢 Світло зараз: Є\n' : '🔴 Світло зараз: Немає\n';
        
        // Add update time if available
        if (user.power_changed_at) {
          const updateDate = new Date(user.power_changed_at);
          const hours = String(updateDate.getHours()).padStart(2, '0');
          const minutes = String(updateDate.getMinutes()).padStart(2, '0');
          message += `🕓 Оновлено: ${hours}:${minutes}\n\n`;
        } else {
          message += '\n';
        }
      } else {
        // Has IP but no power state yet
        message += '⚪ Світло зараз: Невідомо\n\n';
      }
      
      // Settings section
      message += `📍 ${region} · ${user.queue}\n`;
      message += `📡 IP: ${hasIp ? 'підключено' : 'не підключено'}\n`;
      
      // Special messages based on configuration
      if (!hasIp) {
        message += '⚠️ Налаштуйте IP для моніторингу світла\n';
      }
      
      message += `📺 Канал: ${hasChannel ? 'підключено' : 'не підключено'}\n`;
      
      if (!hasChannel && hasIp) {
        message += 'ℹ️ Сповіщення приходитимуть лише в бот\n';
      }
      
      message += `🔔 Сповіщення: ${notificationsEnabled ? 'увімкнено' : 'вимкнено'}\n`;
      
      // Monitoring active message
      if (hasIp && notificationsEnabled) {
        message += '\n✅ Моніторинг активний';
      }
      
      await bot.editMessageText(
        message,
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
        
        const channelPaused = user.channel_paused === 1;
        
        // Build main menu message with beta warning
        let message = '<b>🚧 Бот у розробці</b>\n';
        message += '<i>Деякі функції можуть працювати нестабільно</i>\n\n';
        message += '<i>Допоможіть нам стати краще!</i>\n';
        message += '<i>Натисніть ❓ Допомога → 💬 Обговорення/Підтримка</i>\n\n';
        message += '🏠 <b>Головне меню</b>\n\n';
        message += `📍 Регіон: ${region} • ${user.queue}\n`;
        message += `📺 Канал: ${user.channel_id ? user.channel_id + ' ✅' : 'не підключено'}\n`;
        message += `🔔 Сповіщення: ${user.is_active ? 'увімкнено ✅' : 'вимкнено'}\n`;
        
        // Try to edit message text first
        try {
          await bot.editMessageText(
            message,
            {
              chat_id: query.message.chat.id,
              message_id: query.message.message_id,
              parse_mode: 'HTML',
              reply_markup: getMainMenu(botStatus, channelPaused).reply_markup,
            }
          );
        } catch (error) {
          // If edit fails (e.g., message is a photo), delete and send new message
          try {
            await bot.deleteMessage(query.message.chat.id, query.message.message_id);
          } catch (deleteError) {
            // Ignore delete errors - message may already be deleted or inaccessible
          }
          await bot.sendMessage(
            query.message.chat.id,
            message,
            {
              parse_mode: 'HTML',
              ...getMainMenu(botStatus, channelPaused)
            }
          );
        }
      }
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Settings callbacks
    if (data.startsWith('settings_') || 
        data.startsWith('alert_') ||
        data.startsWith('ip_') ||
        data.startsWith('notify_target_') ||
        data.startsWith('schedule_alert_') ||
        data === 'confirm_deactivate' ||
        data === 'confirm_delete_data' ||
        data === 'delete_data_step2' ||
        data === 'back_to_settings') {
      await handleSettingsCallback(bot, query);
      return;
    }
    
    // Admin callbacks (including pause mode and debounce)
    if (data.startsWith('admin_') || data.startsWith('pause_') || data.startsWith('debounce_')) {
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
        
        const scheduleRawData = await fetchScheduleData(user.region);
        const scheduleData = parseScheduleForQueue(scheduleRawData, user.queue);
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
      await bot.editMessageText(
        '📖 <b>Як користуватися ботом:</b>\n\n' +
        '1. Оберіть регіон і чергу\n' +
        '2. Увімкніть сповіщення\n' +
        '3. (Опціонально) Підключіть канал\n' +
        '4. (Опціонально) Налаштуйте IP моніторинг\n\n' +
        'Бот автоматично сповістить про:\n' +
        '• Зміни в графіку\n' +
        '• Фактичні відключення (з IP)',
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '← Назад', callback_data: 'menu_help' }],
              [{ text: '⤴︎ Меню', callback_data: 'back_to_main' }]
            ]
          }
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'help_faq') {
      await bot.answerCallbackQuery(query.id, {
        text: help_faq,
        show_alert: true
      });
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
