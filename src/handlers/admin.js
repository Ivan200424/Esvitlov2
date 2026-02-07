const usersDb = require('../database/users');
const { getAdminKeyboard, getAdminIntervalsKeyboard, getScheduleIntervalKeyboard, getIpIntervalKeyboard, getGrowthKeyboard, getGrowthStageKeyboard, getGrowthRegistrationKeyboard } = require('../keyboards/inline');
const { isAdmin, formatUptime, formatMemory, formatInterval } = require('../utils');
const config = require('../config');
const { REGIONS } = require('../constants/regions');
const { getSetting, setSetting } = require('../database/db');
const { safeSendMessage, safeEditMessageText } = require('../utils/errorHandler');
const { 
  getCurrentStage, 
  setGrowthStage, 
  getGrowthMetrics, 
  getStageSpecificMetrics, 
  isRegistrationEnabled, 
  setRegistrationEnabled,
  getRecentGrowthEvents,
  checkGrowthHealth,
  GROWTH_STAGES
} = require('../growthMetrics');

// Обробник команди /admin
async function handleAdmin(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await safeSendMessage(bot, chatId, '❓ Невідома команда. Використовуйте /start для початку.');
    return;
  }
  
  try {
    await safeSendMessage(
      bot,
      chatId,
      '👨‍💼 <b>Адмін панель</b>\n\nОберіть опцію:',
      {
        parse_mode: 'HTML',
        ...getAdminKeyboard(),
      }
    );
  } catch (error) {
    console.error('Помилка в handleAdmin:', error);
    await safeSendMessage(bot, chatId, '❌ Виникла помилка.');
  }
}

// Обробник команди /stats
async function handleStats(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await safeSendMessage(bot, chatId, '❓ Невідома команда. Використовуйте /start для початку.');
    return;
  }
  
  try {
    // Use new analytics module
    const { formatAnalytics } = require('../analytics');
    const message = formatAnalytics();
    
    await safeSendMessage(bot, chatId, message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Помилка в handleStats:', error);
    await safeSendMessage(bot, chatId, '❌ Виникла помилка.');
  }
}

// Обробник команди /users
async function handleUsers(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.api.sendMessage(chatId, '❓ Невідома команда. Використовуйте /start для початку.');
    return;
  }
  
  try {
    const users = usersDb.getRecentUsers(20);
    
    if (users.length === 0) {
      await bot.api.sendMessage(chatId, 'ℹ️ Користувачів не знайдено.');
      return;
    }
    
    let message = '👥 <b>Останні 20 користувачів:</b>\n\n';
    
    users.forEach((user, index) => {
      const regionName = REGIONS[user.region]?.name || user.region;
      const status = user.is_active ? '✅' : '❌';
      const channel = user.channel_id ? '📺' : '';
      
      message += `${index + 1}. ${status} @${user.username || 'без username'}\n`;
      message += `   ${regionName}, Черга ${user.queue} ${channel}\n`;
      message += `   ID: <code>${user.telegram_id}</code>\n\n`;
    });
    
    await bot.api.sendMessage(chatId, message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Помилка в handleUsers:', error);
    const { getAdminMenuKeyboard } = require('../keyboards/inline');
    await bot.api.sendMessage(
      chatId, 
      '❌ Виникла помилка.\n\nОберіть наступну дію:',
      getAdminMenuKeyboard()
    );
  }
}

// Обробник команди /broadcast
async function handleBroadcast(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.api.sendMessage(chatId, '❓ Невідома команда. Використовуйте /start для початку.');
    return;
  }
  
  try {
    // Отримуємо текст повідомлення (після /broadcast)
    const text = msg.text.replace('/broadcast', '').trim();
    
    if (!text) {
      await bot.api.sendMessage(
        chatId,
        '❌ Використання: /broadcast <повідомлення>\n\nПриклад:\n/broadcast Важливе оновлення!'
      );
      return;
    }
    
    const users = usersDb.getAllActiveUsers();
    
    if (users.length === 0) {
      await bot.api.sendMessage(chatId, 'ℹ️ Немає активних користувачів.');
      return;
    }
    
    await bot.api.sendMessage(chatId, `📤 Розсилка повідомлення ${users.length} користувачам...`);
    
    let sent = 0;
    let failed = 0;
    
    for (const user of users) {
      try {
        await bot.api.sendMessage(user.telegram_id, `📢 <b>Повідомлення від адміністрації:</b>\n\n${text}`, {
          parse_mode: 'HTML',
        });
        sent++;
        
        // Затримка для уникнення rate limit
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`Помилка відправки користувачу ${user.telegram_id}:`, error.message);
        failed++;
      }
    }
    
    await bot.api.sendMessage(
      chatId,
      `✅ Розсилка завершена!\n\n` +
      `Відправлено: ${sent}\n` +
      `Помилок: ${failed}`
    );
    
  } catch (error) {
    console.error('Помилка в handleBroadcast:', error);
    const { getAdminMenuKeyboard } = require('../keyboards/inline');
    await bot.api.sendMessage(
      chatId, 
      '❌ Виникла помилка при розсилці.\n\nОберіть наступну дію:',
      getAdminMenuKeyboard()
    );
  }
}

// Обробник команди /system
async function handleSystem(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.api.sendMessage(chatId, '❓ Невідома команда. Використовуйте /start для початку.');
    return;
  }
  
  try {
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    
    let message = '💻 <b>Інформація про систему</b>\n\n';
    message += `⏱ Uptime: ${formatUptime(uptime)}\n`;
    message += `📊 Memory (RSS): ${formatMemory(memory.rss)}\n`;
    message += `📊 Memory (Heap): ${formatMemory(memory.heapUsed)} / ${formatMemory(memory.heapTotal)}\n`;
    message += `📊 Node.js: ${process.version}\n`;
    message += `📊 Platform: ${process.platform}\n\n`;
    
    // Railway environment info
    if (process.env.RAILWAY_ENVIRONMENT) {
      message += '<b>Railway:</b>\n';
      message += `Environment: ${process.env.RAILWAY_ENVIRONMENT}\n`;
      message += `Project: ${process.env.RAILWAY_PROJECT_NAME || 'N/A'}\n`;
      message += `Service: ${process.env.RAILWAY_SERVICE_NAME || 'N/A'}\n`;
    }
    
    await bot.api.sendMessage(chatId, message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Помилка в handleSystem:', error);
    const { getAdminMenuKeyboard } = require('../keyboards/inline');
    await bot.api.sendMessage(
      chatId, 
      '❌ Виникла помилка.\n\nОберіть наступну дію:',
      getAdminMenuKeyboard()
    );
  }
}

// Обробник admin callback
async function handleAdminCallback(bot, query) {
  const chatId = query.message.chat.id;
  const userId = String(query.from.id);
  const data = query.data;
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.api.answerCallbackQuery(query.id, { text: '❌ Немає прав' });
    return;
  }
  
  try {
    if (data === 'admin_stats') {
      // Use new analytics module
      const { formatAnalytics } = require('../analytics');
      const message = formatAnalytics();
      
      await safeEditMessageText(bot, message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '← Назад', callback_data: 'admin_menu' },
              { text: '⤴ Меню', callback_data: 'back_to_main' }
            ]
          ]
        },
      });
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'admin_users') {
      const users = usersDb.getRecentUsers(10);
      
      if (users.length === 0) {
        await bot.api.answerCallbackQuery(query.id, { text: 'Користувачів не знайдено' });
        return;
      }
      
      let message = '👥 <b>Останні користувачі:</b>\n\n';
      
      users.forEach((user, index) => {
        const regionName = REGIONS[user.region]?.name || user.region;
        const channelIcon = user.channel_id ? ' 📺' : '';
        const ipIcon = user.router_ip ? ' 📡' : '';
        
        message += `${index + 1}. @${user.username || 'без username'} • ${regionName} ${user.queue}${channelIcon}${ipIcon}\n`;
      });
      
      await safeEditMessageText(bot, message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getAdminKeyboard().reply_markup,
      });
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'admin_broadcast') {
      await safeEditMessageText(bot, 
        '📢 <b>Розсилка повідомлення</b>\n\n' +
        'Для розсилки використовуйте команду:\n' +
        '<code>/broadcast Ваше повідомлення</code>\n\n' +
        'Приклад:\n' +
        '<code>/broadcast Важливе оновлення! Нова версія бота.</code>\n\n' +
        'Повідомлення буде відправлено всім активним користувачам.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getAdminKeyboard().reply_markup,
        }
      );
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'admin_system') {
      const uptime = process.uptime();
      const memory = process.memoryUsage();
      
      let message = '💻 <b>Інформація про систему</b>\n\n';
      message += `⏱ Uptime: ${formatUptime(uptime)}\n`;
      message += `📊 Memory (RSS): ${formatMemory(memory.rss)}\n`;
      message += `📊 Memory (Heap): ${formatMemory(memory.heapUsed)} / ${formatMemory(memory.heapTotal)}\n`;
      message += `📊 Node.js: ${process.version}\n`;
      message += `📊 Platform: ${process.platform}\n\n`;
      
      if (process.env.RAILWAY_ENVIRONMENT) {
        message += '<b>Railway:</b>\n';
        message += `Environment: ${process.env.RAILWAY_ENVIRONMENT}\n`;
      }
      
      await safeEditMessageText(bot, message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getAdminKeyboard().reply_markup,
      });
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    // Admin intervals menu
    if (data === 'admin_intervals') {
      const scheduleInterval = parseInt(getSetting('schedule_check_interval', '60'), 10);
      const ipInterval = parseInt(getSetting('power_check_interval', '2'), 10);
      
      const scheduleMinutes = Math.round(scheduleInterval / 60);
      const ipFormatted = formatInterval(ipInterval);
      
      await safeEditMessageText(bot, 
        '⏱️ <b>Налаштування інтервалів</b>\n\n' +
        `⏱ Інтервал перевірки графіків: ${scheduleMinutes} хв\n` +
        `📡 Інтервал IP моніторингу: ${ipFormatted}\n\n` +
        'Оберіть, що хочете змінити:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getAdminIntervalsKeyboard(scheduleMinutes, ipFormatted).reply_markup,
        }
      );
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    // Admin menu callback (back from intervals)
    if (data === 'admin_menu') {
      await safeEditMessageText(bot, 
        '🔧 <b>Адмін-панель</b>',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getAdminKeyboard().reply_markup,
        }
      );
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    // Show schedule interval options
    if (data === 'admin_interval_schedule') {
      await safeEditMessageText(bot, 
        '⏱ <b>Інтервал перевірки графіків</b>\n\n' +
        'Як часто бот має перевіряти оновлення графіків?\n\n' +
        'Оберіть інтервал:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getScheduleIntervalKeyboard().reply_markup,
        }
      );
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    // Show IP interval options
    if (data === 'admin_interval_ip') {
      await safeEditMessageText(bot, 
        '📡 <b>Інтервал IP моніторингу</b>\n\n' +
        'Як часто бот має перевіряти доступність IP?\n\n' +
        'Оберіть інтервал:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getIpIntervalKeyboard().reply_markup,
        }
      );
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    // Set schedule interval
    if (data.startsWith('admin_schedule_')) {
      const minutes = parseInt(data.replace('admin_schedule_', ''), 10);
      const seconds = minutes * 60;
      
      setSetting('schedule_check_interval', String(seconds));
      
      await bot.api.answerCallbackQuery(query.id, {
        text: `✅ Інтервал графіків: ${minutes} хв. Перезапустіть бота.`,
        show_alert: true
      });
      
      // Return to intervals menu
      const scheduleInterval = parseInt(getSetting('schedule_check_interval', '60'), 10);
      const ipInterval = parseInt(getSetting('power_check_interval', '2'), 10);
      
      const scheduleMinutes = Math.round(scheduleInterval / 60);
      const ipFormatted = formatInterval(ipInterval);
      
      await safeEditMessageText(bot, 
        '⏱️ <b>Налаштування інтервалів</b>\n\n' +
        `⏱ Інтервал перевірки графіків: ${scheduleMinutes} хв\n` +
        `📡 Інтервал IP моніторингу: ${ipFormatted}\n\n` +
        'Оберіть, що хочете змінити:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getAdminIntervalsKeyboard(scheduleMinutes, ipFormatted).reply_markup,
        }
      );
      return;
    }
    
    // Set IP interval
    if (data.startsWith('admin_ip_')) {
      const seconds = parseInt(data.replace('admin_ip_', ''), 10);
      
      setSetting('power_check_interval', String(seconds));
      
      const formatted = formatInterval(seconds);
      await bot.api.answerCallbackQuery(query.id, {
        text: `✅ Інтервал IP: ${formatted}. Перезапустіть бота.`,
        show_alert: true
      });
      
      // Return to intervals menu
      const scheduleInterval = parseInt(getSetting('schedule_check_interval', '60'), 10);
      const ipInterval = parseInt(getSetting('power_check_interval', '2'), 10);
      
      const scheduleMinutes = Math.round(scheduleInterval / 60);
      const ipFormatted = formatInterval(ipInterval);
      
      await safeEditMessageText(bot, 
        '⏱️ <b>Налаштування інтервалів</b>\n\n' +
        `⏱ Інтервал перевірки графіків: ${scheduleMinutes} хв\n` +
        `📡 Інтервал IP моніторингу: ${ipFormatted}\n\n` +
        'Оберіть, що хочете змінити:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getAdminIntervalsKeyboard(scheduleMinutes, ipFormatted).reply_markup,
        }
      );
      return;
    }
    
    // Pause mode handlers
    if (data === 'admin_pause') {
      const isPaused = getSetting('bot_paused', '0') === '1';
      const pauseMessage = getSetting('pause_message', '🔧 Бот тимчасово недоступний. Спробуйте пізніше.');
      const showSupport = getSetting('pause_show_support', '1') === '1';
      
      const statusIcon = isPaused ? '🔴' : '🟢';
      const statusText = isPaused ? 'Бот на паузі' : 'Бот активний';
      
      const { getPauseMenuKeyboard } = require('../keyboards/inline');
      
      await safeEditMessageText(bot, 
        '⏸️ <b>Режим паузи</b>\n\n' +
        `Статус: <b>${statusIcon} ${statusText}</b>\n\n` +
        'При паузі:\n' +
        '• ❌ Блокується підключення нових каналів\n' +
        '• ✅ Все інше працює\n' +
        '• 📢 Показується повідомлення користувачам\n\n' +
        (isPaused ? `Поточне повідомлення:\n"${pauseMessage}"` : ''),
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getPauseMenuKeyboard(isPaused).reply_markup
        }
      );
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'pause_status') {
      // Just ignore - this is the status indicator
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'pause_toggle') {
      const isPaused = getSetting('bot_paused', '0') === '1';
      const newState = isPaused ? '0' : '1';
      setSetting('bot_paused', newState);
      
      // Track pause mode change in monitoring
      try {
        const metricsCollector = require('../monitoring/metricsCollector');
        metricsCollector.trackStateTransition(
          newState === '1' ? 'pause_mode_on' : 'pause_mode_off',
          { 
            userId: telegramId,
            timestamp: new Date().toISOString()
          }
        );
      } catch (e) {
        // Monitoring not available
      }
      
      // Log the pause event
      const { logPauseEvent } = require('../database/pauseLog');
      const pauseType = getSetting('pause_type', 'update'); // default to update
      
      logPauseEvent(
        telegramId,
        newState === '1' ? 'pause' : 'resume',
        newState === '1' ? pauseType : null,
        newState === '1' ? getSetting('pause_message', '🔧 Бот тимчасово недоступний. Спробуйте пізніше.') : null,
        null // reason can be added later if needed
      );
      
      const newIsPaused = newState === '1';
      const statusIcon = newIsPaused ? '🔴' : '🟢';
      const statusText = newIsPaused ? 'Бот на паузі' : 'Бот активний';
      const pauseMessage = getSetting('pause_message', '🔧 Бот тимчасово недоступний. Спробуйте пізніше.');
      
      const { getPauseMenuKeyboard } = require('../keyboards/inline');
      
      await safeEditMessageText(bot, 
        '⏸️ <b>Режим паузи</b>\n\n' +
        `Статус: <b>${statusIcon} ${statusText}</b>\n\n` +
        'При паузі:\n' +
        '• ❌ Блокується підключення нових каналів\n' +
        '• ✅ Все інше працює\n' +
        '• 📢 Показується повідомлення користувачам\n\n' +
        (newIsPaused ? `Поточне повідомлення:\n"${pauseMessage}"` : ''),
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getPauseMenuKeyboard(newIsPaused).reply_markup
        }
      );
      
      await bot.api.answerCallbackQuery(query.id, {
        text: newIsPaused ? '🔴 Паузу увімкнено' : '🟢 Паузу вимкнено',
        show_alert: true
      });
      return;
    }
    
    if (data === 'pause_message_settings') {
      const showSupport = getSetting('pause_show_support', '1') === '1';
      const { getPauseMessageKeyboard } = require('../keyboards/inline');
      
      await safeEditMessageText(bot, 
        '📋 <b>Налаштування повідомлення паузи</b>\n\n' +
        'Оберіть шаблон або введіть свій текст:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getPauseMessageKeyboard(showSupport).reply_markup
        }
      );
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    if (data.startsWith('pause_template_')) {
      const templates = {
        'pause_template_1': '🔧 Бот тимчасово недоступний. Спробуйте пізніше.',
        'pause_template_2': '⏸️ Бот на паузі. Скоро повернемось.',
        'pause_template_3': '🔧 Бот тимчасово оновлюється. Спробуйте пізніше.',
        'pause_template_4': '⏸️ Бот на паузі. Скоро повернемось.',
        'pause_template_5': '🚧 Технічні роботи. Дякуємо за розуміння.'
      };
      
      const message = templates[data];
      if (message) {
        setSetting('pause_message', message);
        
        await bot.api.answerCallbackQuery(query.id, {
          text: '✅ Шаблон збережено',
          show_alert: true
        });
        
        // Refresh message settings view
        const showSupport = getSetting('pause_show_support', '1') === '1';
        const { getPauseMessageKeyboard } = require('../keyboards/inline');
        
        await safeEditMessageText(bot, 
          '📋 <b>Налаштування повідомлення паузи</b>\n\n' +
          'Оберіть шаблон або введіть свій текст:\n\n' +
          `Поточне повідомлення:\n"${message}"`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: getPauseMessageKeyboard(showSupport).reply_markup
          }
        );
      }
      return;
    }
    
    if (data === 'pause_toggle_support') {
      const currentValue = getSetting('pause_show_support', '1');
      const newValue = currentValue === '1' ? '0' : '1';
      setSetting('pause_show_support', newValue);
      
      const showSupport = newValue === '1';
      const { getPauseMessageKeyboard } = require('../keyboards/inline');
      const pauseMessage = getSetting('pause_message', '🔧 Бот тимчасово недоступний. Спробуйте пізніше.');
      
      await safeEditMessageText(bot, 
        '📋 <b>Налаштування повідомлення паузи</b>\n\n' +
        'Оберіть шаблон або введіть свій текст:\n\n' +
        `Поточне повідомлення:\n"${pauseMessage}"`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getPauseMessageKeyboard(showSupport).reply_markup
        }
      );
      
      await bot.api.answerCallbackQuery(query.id, {
        text: showSupport ? '✅ Кнопка буде показуватись' : '❌ Кнопка не буде показуватись'
      });
      return;
    }
    
    // Pause type selection
    if (data === 'pause_type_select') {
      const currentType = getSetting('pause_type', 'update');
      const { getPauseTypeKeyboard } = require('../keyboards/inline');
      
      const typeLabels = {
        'update': '🔧 Оновлення',
        'emergency': '🚨 Аварія',
        'maintenance': '🔨 Обслуговування',
        'testing': '🧪 Тестування'
      };
      
      await safeEditMessageText(bot, 
        '🏷 <b>Тип паузи</b>\n\n' +
        `Поточний тип: <b>${typeLabels[currentType] || currentType}</b>\n\n` +
        'Оберіть тип паузи для логування:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getPauseTypeKeyboard(currentType).reply_markup
        }
      );
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    if (data.startsWith('pause_type_')) {
      const newType = data.replace('pause_type_', '');
      setSetting('pause_type', newType);
      
      const typeLabels = {
        'update': '🔧 Оновлення',
        'emergency': '🚨 Аварія',
        'maintenance': '🔨 Обслуговування',
        'testing': '🧪 Тестування'
      };
      
      await bot.api.answerCallbackQuery(query.id, {
        text: `✅ Тип встановлено: ${typeLabels[newType]}`,
        show_alert: true
      });
      
      // Refresh the pause type menu
      const { getPauseTypeKeyboard } = require('../keyboards/inline');
      await safeEditMessageText(bot, 
        '🏷 <b>Тип паузи</b>\n\n' +
        `Поточний тип: <b>${typeLabels[newType]}</b>\n\n` +
        'Оберіть тип паузи для логування:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getPauseTypeKeyboard(newType).reply_markup
        }
      );
      return;
    }
    
    // Pause log
    if (data === 'pause_log') {
      const { getPauseLog, getPauseLogStats } = require('../database/pauseLog');
      const recentEvents = getPauseLog(10);
      const stats = getPauseLogStats();
      
      let message = '📜 <b>Лог паузи</b>\n\n';
      message += `Всього подій: ${stats.total_events}\n`;
      message += `Паузи: ${stats.pause_count} | Відновлення: ${stats.resume_count}\n\n`;
      
      if (recentEvents.length === 0) {
        message += 'ℹ️ Немає записів в логу';
      } else {
        message += '<b>Останні 10 подій:</b>\n\n';
        
        const typeLabels = {
          'update': '🔧',
          'emergency': '🚨',
          'maintenance': '🔨',
          'testing': '🧪'
        };
        
        recentEvents.forEach(event => {
          const date = new Date(event.created_at);
          const dateStr = date.toLocaleString('uk-UA', { 
            day: '2-digit', 
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          const eventIcon = event.event_type === 'pause' ? '🔴' : '🟢';
          const typeIcon = event.pause_type ? typeLabels[event.pause_type] || '' : '';
          
          message += `${eventIcon} ${dateStr} `;
          if (typeIcon) message += `${typeIcon} `;
          message += event.event_type === 'pause' ? 'Пауза' : 'Відновлення';
          message += '\n';
        });
      }
      
      await safeEditMessageText(bot, message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '← Назад', callback_data: 'admin_pause' },
              { text: '⤴ Меню', callback_data: 'back_to_main' }
            ]
          ]
        }
      });
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'pause_custom_message') {
      // Store conversation state for custom pause message
      const { setConversationState } = require('./channel');
      setConversationState(telegramId, {
        state: 'waiting_for_pause_message',
        previousMessageId: query.message.message_id
      });
      
      await safeEditMessageText(bot, 
        '✏️ <b>Свій текст повідомлення паузи</b>\n\n' +
        'Введіть текст, який буде показано користувачам при спробі підключити канал.\n\n' +
        'Або введіть /cancel для скасування:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        }
      );
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    // Debounce handlers
    if (data === 'admin_debounce') {
      const currentDebounce = getSetting('power_debounce_minutes', '5');
      const { getDebounceKeyboard } = require('../keyboards/inline');
      
      await safeEditMessageText(bot, 
        `⏸ <b>Налаштування Debounce</b>\n\n` +
        `Поточне значення: <b>${currentDebounce} хв</b>\n\n` +
        `Debounce — мінімальний час стабільного стану світла перед публікацією.\n` +
        `Це запобігає спаму при "моргаючому" світлі.\n\n` +
        `Оберіть нове значення:`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getDebounceKeyboard(currentDebounce).reply_markup,
        }
      );
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    if (data.startsWith('debounce_set_')) {
      const minutes = data.replace('debounce_set_', '');
      setSetting('power_debounce_minutes', minutes);
      const { getDebounceKeyboard } = require('../keyboards/inline');
      
      await bot.api.answerCallbackQuery(query.id, {
        text: `✅ Debounce встановлено: ${minutes} хв`,
        show_alert: true
      });
      
      // Оновити повідомлення з оновленою клавіатурою
      await safeEditMessageText(bot, 
        `⏸ <b>Налаштування Debounce</b>\n\n` +
        `Поточне значення: <b>${minutes} хв</b>\n\n` +
        `Debounce — мінімальний час стабільного стану світла перед публікацією.\n` +
        `Це запобігає спаму при "моргаючому" світлі.\n\n` +
        `Оберіть нове значення:`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getDebounceKeyboard(minutes).reply_markup,
        }
      );
      return;
    }
    
    // Growth management handlers
    if (data === 'admin_growth') {
      const metrics = getGrowthMetrics();
      const health = checkGrowthHealth();
      
      let message = '📈 <b>Управління ростом</b>\n\n';
      message += `🎯 Етап: <b>${metrics.stage.name}</b>\n`;
      message += `👥 Користувачів: ${metrics.users.total} / ${metrics.users.limit.max === Infinity ? '∞' : metrics.users.limit.max}\n`;
      message += `📊 Прогрес: ${metrics.users.limit.percentage}%\n\n`;
      
      if (metrics.users.limit.remaining > 0 && metrics.users.limit.remaining < 10) {
        message += `⚠️ Залишилось місць: ${metrics.users.limit.remaining}\n\n`;
      }
      
      message += `📊 Метрики:\n`;
      message += `• Завершили wizard: ${metrics.rates.wizardCompletion}%\n`;
      message += `• Підключили канали: ${metrics.rates.channelAdoption}%\n\n`;
      
      message += `🔐 Реєстрація: ${metrics.registration.enabled ? '🟢 Увімкнена' : '🔴 Вимкнена'}\n\n`;
      
      if (!health.healthy) {
        message += `⚠️ <b>Попередження:</b>\n`;
        health.reasons.forEach(reason => {
          message += `• ${reason}\n`;
        });
      }
      
      await safeEditMessageText(bot, message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getGrowthKeyboard().reply_markup
      });
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'growth_metrics') {
      const metrics = getGrowthMetrics();
      const stageMetrics = getStageSpecificMetrics();
      
      let message = '📊 <b>Метрики росту</b>\n\n';
      message += `<b>Загальні:</b>\n`;
      message += `👥 Всього: ${metrics.users.total}\n`;
      message += `✅ Активних: ${metrics.users.active}\n`;
      message += `📺 З каналами: ${metrics.users.withChannels}\n\n`;
      
      message += `<b>Етап ${stageMetrics.stageId}: ${stageMetrics.stageName}</b>\n\n`;
      
      if (stageMetrics.focus) {
        message += `<b>Фокус метрики:</b>\n`;
        stageMetrics.focus.forEach(metric => {
          const unit = metric.unit ? ` ${metric.unit}` : '';
          const total = metric.total ? `/${metric.total}` : '';
          const comment = metric.comment ? ` (${metric.comment})` : '';
          message += `• ${metric.name}: ${metric.value}${total}${unit}${comment}\n`;
        });
      }
      
      await safeEditMessageText(bot, message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getGrowthKeyboard().reply_markup
      });
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'growth_stage') {
      const currentStage = getCurrentStage();
      const metrics = getGrowthMetrics();
      
      let message = '🎯 <b>Керування етапом росту</b>\n\n';
      message += `Поточний етап: <b>${currentStage.name}</b>\n`;
      message += `Користувачів: ${metrics.users.total} / ${currentStage.maxUsers === Infinity ? '∞' : currentStage.maxUsers}\n\n`;
      message += `⚠️ Змінюйте етап тільки після підтвердження готовності системи!\n\n`;
      message += `Оберіть новий етап:`;
      
      await safeEditMessageText(bot, message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getGrowthStageKeyboard(currentStage.id).reply_markup
      });
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    if (data.startsWith('growth_stage_')) {
      const stageId = parseInt(data.replace('growth_stage_', ''), 10);
      const stage = Object.values(GROWTH_STAGES).find(s => s.id === stageId);
      
      if (stage) {
        setGrowthStage(stageId);
        await bot.api.answerCallbackQuery(query.id, {
          text: `✅ Етап змінено на: ${stage.name}`,
          show_alert: true
        });
        
        // Return to growth stage view
        const currentStage = getCurrentStage();
        const metrics = getGrowthMetrics();
        
        let message = '🎯 <b>Керування етапом росту</b>\n\n';
        message += `Поточний етап: <b>${currentStage.name}</b>\n`;
        message += `Користувачів: ${metrics.users.total} / ${currentStage.maxUsers === Infinity ? '∞' : currentStage.maxUsers}\n\n`;
        message += `⚠️ Змінюйте етап тільки після підтвердження готовності системи!\n\n`;
        message += `Оберіть новий етап:`;
        
        await safeEditMessageText(bot, message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getGrowthStageKeyboard(currentStage.id).reply_markup
        });
      }
      return;
    }
    
    if (data === 'growth_registration') {
      const enabled = isRegistrationEnabled();
      const metrics = getGrowthMetrics();
      
      let message = '🔐 <b>Керування реєстрацією</b>\n\n';
      message += `Статус: ${enabled ? '🟢 Увімкнена' : '🔴 Вимкнена'}\n\n`;
      message += `Поточний етап: ${metrics.stage.name}\n`;
      message += `Користувачів: ${metrics.users.total} / ${metrics.users.limit.max === Infinity ? '∞' : metrics.users.limit.max}\n\n`;
      
      if (metrics.users.limit.reached) {
        message += `⚠️ Ліміт користувачів досягнуто!\n\n`;
      }
      
      message += `Вимкніть реєстрацію для контролю росту або при виникненні проблем.\n`;
      
      await safeEditMessageText(bot, message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getGrowthRegistrationKeyboard(enabled).reply_markup
      });
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'growth_reg_status') {
      // Just a status indicator, do nothing
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'growth_reg_toggle') {
      const currentEnabled = isRegistrationEnabled();
      setRegistrationEnabled(!currentEnabled);
      const newEnabled = !currentEnabled;
      
      await bot.api.answerCallbackQuery(query.id, {
        text: newEnabled ? '🟢 Реєстрацію увімкнено' : '🔴 Реєстрацію вимкнено',
        show_alert: true
      });
      
      // Refresh view
      const metrics = getGrowthMetrics();
      
      let message = '🔐 <b>Керування реєстрацією</b>\n\n';
      message += `Статус: ${newEnabled ? '🟢 Увімкнена' : '🔴 Вимкнена'}\n\n`;
      message += `Поточний етап: ${metrics.stage.name}\n`;
      message += `Користувачів: ${metrics.users.total} / ${metrics.users.limit.max === Infinity ? '∞' : metrics.users.limit.max}\n\n`;
      
      if (metrics.users.limit.reached) {
        message += `⚠️ Ліміт користувачів досягнуто!\n\n`;
      }
      
      message += `Вимкніть реєстрацію для контролю росту або при виникненні проблем.\n`;
      
      await safeEditMessageText(bot, message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getGrowthRegistrationKeyboard(newEnabled).reply_markup
      });
      return;
    }
    
    if (data === 'growth_events') {
      const events = getRecentGrowthEvents(10);
      
      let message = '📝 <b>Останні події росту</b>\n\n';
      
      if (events.length === 0) {
        message += 'Немає подій для відображення.\n';
      } else {
        events.forEach((event, index) => {
          const timestamp = new Date(event.timestamp).toLocaleString('uk-UA');
          message += `${index + 1}. <b>${event.eventType}</b>\n`;
          message += `   ${timestamp}\n`;
          if (event.data.stage !== undefined) {
            message += `   Етап: ${event.data.stage}\n`;
          }
          message += '\n';
        });
      }
      
      await safeEditMessageText(bot, message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getGrowthKeyboard().reply_markup
      });
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    // Clear DB handlers
    if (data === 'admin_clear_db') {
      await safeEditMessageText(bot, 
        `⚠️ <b>УВАГА: Очищення бази даних</b>\n\n` +
        `Ця дія видалить ВСІХ користувачів з бази.\n` +
        `Це потрібно при переході на новий бот.\n\n` +
        `❗️ Дія незворотня!`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '← Скасувати', callback_data: 'admin_menu' },
                { text: '🗑 Так, очистити', callback_data: 'admin_clear_db_confirm' }
              ]
            ]
          }
        }
      );
      await bot.api.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'admin_clear_db_confirm') {
      // Очистити таблицю users з транзакцією для атомарності
      const db = require('../database/db');
      
      try {
        // Використовуємо транзакцію для забезпечення атомарності
        const transaction = db.transaction(() => {
          db.exec('DELETE FROM users');
          db.exec('DELETE FROM power_history');
          db.exec('DELETE FROM outage_history');
        });
        
        transaction();
        
        await safeEditMessageText(bot, 
          `✅ <b>База очищена</b>\n\n` +
          `Всі користувачі видалені.\n` +
          `Нові користувачі можуть починати з /start`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: getAdminKeyboard().reply_markup
          }
        );
        await bot.api.answerCallbackQuery(query.id, { text: '✅ База очищена' });
      } catch (error) {
        console.error('Error clearing database:', error);
        await bot.api.answerCallbackQuery(query.id, { 
          text: '❌ Помилка очищення бази', 
          show_alert: true 
        });
      }
      return;
    }
    
  } catch (error) {
    console.error('Помилка в handleAdminCallback:', error);
    await bot.api.answerCallbackQuery(query.id, { text: '❌ Виникла помилка' });
  }
}

// Обробник команди /setinterval
async function handleSetInterval(bot, msg, match) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.api.sendMessage(chatId, '❓ Невідома команда. Використовуйте /start для початку.');
    return;
  }
  
  try {
    // Формат: /setinterval schedule 300 або /setinterval power 5
    const type = match[1]; // schedule або power
    const value = parseInt(match[2], 10);
    
    if (type !== 'schedule' && type !== 'power') {
      const { getAdminMenuKeyboard } = require('../keyboards/inline');
      await bot.api.sendMessage(
        chatId,
        '❌ Невірний тип інтервалу.\n\n' +
        'Використання:\n' +
        '/setinterval schedule <сек> - інтервал перевірки графіка\n' +
        '/setinterval power <сек> - інтервал моніторингу світла\n\n' +
        'Приклад:\n' +
        '/setinterval schedule 300\n' +
        '/setinterval power 5\n\n' +
        'Оберіть наступну дію:',
        getAdminMenuKeyboard()
      );
      return;
    }
    
    if (isNaN(value)) {
      const { getAdminMenuKeyboard } = require('../keyboards/inline');
      await bot.api.sendMessage(
        chatId, 
        '❌ Значення має бути числом.\n\nОберіть наступну дію:',
        getAdminMenuKeyboard()
      );
      return;
    }
    
    // Валідація лімітів
    if (type === 'schedule') {
      if (value < 5 || value > 3600) {
        const { getAdminMenuKeyboard } = require('../keyboards/inline');
        await bot.api.sendMessage(
          chatId,
          '❌ Інтервал перевірки графіка має бути від 5 до 3600 сек (60 хв).\n\n' +
          'Оберіть наступну дію:',
          getAdminMenuKeyboard()
        );
        return;
      }
    } else if (type === 'power') {
      if (value < 1 || value > 60) {
        const { getAdminMenuKeyboard } = require('../keyboards/inline');
        await bot.api.sendMessage(
          chatId,
          '❌ Інтервал моніторингу світла має бути від 1 до 60 сек.\n\n' +
          'Оберіть наступну дію:',
          getAdminMenuKeyboard()
        );
        return;
      }
    }
    
    // Зберігаємо в БД
    const key = type === 'schedule' ? 'schedule_check_interval' : 'power_check_interval';
    setSetting(key, String(value));
    
    const typeName = type === 'schedule' ? 'перевірки графіка' : 'моніторингу світла';
    await bot.api.sendMessage(
      chatId,
      `✅ Інтервал ${typeName} встановлено: ${value} сек\n\n` +
      '⚠️ Для застосування змін потрібен перезапуск бота.'
    );
    
  } catch (error) {
    console.error('Помилка в handleSetInterval:', error);
    const { getAdminMenuKeyboard } = require('../keyboards/inline');
    await bot.api.sendMessage(
      chatId, 
      '❌ Виникла помилка.\n\nОберіть наступну дію:',
      getAdminMenuKeyboard()
    );
  }
}

// Обробник команди /setdebounce
async function handleSetDebounce(bot, msg, match) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.api.sendMessage(chatId, '❓ Невідома команда. Використовуйте /start для початку.');
    return;
  }
  
  try {
    const value = parseInt(match[1], 10);
    
    if (isNaN(value)) {
      const { getAdminMenuKeyboard } = require('../keyboards/inline');
      await bot.api.sendMessage(
        chatId, 
        '❌ Значення має бути числом.\n\nОберіть наступну дію:',
        getAdminMenuKeyboard()
      );
      return;
    }
    
    // Валідація: від 1 до 30 хвилин
    if (value < 1 || value > 30) {
      const { getAdminMenuKeyboard } = require('../keyboards/inline');
      await bot.api.sendMessage(
        chatId,
        '❌ Час debounce має бути від 1 до 30 хвилин.\n\n' +
        'Рекомендовано: 3-5 хвилин\n\n' +
        'Оберіть наступну дію:',
        getAdminMenuKeyboard()
      );
      return;
    }
    
    // Зберігаємо в БД
    setSetting('power_debounce_minutes', String(value));
    
    await bot.api.sendMessage(
      chatId,
      `✅ Час debounce встановлено: ${value} хв\n\n` +
      'Нові зміни стану світла будуть публікуватись тільки після ' +
      `${value} хвилин стабільного стану.\n\n` +
      'Зміни застосуються автоматично при наступній перевірці.'
    );
    
  } catch (error) {
    console.error('Помилка в handleSetDebounce:', error);
    const { getAdminMenuKeyboard } = require('../keyboards/inline');
    await bot.api.sendMessage(
      chatId, 
      '❌ Виникла помилка.\n\nОберіть наступну дію:',
      getAdminMenuKeyboard()
    );
  }
}

// Обробник команди /debounce
async function handleGetDebounce(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.api.sendMessage(chatId, '❓ Невідома команда. Використовуйте /start для початку.');
    return;
  }
  
  try {
    const value = getSetting('power_debounce_minutes', '5');
    
    await bot.api.sendMessage(
      chatId,
      `⚙️ <b>Поточний час debounce:</b> ${value} хв\n\n` +
      'Зміни стану світла публікуються після ' +
      `${value} хвилин стабільного стану.\n\n` +
      'Для зміни використайте:\n' +
      '/setdebounce <хвилини>',
      { parse_mode: 'HTML' }
    );
    
  } catch (error) {
    console.error('Помилка в handleGetDebounce:', error);
    const { getAdminMenuKeyboard } = require('../keyboards/inline');
    await bot.api.sendMessage(
      chatId, 
      '❌ Виникла помилка.\n\nОберіть наступну дію:',
      getAdminMenuKeyboard()
    );
  }
}

module.exports = {
  handleAdmin,
  handleStats,
  handleUsers,
  handleBroadcast,
  handleSystem,
  handleAdminCallback,
  handleSetInterval,
  handleSetDebounce,
  handleGetDebounce,
  handleMonitoring,
  handleSetAlertChannel,
};

// Обробник команди /monitoring
async function handleMonitoring(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.api.sendMessage(chatId, '❓ Невідома команда. Використовуйте /start для початку.');
    return;
  }
  
  try {
    const { monitoringManager } = require('../monitoring/monitoringManager');
    const status = monitoringManager.getStatus();
    const metricsCollector = monitoringManager.getMetricsCollector();
    const alertManager = monitoringManager.getAlertManager();
    
    // Get metrics
    const metrics = metricsCollector.collectAllMetrics();
    const alertsSummary = alertManager.getAlertsSummary();
    
    // Format message
    let message = '🔎 <b>Система моніторингу</b>\n\n';
    
    // Status
    message += `<b>Статус:</b> ${status.isRunning ? '🟢 Активна' : '🔴 Неактивна'}\n`;
    message += `<b>Інтервал:</b> ${status.config.checkIntervalMinutes} хв\n\n`;
    
    // System metrics
    message += '<b>📊 Система:</b>\n';
    message += `• Uptime: ${metrics.system.uptimeFormatted}\n`;
    message += `• Памʼять: ${metrics.system.memory.heapUsedMB}MB (${metrics.system.memory.heapUsedPercent}%)\n`;
    message += `• Рестарти: ${metrics.system.restartCount}\n\n`;
    
    // Application metrics
    message += '<b>⚙️ Застосунок:</b>\n';
    message += `• Режим паузи: ${metrics.application.botPaused ? '🔴 ТАК' : '🟢 НІ'}\n`;
    message += `• Помилок: ${metrics.application.errorCount} (унікальних: ${metrics.application.uniqueErrors})\n\n`;
    
    // Business metrics
    message += '<b>📈 Бізнес:</b>\n';
    message += `• Всього користувачів: ${metrics.business.totalUsers}\n`;
    message += `• Активні: ${metrics.business.activeUsers}\n`;
    message += `• DAU: ${metrics.business.dau}\n`;
    message += `• WAU: ${metrics.business.wau}\n`;
    message += `• Каналів: ${metrics.business.channelsConnected}\n`;
    message += `• IP моніторингів: ${metrics.business.ipsMonitored}\n\n`;
    
    // Alerts summary
    message += '<b>🚨 Алерти:</b>\n';
    message += `• За годину: ${alertsSummary.lastHour}\n`;
    message += `• За добу: ${alertsSummary.lastDay}\n`;
    message += `• INFO: ${alertsSummary.byLevel.INFO}\n`;
    message += `• WARN: ${alertsSummary.byLevel.WARN}\n`;
    message += `• CRITICAL: ${alertsSummary.byLevel.CRITICAL}\n\n`;
    
    // Alert channel
    const alertChannelId = alertManager.config.alertChannelId;
    message += '<b>📢 Канал для алертів:</b>\n';
    message += alertChannelId ? `✅ Налаштовано: ${alertChannelId}` : '❌ Не налаштовано';
    message += '\n\nДля налаштування канала:\n';
    message += '/setalertchannel <channel_id>';
    
    await bot.api.sendMessage(chatId, message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Помилка в handleMonitoring:', error);
    await bot.api.sendMessage(chatId, '❌ Виникла помилка при отриманні статусу моніторингу.');
  }
}

// Обробник команди /setalertchannel
async function handleSetAlertChannel(bot, msg, match) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.api.sendMessage(chatId, '❓ Невідома команда. Використовуйте /start для початку.');
    return;
  }
  
  try {
    const channelId = match[1].trim();
    
    // Validate channel ID format
    if (!channelId.startsWith('@') && !channelId.startsWith('-')) {
      await bot.api.sendMessage(
        chatId,
        '❌ Невірний формат ID каналу.\n\n' +
        'Використайте:\n' +
        '• @username для публічних каналів\n' +
        '• -100xxxxxxxxxx для приватних каналів\n\n' +
        'Приклад: /setalertchannel @my_alerts_channel'
      );
      return;
    }
    
    // Try to send a test message to verify bot has access
    try {
      await bot.api.sendMessage(
        channelId,
        '✅ Канал для алертів налаштовано успішно!\n\n' +
        'Тут будуть публікуватися алерти системи моніторингу.',
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      await bot.api.sendMessage(
        chatId,
        '❌ Не вдалося надіслати повідомлення в канал.\n\n' +
        'Перевірте:\n' +
        '• Бот доданий до каналу як адміністратор\n' +
        '• Бот має право публікувати повідомлення\n' +
        '• ID каналу вказано правильно\n\n' +
        `Помилка: ${error.message}`
      );
      return;
    }
    
    // Configure alert channel
    const { monitoringManager } = require('../monitoring/monitoringManager');
    monitoringManager.setAlertChannel(channelId);
    
    await bot.api.sendMessage(
      chatId,
      `✅ Канал для алертів налаштовано: ${channelId}\n\n` +
      'Тепер усі алерти системи моніторингу будуть публікуватися в цьому каналі.',
      { parse_mode: 'HTML' }
    );
    
  } catch (error) {
    console.error('Помилка в handleSetAlertChannel:', error);
    await bot.api.sendMessage(chatId, '❌ Виникла помилка при налаштуванні каналу.');
  }
}
