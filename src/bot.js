const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const { handleStart, handleWizardCallback } = require('./handlers/start');
const { handleSchedule, handleNext, handleTimer } = require('./handlers/schedule');
const { handleSettings, handleSettingsCallback } = require('./handlers/settings');
const { handleChannel, handleForwardedMessage } = require('./handlers/channel');
const { handleAdmin, handleStats, handleUsers, handleBroadcast, handleSystem, handleAdminCallback } = require('./handlers/admin');
const { formatHelpMessage } = require('./formatter');
const { formatDurationFromMs } = require('./utils');
const usersDb = require('./database/users');

// Створення бота
const bot = new TelegramBot(config.botToken, { polling: true });

// Зберігаємо ID бота для використання в handlers
bot.options = bot.options || {};

// Обробка помилок polling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

// Команди
bot.onText(/\/start/, (msg) => handleStart(bot, msg));
bot.onText(/\/schedule/, (msg) => handleSchedule(bot, msg));
bot.onText(/\/next/, (msg) => handleNext(bot, msg));
bot.onText(/\/timer/, (msg) => handleTimer(bot, msg));
bot.onText(/\/settings/, (msg) => handleSettings(bot, msg));
bot.onText(/\/channel/, (msg) => handleChannel(bot, msg));
bot.onText(/\/admin/, (msg) => handleAdmin(bot, msg));
bot.onText(/\/stats/, (msg) => handleStats(bot, msg));
bot.onText(/\/users/, (msg) => handleUsers(bot, msg));
bot.onText(/\/broadcast (.+)/, (msg) => handleBroadcast(bot, msg));
bot.onText(/\/system/, (msg) => handleSystem(bot, msg));

// Команда /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, formatHelpMessage(), { parse_mode: 'HTML' });
});

// Кнопка ⚡ Світло
bot.onText(/^⚡ Світло$/, async (msg) => {
  const chatId = msg.chat.id;
  
  const { ROUTER_HOST } = config;
  if (!ROUTER_HOST) {
    await bot.sendMessage(chatId, '⚡ Моніторинг світла не налаштований\n\nДодайте ROUTER_HOST в змінні середовища');
    return;
  }
  
  const { checkRouterAvailability, getPowerState } = require('./powerMonitor');
  const isOnline = await checkRouterAvailability();
  const powerState = getPowerState();
  
  let message = '';
  if (isOnline) {
    message = '🟢 <b>Світло є</b>';
  } else {
    message = '🔴 <b>Світла немає</b>';
  }
  
  if (powerState.changedAt) {
    const durationMs = Date.now() - powerState.changedAt;
    const duration = formatDurationFromMs(durationMs);
    message += `\n🕓 Вже ${duration}`;
  }
  
  await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
});

// Обробка текстових команд з клавіатури
bot.on('message', async (msg) => {
  // Ігноруємо команди
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }
  
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Перевіряємо чи це переслане повідомлення для підключення каналу
  if (msg.forward_from_chat) {
    await handleForwardedMessage(bot, msg);
    return;
  }
  
  // Обробка команд з клавіатури
  if (text === '📋 Графік') {
    await handleSchedule(bot, msg);
  } else if (text === '⏭ Наступне') {
    await handleNext(bot, msg);
  } else if (text === '⏰ Таймер') {
    await handleTimer(bot, msg);
  } else if (text === '⚙️ Налаштування') {
    await handleSettings(bot, msg);
  } else if (text === '📺 Канал') {
    await handleChannel(bot, msg);
  } else if (text === '❓ Допомога') {
    await bot.sendMessage(chatId, formatHelpMessage(), { parse_mode: 'HTML' });
  } else if (text) {
    // Відповідь на невідоме повідомлення
    // Ігноруємо відомі кнопки (вони обробляються окремими onText handlers)
    const knownButtons = [
      '📋 Графік', '⏭ Наступне', '⏰ Таймер',
      '⚙️ Налаштування', '📺 Канал', '❓ Допомога',
      '⚡ Світло'
    ];
    
    if (!knownButtons.includes(text)) {
      await bot.sendMessage(chatId, 
        '🤔 Не розумію цю команду.\n\n' +
        'Використовуйте кнопки меню або команди:\n' +
        '/start - Почати\n' +
        '/schedule - Графік відключень\n' +
        '/help - Допомога'
      );
    }
  }
});

// Обробка callback query
bot.on('callback_query', async (query) => {
  const data = query.data;
  
  // Визначаємо тип callback
  if (data.startsWith('region_') || data.startsWith('group_') || data.startsWith('subgroup_') || 
      data === 'confirm_setup' || data === 'back_to_region' || data === 'back_to_group') {
    await handleWizardCallback(bot, query);
  } else if (data.startsWith('settings_') || data.startsWith('alert_') || 
             data === 'confirm_deactivate' || data === 'back_to_settings') {
    await handleSettingsCallback(bot, query);
  } else if (data.startsWith('admin_')) {
    await handleAdminCallback(bot, query);
  } else if (data === 'back_to_main') {
    await bot.deleteMessage(query.message.chat.id, query.message.message_id);
    await bot.answerCallbackQuery(query.id);
  }
});

// Отримуємо інформацію про бота при запуску
bot.getMe().then((me) => {
  bot.options.id = me.id;
  console.log(`✅ Бот @${me.username} запущено!`);
  console.log(`ID бота: ${me.id}`);
});

module.exports = bot;
