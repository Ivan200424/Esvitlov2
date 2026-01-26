const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const { handleStart, handleWizardCallback } = require('./handlers/start');
const { handleSchedule, handleNext, handleTimer } = require('./handlers/schedule');
const { handleSettings, handleSettingsCallback } = require('./handlers/settings');
const { handleChannel, handleSetChannel, handleConversation, handleChannelCallback, handleCancelChannel, handleForwardedMessage } = require('./handlers/channel');
const { handleAdmin, handleStats, handleUsers, handleBroadcast, handleSystem, handleAdminCallback, handleSetInterval, handleSetDebounce, handleGetDebounce } = require('./handlers/admin');
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
bot.onText(/\/setchannel\s+(@\w+)/, (msg, match) => handleSetChannel(bot, msg, match));
bot.onText(/\/cancel/, (msg) => handleCancelChannel(bot, msg));
bot.onText(/\/admin/, (msg) => handleAdmin(bot, msg));
bot.onText(/\/stats/, (msg) => handleStats(bot, msg));
bot.onText(/\/users/, (msg) => handleUsers(bot, msg));
bot.onText(/\/broadcast (.+)/, (msg) => handleBroadcast(bot, msg));
bot.onText(/\/system/, (msg) => handleSystem(bot, msg));
bot.onText(/\/setinterval\s+(schedule|power)\s+(\d+)/, (msg, match) => handleSetInterval(bot, msg, match));
bot.onText(/\/setdebounce\s+(\d+)/, (msg, match) => handleSetDebounce(bot, msg, match));
bot.onText(/\/debounce$/, (msg) => handleGetDebounce(bot, msg));

// Команда /help
bot.onText(/\/help$/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, formatHelpMessage(), { parse_mode: 'HTML' });
});

// Команда /help_ip
bot.onText(/\/help_ip/, async (msg) => {
  const chatId = msg.chat.id;
  const message = `📖 <b>Як налаштувати моніторинг світла</b>

🌐 <b>Варіант А: Моніторинг роутера через Інтернет</b>

Бот перевіряє доступність вашого роутера через його публічну IP-адресу.

⚠️ <b>Важливо: Потрібна статична IP-адреса</b>

Динамічна IP-адреса не підходить — вона змінюється при перезавантаженні роутера.

📋 <b>Кроки:</b>

1️⃣ <b>Замовте статичну IP у провайдера</b>
   💰 Вартість: ~30-50 грн/міс
   📞 Зверніться до підтримки провайдера

2️⃣ <b>Налаштуйте роутер</b>
   • Увімкніть відповідь на ping (ICMP)
   • Знайдіть: Security → Firewall → "Respond to Ping from WAN"

3️⃣ <b>Дізнайтеся вашу IP</b>
   • Введіть в Google: "my ip"
   • Або: 2ip.ua, whatismyipaddress.com

4️⃣ <b>Додайте IP в бота</b>
   /setip ВАША_IP_АДРЕСА

✅ Готово! Тепер бот моніторить ваше світло.`;
  
  await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
});

// Команда /setip
bot.onText(/\/setip\s+(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const ip = match[1].trim();
  
  // Валідація IP-адреси
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip)) {
    await bot.sendMessage(chatId, '❌ Невірний формат IP-адреси.\n\nПриклад: /setip 91.123.45.67');
    return;
  }
  
  // Перевірка що кожен октет в діапазоні 0-255
  const octets = ip.split('.').map(Number);
  if (octets.some(octet => octet < 0 || octet > 255)) {
    await bot.sendMessage(chatId, '❌ Невірна IP-адреса. Кожне число має бути від 0 до 255.\n\nПриклад: /setip 91.123.45.67');
    return;
  }
  
  // Перевірка чи користувач існує
  const user = usersDb.getUserByTelegramId(telegramId);
  if (!user) {
    await bot.sendMessage(chatId, '❌ Спочатку налаштуйте бота командою /start');
    return;
  }
  
  // Зберігаємо IP
  usersDb.updateUserRouterIp(telegramId, ip);
  await bot.sendMessage(chatId, `✅ IP-адресу збережено: ${ip}\n\nТепер ви можете використовувати кнопку "⚡ Світло" для моніторингу.`);
});

// Команда /removeip
bot.onText(/\/removeip/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  
  const user = usersDb.getUserByTelegramId(telegramId);
  if (!user) {
    await bot.sendMessage(chatId, '❌ Спочатку налаштуйте бота командою /start');
    return;
  }
  
  usersDb.updateUserRouterIp(telegramId, null);
  await bot.sendMessage(chatId, '✅ IP-адресу видалено.');
});

// Команда /myip
bot.onText(/\/myip/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  
  const user = usersDb.getUserByTelegramId(telegramId);
  if (!user) {
    await bot.sendMessage(chatId, '❌ Спочатку налаштуйте бота командою /start');
    return;
  }
  
  if (!user.router_ip) {
    await bot.sendMessage(chatId, 'ℹ️ IP-адреса не налаштована.\n\nВикористайте команду /setip для налаштування.');
    return;
  }
  
  await bot.sendMessage(chatId, `📍 Ваша IP-адреса: ${user.router_ip}`);
});

// Команда /test - тестова публікація графіка
bot.onText(/\/test/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  
  const user = usersDb.getUserByTelegramId(telegramId);
  if (!user) {
    await bot.sendMessage(chatId, '❌ Спочатку налаштуйте бота командою /start');
    return;
  }
  
  if (!user.channel_id) {
    await bot.sendMessage(chatId, '❌ Спочатку підключіть канал командою /channel');
    return;
  }
  
  await bot.sendMessage(chatId, '🔄 Відправляю тестове повідомлення в канал...');
  
  try {
    const { publishScheduleWithPhoto } = require('./publisher');
    const sentMsg = await publishScheduleWithPhoto(bot, user, user.region, user.queue);
    
    // Зберігаємо ID останнього поста
    usersDb.updateUserPostId(user.id, sentMsg.message_id);
    
    await bot.sendMessage(chatId, `✅ Тестове повідомлення відправлено!\n\nID повідомлення: ${sentMsg.message_id}`);
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Помилка відправки:\n\n${error.message}`);
  }
});

// Кнопка ⚡ Світло
bot.onText(/^⚡ Світло$/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  
  // Перевіряємо чи користувач налаштував IP
  const user = usersDb.getUserByTelegramId(telegramId);
  if (!user) {
    await bot.sendMessage(chatId, '❌ Спочатку налаштуйте бота командою /start');
    return;
  }
  
  if (!user.router_ip) {
    const message = `⚡ <b>Моніторинг світла не налаштовано</b>

Щоб налаштувати:
1️⃣ Замовте статичну IP-адресу у провайдера (~30-50 грн/міс)
2️⃣ Налаштуйте роутер (увімкніть відповідь на ping)
3️⃣ Введіть команду: /setip ВАША_IP_АДРЕСА

📖 Детальніше: /help_ip`;
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    return;
  }
  
  // Перевіряємо роутер користувача
  const { checkRouterAvailability } = require('./powerMonitor');
  const isOnline = await checkRouterAvailability(user.router_ip);
  
  let message = '';
  if (isOnline === null) {
    message = '❌ Не вдалося перевірити роутер. Спробуйте пізніше.';
  } else if (isOnline) {
    message = '🟢 <b>Світло є</b>';
  } else {
    message = '🔴 <b>Світла немає</b>';
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
  
  // Handle IP setup conversation
  const { ipSetupStates } = require('./handlers/settings');
  const ipState = ipSetupStates.get(String(msg.from.id));
  if (ipState && text) {
    const telegramId = String(msg.from.id);
    const ip = text.trim();
    
    // Валідація IP-адреси
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      await bot.sendMessage(chatId, '❌ Невірний формат IP-адреси.\n\nПриклад: 192.168.1.1');
      return;
    }
    
    // Перевірка що кожен октет в діапазоні 0-255
    const octets = ip.split('.').map(Number);
    if (octets.some(octet => octet < 0 || octet > 255)) {
      await bot.sendMessage(chatId, '❌ Невірна IP-адреса. Кожне число має бути від 0 до 255.');
      return;
    }
    
    // Зберігаємо IP
    usersDb.updateUserRouterIp(telegramId, ip);
    
    // Clear timeout
    if (ipState.timeout) {
      clearTimeout(ipState.timeout);
    }
    ipSetupStates.delete(telegramId);
    
    // Update the original message
    try {
      await bot.editMessageText(
        `✅ IP-адресу збережено: ${ip}`,
        {
          chat_id: chatId,
          message_id: ipState.messageId,
        }
      );
    } catch (e) {
      await bot.sendMessage(chatId, `✅ IP-адресу збережено: ${ip}`);
    }
    
    return;
  }
  
  // Handle conversation for channel setup
  if (text && await handleConversation(bot, msg)) {
    return;
  }
  
  // Обробка команд з клавіатури
  if (text === '📊 Графік') {
    await handleSchedule(bot, msg);
  } else if (text === '💡 Статус') {
    // Handle status - check router availability
    const telegramId = String(msg.from.id);
    const user = usersDb.getUserByTelegramId(telegramId);
    
    if (!user) {
      await bot.sendMessage(chatId, '❌ Спочатку налаштуйте бота командою /start');
      return;
    }
    
    if (!user.router_ip) {
      const message = `💡 <b>Статус світла</b>\n\nМоніторинг не налаштовано.\n\nНалаштуйте IP-адресу в меню: ⚙️ Налаштування → 🌐 IP моніторинг`;
      await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
      return;
    }
    
    const { checkRouterAvailability } = require('./powerMonitor');
    const isOnline = await checkRouterAvailability(user.router_ip);
    
    let message = '';
    if (isOnline === null) {
      message = '❌ Не вдалося перевірити роутер. Спробуйте пізніше.';
    } else if (isOnline) {
      message = '🟢 <b>Світло є</b>';
    } else {
      message = '🔴 <b>Світла немає</b>';
    }
    
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } else if (text === '⚙️ Налаштування') {
    await handleSettings(bot, msg);
  } else if (text === '❓ Допомога') {
    const { getHelpKeyboard } = require('./keyboards/inline');
    const { formatHelpMessage } = require('./formatter');
    await bot.sendMessage(chatId, formatHelpMessage(), { 
      parse_mode: 'HTML',
      ...getHelpKeyboard()
    });
  } else if (text) {
    // Відповідь на невідоме повідомлення
    // Ігноруємо відомі кнопки (вони обробляються окремими onText handlers)
    const knownButtons = [
      '📊 Графік', '💡 Статус',
      '⚙️ Налаштування', '❓ Допомога'
    ];
    
    if (!knownButtons.includes(text)) {
      await bot.sendMessage(chatId, 
        '🤔 Не розумію цю команду.\n\n' +
        'Використовуйте кнопки меню або введіть /help'
      );
    }
  }
});

// Обробка callback query
bot.on('callback_query', async (query) => {
  const data = query.data;
  
  // Обробка кнопок каналу (таймер і статистика)
  if (data.startsWith('timer_')) {
    const userId = parseInt(data.replace('timer_', ''));
    const user = usersDb.getUserById(userId);
    
    if (!user) {
      await bot.answerCallbackQuery(query.id, { text: '❌ Користувача не знайдено' });
      return;
    }
    
    // Отримуємо дані про наступну подію
    const { parseScheduleForQueue, findNextEvent } = require('./parser');
    const { fetchScheduleData } = require('./api');
    const { formatExactDuration } = require('./utils');
    
    try {
      const data = await fetchScheduleData(user.region);
      const scheduleData = parseScheduleForQueue(data, user.queue);
      const nextEvent = findNextEvent(scheduleData);
      
      let popupMessage = '';
      
      if (!nextEvent) {
        popupMessage = '✅ Відключень не заплановано';
      } else if (nextEvent.type === 'power_off') {
        const duration = formatExactDuration(nextEvent.minutes);
        // Use Kyiv timezone
        const startTime = new Date(nextEvent.time).toLocaleTimeString('uk-UA', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Europe/Kyiv'
        });
        const endTime = nextEvent.endTime ? new Date(nextEvent.endTime).toLocaleTimeString('uk-UA', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Europe/Kyiv'
        }) : '??:??';
        popupMessage = `⏰ До відключення: ${duration}\n🪫 ${startTime} - ${endTime}`;
      } else {
        const duration = formatExactDuration(nextEvent.minutes);
        const startTime = nextEvent.startTime ? new Date(nextEvent.startTime).toLocaleTimeString('uk-UA', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Europe/Kyiv'
        }) : '??:??';
        const endTime = new Date(nextEvent.time).toLocaleTimeString('uk-UA', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Europe/Kyiv'
        });
        popupMessage = `⏰ До появи світла: ${duration}\n🔋 ${startTime} - ${endTime}`;
      }
      
      await bot.answerCallbackQuery(query.id, { text: popupMessage, show_alert: true });
    } catch (error) {
      console.error('Error in timer callback:', error);
      await bot.answerCallbackQuery(query.id, { text: '❌ Помилка отримання даних' });
    }
    
    return;
  }
  
  if (data.startsWith('stats_')) {
    const userId = parseInt(data.replace('stats_', ''));
    const user = usersDb.getUserById(userId);
    
    // Check if user has router_ip configured
    if (!user || !user.router_ip) {
      await bot.answerCallbackQuery(query.id, { 
        text: 'Налаштуйте моніторинг командою /setip для збору статистики', 
        show_alert: true 
      });
      return;
    }
    
    const { getWeeklyStats } = require('./statistics');
    const { formatStatsForChannelPopup } = require('./formatter');
    
    try {
      const stats = getWeeklyStats(userId);
      const message = formatStatsForChannelPopup(stats);
      await bot.answerCallbackQuery(query.id, { text: message, show_alert: true });
    } catch (error) {
      console.error('Error in stats callback:', error);
      await bot.answerCallbackQuery(query.id, { text: '❌ Помилка отримання статистики' });
    }
    
    return;
  }
  
  // Help menu callbacks
  if (data.startsWith('help_')) {
    if (data === 'help_howto') {
      const message = 
        `📖 <b>Як користуватись</b>\n\n` +
        `1️⃣ Налаштуйте регіон і чергу через /start\n` +
        `2️⃣ Бот автоматично перевіряє графіки\n` +
        `3️⃣ Підключіть канал для публікацій\n` +
        `4️⃣ Налаштуйте IP для моніторингу світла\n\n` +
        `Використовуйте меню для доступу до всіх функцій!`;
      
      await bot.answerCallbackQuery(query.id, { text: message, show_alert: true });
      return;
    }
    
    if (data === 'help_faq') {
      const message = 
        `⚠️ <b>Проблеми та рішення</b>\n\n` +
        `❓ Не приходять сповіщення?\n` +
        `→ Перевірте налаштування в меню\n\n` +
        `❓ Канал не працює?\n` +
        `→ Переконайтесь що бот є адміном\n\n` +
        `❓ IP моніторинг не працює?\n` +
        `→ Потрібна статична IP від провайдера`;
      
      await bot.answerCallbackQuery(query.id, { text: message, show_alert: true });
      return;
    }
  }
  
  // Statistics menu callbacks
  if (data.startsWith('stats_') && data !== 'stats_week' && data !== 'stats_device' && data !== 'stats_settings') {
    // This is for channel stats button (stats_{userId})
    // Already handled above, so we skip
  } else if (data === 'stats_week') {
    const telegramId = String(query.from.id);
    const user = usersDb.getUserByTelegramId(telegramId);
    
    if (!user || !user.router_ip) {
      await bot.answerCallbackQuery(query.id, { 
        text: 'Налаштуйте IP моніторинг для збору статистики', 
        show_alert: true 
      });
      return;
    }
    
    const { getWeeklyStats } = require('./statistics');
    const { formatStatsForChannelPopup } = require('./formatter');
    
    try {
      const stats = getWeeklyStats(user.id);
      const message = formatStatsForChannelPopup(stats);
      await bot.answerCallbackQuery(query.id, { text: message, show_alert: true });
    } catch (error) {
      console.error('Error in stats callback:', error);
      await bot.answerCallbackQuery(query.id, { text: '❌ Помилка отримання статистики' });
    }
    return;
  } else if (data === 'stats_device') {
    const telegramId = String(query.from.id);
    const user = usersDb.getUserByTelegramId(telegramId);
    
    if (!user || !user.router_ip) {
      await bot.answerCallbackQuery(query.id, { 
        text: 'Налаштуйте IP моніторинг', 
        show_alert: true 
      });
      return;
    }
    
    const { checkRouterAvailability } = require('./powerMonitor');
    const isOnline = await checkRouterAvailability(user.router_ip);
    
    let message = '';
    if (isOnline === null) {
      message = '❌ Не вдалося перевірити роутер';
    } else if (isOnline) {
      message = '🟢 Пристрій онлайн\nСвітло є';
    } else {
      message = '🔴 Пристрій офлайн\nСвітла немає';
    }
    
    await bot.answerCallbackQuery(query.id, { text: message, show_alert: true });
    return;
  } else if (data === 'stats_settings') {
    const telegramId = String(query.from.id);
    const user = usersDb.getUserByTelegramId(telegramId);
    const { REGIONS } = require('./constants/regions');
    
    if (!user) {
      await bot.answerCallbackQuery(query.id, { text: '❌ Користувача не знайдено' });
      return;
    }
    
    const region = REGIONS[user.region]?.name || user.region;
    const message = 
      `⚙️ <b>Мої налаштування</b>\n\n` +
      `📍 Регіон: ${region}\n` +
      `⚡ Черга: GPV${user.queue}\n` +
      `📺 Канал: ${user.channel_id ? '✅' : '❌'}\n` +
      `🌐 IP: ${user.router_ip ? '✅' : '❌'}\n` +
      `🔔 Сповіщення: ${user.is_active ? '✅' : '❌'}`;
    
    await bot.answerCallbackQuery(query.id, { text: message, show_alert: true });
    return;
  }
  
  // IP menu callbacks - route to settings handler
  if (data.startsWith('ip_')) {
    await handleSettingsCallback(bot, query);
    return;
  }
  
  // Channel menu callbacks (channel_info, channel_change, channel_disable)
  if (data === 'channel_info') {
    const telegramId = String(query.from.id);
    const user = usersDb.getUserByTelegramId(telegramId);
    
    if (!user || !user.channel_id) {
      await bot.answerCallbackQuery(query.id, { text: 'Канал не підключено' });
      return;
    }
    
    const message = 
      `ℹ️ <b>Інформація про канал</b>\n\n` +
      `ID: ${user.channel_id}\n` +
      `Назва: ${user.channel_title || 'Невідомо'}\n` +
      `Статус: ${user.channel_status === 'active' ? '✅ Активний' : '🔴 Неактивний'}`;
    
    await bot.answerCallbackQuery(query.id, { text: message, show_alert: true });
    return;
  } else if (data === 'channel_change') {
    await bot.answerCallbackQuery(query.id, { 
      text: 'Використайте команду /channel для зміни каналу',
      show_alert: true 
    });
    return;
  } else if (data === 'channel_disable') {
    const telegramId = String(query.from.id);
    const user = usersDb.getUserByTelegramId(telegramId);
    
    if (!user || !user.channel_id) {
      await bot.answerCallbackQuery(query.id, { text: 'Канал не підключено' });
      return;
    }
    
    usersDb.updateUserChannel(telegramId, null, null, null, null, null);
    
    await bot.editMessageText(
      '✅ Публікацію в канал вимкнено',
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
      }
    );
    await bot.answerCallbackQuery(query.id);
    return;
  }
  
  // Restore settings callback
  if (data === 'restore_settings') {
    const telegramId = String(query.from.id);
    usersDb.setUserActive(telegramId, true);
    
    await bot.editMessageText(
      '✅ Налаштування відновлено!\n\nВикористовуйте меню для роботи з ботом.',
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
      }
    );
    
    // Send main menu
    const { getMainMenu } = require('./keyboards/inline');
    await bot.sendMessage(query.message.chat.id, 'Головне меню:', getMainMenu());
    
    await bot.answerCallbackQuery(query.id);
    return;
  } else if (data === 'start_new') {
    const telegramId = String(query.from.id);
    const username = query.from.username || query.from.first_name;
    
    // Delete user and start wizard
    usersDb.deleteUser(telegramId);
    
    await bot.deleteMessage(query.message.chat.id, query.message.message_id);
    
    const { startWizard } = require('./handlers/start');
    await startWizard(bot, query.message.chat.id, telegramId, username, 'new');
    
    await bot.answerCallbackQuery(query.id);
    return;
  }
  
  // Визначаємо тип callback
  if (data.startsWith('channel_')) {
    await handleChannelCallback(bot, query);
  } else if (data.startsWith('region_') || data.startsWith('group_') || data.startsWith('subgroup_') || 
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
