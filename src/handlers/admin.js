const usersDb = require('../database/users');
const ticketsDb = require('../database/tickets');
const { getAdminKeyboard, getAdminIntervalsKeyboard, getScheduleIntervalKeyboard, getIpIntervalKeyboard, getGrowthKeyboard, getGrowthStageKeyboard, getGrowthRegistrationKeyboard, getUsersMenuKeyboard, getAdminTicketKeyboard, getAdminTicketsListKeyboard } = require('../keyboards/inline');
const { isAdmin, formatUptime, formatMemory, formatInterval } = require('../utils');
const config = require('../config');
const { REGIONS } = require('../constants/regions');
const { getSetting, setSetting } = require('../database/db');
const { safeSendMessage, safeEditMessageText, safeDeleteMessage, safeSendPhoto } = require('../utils/errorHandler');
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
    const openTicketsCount = await ticketsDb.getOpenTicketsCount();
    
    await safeSendMessage(
      bot,
      chatId,
      '👨‍💼 <b>Адмін панель</b>\n\nОберіть опцію:',
      {
        parse_mode: 'HTML',
        ...getAdminKeyboard(openTicketsCount),
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
    const message = await formatAnalytics();
    
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
    await bot.sendMessage(chatId, '❓ Невідома команда. Використовуйте /start для початку.');
    return;
  }
  
  try {
    const users = await usersDb.getRecentUsers(20);
    
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
    const { getAdminMenuKeyboard } = require('../keyboards/inline');
    await bot.sendMessage(
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
    await bot.sendMessage(chatId, '❓ Невідома команда. Використовуйте /start для початку.');
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
    
    const users = await usersDb.getAllActiveUsers();
    
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
    const { getAdminMenuKeyboard } = require('../keyboards/inline');
    await bot.sendMessage(
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
    await bot.sendMessage(chatId, '❓ Невідома команда. Використовуйте /start для початку.');
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
    const { getAdminMenuKeyboard } = require('../keyboards/inline');
    await bot.sendMessage(
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
    await bot.answerCallbackQuery(query.id, { text: '❌ Немає прав' });
    return;
  }
  
  try {
    if (data === 'admin_stats') {
      // Use new analytics module
      const { formatAnalytics } = require('../analytics');
      const message = await formatAnalytics();
      
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
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'admin_users') {
      const stats = await usersDb.getUserStats();
      
      await safeEditMessageText(bot,
        `👥 <b>Користувачі</b>\n\n` +
        `📊 Всього: ${stats.total}\n` +
        `✅ Активних: ${stats.active}\n` +
        `📺 З каналами: ${stats.withChannels}\n\n` +
        `Оберіть дію:`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getUsersMenuKeyboard().reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'admin_users_stats') {
      const stats = await usersDb.getUserStats();
      
      let message = `📊 <b>Статистика користувачів</b>\n\n`;
      message += `📊 Всього: ${stats.total}\n`;
      message += `✅ Активних: ${stats.active}\n`;
      message += `❌ Неактивних: ${stats.total - stats.active}\n`;
      message += `📺 З каналами: ${stats.withChannels}\n`;
      message += `📱 Тільки бот: ${stats.total - stats.withChannels}\n\n`;
      
      message += `🏙 <b>За регіонами:</b>\n`;
      for (const r of stats.byRegion) {
        const regionName = REGIONS[r.region]?.name || r.region;
        message += `  ${regionName}: ${r.count}\n`;
      }
      
      await safeEditMessageText(bot, message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '← Назад', callback_data: 'admin_users' }],
            [{ text: '⤴ Меню', callback_data: 'back_to_main' }]
          ]
        }
      });
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data.startsWith('admin_users_list_')) {
      const page = parseInt(data.replace('admin_users_list_', ''), 10) || 1;
      const perPage = 10;
      
      const allUsers = await usersDb.getAllUsers(); // вже відсортовані по created_at DESC
      const totalPages = Math.ceil(allUsers.length / perPage);
      const currentPage = Math.min(page, totalPages) || 1;
      const startIndex = (currentPage - 1) * perPage;
      const pageUsers = allUsers.slice(startIndex, startIndex + perPage);
      
      let message = `📋 <b>Користувачі</b> (${allUsers.length} всього)\n`;
      message += `📄 Сторінка ${currentPage}/${totalPages}\n\n`;
      
      pageUsers.forEach((user, index) => {
        const num = startIndex + index + 1;
        const regionName = REGIONS[user.region]?.name || user.region;
        const channelIcon = user.channel_id ? ' 📺' : '';
        const ipIcon = user.router_ip ? ' 📡' : '';
        const activeIcon = user.is_active ? '' : ' ❌';
        
        message += `${num}. ${user.username ? '@' + user.username : 'без username'} • ${regionName} ${user.queue}${channelIcon}${ipIcon}${activeIcon}\n`;
      });
      
      // Пагінація
      const navButtons = [];
      if (currentPage > 1) {
        navButtons.push({ text: '← Попередня', callback_data: `admin_users_list_${currentPage - 1}` });
      }
      navButtons.push({ text: `${currentPage}/${totalPages}`, callback_data: 'noop' });
      if (currentPage < totalPages) {
        navButtons.push({ text: 'Наступна →', callback_data: `admin_users_list_${currentPage + 1}` });
      }
      
      const keyboard = [];
      if (navButtons.length > 1) {
        keyboard.push(navButtons);
      }
      keyboard.push([
        { text: '← Назад', callback_data: 'admin_users' },
        { text: '⤴ Меню', callback_data: 'back_to_main' }
      ]);
      
      await safeEditMessageText(bot, message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
      });
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'noop') {
      await bot.answerCallbackQuery(query.id);
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
      
      await safeEditMessageText(bot, message, {
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
      const scheduleInterval = parseInt(await getSetting('schedule_check_interval', '60'), 10);
      const ipInterval = parseInt(await getSetting('power_check_interval', '2'), 10);
      
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
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Admin menu callback (back from intervals)
    if (data === 'admin_menu') {
      const openTicketsCount = await ticketsDb.getOpenTicketsCount();
      
      await safeEditMessageText(bot, 
        '🔧 <b>Адмін-панель</b>',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getAdminKeyboard(openTicketsCount).reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Tickets list
    if (data === 'admin_tickets' || data.startsWith('admin_tickets_page_')) {
      const page = data.startsWith('admin_tickets_page_') 
        ? parseInt(data.replace('admin_tickets_page_', ''), 10) 
        : 1;
      
      const openTickets = await ticketsDb.getTicketsByStatus('open');
      
      if (openTickets.length === 0) {
        await safeEditMessageText(bot,
          '📩 <b>Звернення</b>\n\n' +
          'Немає відкритих звернень.',
          {
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
            }
          }
        );
      } else {
        await safeEditMessageText(bot,
          `📩 <b>Звернення</b>\n\n` +
          `Відкритих звернень: ${openTickets.length}\n\n` +
          'Оберіть звернення для перегляду:',
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: getAdminTicketsListKeyboard(openTickets, page),
          }
        );
      }
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Helper function to format ticket message for display
    async function formatTicketView(ticketId) {
      const ticket = await ticketsDb.getTicketById(ticketId);
      if (!ticket) return null;
      
      const messages = await ticketsDb.getTicketMessages(ticketId);
      const typeEmoji = ticket.type === 'bug' ? '🐛 Баг' : ticket.type === 'region_request' ? '🏙 Запит регіону' : '💬 Звернення';
      const statusEmoji = ticket.status === 'open' ? '🆕 Відкрито' : ticket.status === 'closed' ? '✅ Закрито' : '🔄 В роботі';
      
      let message = 
        `📩 <b>Звернення #${ticket.id}</b>\n\n` +
        `${typeEmoji}\n` +
        `${statusEmoji}\n` +
        `👤 <b>Від:</b> <code>${ticket.telegram_id}</code>\n` +
        `📅 <b>Створено:</b> ${new Date(ticket.created_at).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}\n`;
      
      if (ticket.subject) {
        message += `📝 <b>Тема:</b> ${ticket.subject}\n`;
      }
      
      message += '\n<b>Повідомлення:</b>\n\n';
      
      for (const msg of messages) {
        const senderLabel = msg.sender_type === 'user' ? '👤 Користувач' : '👨‍💼 Адмін';
        message += `${senderLabel}:\n`;
        
        if (msg.message_type === 'text') {
          message += `${msg.content}\n`;
        } else if (msg.message_type === 'photo') {
          message += `📷 Фото${msg.content ? ': ' + msg.content : ''}\n`;
        } else if (msg.message_type === 'video') {
          message += `🎥 Відео${msg.content ? ': ' + msg.content : ''}\n`;
        }
        message += '\n';
      }
      
      return { ticket, message };
    }
    
    // View specific ticket
    if (data.startsWith('admin_ticket_view_')) {
      const ticketId = parseInt(data.replace('admin_ticket_view_', ''), 10);
      const result = await formatTicketView(ticketId);
      
      if (!result) {
        await bot.answerCallbackQuery(query.id, { text: '❌ Тикет не знайдено' });
        return;
      }
      
      await safeEditMessageText(bot, result.message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getAdminTicketKeyboard(ticketId, result.ticket.status),
      });
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Close ticket
    if (data.startsWith('admin_ticket_close_')) {
      const ticketId = parseInt(data.replace('admin_ticket_close_', ''), 10);
      const ticket = await ticketsDb.getTicketById(ticketId);
      
      if (!ticket) {
        await bot.answerCallbackQuery(query.id, { text: '❌ Тикет не знайдено' });
        return;
      }
      
      await ticketsDb.updateTicketStatus(ticketId, 'closed', userId);
      
      // Notify user
      await safeSendMessage(
        bot,
        ticket.telegram_id,
        `✅ <b>Ваше звернення #${ticketId} закрито</b>\n\n` +
        'Дякуємо за звернення!',
        { parse_mode: 'HTML' }
      );
      
      await bot.answerCallbackQuery(query.id, { text: '✅ Тикет закрито' });
      
      // Refresh ticket view using the shared function
      const result = await formatTicketView(ticketId);
      if (result) {
        await safeEditMessageText(bot, result.message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getAdminTicketKeyboard(ticketId, result.ticket.status),
        });
      }
      
      return;
    }
    
    // Reopen ticket
    if (data.startsWith('admin_ticket_reopen_')) {
      const ticketId = parseInt(data.replace('admin_ticket_reopen_', ''), 10);
      
      await ticketsDb.updateTicketStatus(ticketId, 'open');
      await bot.answerCallbackQuery(query.id, { text: '✅ Тикет знову відкрито' });
      
      // Refresh ticket view using the shared function
      const result = await formatTicketView(ticketId);
      if (result) {
        await safeEditMessageText(bot, result.message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getAdminTicketKeyboard(ticketId, result.ticket.status),
        });
      }
      
      return;
    }
    
    // Reply to ticket - just notify admin it's not implemented in this minimal version
    if (data.startsWith('admin_ticket_reply_')) {
      await bot.answerCallbackQuery(query.id, { 
        text: 'Щоб відповісти, закрийте тикет та напишіть користувачу особисто через його ID',
        show_alert: true 
      });
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
      await bot.answerCallbackQuery(query.id);
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
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Set schedule interval
    if (data.startsWith('admin_schedule_')) {
      const minutes = parseInt(data.replace('admin_schedule_', ''), 10);
      const seconds = minutes * 60;
      
      await setSetting('schedule_check_interval', String(seconds));
      
      await bot.answerCallbackQuery(query.id, {
        text: `✅ Інтервал графіків: ${minutes} хв. Перезапустіть бота.`,
        show_alert: true
      });
      
      // Return to intervals menu
      const scheduleInterval = parseInt(await getSetting('schedule_check_interval', '60'), 10);
      const ipInterval = parseInt(await getSetting('power_check_interval', '2'), 10);
      
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
      
      await setSetting('power_check_interval', String(seconds));
      
      const formatted = formatInterval(seconds);
      await bot.answerCallbackQuery(query.id, {
        text: `✅ Інтервал IP: ${formatted}. Перезапустіть бота.`,
        show_alert: true
      });
      
      // Return to intervals menu
      const scheduleInterval = parseInt(await getSetting('schedule_check_interval', '60'), 10);
      const ipInterval = parseInt(await getSetting('power_check_interval', '2'), 10);
      
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
      const isPaused = await getSetting('bot_paused', '0') === '1';
      const pauseMessage = await getSetting('pause_message', '🔧 Бот тимчасово недоступний. Спробуйте пізніше.');
      const showSupport = await getSetting('pause_show_support', '1') === '1';
      
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
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'pause_status') {
      // Just ignore - this is the status indicator
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'pause_toggle') {
      const isPaused = await getSetting('bot_paused', '0') === '1';
      const newState = isPaused ? '0' : '1';
      await setSetting('bot_paused', newState);
      
      // Track pause mode change in monitoring
      try {
        const metricsCollector = require('../monitoring/metricsCollector');
        metricsCollector.trackStateTransition(
          newState === '1' ? 'pause_mode_on' : 'pause_mode_off',
          { 
            userId: userId,
            timestamp: new Date().toISOString()
          }
        );
      } catch (e) {
        // Monitoring not available
      }
      
      // Log the pause event
      const { logPauseEvent } = require('../database/pauseLog');
      const pauseType = await getSetting('pause_type', 'update'); // default to update
      
      await logPauseEvent(
        userId,
        newState === '1' ? 'pause' : 'resume',
        newState === '1' ? pauseType : null,
        newState === '1' ? await getSetting('pause_message', '🔧 Бот тимчасово недоступний. Спробуйте пізніше.') : null,
        null // reason can be added later if needed
      );
      
      const newIsPaused = newState === '1';
      const statusIcon = newIsPaused ? '🔴' : '🟢';
      const statusText = newIsPaused ? 'Бот на паузі' : 'Бот активний';
      const pauseMessage = await getSetting('pause_message', '🔧 Бот тимчасово недоступний. Спробуйте пізніше.');
      
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
      
      await bot.answerCallbackQuery(query.id, {
        text: newIsPaused ? '🔴 Паузу увімкнено' : '🟢 Паузу вимкнено',
        show_alert: true
      });
      return;
    }
    
    if (data === 'pause_message_settings') {
      const showSupport = await getSetting('pause_show_support', '1') === '1';
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
      await bot.answerCallbackQuery(query.id);
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
        await setSetting('pause_message', message);
        
        await bot.answerCallbackQuery(query.id, {
          text: '✅ Шаблон збережено',
          show_alert: true
        });
        
        // Refresh message settings view
        const showSupport = await getSetting('pause_show_support', '1') === '1';
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
      const currentValue = await getSetting('pause_show_support', '1');
      const newValue = currentValue === '1' ? '0' : '1';
      await setSetting('pause_show_support', newValue);
      
      const showSupport = newValue === '1';
      const { getPauseMessageKeyboard } = require('../keyboards/inline');
      const pauseMessage = await getSetting('pause_message', '🔧 Бот тимчасово недоступний. Спробуйте пізніше.');
      
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
      
      await bot.answerCallbackQuery(query.id, {
        text: showSupport ? '✅ Кнопка буде показуватись' : '❌ Кнопка не буде показуватись'
      });
      return;
    }
    
    // Pause type selection
    if (data === 'pause_type_select') {
      const currentType = await getSetting('pause_type', 'update');
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
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data.startsWith('pause_type_')) {
      const newType = data.replace('pause_type_', '');
      await setSetting('pause_type', newType);
      
      const typeLabels = {
        'update': '🔧 Оновлення',
        'emergency': '🚨 Аварія',
        'maintenance': '🔨 Обслуговування',
        'testing': '🧪 Тестування'
      };
      
      await bot.answerCallbackQuery(query.id, {
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
      const recentEvents = await getPauseLog(10);
      const stats = await getPauseLogStats();
      
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
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'pause_custom_message') {
      // Store conversation state for custom pause message
      const { setConversationState } = require('./channel');
      setConversationState(userId, {
        state: 'waiting_for_pause_message',
        previousMessageId: query.message.message_id
      });
      
      await safeEditMessageText(bot, 
        '✏️ <b>Свій текст повідомлення паузи</b>\n\n' +
        'Надішліть текст, який буде показано користувачам при спробі підключити канал.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Скасувати', callback_data: 'pause_message_settings' }]
            ]
          }
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Debounce handlers
    if (data === 'admin_debounce') {
      const currentDebounce = await getSetting('power_debounce_minutes', '5');
      const { getDebounceKeyboard } = require('../keyboards/inline');
      
      // Display text based on current value
      const displayValue = currentDebounce === '0' ? 'Вимкнено (без затримок)' : `${currentDebounce} хв`;
      
      await safeEditMessageText(bot, 
        `⏸ <b>Налаштування Debounce</b>\n\n` +
        `Поточне значення: <b>${displayValue}</b>\n\n` +
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
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data.startsWith('debounce_set_')) {
      const minutes = data.replace('debounce_set_', '');
      await setSetting('power_debounce_minutes', minutes);
      const { getDebounceKeyboard } = require('../keyboards/inline');
      
      // Display text based on selected value
      const displayValue = minutes === '0' ? 'Вимкнено (без затримок)' : `${minutes} хв`;
      const alertText = minutes === '0' 
        ? '✅ Debounce вимкнено. Сповіщення надходитимуть без затримок.'
        : `✅ Debounce встановлено: ${minutes} хв`;
      
      await bot.answerCallbackQuery(query.id, {
        text: alertText,
        show_alert: true
      });
      
      // Оновити повідомлення з оновленою клавіатурою
      await safeEditMessageText(bot, 
        `⏸ <b>Налаштування Debounce</b>\n\n` +
        `Поточне значення: <b>${displayValue}</b>\n\n` +
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
      const metrics = await getGrowthMetrics();
      const health = await checkGrowthHealth();
      
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
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'growth_metrics') {
      const metrics = await getGrowthMetrics();
      const stageMetrics = await getStageSpecificMetrics();
      
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
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'growth_stage') {
      const currentStage = await getCurrentStage();
      const metrics = await getGrowthMetrics();
      
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
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data.startsWith('growth_stage_')) {
      const stageId = parseInt(data.replace('growth_stage_', ''), 10);
      const stage = Object.values(GROWTH_STAGES).find(s => s.id === stageId);
      
      if (stage) {
        await setGrowthStage(stageId);
        await bot.answerCallbackQuery(query.id, {
          text: `✅ Етап змінено на: ${stage.name}`,
          show_alert: true
        });
        
        // Return to growth stage view
        const currentStage = await getCurrentStage();
        const metrics = await getGrowthMetrics();
        
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
      const enabled = await isRegistrationEnabled();
      const metrics = await getGrowthMetrics();
      
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
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'growth_reg_status') {
      // Just a status indicator, do nothing
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'growth_reg_toggle') {
      const currentEnabled = await isRegistrationEnabled();
      await setRegistrationEnabled(!currentEnabled);
      const newEnabled = !currentEnabled;
      
      await bot.answerCallbackQuery(query.id, {
        text: newEnabled ? '🟢 Реєстрацію увімкнено' : '🔴 Реєстрацію вимкнено',
        show_alert: true
      });
      
      // Refresh view
      const metrics = await getGrowthMetrics();
      
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
      const events = await getRecentGrowthEvents(10);
      
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
      await bot.answerCallbackQuery(query.id);
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
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'admin_clear_db_confirm') {
      // Очистити таблицю users з транзакцією для атомарності
      const { pool } = require('../database/db');
      
      try {
        // Використовуємо транзакцію для забезпечення атомарності
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('DELETE FROM users');
          await client.query('DELETE FROM power_history');
          await client.query('DELETE FROM outage_history');
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
        
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
        await bot.answerCallbackQuery(query.id, { text: '✅ База очищена' });
      } catch (error) {
        console.error('Error clearing database:', error);
        await bot.answerCallbackQuery(query.id, { 
          text: '❌ Помилка очищення бази', 
          show_alert: true 
        });
      }
      return;
    }
    
    if (data === 'admin_restart') {
      const { getRestartConfirmKeyboard } = require('../keyboards/inline');
      
      await safeEditMessageText(bot,
        '🔄 <b>Перезапуск бота</b>\n\n' +
        '⚠️ Бот буде недоступний ~10-15 секунд.\n' +
        'Всі налаштування та дані збережуться.\n\n' +
        'Ви впевнені?',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getRestartConfirmKeyboard().reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === 'admin_restart_confirm') {
      await bot.answerCallbackQuery(query.id, {
        text: '🔄 Перезапуск бота...',
        show_alert: false
      });
      
      await safeEditMessageText(bot,
        '🔄 <b>Перезапуск бота через 3 секунди...</b>\n\n' +
        '⏳ Бот буде доступний через ~10-15 секунд.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
        }
      );
      
      // Graceful shutdown: зберігаємо стани перед виходом
      setTimeout(() => {
        // Wrap everything in try-catch to handle any unhandled promise rejections
        (async () => {
          try {
            // Зберігаємо стани користувачів
            const { stopPowerMonitoring, saveAllUserStates } = require('../powerMonitor');
            await saveAllUserStates();
            stopPowerMonitoring();
            console.log('🔄 Адмін-перезапуск ініційований користувачем', userId);
          } catch (error) {
            console.error('Помилка при graceful shutdown:', error);
          } finally {
            // Always exit, even if there were errors during shutdown
            process.exit(1);
          }
        })();
      }, 3000);
      
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
    await bot.sendMessage(chatId, '❓ Невідома команда. Використовуйте /start для початку.');
    return;
  }
  
  try {
    // Формат: /setinterval schedule 300 або /setinterval power 5
    const type = match[1]; // schedule або power
    const value = parseInt(match[2], 10);
    
    if (type !== 'schedule' && type !== 'power') {
      const { getAdminMenuKeyboard } = require('../keyboards/inline');
      await bot.sendMessage(
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
      await bot.sendMessage(
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
        await bot.sendMessage(
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
        await bot.sendMessage(
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
    await setSetting(key, String(value));
    
    const typeName = type === 'schedule' ? 'перевірки графіка' : 'моніторингу світла';
    await bot.sendMessage(
      chatId,
      `✅ Інтервал ${typeName} встановлено: ${value} сек\n\n` +
      '⚠️ Для застосування змін потрібен перезапуск бота.'
    );
    
  } catch (error) {
    console.error('Помилка в handleSetInterval:', error);
    const { getAdminMenuKeyboard } = require('../keyboards/inline');
    await bot.sendMessage(
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
    await bot.sendMessage(chatId, '❓ Невідома команда. Використовуйте /start для початку.');
    return;
  }
  
  try {
    const value = parseInt(match[1], 10);
    
    if (isNaN(value)) {
      const { getAdminMenuKeyboard } = require('../keyboards/inline');
      await bot.sendMessage(
        chatId, 
        '❌ Значення має бути числом.\n\nОберіть наступну дію:',
        getAdminMenuKeyboard()
      );
      return;
    }
    
    // Валідація: від 0 до 30 хвилин (0 = вимкнено)
    if (value < 0 || value > 30) {
      const { getAdminMenuKeyboard } = require('../keyboards/inline');
      await bot.sendMessage(
        chatId,
        '❌ Час debounce має бути від 0 до 30 хвилин.\n\n' +
        '0 = вимкнено (без затримок)\n' +
        'Рекомендовано: 3-5 хвилин\n\n' +
        'Оберіть наступну дію:',
        getAdminMenuKeyboard()
      );
      return;
    }
    
    // Зберігаємо в БД
    await setSetting('power_debounce_minutes', String(value));
    
    // Display appropriate message based on value
    let message;
    if (value === 0) {
      message = `✅ Debounce вимкнено. Сповіщення надходитимуть без затримок.\n\n` +
        'Зміни застосуються автоматично при наступній перевірці.';
    } else {
      message = `✅ Час debounce встановлено: ${value} хв\n\n` +
        'Нові зміни стану світла будуть публікуватись тільки після ' +
        `${value} хвилин стабільного стану.\n\n` +
        'Зміни застосуються автоматично при наступній перевірці.';
    }
    
    await bot.sendMessage(chatId, message);
    
  } catch (error) {
    console.error('Помилка в handleSetDebounce:', error);
    const { getAdminMenuKeyboard } = require('../keyboards/inline');
    await bot.sendMessage(
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
    await bot.sendMessage(chatId, '❓ Невідома команда. Використовуйте /start для початку.');
    return;
  }
  
  try {
    const value = await getSetting('power_debounce_minutes', '5');
    
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
    const { getAdminMenuKeyboard } = require('../keyboards/inline');
    await bot.sendMessage(
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
    await bot.sendMessage(chatId, '❓ Невідома команда. Використовуйте /start для початку.');
    return;
  }
  
  try {
    const { monitoringManager } = require('../monitoring/monitoringManager');
    const status = await monitoringManager.getStatus();
    const metricsCollector = monitoringManager.getMetricsCollector();
    const alertManager = monitoringManager.getAlertManager();
    
    // Get metrics
    const metrics = await metricsCollector.collectAllMetrics();
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
    
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Помилка в handleMonitoring:', error);
    await bot.sendMessage(chatId, '❌ Виникла помилка при отриманні статусу моніторингу.');
  }
}

// Обробник команди /setalertchannel
async function handleSetAlertChannel(bot, msg, match) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds, config.ownerId)) {
    await bot.sendMessage(chatId, '❓ Невідома команда. Використовуйте /start для початку.');
    return;
  }
  
  try {
    const channelId = match[1].trim();
    
    // Validate channel ID format
    if (!channelId.startsWith('@') && !channelId.startsWith('-')) {
      await bot.sendMessage(
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
      await bot.sendMessage(
        channelId,
        '✅ Канал для алертів налаштовано успішно!\n\n' +
        'Тут будуть публікуватися алерти системи моніторингу.',
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      await bot.sendMessage(
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
    
    await bot.sendMessage(
      chatId,
      `✅ Канал для алертів налаштовано: ${channelId}\n\n` +
      'Тепер усі алерти системи моніторингу будуть публікуватися в цьому каналі.',
      { parse_mode: 'HTML' }
    );
    
  } catch (error) {
    console.error('Помилка в handleSetAlertChannel:', error);
    await bot.sendMessage(chatId, '❌ Виникла помилка при налаштуванні каналу.');
  }
}
