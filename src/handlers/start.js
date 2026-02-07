const usersDb = require('../database/users');
const { formatWelcomeMessage, formatErrorMessage } = require('../formatter');
const { getRegionKeyboard, getMainMenu, getQueueKeyboard, getConfirmKeyboard, getErrorKeyboard, getWizardNotifyTargetKeyboard } = require('../keyboards/inline');
const { REGIONS } = require('../constants/regions');
const { getBotUsername, getChannelConnectionInstructions, escapeHtml } = require('../utils');
const { safeSendMessage, safeDeleteMessage, safeEditMessage, safeEditMessageText } = require('../utils/errorHandler');
const { getSetting } = require('../database/db');
const { isRegistrationEnabled, checkUserLimit, logUserRegistration, logWizardCompletion } = require('../growthMetrics');
const { getState, setState, clearState, hasState } = require('../state/stateManager');

// Constants imported from channel.js for consistency
const PENDING_CHANNEL_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutes
const CHANNEL_NAME_PREFIX = 'Вольтик ⚡️ ';

// Helper function to check if user is in wizard
function isInWizard(telegramId) {
  const state = getState('wizard', telegramId);
  return !!(state && state.step);
}

// Helper functions to manage wizard state (now using centralized state manager)
function setWizardState(telegramId, data) {
  setState('wizard', telegramId, data);
}

function getWizardState(telegramId) {
  return getState('wizard', telegramId);
}

function clearWizardState(telegramId) {
  clearState('wizard', telegramId);
}

/**
 * Відновити wizard стани з БД при запуску бота
 * NOTE: This is now handled by centralized state manager, kept for backward compatibility
 */
function restoreWizardStates() {
  // State restoration is now handled by initStateManager()
  console.log('✅ Wizard states restored by centralized state manager');
}

// Helper function to create pause mode keyboard
function createPauseKeyboard(showSupport) {
  const buttons = [];
  
  if (showSupport) {
    buttons.push([{ text: '💬 Обговорення/Підтримка', url: 'https://t.me/c/3857764385/2' }]);
  }
  
  buttons.push([{ text: '← Назад', callback_data: 'wizard_notify_back' }]);
  
  return { inline_keyboard: buttons };
}

// Запустити wizard для нового або існуючого користувача
async function startWizard(bot, chatId, telegramId, username, mode = 'new') {
  setWizardState(telegramId, { step: 'region', mode });
  
  // Видаляємо попереднє wizard-повідомлення якщо є
  const lastMsg = getState('lastMenuMessages', telegramId);
  if (lastMsg && lastMsg.messageId) {
    try {
      await bot.api.deleteMessage(chatId, lastMsg.messageId);
    } catch (e) {
      // Ігноруємо помилки: повідомлення може бути вже видалене користувачем або застаріле
    }
  }
  
  let sentMessage;
  if (mode === 'new') {
    sentMessage = await safeSendMessage(
      bot,
      chatId,
      '👋 Привіт! Я Вольтик 🤖\n\n' +
      'Я допоможу відстежувати відключення світла\n' +
      'та повідомлю, коли воно зʼявиться або зникне.\n\n' +
      'Давай налаштуємося. Обери свій регіон:',
      { parse_mode: 'HTML', ...getRegionKeyboard() }
    );
  } else {
    sentMessage = await safeSendMessage(
      bot,
      chatId,
      '1️⃣ Оберіть ваш регіон:',
      getRegionKeyboard()
    );
  }
  
  // Зберігаємо ID нового повідомлення або видаляємо запис при невдачі
  if (sentMessage) {
    setState('lastMenuMessages', telegramId, {
      messageId: sentMessage.message_id
    }, false); // Don't persist menu message IDs to DB
  } else {
    // Видаляємо запис якщо не вдалося відправити, щоб уникнути застарілих ID
    clearState('lastMenuMessages', telegramId);
  }
}

// Обробник команди /start
async function handleStart(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const username = msg.from.username || msg.from.first_name;
  
  try {
    // Якщо користувач в процесі wizard — не пускати в головне меню
    if (isInWizard(telegramId)) {
      await safeSendMessage(bot, chatId, 
        '⚠️ Спочатку завершіть налаштування!\n\n' +
        'Продовжіть з того місця, де зупинились.',
        { parse_mode: 'HTML' }
      );
      return;
    }
    
    // Clear any pending IP setup state
    const { clearIpSetupState } = require('./settings');
    clearIpSetupState(telegramId);
    
    // Clear any pending channel conversation state
    const { clearConversationState } = require('./channel');
    clearConversationState(telegramId);
    
    // Видаляємо попереднє меню якщо є
    const user = usersDb.getUserByTelegramId(telegramId);
    if (user && user.last_start_message_id) {
      await safeDeleteMessage(bot, chatId, user.last_start_message_id);
    }
    
    // Перевіряємо чи користувач вже існує
    if (user) {
      // Check if user was deactivated
      if (!user.is_active) {
        const { getRestorationKeyboard } = require('../keyboards/inline');
        const sentMessage = await safeSendMessage(
          bot,
          chatId,
          `👋 З поверненням!\n\n` +
          `Ваш профіль було деактивовано.\n\n` +
          `Оберіть опцію:`,
          getRestorationKeyboard()
        );
        if (sentMessage) {
          await usersDb.updateUser(telegramId, { last_start_message_id: sentMessage.message_id });
        }
        return;
      }
      
      // Існуючий користувач - показуємо головне меню
      const region = REGIONS[user.region]?.name || user.region;
      
      // Determine bot status
      let botStatus = 'active';
      if (!user.channel_id) {
        botStatus = 'no_channel';
      } else if (!user.is_active) {
        botStatus = 'paused';
      }
      
      const channelPaused = user.channel_paused === 1;
      
      // Build main menu message
      let message = '<b>🚧 Бот у розробці</b>\n';
      message += '<i>Деякі функції можуть працювати нестабільно</i>\n\n';
      message += '<i>💬 Маєте ідеї або знайшли помилку?</i>\n';
      message += '<i>❓ Допомога → Обговорення / Підтримка</i>\n\n';
      message += '🏠 <b>Головне меню</b>\n\n';
      message += `📍 Регіон: ${region} • ${user.queue}\n`;
      message += `📺 Канал: ${user.channel_id ? user.channel_id + ' ✅' : 'не підключено'}\n`;
      message += `🔔 Сповіщення: ${user.is_active ? 'увімкнено ✅' : 'вимкнено'}\n`;
      
      const sentMessage = await safeSendMessage(
        bot,
        chatId,
        message,
        {
          parse_mode: 'HTML',
          ...getMainMenu(botStatus, channelPaused)
        }
      );
      if (sentMessage) {
        await usersDb.updateUser(telegramId, { last_start_message_id: sentMessage.message_id });
      }
    } else {
      // Новий користувач - запускаємо wizard
      await startWizard(bot, chatId, telegramId, username, 'new');
    }
  } catch (error) {
    console.error('Помилка в handleStart:', error);
    await safeSendMessage(bot, chatId, formatErrorMessage(), {
      parse_mode: 'HTML',
      ...getErrorKeyboard()
    });
  }
}

// Обробник callback query для wizard
async function handleWizardCallback(bot, query) {
  const chatId = query.message.chat.id;
  const telegramId = String(query.from.id);
  const data = query.data;
  
  try {
    const state = wizardState.get(telegramId) || { step: 'region' };
    
    // Вибір регіону
    if (data.startsWith('region_')) {
      const region = data.replace('region_', '');
      state.region = region;
      state.step = 'queue';
      setWizardState(telegramId, state);
      
      await safeEditMessageText(bot, 
        `✅ Регіон: ${REGIONS[region].name}\n\n2️⃣ Оберіть свою чергу:`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: getQueueKeyboard().reply_markup,
        }
      );
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    // Вибір черги
    if (data.startsWith('queue_')) {
      const queue = data.replace('queue_', '');
      state.queue = queue;
      
      // For new users, show notification target selection
      if (state.mode === 'new') {
        state.step = 'notify_target';
        setWizardState(telegramId, state);
        
        const region = REGIONS[state.region]?.name || state.region;
        
        await safeEditMessageText(bot, 
          `✅ Налаштування:\n\n` +
          `📍 Регіон: ${region}\n` +
          `⚡️ Черга: ${queue}\n\n` +
          `📬 Куди надсилати сповіщення про світло та графіки?\n\n` +
          `Оберіть, де вам зручніше їх отримувати:\n\n` +
          `📱 <b>У цьому боті</b>\n` +
          `Сповіщення приходитимуть прямо в цей чат\n\n` +
          `📺 <b>У вашому Telegram-каналі</b>\n` +
          `Бот публікуватиме сповіщення у ваш канал\n` +
          `(потрібно додати бота як адміністратора)`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: getWizardNotifyTargetKeyboard().reply_markup,
          }
        );
        await bot.api.answerCallbackQuery(query.id);
        return;
      } else {
        // For edit mode, go to confirmation as before
        state.step = 'confirm';
        setWizardState(telegramId, state);
        
        const region = REGIONS[state.region]?.name || state.region;
        
        await safeEditMessageText(bot, 
          `✅ Налаштування:\n\n` +
          `📍 Регіон: ${region}\n` +
          `⚡️ Черга: ${queue}\n\n` +
          `Підтвердіть налаштування:`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: getConfirmKeyboard().reply_markup,
          }
        );
        await bot.api.answerCallbackQuery(query.id);
        return;
      }
    }
    
    // Підтвердження
    if (data === 'confirm_setup') {
      const username = query.from.username || query.from.first_name;
      const mode = state.mode || 'new';
      
      if (mode === 'edit') {
        // Режим редагування - оновлюємо існуючого користувача
        usersDb.updateUserRegionAndQueue(telegramId, state.region, state.queue);
        clearWizardState(telegramId);
        
        const region = REGIONS[state.region]?.name || state.region;
        
        await safeEditMessageText(bot, 
          `✅ <b>Налаштування оновлено!</b>\n\n` +
          `📍 Регіон: ${region}\n` +
          `⚡ Черга: ${state.queue}\n\n` +
          `Графік буде опубліковано при наступній перевірці.`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⤴ Меню', callback_data: 'back_to_main' }]
              ]
            }
          }
        );
      } else {
        // Режим створення нового користувача (legacy flow without notification target selection)
        // Перевіряємо чи користувач вже існує (для безпеки)
        const existingUser = usersDb.getUserByTelegramId(telegramId);
        
        if (existingUser) {
          // Користувач вже існує - оновлюємо налаштування
          usersDb.updateUserRegionAndQueue(telegramId, state.region, state.queue);
        } else {
          // Check registration limits before creating new user
          const limit = checkUserLimit();
          if (limit.reached || !isRegistrationEnabled()) {
            await safeEditMessageText(bot, 
              `⚠️ <b>Реєстрація тимчасово обмежена</b>\n\n` +
              `На даний момент реєстрація нових користувачів тимчасово зупинена.\n\n` +
              `Спробуйте пізніше або зв'яжіться з підтримкою.`,
              {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'HTML'
              }
            );
            clearWizardState(telegramId);
            await bot.api.answerCallbackQuery(query.id);
            return;
          }
          
          // Створюємо нового користувача
          usersDb.createUser(telegramId, username, state.region, state.queue);
          
          // Log user registration for growth tracking
          logUserRegistration(telegramId, { region: state.region, queue: state.queue, username });
          logWizardCompletion(telegramId);
        }
        clearWizardState(telegramId);
        
        const region = REGIONS[state.region]?.name || state.region;
        
        await safeEditMessageText(bot, 
          `✅ Налаштування збережено!\n\n` +
          `📍 Регіон: ${region}\n` +
          `⚡️ Черга: ${state.queue}\n\n` +
          `Тепер ви будете отримувати сповіщення про зміни графіка.\n\n` +
          `Використовуйте команду /channel для підключення до каналу.`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
          }
        );
        
        // Відправляємо головне меню і зберігаємо ID
        const botStatus = 'no_channel'; // New user won't have channel yet
        const sentMessage = await bot.api.sendMessage(chatId, 'Головне меню:', getMainMenu(botStatus, false));
        await usersDb.updateUser(telegramId, { last_start_message_id: sentMessage.message_id });
      }
      
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    // Назад до регіону
    if (data === 'back_to_region') {
      state.step = 'region';
      setWizardState(telegramId, state);
      
      await safeEditMessageText(bot, 
        '1️⃣ Оберіть ваш регіон:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: getRegionKeyboard().reply_markup,
        }
      );
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    // Wizard: вибір "У цьому боті"
    if (data === 'wizard_notify_bot') {
      const username = query.from.username || query.from.first_name;
      
      // Перевіряємо чи користувач вже існує
      const existingUser = usersDb.getUserByTelegramId(telegramId);
      
      if (existingUser) {
        // Користувач вже існує - оновлюємо налаштування включаючи регіон та чергу з wizard
        usersDb.updateUserRegionAndQueue(telegramId, state.region, state.queue);
        usersDb.updateUserPowerNotifyTarget(telegramId, 'bot');
      } else {
        // Check registration limits before creating new user
        const limit = checkUserLimit();
        if (limit.reached || !isRegistrationEnabled()) {
          await safeEditMessageText(bot, 
            `⚠️ <b>Реєстрація тимчасово обмежена</b>\n\n` +
            `На даний момент реєстрація нових користувачів тимчасово зупинена.\n\n` +
            `Спробуйте пізніше або зв'яжіться з підтримкою.`,
            {
              chat_id: chatId,
              message_id: query.message.message_id,
              parse_mode: 'HTML'
            }
          );
          clearWizardState(telegramId);
          await bot.api.answerCallbackQuery(query.id);
          return;
        }
        
        // Створюємо користувача з power_notify_target = 'bot'
        // Note: Two separate calls used here to maintain backward compatibility with createUser
        // TODO: Consider extending createUser to accept power_notify_target parameter
        usersDb.createUser(telegramId, username, state.region, state.queue);
        usersDb.updateUserPowerNotifyTarget(telegramId, 'bot');
        
        // Log user registration for growth tracking
        logUserRegistration(telegramId, { region: state.region, queue: state.queue, username, notify_target: 'bot' });
        logWizardCompletion(telegramId);
      }
      clearWizardState(telegramId);
      
      const region = REGIONS[state.region]?.name || state.region;
      
      await safeEditMessageText(bot, 
        `✅ <b>Налаштування завершено!</b>\n\n` +
        `📍 Регіон: ${region}\n` +
        `⚡️ Черга: ${state.queue}\n` +
        `📬 Сповіщення: у цей чат\n\n` +
        `Сповіщення приходитимуть у цей чат.`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
        }
      );
      
      // Затримка перед показом головного меню
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Відправляємо головне меню
      const botStatus = 'no_channel'; // New user won't have channel yet
      const sentMessage = await bot.api.sendMessage(
        chatId, 
        '🏠 <b>Головне меню</b>',
        {
          parse_mode: 'HTML',
          ...getMainMenu(botStatus, false)
        }
      );
      await usersDb.updateUser(telegramId, { last_start_message_id: sentMessage.message_id });
      
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    // Wizard: вибір "У Telegram-каналі"
    if (data === 'wizard_notify_channel') {
      // Перевірка режиму паузи
      const botPaused = getSetting('bot_paused', '0') === '1';
      
      if (botPaused) {
        const pauseMessage = getSetting('pause_message', '🔧 Бот тимчасово недоступний. Спробуйте пізніше.');
        const showSupport = getSetting('pause_show_support', '1') === '1';
        
        await safeEditMessageText(bot, pauseMessage, {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: createPauseKeyboard(showSupport)
        });
        await bot.api.answerCallbackQuery(query.id);
        return;
      }
      
      const username = query.from.username || query.from.first_name;
      
      // Перевіряємо чи користувач вже існує
      const existingUser = usersDb.getUserByTelegramId(telegramId);
      
      if (existingUser) {
        // Користувач вже існує - оновлюємо налаштування включаючи регіон та чергу з wizard
        usersDb.updateUserRegionAndQueue(telegramId, state.region, state.queue);
        usersDb.updateUserPowerNotifyTarget(telegramId, 'channel');
      } else {
        // Check registration limits before creating new user
        const limit = checkUserLimit();
        if (limit.reached || !isRegistrationEnabled()) {
          await safeEditMessageText(bot, 
            `⚠️ <b>Реєстрація тимчасово обмежена</b>\n\n` +
            `На даний момент реєстрація нових користувачів тимчасово зупинена.\n\n` +
            `Спробуйте пізніше або зв'яжіться з підтримкою.`,
            {
              chat_id: chatId,
              message_id: query.message.message_id,
              parse_mode: 'HTML'
            }
          );
          clearWizardState(telegramId);
          await bot.api.answerCallbackQuery(query.id);
          return;
        }
        
        // Створюємо нового користувача з power_notify_target = 'channel'
        // Note: Two separate calls used here to maintain backward compatibility with createUser
        // TODO: Consider extending createUser to accept power_notify_target parameter
        usersDb.createUser(telegramId, username, state.region, state.queue);
        usersDb.updateUserPowerNotifyTarget(telegramId, 'channel');
        
        // Log user registration for growth tracking
        logUserRegistration(telegramId, { region: state.region, queue: state.queue, username, notify_target: 'channel' });
        logWizardCompletion(telegramId);
      }
      
      // Зберігаємо wizard state для обробки підключення каналу
      state.step = 'channel_setup';
      setWizardState(telegramId, state);
      
      // Використовуємо існуючу логіку підключення каналу
      const { pendingChannels } = require('../bot');
      
      // Перевіряємо чи є pending channel для ЦЬОГО користувача
      let pendingChannel = null;
      for (const [channelId, channel] of pendingChannels.entries()) {
        // Канал має бути доданий протягом останніх 30 хвилин
        if (Date.now() - channel.timestamp < PENDING_CHANNEL_EXPIRATION_MS) {
          // Перевіряємо що канал не зайнятий іншим користувачем
          const existingUser = usersDb.getUserByChannelId(channelId);
          if (!existingUser || existingUser.telegram_id === telegramId) {
            pendingChannel = channel;
            break;
          }
        }
      }
      
      if (pendingChannel) {
        // Є канал для підключення - показати підтвердження
        await safeEditMessageText(bot, 
          `📺 <b>Знайдено канал!</b>\n\n` +
          `Канал: <b>${escapeHtml(pendingChannel.channelTitle)}</b>\n` +
          `(${pendingChannel.channelUsername})\n\n` +
          `Підключити цей канал?`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✓ Так, підключити', callback_data: `wizard_channel_confirm_${pendingChannel.channelId}` },
                  { text: '✕ Ні', callback_data: 'wizard_notify_back' }
                ]
              ]
            }
          }
        );
      } else {
        // Немає pending каналу - показати інструкції
        // Отримуємо username бота для інструкції (з кешем)
        const botUsername = await getBotUsername(bot);
        
        await safeEditMessageText(bot, 
          getChannelConnectionInstructions(botUsername),
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '✅ Перевірити', callback_data: 'wizard_notify_channel' }],
                [{ text: '← Назад', callback_data: 'wizard_notify_back' }]
              ]
            }
          }
        );
        
        // Оновлюємо wizard state з message ID
        state.lastMessageId = query.message.message_id;
        setWizardState(telegramId, state);
      }
      
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    // Wizard: назад до вибору куди сповіщати
    if (data === 'wizard_notify_back') {
      state.step = 'notify_target';
      setWizardState(telegramId, state);
      
      const region = REGIONS[state.region]?.name || state.region;
      
      await safeEditMessageText(bot, 
        `✅ Налаштування:\n\n` +
        `📍 Регіон: ${region}\n` +
        `⚡️ Черга: ${state.queue}\n\n` +
        `📬 Куди надсилати сповіщення про світло та графіки?\n\n` +
        `Оберіть, де вам зручніше їх отримувати:\n\n` +
        `📱 <b>У цьому боті</b>\n` +
        `Сповіщення приходитимуть прямо в цей чат\n\n` +
        `📺 <b>У вашому Telegram-каналі</b>\n` +
        `Бот публікуватиме сповіщення у ваш канал\n` +
        `(потрібно додати бота як адміністратора)`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getWizardNotifyTargetKeyboard().reply_markup,
        }
      );
      
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    // Wizard: підтвердження підключення каналу
    if (data.startsWith('wizard_channel_confirm_')) {
      // Перевірка режиму паузи
      const botPaused = getSetting('bot_paused', '0') === '1';
      
      if (botPaused) {
        const pauseMessage = getSetting('pause_message', '🔧 Бот тимчасово недоступний. Спробуйте пізніше.');
        const showSupport = getSetting('pause_show_support', '1') === '1';
        
        await safeEditMessageText(bot, pauseMessage, {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: createPauseKeyboard(showSupport)
        });
        await bot.api.answerCallbackQuery(query.id);
        return;
      }
      
      const channelId = data.replace('wizard_channel_confirm_', '');
      
      // Перевіряємо чи бот ще в каналі
      try {
        const botInfo = await bot.api.getMe();
        const chatMember = await bot.api.getChatMember(channelId, botInfo.id);
        
        if (chatMember.status !== 'administrator') {
          await bot.api.answerCallbackQuery(query.id, {
            text: '❌ Бота більше немає в каналі. Додайте його знову.',
            show_alert: true
          });
          return;
        }
      } catch (error) {
        await bot.api.answerCallbackQuery(query.id, {
          text: '❌ Не вдалося перевірити канал. Спробуйте ще раз.',
          show_alert: true
        });
        return;
      }
      
      const { pendingChannels, removePendingChannel } = require('../bot');
      const pending = pendingChannels.get(channelId);
      
      if (!pending) {
        await bot.api.answerCallbackQuery(query.id, {
          text: '❌ Канал не знайдено. Додайте бота в канал ще раз.',
          show_alert: true
        });
        return;
      }
      
      // Зберігаємо канал
      usersDb.updateUser(telegramId, {
        channel_id: channelId,
        channel_title: pending.channelTitle
      });
      
      // Видаляємо з pending
      removePendingChannel(channelId);
      
      // Очищаємо wizard state
      clearWizardState(telegramId);
      
      const region = REGIONS[state.region]?.name || state.region;
      
      // Показуємо успіх
      await safeEditMessageText(bot,
        `✅ <b>Налаштування завершено!</b>\n\n` +
        `📍 Регіон: ${region}\n` +
        `⚡️ Черга: ${state.queue}\n` +
        `📺 Канал: ${escapeHtml(pending.channelTitle)}\n\n` +
        `Сповіщення надсилатимуться в канал.`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        }
      );
      
      // Показуємо головне меню через 2 секунди
      setTimeout(async () => {
        try {
          const sentMessage = await bot.api.sendMessage(
            chatId,
            '🏠 <b>Головне меню</b>',
            {
              parse_mode: 'HTML',
              ...getMainMenu('active', false)
            }
          );
          await usersDb.updateUser(telegramId, { last_start_message_id: sentMessage.message_id });
        } catch (error) {
          console.error('Error sending main menu after wizard completion:', error);
        }
      }, 2000);
      
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
    // Wizard: відмова від підключення
    if (data === 'wizard_channel_cancel') {
      const { removePendingChannel } = require('../bot');
      
      // Видаляємо pending channel якщо є
      if (state && state.pendingChannelId) {
        removePendingChannel(state.pendingChannelId);
      }
      
      // Повертаємося до вибору куди сповіщати
      state.step = 'notify_target';
      state.pendingChannelId = null;
      setWizardState(telegramId, state);
      
      await safeEditMessageText(bot,
        `👌 Добре, канал не підключено.\n\n` +
        `Оберіть куди надсилати сповіщення:`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getWizardNotifyTargetKeyboard().reply_markup
        }
      );
      
      await bot.api.answerCallbackQuery(query.id);
      return;
    }
    
  } catch (error) {
    console.error('Помилка в handleWizardCallback:', error);
    await bot.api.answerCallbackQuery(query.id, { text: '😅 Щось пішло не так. Спробуй ще раз!' });
  }
}

module.exports = {
  handleStart,
  handleWizardCallback,
  startWizard,
  isInWizard,
  getWizardState,
  setWizardState,
  clearWizardState,
  restoreWizardStates,
};
