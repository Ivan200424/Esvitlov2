const usersDb = require('../database/users');
const { getAdminKeyboard } = require('../keyboards/inline');
const { isAdmin, formatUptime, formatMemory } = require('../utils');
const config = require('../config');
const { REGIONS } = require('../constants/regions');

// Обробник команди /admin
async function handleAdmin(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  if (!isAdmin(userId, config.adminIds)) {
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
  
  if (!isAdmin(userId, config.adminIds)) {
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
  
  if (!isAdmin(userId, config.adminIds)) {
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
      message += `   ${regionName}, GPV${user.queue} ${channel}\n`;
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
  
  if (!isAdmin(userId, config.adminIds)) {
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
  
  if (!isAdmin(userId, config.adminIds)) {
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
  
  if (!isAdmin(userId, config.adminIds)) {
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
        message += `   ${regionName}, GPV${user.queue} ${channel}\n\n`;
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
    
  } catch (error) {
    console.error('Помилка в handleAdminCallback:', error);
    await bot.answerCallbackQuery(query.id, { text: '❌ Виникла помилка' });
  }
}

module.exports = {
  handleAdmin,
  handleStats,
  handleUsers,
  handleBroadcast,
  handleSystem,
  handleAdminCallback,
};
