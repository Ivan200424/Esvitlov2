const usersDb = require('../database/users');
const { getAdminKeyboard, getAlertTimeKeyboard, getAlertsSettingsKeyboard, getChannelMenuKeyboard, getDeactivateConfirmKeyboard, getDeleteDataConfirmKeyboard, getDeleteDataFinalKeyboard, getErrorKeyboard, getIpCancelKeyboard, getIpMonitoringKeyboard, getMainMenu, getNotifyTargetKeyboard, getSettingsKeyboard, getUnifiedAlertsKeyboard } = require('../keyboards/inline');
const { REGIONS } = require('../constants/regions');
const { startWizard } = require('./start');
const { isAdmin, generateLiveStatusMessage } = require('../utils');
const config = require('../config');
const { formatErrorMessage } = require('../formatter');
const { safeSendMessage, safeDeleteMessage, safeEditMessageText, safeAnswerCallbackQuery } = require('../utils/errorHandler');
const { logIpMonitoringSetup } = require('../growthMetrics');
const { getState, setState, clearState } = require('../state/stateManager');
const { getUserIpStatus } = require('../powerMonitor');
const { publishScheduleWithPhoto } = require('../publisher');

// Helper functions to manage IP setup states (now using centralized state manager)
async function setIpSetupState(telegramId, data) {
  // Don't persist timeout handlers - they contain function references
  const { warningTimeout, finalTimeout, timeout, ...persistData } = data;
  await setState('ipSetup', telegramId, persistData);
}

function getIpSetupState(telegramId) {
  return getState('ipSetup', telegramId);
}

async function clearIpSetupState(telegramId) {
  const state = getState('ipSetup', telegramId);
  if (state) {
    // Очищаємо таймери перед видаленням
    if (state.warningTimeout) clearTimeout(state.warningTimeout);
    if (state.finalTimeout) clearTimeout(state.finalTimeout);
    if (state.timeout) clearTimeout(state.timeout);
  }
  await clearState('ipSetup', telegramId);
}

// Helper function to send main menu
async function sendMainMenu(bot, chatId, telegramId) {
  const user = await usersDb.getUserByTelegramId(telegramId);
  
  let botStatus = 'active';
  if (!user.channel_id) {
    botStatus = 'no_channel';
  } else if (!user.is_active) {
    botStatus = 'paused';
  }
  const channelPaused = user.channel_paused === true;
  
  await bot.api.sendMessage(
    chatId,
    '🏠 <b>Головне меню</b>',
    {
      parse_mode: 'HTML',
      ...getMainMenu(botStatus, channelPaused),
    }
  ).catch(() => {});
}

/**
 * Відновити IP setup стани з БД при запуску бота
 * NOTE: This is now handled by centralized state manager, kept for backward compatibility
 */
function restoreIpSetupStates() {
  // State restoration is now handled by initStateManager()
  console.log('✅ IP setup states restored by centralized state manager');
}

// Build the alerts message in tree format
function buildAlertsMessage(isActive, currentTarget) {
  const targetLabels = {
    'bot': '📱 Тільки в бот',
    'channel': '📺 Тільки в канал',
    'both': '📱📺 В бот і канал'
  };
  let message = `🔔 <b>Сповіщення</b>\n\n`;
  message += `Статус: <b>${isActive ? '✅ Увімкнено' : '❌ Вимкнено'}</b>\n`;
  if (isActive) {
    message += `Куди: <b>${targetLabels[currentTarget]}</b>\n`;
    message += '\n';
    message += `Ви отримуєте:\n`;
    message += `• Зміни графіка\n`;
    message += `• Фактичні відключення`;
  } else {
    message += '\n';
    message += `Увімкніть сповіщення щоб отримувати\nінформацію про зміни графіка та\nфактичні відключення.`;
  }
  return message;
}

// IP address and domain validation function
function isValidIPorDomain(input) {
  const trimmed = input.trim();
  
  if (trimmed.includes(' ')) {
    return { valid: false, error: 'Адреса не може містити пробіли' };
  }
  
  // Розділяємо на хост і порт
  let host = trimmed;
  let port = null;
  
  // Перевіряємо чи є порт (останній :число)
  const portMatch = trimmed.match(/^(.+):(\d+)$/);
  if (portMatch) {
    host = portMatch[1];
    port = parseInt(portMatch[2], 10);
    
    if (isNaN(port) || port < 1 || port > 65535) {
      return { valid: false, error: 'Порт має бути від 1 до 65535' };
    }
  }
  
  // Перевірка IPv4
  const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipMatch = host.match(ipRegex);
  
  if (ipMatch) {
    // Валідація октетів
    for (let i = 1; i <= 4; i++) {
      const num = parseInt(ipMatch[i], 10);
      if (isNaN(num) || num < 0 || num > 255) {
        return { valid: false, error: 'Кожне число в IP-адресі має бути від 0 до 255' };
      }
    }
    return { valid: true, address: trimmed, host, port, type: 'ip' };
  }
  
  // Перевірка доменного імені (DDNS)
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
  
  if (domainRegex.test(host)) {
    return { valid: true, address: trimmed, host, port, type: 'domain' };
  }
  
  return { valid: false, error: 'Невірний формат. Введіть IP-адресу або доменне імʼя.\n\nПриклади:\n• 89.167.32.1\n• 89.167.32.1:80\n• myhome.ddns.net' };
}

// Обробник команди /settings
async function handleSettings(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  
  try {
    const user = await usersDb.getUserByTelegramId(telegramId);
    
    if (!user) {
      await safeSendMessage(bot, chatId, '❌ Спочатку запустіть бота, натиснувши /start');
      return;
    }
    
    // Delete previous settings message if exists
    if (user.last_settings_message_id) {
      await safeDeleteMessage(bot, chatId, user.last_settings_message_id);
    }
    
    const userIsAdmin = isAdmin(telegramId, config.adminIds, config.ownerId);
    const regionName = REGIONS[user.region]?.name || user.region;
    
    // Generate Live Status message using helper function
    const message = generateLiveStatusMessage(user, regionName);
    
    const sentMessage = await safeSendMessage(bot, chatId, message, {
      parse_mode: 'HTML',
      ...getSettingsKeyboard(userIsAdmin),
    });
    
    if (sentMessage) {
      await usersDb.updateUser(telegramId, { last_settings_message_id: sentMessage.message_id });
    }
    
  } catch (error) {
    console.error('Помилка в handleSettings:', error);
    const errorKeyboard = await getErrorKeyboard();
    await safeSendMessage(bot, chatId, formatErrorMessage(), {
      parse_mode: 'HTML',
      ...errorKeyboard
    });
  }
}

// Обробник callback для налаштувань
async function handleSettingsCallback(bot, query) {
  const chatId = query.message.chat.id;
  const telegramId = String(query.from.id);
  const data = query.data;
  
  try {
    const user = await usersDb.getUserByTelegramId(telegramId);
    
    if (!user) {
      await safeAnswerCallbackQuery(bot, query.id, { text: '❌ Користувача не знайдено' });
      return;
    }
    
    // Answer callback query immediately to prevent timeout (after user validation)
    await bot.api.answerCallbackQuery(query.id).catch(() => {});
    
    // Показати підтвердження перед зміною черги
    if (data === 'settings_region') {
      const confirmKeyboard = {
        inline_keyboard: [
          [
            { text: 'Так, змінити', callback_data: 'settings_region_confirm', icon_custom_emoji_id: '5206607081334906820' },
            { text: 'Скасувати', callback_data: 'back_to_settings', icon_custom_emoji_id: '5210952531676504517' }
          ]
        ]
      };
      
      await safeEditMessageText(bot,
        '<tg-emoji emoji-id="5447644880824181073">⚠️</tg-emoji> <b>Зміна регіону/черги</b>\n\n' +
        'Поточні налаштування:\n' +
        `<tg-emoji emoji-id="5399898266265475100">📍</tg-emoji> Регіон: ${REGIONS[user.region]?.name || user.region}\n` +
        `<tg-emoji emoji-id="5390854796011906616">🔢</tg-emoji> Черга: ${user.queue}\n\n` +
        'Ви впевнені, що хочете змінити регіон або чергу?',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: confirmKeyboard,
        }
      );
      return;
    }
    
    // Підтвердження зміни черги
    if (data === 'settings_region_confirm') {
      // Видаляємо попереднє повідомлення
      try {
        await bot.api.deleteMessage(chatId, query.message.message_id);
      } catch (e) {
        // Ігноруємо помилки видалення
      }
      
      // Запускаємо wizard в режимі редагування
      const username = query.from.username || query.from.first_name;
      await startWizard(bot, chatId, telegramId, username, 'edit');
      
      return;
    }
    
    // Налаштування алертів - unified menu
    if (data === 'settings_alerts') {
      const currentTarget = user.power_notify_target || 'both';
      
      await safeEditMessageText(bot, buildAlertsMessage(user.is_active, currentTarget), {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getUnifiedAlertsKeyboard(user.is_active, currentTarget).reply_markup,
      });
      return;
    }
    
    // Toggle alerts on/off - unified menu
    if (data === 'alert_toggle') {
      const newValue = !user.is_active;
      await usersDb.setUserActive(telegramId, newValue);
      
      const updatedUser = await usersDb.getUserByTelegramId(telegramId);
      const currentTarget = updatedUser.power_notify_target || 'both';
      
      await safeEditMessageText(bot, buildAlertsMessage(updatedUser.is_active, currentTarget), {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getUnifiedAlertsKeyboard(updatedUser.is_active, currentTarget).reply_markup,
      });
      return;
    }
    
    // Delete data - Step 1
    if (data === 'settings_delete_data') {
      await safeEditMessageText(bot,
        '⚠️ <b>Увага</b>\n\n' +
        'Ви збираєтесь видалити всі дані:\n\n' +
        '• Обраний регіон та чергу\n' +
        '• Підключений канал\n' +
        '• IP-адресу роутера\n' +
        '• Налаштування сповіщень\n' +
        '• Статистику відключень\n\n' +
        'Цю дію неможливо скасувати.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getDeleteDataConfirmKeyboard().reply_markup,
        }
      );
      return;
    }
    
    // Delete data - Step 2
    if (data === 'delete_data_step2') {
      await safeEditMessageText(bot,
        '❗ <b>Підтвердження</b>\n\n' +
        'Видалити всі дані?',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getDeleteDataFinalKeyboard().reply_markup,
        }
      );
      return;
    }
    
    // Confirm delete data - Final
    if (data === 'confirm_delete_data') {
      // Delete user from database
      await usersDb.deleteUser(telegramId);
      
      await safeEditMessageText(bot,
        'Добре, домовились 🙂\n' +
        'Я видалив усі дані та відключив канал.\n\n' +
        'Якщо захочете повернутись — просто напишіть /start.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
        }
      );
      return;
    }
    
    // Деактивувати бота
    if (data === 'settings_deactivate') {
      await safeEditMessageText(bot,
        '❗️ Ви впевнені, що хочете деактивувати бота?\n\n' +
        'Ви перестанете отримувати сповіщення про зміни графіка.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: getDeactivateConfirmKeyboard().reply_markup,
        }
      );
      return;
    }
    
    // Підтвердження деактивації
    if (data === 'confirm_deactivate') {
      await usersDb.setUserActive(telegramId, false);
      
      await safeEditMessageText(bot,
        '✅ Бот деактивовано.\n\n' +
        'Використайте /start для повторної активації.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
        }
      );
      
      // Send main menu after successful deactivation
      await bot.api.sendMessage(
        chatId,
        '🏠 <b>Головне меню</b>',
        {
          parse_mode: 'HTML',
          ...getMainMenu('paused', false),
        }
      );
      return;
    }
    
    // IP моніторинг меню
    if (data === 'settings_ip') {
      await safeEditMessageText(bot,
        '🌐 <b>IP моніторинг</b>\n\n' +
        `Поточна IP: ${user.router_ip || 'не налаштовано'}\n\n` +
        'Оберіть опцію:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getIpMonitoringKeyboard().reply_markup,
        }
      );
      return;
    }
    
    // IP instruction
    if (data === 'ip_instruction') {
      const instructionText = `ℹ️ <b>Налаштування моніторингу через IP</b>

Налаштування може здатися складним, особливо якщо ви не айтішник,
але всі кроки можна виконати самостійно.
Нижче описано, як саме працює моніторинг і що потрібно для його коректної роботи.

━━━━━━━━━━━━━━━━━━━━

🔌 <b>Важливі умови</b>

Для роботи IP-моніторингу потрібен роутер,
який стає недоступним при вимкненні електроенергії.

Зверніть увагу:
• якщо роутер підключений до ДБЖ або powerbank'у,
  він не вимикатиметься разом зі світлом
• у такому випадку потрібно вказати інший роутер —
  саме той, який втрачає живлення під час відключень

У деяких ситуаціях також може знадобитися налаштування Port Forwarding
на головному роутері, щоб доступ до потрібного пристрою
був можливий з інтернету.

━━━━━━━━━━━━━━━━━━━━

⚡ <b>Принцип роботи</b>

СвітлоБот перевіряє доступність вашого роутера ззовні.
Якщо роутер перестає відповідати — вважається, що світло зникло.
Коли доступ до роутера відновлюється — світло зʼявилось.

Перевірка виконується автоматично сервером
і не потребує додаткових дій після налаштування.

━━━━━━━━━━━━━━━━━━━━

🛠 <b>Варіанти налаштування</b>

1️⃣ <b>Використання статичної IP-адреси</b>

Деякі інтернет-провайдери надають статичну IP-адресу,
але часто це окрема платна послуга.

Варто врахувати:
• динамічна IP-адреса може змінюватися
• у такому разі моніторинг працюватиме некоректно

Корисні сервіси для перевірки:
• Визначення вашої IP-адреси: https://2ip.ua/ua
• Перевірка доступності з інтернету:
  https://2ip.ua/ua/services/ip-service/ping-traceroute
• Перевірка відкритих портів (Port Forwarding):
  https://2ip.ua/ua/services/ip-service/port-check

━━━━━━━━━━━━━━━━━━━━

2️⃣ <b>Доменне імʼя DDNS (альтернатива статичній IP)</b>

DDNS (Dynamic Domain Name System) дозволяє
підключатися до роутера через доменне імʼя,
навіть якщо IP-адреса змінюється.

У цьому випадку роутер самостійно оновлює інформацію
про свою поточну IP-адресу,
а моніторинг продовжує працювати без переривань.

Що потрібно зробити:
• увімкнути DDNS у налаштуваннях роутера
• скопіювати згенероване доменне імʼя
• вставити його сюди

━━━━━━━━━━━━━━━━━━━━

📘 <b>Інструкції з налаштування DDNS</b>

• ASUS — https://www.asus.com/ua-ua/support/FAQ/1011725/
• TP-Link:
  – https://help-wifi.com/tp-link/nastrojka-ddns-dinamicheskij-dns-na-routere-tp-link/
  – https://www.youtube.com/watch?v=Q97_8XVyBuo
• NETGEAR — https://www.hardreset.info/uk/devices/netgear/netgear-dgnd3700v2/faq/dns-settings/how-to-change-dns/
• D-Link — https://yesondd.com/361-dlinkddns-com-remote-access-to-d-link-wifi-router-via-internet-via-ddns
• MikroTik — https://xn----7sba7aachdbqfnhtigrl.xn--j1amh/nastrojka-mikrotik-cloud-sobstvennyj-ddns/
• Xiaomi — https://www.hardreset.info/ru/devices/xiaomi/xiaomi-mi-router-4a/nastroyki-dns/

Багато роутерів також підтримують сторонні DDNS-сервіси
(наприклад, noip.com), навіть якщо вбудованого клієнта DDNS немає.
У такому випадку налаштування виконується вручну.

━━━━━━━━━━━━━━━━━━━━

✍️ <b>Що потрібно ввести</b>

Після налаштування статичної IP-адреси або DDNS
поверніться назад і натисніть «Підключити IP».

Приклади форматів:
• 89.267.32.1
• 89.267.32.1:80 (80 — ваш порт)
• myhome.ddns.net`;

      // Кнопки навігації під інструкцією
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '← Назад', callback_data: 'settings_ip' },
              { text: '⤴ Меню', callback_data: 'back_to_main' }
            ]
          ]
        }
      };

      await bot.api.editMessageText(chatId, query.message.message_id, instructionText, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...keyboard
      });
      
      return;
    }
    
    // IP setup
    if (data === 'ip_setup') {
      // Check if user already has an IP address
      if (user.router_ip) {
        await safeEditMessageText(bot,
          '⚠️ У вас вже додана IP-адреса:\n\n' +
          `📡 ${user.router_ip}\n\n` +
          'Щоб додати нову адресу — спочатку видаліть поточну.',
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🗑 Видалити адресу', callback_data: 'ip_delete' }
                ],
                [
                  { text: '← Назад', callback_data: 'settings_ip' },
                  { text: '⤴ Меню', callback_data: 'back_to_main' }
                ]
              ]
            }
          }
        );
        return;
      }
      
      await safeEditMessageText(bot,
        '🌐 <b>Налаштування IP</b>\n\n' +
        'Надішліть IP-адресу вашого роутера або DDNS домен.\n\n' +
        'Приклади:\n' +
        '• 89.267.32.1\n' +
        '• 89.267.32.1:80\n' +
        '• myhome.ddns.net\n\n' +
        '⏰ Час очікування введення: 5 хвилин',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getIpCancelKeyboard().reply_markup,
        }
      );
      
      // Set up warning timeout (4 minutes = 5 minutes - 1 minute)
      const warningTimeout = setTimeout(() => {
        bot.api.sendMessage(
          chatId,
          '⏳ Залишилась 1 хвилина.\n' +
          'Надішліть IP-адресу або продовжіть пізніше.'
        ).catch(() => {});
      }, 240000); // 4 minutes
      
      // Set up final timeout (5 minutes)
      const finalTimeout = setTimeout(async () => {
        await clearIpSetupState(telegramId);
        
        // Send timeout message with navigation buttons
        const user = await usersDb.getUserByTelegramId(telegramId);
        
        let botStatus = 'active';
        if (!user.channel_id) {
          botStatus = 'no_channel';
        } else if (!user.is_active) {
          botStatus = 'paused';
        }
        const channelPaused = user.channel_paused === true;
        
        await bot.api.sendMessage(
          chatId,
          '⌛ <b>Час вийшов.</b>\n' +
          'Режим налаштування IP завершено.\n\n' +
          'Оберіть наступну дію:',
          { 
            parse_mode: 'HTML',
            ...getMainMenu(botStatus, channelPaused)
          }
        ).catch(() => {});
      }, 300000); // 5 minutes
      
      await setIpSetupState(telegramId, {
        messageId: query.message.message_id,
        warningTimeout: warningTimeout,
        finalTimeout: finalTimeout,
        timestamp: Date.now()
      });
      
      return;
    }
    
    // IP cancel
    if (data === 'ip_cancel') {
      const state = getIpSetupState(telegramId);
      if (state) {
        if (state.warningTimeout) clearTimeout(state.warningTimeout);
        if (state.finalTimeout) clearTimeout(state.finalTimeout);
        if (state.timeout) clearTimeout(state.timeout); // backwards compatibility
        await clearIpSetupState(telegramId);
      }
      
      await safeEditMessageText(bot,
        '❌ Налаштування IP скасовано.\n\nОберіть наступну дію:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '← Назад', callback_data: 'settings_ip' },
                { text: '⤴ Меню', callback_data: 'back_to_main' }
              ]
            ]
          }
        }
      );
      return;
    }
    
    // IP show
    if (data === 'ip_show') {
      if (!user.router_ip) {
        await safeAnswerCallbackQuery(bot, query.id, { 
          text: 'ℹ️ IP-адреса не налаштована',
          show_alert: true 
        });
        return;
      }
      
      // Get IP monitoring status
      const ipStatus = getUserIpStatus(user.telegram_id);
      
      const statusInfo = [
        `📍 IP-адреса: ${user.router_ip}`,
        ``,
        `Статус: ${ipStatus.label}`,
      ];
      
      if (ipStatus.lastPing) {
        statusInfo.push(`Останній пінг: ${ipStatus.lastPing}`);
      }
      
      if (ipStatus.state === 'unstable') {
        statusInfo.push(`⚠️ Зʼєднання нестабільне`);
      }
      
      await safeAnswerCallbackQuery(bot, query.id, { 
        text: statusInfo.join('\n'),
        show_alert: true 
      });
      return;
    }
    
    // IP delete
    if (data === 'ip_delete') {
      if (!user.router_ip) {
        await safeAnswerCallbackQuery(bot, query.id, { text: 'ℹ️ IP-адреса не налаштована' });
        return;
      }
      
      await usersDb.updateUserRouterIp(telegramId, null);
      
      await safeEditMessageText(bot,
        '✅ IP-адресу видалено.\n\nОберіть наступну дію:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '← Назад', callback_data: 'settings_ip' },
                { text: '⤴ Меню', callback_data: 'back_to_main' }
              ]
            ]
          }
        }
      );
      return;
    }
    
    // Channel menu
    if (data === 'settings_channel') {
      const isPublic = user.channel_id && user.channel_id.startsWith('@');
      let channelName = user.channel_id || 'не підключено';
      
      // Truncate long channel names
      if (channelName.length > 20) {
        channelName = channelName.substring(0, 20) + '...';
      }
      
      const channelStatus = user.channel_status || 'active';
      const statusText = channelStatus === 'blocked' ? '🔴 Заблокований' : '🟢 Активний';
      
      const message = 
        `📺 <b>Налаштування каналу</b>\n\n` +
        `Поточний: ${channelName}\n` +
        (user.channel_id ? `Статус: ${statusText}\n\n` : '\n') +
        (isPublic ? '' : user.channel_id ? 'Канал приватний\n\n' : '') +
        (channelStatus === 'blocked' ? '⚠️ Канал заблокований через зміну назви/опису/фото.\nВикористайте "Перепідключити канал" для відновлення.\n\n' : '') +
        'Оберіть опцію:';
      
      await safeEditMessageText(bot, message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getChannelMenuKeyboard(user.channel_id, isPublic, channelStatus).reply_markup,
      });
      return;
    }
    
    // Channel reconnect
    if (data === 'channel_reconnect') {
      if (!user.channel_id) {
        await safeAnswerCallbackQuery(bot, query.id, { 
          text: '❌ Канал не підключено',
          show_alert: true 
        });
        return;
      }
      
      // Reset channel status to active
      await usersDb.updateChannelStatus(telegramId, 'active');
      
      await safeEditMessageText(bot,
        '✅ <b>Канал розблоковано!</b>\n\n' +
        'Статус каналу змінено на "Активний".\n\n' +
        '⚠️ <b>Важливо:</b> Не змінюйте назву, опис або фото каналу в майбутньому, ' +
        'інакше канал буде знову заблоковано.\n\n' +
        'Публікації в канал відновлено.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
        }
      );
      
      // Затримка 3 секунди
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Повернення до головного меню
      const updatedUser = await usersDb.getUserByTelegramId(telegramId);
      
      let botStatus = 'active';
      if (!updatedUser.channel_id) {
        botStatus = 'no_channel';
      } else if (!updatedUser.is_active) {
        botStatus = 'paused';
      }
      const channelPaused = updatedUser.channel_paused === true;
      
      await bot.api.sendMessage(
        chatId,
        '🏠 <b>Головне меню</b>',
        {
          parse_mode: 'HTML',
          ...getMainMenu(botStatus, channelPaused),
        }
      );
      return;
    }
    
    // Test button
    if (data === 'settings_test') {
      if (!user.channel_id) {
        await safeAnswerCallbackQuery(bot, query.id, { 
          text: '❌ Спочатку підключіть канал',
          show_alert: true 
        });
        return;
      }
      
      try {
        await publishScheduleWithPhoto(bot, user, user.region, user.queue, { force: true });
        
        await safeAnswerCallbackQuery(bot, query.id, { 
          text: '✅ Тестове повідомлення відправлено!',
          show_alert: true 
        });
      } catch (error) {
        await safeAnswerCallbackQuery(bot, query.id, { 
          text: '❌ Не вдалось відправити. Перевірте налаштування каналу.',
          show_alert: true 
        });
      }
      return;
    }
    
    // Admin panel
    if (data === 'settings_admin') {
      const userIsAdmin = isAdmin(telegramId, config.adminIds, config.ownerId);
      if (!userIsAdmin) {
        await safeAnswerCallbackQuery(bot, query.id, { text: '❌ Доступ заборонено', show_alert: true });
        return;
      }
      
      // Show admin panel directly
      
      await safeEditMessageText(bot,
        '🔧 <b>Адмін-панель</b>',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getAdminKeyboard().reply_markup,
        }
      );
      return;
    }
    
    // Встановити налаштування куди публікувати - update unified menu
    if (data.startsWith('notify_target_')) {
      const target = data.replace('notify_target_', '');
      if (['bot', 'channel', 'both'].includes(target)) {
        const success = await usersDb.updateUserPowerNotifyTarget(telegramId, target);
        
        if (!success) {
          await safeAnswerCallbackQuery(bot, query.id, {
            text: '❌ Помилка оновлення налаштування',
            show_alert: true
          });
          return;
        }
        
        // Refresh the unified alerts menu
        const updatedUser = await usersDb.getUserByTelegramId(telegramId);
        await safeEditMessageText(bot,
          buildAlertsMessage(updatedUser.is_active, target),
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: getUnifiedAlertsKeyboard(updatedUser.is_active, target).reply_markup
          }
        );
      }
      return;
    }
    
    // Назад до налаштувань
    if (data === 'back_to_settings') {
      const updatedUser = await usersDb.getUserByTelegramId(telegramId);
      const userIsAdmin = isAdmin(telegramId, config.adminIds, config.ownerId);
      const region = REGIONS[updatedUser.region]?.name || updatedUser.region;
      
      // Build settings message according to new format
      let message = '⚙️ <b>Налаштування</b>\n\n';
      message += 'Поточні параметри:\n\n';
      message += `📍 Регіон: ${region} • ${updatedUser.queue}\n`;
      message += `📺 Канал: ${updatedUser.channel_id ? updatedUser.channel_id + ' ✅' : 'не підключено'}\n`;
      message += `📡 IP: ${updatedUser.router_ip ? updatedUser.router_ip + ' ✅' : 'не підключено'}\n`;
      message += `🔔 Сповіщення: ${updatedUser.is_active ? 'увімкнено ✅' : 'вимкнено'}\n\n`;
      message += 'Керування:\n';
      
      await safeEditMessageText(bot, message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getSettingsKeyboard(userIsAdmin).reply_markup,
      });
      return;
    }
    
  } catch (error) {
    console.error('Помилка в handleSettingsCallback:', error);
    await safeAnswerCallbackQuery(bot, query.id, { text: '😅 Щось пішло не так. Спробуйте ще раз!' });
  }
}

// Handle IP setup conversation
async function handleIpConversation(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const text = msg.text;
  
  const state = getIpSetupState(telegramId);
  if (!state) return false;
  
  try {
    // Clear all timeouts
    if (state.timeout) clearTimeout(state.timeout);
    if (state.warningTimeout) clearTimeout(state.warningTimeout);
    if (state.finalTimeout) clearTimeout(state.finalTimeout);
    
    // Validate IP address using the new validation function
    const validationResult = isValidIPorDomain(text);
    
    if (!validationResult.valid) {
      await bot.api.sendMessage(chatId, `❌ ${validationResult.error}`);
      
      // Reset timeout with new 5-minute timer
      const warningTimeout = setTimeout(() => {
        bot.api.sendMessage(
          chatId,
          '⏳ Залишилась 1 хвилина.\n' +
          'Надішліть IP-адресу або продовжіть пізніше.'
        ).catch(() => {});
      }, 240000); // 4 minutes
      
      const finalTimeout = setTimeout(async () => {
        await clearIpSetupState(telegramId);
        
        // Send timeout message with navigation buttons
        const user = await usersDb.getUserByTelegramId(telegramId);
        
        let botStatus = 'active';
        if (!user.channel_id) {
          botStatus = 'no_channel';
        } else if (!user.is_active) {
          botStatus = 'paused';
        }
        const channelPaused = user.channel_paused === true;
        
        await bot.api.sendMessage(
          chatId,
          '⌛ <b>Час вийшов.</b>\n' +
          'Режим налаштування IP завершено.\n\n' +
          'Оберіть наступну дію:',
          { 
            parse_mode: 'HTML',
            ...getMainMenu(botStatus, channelPaused)
          }
        ).catch(() => {});
      }, 300000); // 5 minutes
      
      state.warningTimeout = warningTimeout;
      state.finalTimeout = finalTimeout;
      await setIpSetupState(telegramId, state);
      
      return true;
    }
    
    // Save IP address using the trimmed and validated address
    await usersDb.updateUserRouterIp(telegramId, validationResult.address);
    await clearIpSetupState(telegramId);
    
    // Log IP monitoring setup for growth tracking
    await logIpMonitoringSetup(telegramId);
    
    // Send success message with navigation buttons
    await bot.api.sendMessage(
      chatId,
      `✅ IP-адресу збережено\n\n` +
      `📡 Адреса: ${validationResult.address}\n\n` +
      `Тепер бот буде моніторити доступність цієї адреси для визначення наявності світла.`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '← Назад', callback_data: 'settings_ip' },
              { text: '⤴ Меню', callback_data: 'back_to_main' }
            ]
          ]
        }
      }
    );
    
    return true;
  } catch (error) {
    console.error('Помилка в handleIpConversation:', error);
    await clearIpSetupState(telegramId);
    
    // Send error message with navigation buttons
    const user = await usersDb.getUserByTelegramId(telegramId);
    
    let botStatus = 'active';
    if (user && !user.channel_id) {
      botStatus = 'no_channel';
    } else if (user && !user.is_active) {
      botStatus = 'paused';
    }
    const channelPaused = user ? user.channel_paused === true : false;
    
    await bot.api.sendMessage(
      chatId, 
      '😅 Щось пішло не так. Спробуйте ще раз.\n\nОберіть наступну дію:',
      getMainMenu(botStatus, channelPaused)
    );
    return true;
  }
}

module.exports = {
  handleSettings,
  handleSettingsCallback,
  handleIpConversation,
  restoreIpSetupStates,
  clearIpSetupState, // Export for /start cleanup
  isValidIPorDomain, // Export for admin router IP validation
};
