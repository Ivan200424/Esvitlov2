const usersDb = require('../database/users');
const { formatWelcomeMessage, formatErrorMessage } = require('../formatter');
const { getRegionKeyboard, getMainMenu, getQueueKeyboard, getConfirmKeyboard, getErrorKeyboard, getWizardNotifyTargetKeyboard } = require('../keyboards/inline');
const { REGIONS } = require('../constants/regions');
const { getBotUsername, getChannelConnectionInstructions } = require('../utils');
const { safeSendMessage, safeDeleteMessage, safeEditMessage } = require('../utils/errorHandler');

// Constants imported from channel.js for consistency
const PENDING_CHANNEL_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutes
const CHANNEL_NAME_PREFIX = 'СвітлоЧек ⚡️ ';

// Стан wizard для кожного користувача
const wizardState = new Map();

// Зберігаємо останній message_id меню для кожного користувача
const lastMenuMessages = new Map();

// Запустити wizard для нового або існуючого користувача
async function startWizard(bot, chatId, telegramId, username, mode = 'new') {
  wizardState.set(telegramId, { step: 'region', mode });
  
  // Видаляємо попереднє wizard-повідомлення якщо є
  const lastMsgId = lastMenuMessages.get(telegramId);
  if (lastMsgId) {
    try {
      await bot.deleteMessage(chatId, lastMsgId);
    } catch (e) {
      // Ігноруємо помилки: повідомлення може бути вже видалене користувачем або застаріле
    }
  }
  
  let sentMessage;
  if (mode === 'new') {
    sentMessage = await safeSendMessage(
      bot,
      chatId,
      formatWelcomeMessage(username),
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
    lastMenuMessages.set(telegramId, sentMessage.message_id);
  } else {
    // Видаляємо запис якщо не вдалося відправити, щоб уникнути застарілих ID
    lastMenuMessages.delete(telegramId);
  }
}

// Обробник команди /start
async function handleStart(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const username = msg.from.username || msg.from.first_name;
  
  try {
    // Якщо користувач в процесі wizard — не пускати в головне меню
    const state = wizardState.get(telegramId);
    if (state && state.step) {
      await safeSendMessage(bot, chatId, 
        '⚠️ Спочатку завершіть налаштування!\n\n' +
        'Продовжіть з того місця, де зупинились, або натисніть кнопку нижче.',
        { parse_mode: 'HTML' }
      );
      return;
    }
    
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
      message += '<i>Допоможіть нам стати краще!</i>\n';
      message += '<i>Натисніть ❓ Допомога → 💬 Обговорення/Підтримка</i>\n\n';
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
      wizardState.set(telegramId, state);
      
      await bot.editMessageText(
        `✅ Регіон: ${REGIONS[region].name}\n\n2️⃣ Оберіть чергу:`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: getQueueKeyboard().reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Вибір черги
    if (data.startsWith('queue_')) {
      const queue = data.replace('queue_', '');
      state.queue = queue;
      
      // For new users, show notification target selection
      if (state.mode === 'new') {
        state.step = 'notify_target';
        wizardState.set(telegramId, state);
        
        const region = REGIONS[state.region]?.name || state.region;
        
        await bot.editMessageText(
          `✅ Налаштування:\n\n` +
          `📍 Регіон: ${region}\n` +
          `⚡️ Черга: ${queue}\n\n` +
          `📬 Куди надсилати сповіщення про світло/графіки?\n\n` +
          `Оберіть, де вам зручніше їх отримувати:\n\n` +
          `📱 <b>У цьому боті</b>\n` +
          `Повідомлення приходитимуть прямо в цей чат\n\n` +
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
        await bot.answerCallbackQuery(query.id);
        return;
      } else {
        // For edit mode, go to confirmation as before
        state.step = 'confirm';
        wizardState.set(telegramId, state);
        
        const region = REGIONS[state.region]?.name || state.region;
        
        await bot.editMessageText(
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
        await bot.answerCallbackQuery(query.id);
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
        wizardState.delete(telegramId);
        
        const region = REGIONS[state.region]?.name || state.region;
        
        await bot.editMessageText(
          `✅ <b>Налаштування оновлено!</b>\n\n` +
          `📍 Регіон: ${region}\n` +
          `⚡ Черга: ${state.queue}\n\n` +
          `Графік буде опубліковано при наступній перевірці.`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
          }
        );
        
        // Затримка 4 секунди
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        // Send main menu after successful region/queue update
        const user = usersDb.getUserByTelegramId(telegramId);
        let botStatus = 'active';
        if (!user.channel_id) {
          botStatus = 'no_channel';
        } else if (!user.is_active) {
          botStatus = 'paused';
        }
        
        const channelPaused = user.channel_paused === 1;
        
        await bot.sendMessage(
          chatId,
          '🏠 <b>Головне меню</b>',
          {
            parse_mode: 'HTML',
            ...getMainMenu(botStatus, channelPaused),
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
          // Створюємо нового користувача
          usersDb.createUser(telegramId, username, state.region, state.queue);
        }
        wizardState.delete(telegramId);
        
        const region = REGIONS[state.region]?.name || state.region;
        
        await bot.editMessageText(
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
        const sentMessage = await bot.sendMessage(chatId, 'Головне меню:', getMainMenu(botStatus, false));
        await usersDb.updateUser(telegramId, { last_start_message_id: sentMessage.message_id });
      }
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Назад до регіону
    if (data === 'back_to_region') {
      state.step = 'region';
      wizardState.set(telegramId, state);
      
      await bot.editMessageText(
        '1️⃣ Оберіть ваш регіон:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: getRegionKeyboard().reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
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
        // Створюємо користувача з power_notify_target = 'bot'
        // Note: Two separate calls used here to maintain backward compatibility with createUser
        // TODO: Consider extending createUser to accept power_notify_target parameter
        usersDb.createUser(telegramId, username, state.region, state.queue);
        usersDb.updateUserPowerNotifyTarget(telegramId, 'bot');
      }
      wizardState.delete(telegramId);
      
      const region = REGIONS[state.region]?.name || state.region;
      
      await bot.editMessageText(
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
      const sentMessage = await bot.sendMessage(
        chatId, 
        '🏠 <b>Головне меню</b>',
        {
          parse_mode: 'HTML',
          ...getMainMenu(botStatus, false)
        }
      );
      await usersDb.updateUser(telegramId, { last_start_message_id: sentMessage.message_id });
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Wizard: вибір "У Telegram-каналі"
    if (data === 'wizard_notify_channel') {
      const username = query.from.username || query.from.first_name;
      
      // Перевіряємо чи користувач вже існує
      const existingUser = usersDb.getUserByTelegramId(telegramId);
      
      if (existingUser) {
        // Користувач вже існує - оновлюємо налаштування включаючи регіон та чергу з wizard
        usersDb.updateUserRegionAndQueue(telegramId, state.region, state.queue);
        usersDb.updateUserPowerNotifyTarget(telegramId, 'channel');
      } else {
        // Створюємо нового користувача з power_notify_target = 'channel'
        // Note: Two separate calls used here to maintain backward compatibility with createUser
        // TODO: Consider extending createUser to accept power_notify_target parameter
        usersDb.createUser(telegramId, username, state.region, state.queue);
        usersDb.updateUserPowerNotifyTarget(telegramId, 'channel');
      }
      
      // Зберігаємо wizard state для обробки підключення каналу
      state.step = 'channel_setup';
      wizardState.set(telegramId, state);
      
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
        await bot.editMessageText(
          `📺 <b>Знайдено канал!</b>\n\n` +
          `Канал: <b>${pendingChannel.channelTitle}</b>\n` +
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
        
        await bot.editMessageText(
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
      }
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Wizard: назад до вибору куди сповіщати
    if (data === 'wizard_notify_back') {
      state.step = 'notify_target';
      wizardState.set(telegramId, state);
      
      const region = REGIONS[state.region]?.name || state.region;
      
      await bot.editMessageText(
        `✅ Налаштування:\n\n` +
        `📍 Регіон: ${region}\n` +
        `⚡️ Черга: ${state.queue}\n\n` +
        `📬 Куди надсилати сповіщення про світло/графіки?\n\n` +
        `Оберіть, де вам зручніше їх отримувати:\n\n` +
        `📱 <b>У цьому боті</b>\n` +
        `Повідомлення приходитимуть прямо в цей чат\n\n` +
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
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Wizard: підтвердження підключення каналу
    if (data.startsWith('wizard_channel_confirm_')) {
      const channelId = data.replace('wizard_channel_confirm_', '');
      const { pendingChannels } = require('../bot');
      const { conversationStates } = require('./channel');
      const pendingChannel = pendingChannels.get(channelId);
      
      if (!pendingChannel) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Канал не знайдено. Спробуйте ще раз.',
          show_alert: true
        });
        return;
      }
      
      // Видаляємо з pending
      pendingChannels.delete(channelId);
      
      // Зберігаємо channel_id та започатковуємо conversation для налаштування
      usersDb.resetUserChannel(telegramId, channelId);
      
      conversationStates.set(telegramId, {
        state: 'waiting_for_title',
        channelId: channelId,
        channelUsername: pendingChannel.channelUsername,
        wizardMode: true  // Позначаємо що це wizard mode
      });
      
      await bot.editMessageText(
        '📝 <b>Введіть назву для каналу</b>\n\n' +
        `Вона буде додана після префіксу "${CHANNEL_NAME_PREFIX}"\n\n` +
        '<b>Приклад:</b> Київ Черга 3.1\n' +
        `<b>Результат:</b> ${CHANNEL_NAME_PREFIX}Київ Черга 3.1`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        }
      );
      
      // Видаляємо wizard state оскільки тепер conversation state керує процесом
      wizardState.delete(telegramId);
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
  } catch (error) {
    console.error('Помилка в handleWizardCallback:', error);
    await bot.answerCallbackQuery(query.id, { text: '😅 Щось пішло не так. Спробуй ще раз!' });
  }
}

module.exports = {
  handleStart,
  handleWizardCallback,
  startWizard,
  wizardState,
};
