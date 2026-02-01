const usersDb = require('../database/users');
const { getAdminKeyboard, getAdminIntervalsKeyboard, getScheduleIntervalKeyboard, getIpIntervalKeyboard } = require('../keyboards/inline');
const { isAdmin, formatUptime, formatMemory, formatInterval } = require('../utils');
const config = require('../config');
const { REGIONS } = require('../constants/regions');
const { getSetting, setSetting } = require('../database/db');

// Обробник команди /admin
async function handleAdmin(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.sendMessage(chatId, '❌ У вас немає прав адміністратора.');
    return;
  }
  
  try {
    await bot.sendMessage(
      chatId,
      '👨‍💼 <b>Адмін панель</b>\n\nОберіть опцію:',
      {
        parse_mode: 'HTML',
        ...getAdminKeyboard(),
      }
    );
  } catch (error) {
    console.error('Помилка в handleAdmin:', error);
    await bot.sendMessage(chatId, '❌ Виникла помилка.');
  }
}

// Обробник команди /stats
async function handleStats(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.sendMessage(chatId, '❌ У вас немає прав адміністратора.');
    return;
  }
  
  try {
    const stats = usersDb.getUserStats();
    
    let message = '📊 <b>Статистика користувачів</b>\n\n';
    message += `👥 Всього користувачів: ${stats.total}\n`;
    message += `✅ Активних: ${stats.active}\n`;
    message += `📺 З підключеними каналами: ${stats.withChannels}\n\n`;
    
    if (stats.byRegion.length > 0) {
      message += '<b>Розподіл по регіонах:</b>\n';
      stats.byRegion.forEach(item => {
        const regionName = REGIONS[item.region]?.name || item.region;
        message += `• ${regionName}: ${item.count}\n`;
      });
    }
    
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Помилка в handleStats:', error);
    await bot.sendMessage(chatId, '❌ Виникла помилка.');
  }
}

// Обробник команди /users
async function handleUsers(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.sendMessage(chatId, '❌ У вас немає прав адміністратора.');
    return;
  }
  
  try {
    const users = usersDb.getRecentUsers(20);
    
    if (users.length === 0) {
      await bot.sendMessage(chatId, 'ℹ️ Користувачів не знайдено.');
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
    
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Помилка в handleUsers:', error);
    await bot.sendMessage(chatId, '❌ Виникла помилка.');
  }
}

// Обробник команди /broadcast
async function handleBroadcast(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.sendMessage(chatId, '❌ У вас немає прав адміністратора.');
    return;
  }
  
  try {
    // Отримуємо текст повідомлення (після /broadcast)
    const text = msg.text.replace('/broadcast', '').trim();
    
    if (!text) {
      await bot.sendMessage(
        chatId,
        '❌ Використання: /broadcast <повідомлення>\n\nПриклад:\n/broadcast Важливе оновлення!'
      );
      return;
    }
    
    const users = usersDb.getAllActiveUsers();
    
    if (users.length === 0) {
      await bot.sendMessage(chatId, 'ℹ️ Немає активних користувачів.');
      return;
    }
    
    await bot.sendMessage(chatId, `📤 Розсилка повідомлення ${users.length} користувачам...`);
    
    let sent = 0;
    let failed = 0;
    
    for (const user of users) {
      try {
        await bot.sendMessage(user.telegram_id, `📢 <b>Повідомлення від адміністрації:</b>\n\n${text}`, {
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
    
    await bot.sendMessage(
      chatId,
      `✅ Розсилка завершена!\n\n` +
      `Відправлено: ${sent}\n` +
      `Помилок: ${failed}`
    );
    
  } catch (error) {
    console.error('Помилка в handleBroadcast:', error);
    await bot.sendMessage(chatId, '❌ Виникла помилка при розсилці.');
  }
}

// Обробник команди /system
async function handleSystem(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.sendMessage(chatId, '❌ У вас немає прав адміністратора.');
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
    
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Помилка в handleSystem:', error);
    await bot.sendMessage(chatId, '❌ Виникла помилка.');
  }
}

// Обробник admin callback
async function handleAdminCallback(bot, query) {
  const chatId = query.message.chat.id;
  const userId = String(query.from.id);
  const data = query.data;
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.answerCallbackQuery(query.id, { text: '❌ Немає прав' });
    return;
  }
  
  try {
    if (data === 'admin_stats') {
      const stats = usersDb.getUserStats();
      
      let message = '📊 <b>Статистика користувачів</b>\n\n';
      message += `👥 Всього користувачів: ${stats.total}\n`;
      message += `✅ Активних: ${stats.active}\n`;
      message += `📺 З підключеними каналами: ${stats.withChannels}\n\n`;
      
      if (stats.byRegion.length > 0) {
        message += '<b>Розподіл по регіонах:</b>\n';
        stats.byRegion.forEach(item => {
          const regionName = REGIONS[item.region]?.name || item.region;
          message += `• ${regionName}: ${item.count}\n`;
        });
      }
      
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getAdminKeyboard().reply_markup,
      });
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'admin_users') {
      const users = usersDb.getRecentUsers(10);
      
      if (users.length === 0) {
        await bot.answerCallbackQuery(query.id, { text: 'Користувачів не знайдено' });
        return;
      }
      
      let message = '👥 <b>Останні 10 користувачів:</b>\n\n';
      
      users.forEach((user, index) => {
        const regionName = REGIONS[user.region]?.name || user.region;
        const status = user.is_active ? '✅' : '❌';
        const channel = user.channel_id ? '📺' : '';
        
        message += `${index + 1}. ${status} @${user.username || 'без username'}\n`;
        message += `   ${regionName}, Черга ${user.queue} ${channel}\n\n`;
      });
      
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getAdminKeyboard().reply_markup,
      });
      await bot.answerCallbackQuery(query.id);
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
      
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getAdminKeyboard().reply_markup,
      });
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Admin intervals menu
    if (data === 'admin_intervals') {
      const scheduleInterval = parseInt(getSetting('schedule_check_interval', '60'), 10);
      const ipInterval = parseInt(getSetting('power_check_interval', '2'), 10);
      
      const scheduleMinutes = Math.round(scheduleInterval / 60);
      const ipFormatted = formatInterval(ipInterval);
      
      await bot.editMessageText(
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
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Admin menu callback (back from intervals)
    if (data === 'admin_menu') {
      await bot.editMessageText(
        '👨‍💼 <b>Адмін панель</b>\n\nОберіть опцію:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getAdminKeyboard().reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Show schedule interval options
    if (data === 'admin_interval_schedule') {
      await bot.editMessageText(
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
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Show IP interval options
    if (data === 'admin_interval_ip') {
      await bot.editMessageText(
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
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Set schedule interval
    if (data.startsWith('admin_schedule_')) {
      const minutes = parseInt(data.replace('admin_schedule_', ''), 10);
      const seconds = minutes * 60;
      
      setSetting('schedule_check_interval', String(seconds));
      
      await bot.answerCallbackQuery(query.id, {
        text: `✅ Інтервал графіків: ${minutes} хв. Перезапустіть бота.`,
        show_alert: true
      });
      
      // Return to intervals menu
      const scheduleInterval = parseInt(getSetting('schedule_check_interval', '60'), 10);
      const ipInterval = parseInt(getSetting('power_check_interval', '2'), 10);
      
      const scheduleMinutes = Math.round(scheduleInterval / 60);
      const ipFormatted = formatInterval(ipInterval);
      
      await bot.editMessageText(
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
      await bot.answerCallbackQuery(query.id, {
        text: `✅ Інтервал IP: ${formatted}. Перезапустіть бота.`,
        show_alert: true
      });
      
      // Return to intervals menu
      const scheduleInterval = parseInt(getSetting('schedule_check_interval', '60'), 10);
      const ipInterval = parseInt(getSetting('power_check_interval', '2'), 10);
      
      const scheduleMinutes = Math.round(scheduleInterval / 60);
      const ipFormatted = formatInterval(ipInterval);
      
      await bot.editMessageText(
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
    
  } catch (error) {
    console.error('Помилка в handleAdminCallback:', error);
    await bot.answerCallbackQuery(query.id, { text: '❌ Виникла помилка' });
  }
}

// Обробник команди /setinterval
async function handleSetInterval(bot, msg, match) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.sendMessage(chatId, '❌ У вас немає прав адміністратора.');
    return;
  }
  
  try {
    // Формат: /setinterval schedule 300 або /setinterval power 5
    const type = match[1]; // schedule або power
    const value = parseInt(match[2], 10);
    
    if (type !== 'schedule' && type !== 'power') {
      await bot.sendMessage(
        chatId,
        '❌ Невірний тип інтервалу.\n\n' +
        'Використання:\n' +
        '/setinterval schedule <сек> - інтервал перевірки графіка\n' +
        '/setinterval power <сек> - інтервал моніторингу світла\n\n' +
        'Приклад:\n' +
        '/setinterval schedule 300\n' +
        '/setinterval power 5'
      );
      return;
    }
    
    if (isNaN(value)) {
      await bot.sendMessage(chatId, '❌ Значення має бути числом.');
      return;
    }
    
    // Валідація лімітів
    if (type === 'schedule') {
      if (value < 5 || value > 3600) {
        await bot.sendMessage(
          chatId,
          '❌ Інтервал перевірки графіка має бути від 5 до 3600 сек (60 хв).'
        );
        return;
      }
    } else if (type === 'power') {
      if (value < 1 || value > 60) {
        await bot.sendMessage(
          chatId,
          '❌ Інтервал моніторингу світла має бути від 1 до 60 сек.'
        );
        return;
      }
    }
    
    // Зберігаємо в БД
    const key = type === 'schedule' ? 'schedule_check_interval' : 'power_check_interval';
    setSetting(key, String(value));
    
    const typeName = type === 'schedule' ? 'перевірки графіка' : 'моніторингу світла';
    await bot.sendMessage(
      chatId,
      `✅ Інтервал ${typeName} встановлено: ${value} сек\n\n` +
      '⚠️ Для застосування змін потрібен перезапуск бота.'
    );
    
  } catch (error) {
    console.error('Помилка в handleSetInterval:', error);
    await bot.sendMessage(chatId, '❌ Виникла помилка.');
  }
}

// Обробник команди /setdebounce
async function handleSetDebounce(bot, msg, match) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.sendMessage(chatId, '❌ У вас немає прав адміністратора.');
    return;
  }
  
  try {
    const value = parseInt(match[1], 10);
    
    if (isNaN(value)) {
      await bot.sendMessage(chatId, '❌ Значення має бути числом.');
      return;
    }
    
    // Валідація: від 1 до 30 хвилин
    if (value < 1 || value > 30) {
      await bot.sendMessage(
        chatId,
        '❌ Час debounce має бути від 1 до 30 хвилин.\n\n' +
        'Рекомендовано: 3-5 хвилин'
      );
      return;
    }
    
    // Зберігаємо в БД
    setSetting('power_debounce_minutes', String(value));
    
    await bot.sendMessage(
      chatId,
      `✅ Час debounce встановлено: ${value} хв\n\n` +
      'Нові зміни стану світла будуть публікуватись тільки після ' +
      `${value} хвилин стабільного стану.\n\n` +
      'Зміни застосуються автоматично при наступній перевірці.'
    );
    
  } catch (error) {
    console.error('Помилка в handleSetDebounce:', error);
    await bot.sendMessage(chatId, '❌ Виникла помилка.');
  }
}

// Обробник команди /debounce
async function handleGetDebounce(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.sendMessage(chatId, '❌ У вас немає прав адміністратора.');
    return;
  }
  
  try {
    const value = getSetting('power_debounce_minutes', '5');
    
    await bot.sendMessage(
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
    await bot.sendMessage(chatId, '❌ Виникла помилка.');
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
};
