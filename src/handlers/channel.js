const usersDb = require('../database/users');
const fs = require('fs');
const path = require('path');
const { getBotUsername, getChannelConnectionInstructions } = require('../utils');
const { safeSendMessage, safeEditMessageText } = require('../utils/errorHandler');

// Store conversation states
const conversationStates = new Map();

// Constants
const CHANNEL_NAME_PREFIX = 'Вольтик ⚡️ ';
const CHANNEL_DESCRIPTION_BASE = '⚡️ Вольтик — слідкує, щоб ти не слідкував';
const PHOTO_PATH = path.join(__dirname, '../../photo_for_channels.PNG.jpg');
const PENDING_CHANNEL_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutes
const FORMAT_SETTINGS_MESSAGE = '📋 <b>Формат публікацій</b>\n\nНалаштуйте формат повідомлень для вашого каналу:';

// Обробник команди /channel
async function handleChannel(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  
  try {
    const user = usersDb.getUserByTelegramId(telegramId);
    
    if (!user) {
      await safeSendMessage(bot, chatId, '❌ Спочатку налаштуйте бота командою /start');
      return;
    }
    
    const message = 
      `📺 <b>Підключення до каналу</b>\n\n` +
      `Щоб підключити бота до вашого каналу:\n\n` +
      `1️⃣ Додайте бота як адміністратора вашого каналу\n` +
      `2️⃣ Дайте боту права на:\n` +
      `   • Публікацію повідомлень\n` +
      `   • Редагування інформації каналу\n` +
      `3️⃣ Перейдіть в Налаштування → Канал → Підключити канал\n\n` +
      (user.channel_id 
        ? `✅ Канал підключено: <code>${user.channel_id}</code>\n\n` +
          `Назва: <b>${user.channel_title || 'Не налаштовано'}</b>\n` +
          `Статус: <b>${user.channel_status === 'blocked' ? '🔴 Заблокований' : '🟢 Активний'}</b>\n\n` +
          `Для зміни каналу використайте меню налаштувань.`
        : `ℹ️ Канал ще не підключено.`);
    
    await safeSendMessage(bot, chatId, message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Помилка в handleChannel:', error);
    await safeSendMessage(bot, chatId, '😅 Щось пішло не так. Спробуй ще раз!');
  }
}

// Обробник команди /setchannel
async function handleSetChannel(bot, msg, match) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const channelUsername = match ? match[1].trim() : null;
  
  try {
    const user = usersDb.getUserByTelegramId(telegramId);
    
    if (!user) {
      await bot.sendMessage(chatId, '❌ Спочатку налаштуйте бота командою /start');
      return;
    }
    
    if (!channelUsername) {
      await bot.sendMessage(
        chatId, 
        '❌ Вкажіть канал.\n\nПриклад: <code>/setchannel @mychannel</code>',
        { parse_mode: 'HTML' }
      );
      return;
    }
    
    // Check if user was previously blocked
    if (user.channel_status === 'blocked' && user.channel_id) {
      await bot.sendMessage(
        chatId,
        '⚠️ Ваш канал був заблокований через зміну назви/опису/фото.\n\n' +
        'Будь ласка, не змінюйте налаштування каналу в майбутньому.\n' +
        'Продовжуємо налаштування...'
      );
    }
    
    // Try to get channel info
    let channelInfo;
    try {
      channelInfo = await bot.getChat(channelUsername);
    } catch (error) {
      await bot.sendMessage(
        chatId,
        '❌ Не вдалося знайти канал. Переконайтесь, що:\n' +
        '1. Канал існує\n' +
        '2. Канал є публічним або ви використовуєте правильний @username'
      );
      return;
    }
    
    if (channelInfo.type !== 'channel') {
      await bot.sendMessage(chatId, '❌ Це не канал. Вкажіть канал (не групу).');
      return;
    }
    
    const channelId = String(channelInfo.id);
    
    // Перевіряємо чи бот є адміністратором з необхідними правами
    try {
      // Get bot ID - it should be available but handle race condition
      const botId = bot.options.id;
      if (!botId) {
        // Fallback: get bot info on the fly
        const botInfo = await bot.getMe();
        bot.options.id = botInfo.id;
      }
      
      const botMember = await bot.getChatMember(channelId, bot.options.id);
      
      if (botMember.status !== 'administrator') {
        await bot.sendMessage(
          chatId,
          '❌ Бот не є адміністратором каналу.\n\n' +
          'Додайте бота як адміністратора з правами на:\n' +
          '• Публікацію повідомлень\n' +
          '• Редагування інформації каналу'
        );
        return;
      }
      
      // Check specific permissions
      if (!botMember.can_post_messages || !botMember.can_change_info) {
        await bot.sendMessage(
          chatId,
          '❌ Бот не має необхідних прав.\n\n' +
          'Дайте боту права на:\n' +
          '• Публікацію повідомлень\n' +
          '• Редагування інформації каналу'
        );
        return;
      }
      
    } catch (error) {
      console.error('Помилка перевірки прав бота:', error);
      await bot.sendMessage(
        chatId,
        '❌ Не вдалося перевірити права бота в каналі.\n' +
        'Переконайтесь, що бот є адміністратором.'
      );
      return;
    }
    
    // Save channel_id and start conversation for title
    usersDb.resetUserChannel(telegramId, channelId);
    
    conversationStates.set(telegramId, {
      state: 'waiting_for_title',
      channelId: channelId,
      channelUsername: channelUsername
    });
    
    await bot.sendMessage(
      chatId,
      '📝 <b>Введіть назву для каналу</b>\n\n' +
      `Вона буде додана після префіксу "${CHANNEL_NAME_PREFIX}"\n\n` +
      '<b>Приклад:</b> Київ Черга 3.1\n' +
      '<b>Результат:</b> Вольтик ⚡️ Київ Черга 3.1',
      { parse_mode: 'HTML' }
    );
    
  } catch (error) {
    console.error('Помилка в handleSetChannel:', error);
    await bot.sendMessage(chatId, '😅 Щось пішло не так при налаштуванні каналу. Спробуй ще раз!');
  }
}

// Handle conversation messages
async function handleConversation(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const text = msg.text;
  
  const state = conversationStates.get(telegramId);
  if (!state) return false;
  
  try {
    if (state.state === 'waiting_for_title') {
      // Validate title
      if (!text || text.trim().length === 0) {
        await bot.sendMessage(chatId, '❌ Назва не може бути пустою. Спробуйте ще раз:');
        return true;
      }
      
      const MAX_TITLE_LENGTH = 128;
      if (text.length > MAX_TITLE_LENGTH) {
        await bot.sendMessage(chatId, `❌ Назва занадто довга (максимум ${MAX_TITLE_LENGTH} символів).\n\nПеревищено на: ${text.length - MAX_TITLE_LENGTH} символів\n\nСпробуйте ще раз:`);
        return true;
      }
      
      state.userTitle = text.trim();
      state.state = 'waiting_for_description_choice';
      
      // Ask about description
      const keyboard = {
        inline_keyboard: [
          [
            { text: '✍️ Додати опис', callback_data: 'channel_add_desc' },
            { text: '⏭️ Пропустити', callback_data: 'channel_skip_desc' }
          ]
        ]
      };
      
      await bot.sendMessage(
        chatId,
        '📝 <b>Хочете додати додатковий опис каналу?</b>\n\n' +
        'Наприклад: ЖК "Сонячний", під\'їзд 2',
        { parse_mode: 'HTML', reply_markup: keyboard }
      );
      
      conversationStates.set(telegramId, state);
      return true;
    }
    
    if (state.state === 'waiting_for_description') {
      // Validate description
      if (!text || text.trim().length === 0) {
        await bot.sendMessage(chatId, '❌ Опис не може бути пустим. Спробуйте ще раз або використайте /cancel для скасування:');
        return true;
      }
      
      const MAX_DESC_LENGTH = 255;
      if (text.length > MAX_DESC_LENGTH) {
        await bot.sendMessage(chatId, `❌ Опис занадто довгий (максимум ${MAX_DESC_LENGTH} символів).\n\nПеревищено на: ${text.length - MAX_DESC_LENGTH} символів\n\nСпробуйте ще раз:`);
        return true;
      }
      
      state.userDescription = text.trim();
      await applyChannelBranding(bot, chatId, telegramId, state);
      conversationStates.delete(telegramId);
      return true;
    }
    
    if (state.state === 'editing_title') {
      // Validate title
      if (!text || text.trim().length === 0) {
        await bot.sendMessage(chatId, '❌ Назва не може бути пустою. Спробуйте ще раз або використайте /cancel:');
        return true;
      }
      
      const MAX_TITLE_LENGTH = 128;
      if (text.length > MAX_TITLE_LENGTH) {
        await bot.sendMessage(chatId, `❌ Назва занадто довга (максимум ${MAX_TITLE_LENGTH} символів).\n\nПеревищено на: ${text.length - MAX_TITLE_LENGTH} символів\n\nСпробуйте ще раз:`);
        return true;
      }
      
      const userTitle = text.trim();
      const fullTitle = CHANNEL_NAME_PREFIX + userTitle;
      
      // Update channel title
      try {
        await bot.setChatTitle(state.channelId, fullTitle);
        
        // Update database
        usersDb.updateChannelBranding(telegramId, {
          channelTitle: fullTitle,
          userTitle: userTitle
        });
        
        await bot.sendMessage(
          chatId,
          `✅ <b>Назву каналу змінено!</b>\n\n` +
          `Нова назва: ${fullTitle}\n\n` +
          `⚠️ <b>Важливо:</b> Зміна через бота - дозволена.\n` +
          `Не змінюйте назву вручну в Telegram!`,
          { parse_mode: 'HTML' }
        );
        
        conversationStates.delete(telegramId);
        return true;
      } catch (error) {
        console.error('Error updating channel title:', error);
        await bot.sendMessage(
          chatId,
          '😅 Щось пішло не так. Не вдалося змінити назву каналу. Переконайтесь, що бот має права на редагування інформації каналу.'
        );
        conversationStates.delete(telegramId);
        return true;
      }
    }
    
    if (state.state === 'editing_description') {
      // Validate description
      if (!text || text.trim().length === 0) {
        await bot.sendMessage(chatId, '❌ Опис не може бути пустим. Спробуйте ще раз або використайте /cancel:');
        return true;
      }
      
      const MAX_DESC_LENGTH = 255;
      if (text.length > MAX_DESC_LENGTH) {
        await bot.sendMessage(chatId, `❌ Опис занадто довгий (максимум ${MAX_DESC_LENGTH} символів).\n\nПеревищено на: ${text.length - MAX_DESC_LENGTH} символів\n\nСпробуйте ще раз:`);
        return true;
      }
      
      const userDescription = text.trim();
      let fullDescription = CHANNEL_DESCRIPTION_BASE;
      if (userDescription) {
        fullDescription += '\n📍 ' + userDescription;
      }
      
      // Update channel description
      try {
        await bot.setChatDescription(state.channelId, fullDescription);
        
        // Update database
        usersDb.updateChannelBranding(telegramId, {
          channelDescription: fullDescription,
          userDescription: userDescription
        });
        
        await bot.sendMessage(
          chatId,
          `✅ <b>Опис каналу змінено!</b>\n\n` +
          `Новий опис: ${fullDescription}\n\n` +
          `⚠️ <b>Важливо:</b> Зміна через бота - дозволена.\n` +
          `Не змінюйте опис вручну в Telegram!`,
          { parse_mode: 'HTML' }
        );
        
        conversationStates.delete(telegramId);
        return true;
      } catch (error) {
        console.error('Error updating channel description:', error);
        await bot.sendMessage(
          chatId,
          '😅 Щось пішло не так. Не вдалося змінити опис каналу. Переконайтесь, що бот має права на редагування інформації каналу.'
        );
        conversationStates.delete(telegramId);
        return true;
      }
    }
    
    if (state.state === 'waiting_for_schedule_caption') {
      if (!text || text.trim().length === 0) {
        await bot.sendMessage(chatId, '❌ Шаблон не може бути пустим. Спробуйте ще раз або /cancel:');
        return true;
      }
      
      usersDb.updateUserFormatSettings(telegramId, { scheduleCaption: text.trim() });
      
      await bot.sendMessage(chatId, '✅ Шаблон підпису оновлено!', { parse_mode: 'HTML' });
      
      // Return to format settings menu
      const user = usersDb.getUserByTelegramId(telegramId);
      const { getFormatSettingsKeyboard } = require('../keyboards/inline');
      await bot.sendMessage(
        chatId,
        FORMAT_SETTINGS_MESSAGE,
        {
          parse_mode: 'HTML',
          ...getFormatSettingsKeyboard(user)
        }
      );
      
      conversationStates.delete(telegramId);
      return true;
    }
    
    if (state.state === 'waiting_for_period_format') {
      if (!text || text.trim().length === 0) {
        await bot.sendMessage(chatId, '❌ Формат не може бути пустим. Спробуйте ще раз або /cancel:');
        return true;
      }
      
      usersDb.updateUserFormatSettings(telegramId, { periodFormat: text.trim() });
      
      await bot.sendMessage(chatId, '✅ Формат періодів оновлено!', { parse_mode: 'HTML' });
      
      // Return to format settings menu
      const user = usersDb.getUserByTelegramId(telegramId);
      const { getFormatSettingsKeyboard } = require('../keyboards/inline');
      await bot.sendMessage(
        chatId,
        FORMAT_SETTINGS_MESSAGE,
        {
          parse_mode: 'HTML',
          ...getFormatSettingsKeyboard(user)
        }
      );
      
      conversationStates.delete(telegramId);
      return true;
    }
    
    if (state.state === 'waiting_for_power_off_text') {
      if (!text || text.trim().length === 0) {
        await bot.sendMessage(chatId, '❌ Текст не може бути пустим. Спробуйте ще раз або /cancel:');
        return true;
      }
      
      usersDb.updateUserFormatSettings(telegramId, { powerOffText: text.trim() });
      
      await bot.sendMessage(chatId, '✅ Текст відключення оновлено!', { parse_mode: 'HTML' });
      
      // Return to format settings menu
      const user = usersDb.getUserByTelegramId(telegramId);
      const { getFormatSettingsKeyboard } = require('../keyboards/inline');
      await bot.sendMessage(
        chatId,
        FORMAT_SETTINGS_MESSAGE,
        {
          parse_mode: 'HTML',
          ...getFormatSettingsKeyboard(user)
        }
      );
      
      conversationStates.delete(telegramId);
      return true;
    }
    
    if (state.state === 'waiting_for_power_on_text') {
      if (!text || text.trim().length === 0) {
        await bot.sendMessage(chatId, '❌ Текст не може бути пустим. Спробуйте ще раз або /cancel:');
        return true;
      }
      
      usersDb.updateUserFormatSettings(telegramId, { powerOnText: text.trim() });
      
      await bot.sendMessage(chatId, '✅ Текст включення оновлено!', { parse_mode: 'HTML' });
      
      // Return to format settings menu
      const user = usersDb.getUserByTelegramId(telegramId);
      const { getFormatSettingsKeyboard } = require('../keyboards/inline');
      await bot.sendMessage(
        chatId,
        FORMAT_SETTINGS_MESSAGE,
        {
          parse_mode: 'HTML',
          ...getFormatSettingsKeyboard(user)
        }
      );
      
      conversationStates.delete(telegramId);
      return true;
    }
    
    if (state.state === 'waiting_for_custom_test') {
      if (!text || text.trim().length === 0) {
        await bot.sendMessage(chatId, '❌ Текст не може бути пустим. Спробуйте ще раз або /cancel:');
        return true;
      }
      
      const user = usersDb.getUserByTelegramId(telegramId);
      
      try {
        await bot.sendMessage(user.channel_id, text.trim(), { parse_mode: 'HTML' });
        await bot.sendMessage(chatId, '✅ Повідомлення опубліковано в канал!', { parse_mode: 'HTML' });
      } catch (error) {
        console.error('Error publishing custom test:', error);
        await bot.sendMessage(chatId, '❌ Помилка публікації. Перевірте формат повідомлення.');
      }
      
      conversationStates.delete(telegramId);
      return true;
    }
    
    if (state.state === 'waiting_for_pause_message') {
      if (!text || text.trim().length === 0) {
        await bot.sendMessage(chatId, '❌ Текст не може бути пустим. Спробуйте ще раз або /cancel:');
        return true;
      }
      
      const { setSetting, getSetting } = require('../database/db');
      setSetting('pause_message', text.trim());
      
      await bot.sendMessage(chatId, '✅ Повідомлення паузи збережено!', { parse_mode: 'HTML' });
      
      // Show pause message settings again
      const showSupport = getSetting('pause_show_support', '1') === '1';
      const { getPauseMessageKeyboard } = require('../keyboards/inline');
      
      await bot.sendMessage(
        chatId,
        '📋 <b>Налаштування повідомлення паузи</b>\n\n' +
        'Оберіть шаблон або введіть свій текст:\n\n' +
        `Поточне повідомлення:\n"${text.trim()}"`,
        {
          parse_mode: 'HTML',
          reply_markup: getPauseMessageKeyboard(showSupport).reply_markup
        }
      );
      
      conversationStates.delete(telegramId);
      return true;
    }
    
  } catch (error) {
    console.error('Помилка в handleConversation:', error);
    await bot.sendMessage(chatId, '😅 Щось пішло не так. Спробуй ще раз командою /setchannel');
    conversationStates.delete(telegramId);
  }
  
  return false;
}

// Handle callback for channel operations
async function handleChannelCallback(bot, query) {
  const chatId = query.message.chat.id;
  const telegramId = String(query.from.id);
  const data = query.data;
  
  try {
    const user = usersDb.getUserByTelegramId(telegramId);
    
    // Handle channel_connect - new auto-connect flow
    if (data === 'channel_connect') {
      // Check if bot is paused
      const { getSetting } = require('../database/db');
      const botPaused = getSetting('bot_paused', '0') === '1';
      
      if (botPaused) {
        const pauseMessage = getSetting('pause_message', '🔧 Бот тимчасово недоступний. Спробуйте пізніше.');
        const showSupport = getSetting('pause_show_support', '1') === '1';
        
        const keyboard = showSupport ? {
          inline_keyboard: [
            [{ text: '💬 Обговорення/Підтримка', url: 'https://t.me/c/3857764385/2' }],
            [{ text: '← Назад', callback_data: 'settings_channel' }]
          ]
        } : {
          inline_keyboard: [
            [{ text: '← Назад', callback_data: 'settings_channel' }]
          ]
        };
        
        await safeEditMessageText(bot, pauseMessage, {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: keyboard
        });
        await bot.answerCallbackQuery(query.id);
        return;
      }
      
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
        const keyboard = {
          inline_keyboard: [
            [
              { text: '✓ Так, підключити', callback_data: `channel_confirm_${pendingChannel.channelId}` },
              { text: '✕ Ні', callback_data: 'settings_channel' }
            ]
          ]
        };
        
        await safeEditMessageText(bot, 
          `📺 <b>Знайдено канал!</b>\n\n` +
          `Канал: <b>${pendingChannel.channelTitle}</b>\n` +
          `(${pendingChannel.channelUsername})\n\n` +
          `Підключити цей канал?`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: keyboard
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
                [{ text: '✅ Перевірити', callback_data: 'channel_connect' }],
                [{ text: '← Назад', callback_data: 'settings_channel' }]
              ]
            }
          }
        );
      }
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle channel_confirm_ - confirm and setup channel
    if (data.startsWith('channel_confirm_')) {
      const channelId = data.replace('channel_confirm_', '');
      
      // Перевірка чи канал вже зайнятий
      const existingUser = usersDb.getUserByChannelId(channelId);
      if (existingUser && existingUser.telegram_id !== telegramId) {
        await safeEditMessageText(bot, 
          `⚠️ <b>Цей канал вже підключений.</b>\n\n` +
          `Якщо це ваш канал — зверніться до підтримки\n` +
          `або видаліть бота з каналу і додайте знову.`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '← Назад', callback_data: 'settings_channel' }]
              ]
            }
          }
        );
        await bot.answerCallbackQuery(query.id);
        return;
      }
      
      // Перевіряємо права бота в каналі
      try {
        if (!bot.options.id) {
          const botInfo = await bot.getMe();
          bot.options.id = botInfo.id;
        }
        
        const botMember = await bot.getChatMember(channelId, bot.options.id);
        
        if (botMember.status !== 'administrator' || !botMember.can_post_messages || !botMember.can_change_info) {
          await safeEditMessageText(bot, 
            '❌ <b>Недостатньо прав</b>\n\n' +
            'Бот повинен мати права на:\n' +
            '• Публікацію повідомлень\n' +
            '• Редагування інформації каналу',
            {
              chat_id: chatId,
              message_id: query.message.message_id,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '← Назад', callback_data: 'settings_channel' }]
                ]
              }
            }
          );
          await bot.answerCallbackQuery(query.id);
          return;
        }
      } catch (error) {
        console.error('Error checking bot permissions:', error);
        await bot.answerCallbackQuery(query.id, {
          text: '😅 Щось пішло не так при перевірці прав',
          show_alert: true
        });
        return;
      }
      
      // Отримуємо інфо про канал з pendingChannels
      const { pendingChannels } = require('../bot');
      const pendingChannel = pendingChannels.get(channelId);
      
      if (!pendingChannel) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Канал не знайдено. Спробуйте додати бота заново.',
          show_alert: true
        });
        return;
      }
      
      // Видаляємо з pending
      pendingChannels.delete(channelId);
      
      // Зберігаємо channel_id та початкуємо conversation для налаштування
      usersDb.resetUserChannel(telegramId, channelId);
      
      conversationStates.set(telegramId, {
        state: 'waiting_for_title',
        channelId: channelId,
        channelUsername: pendingChannel.channelUsername
      });
      
      await safeEditMessageText(bot, 
        '📝 <b>Введіть назву для каналу</b>\n\n' +
        `Вона буде додана після префіксу "${CHANNEL_NAME_PREFIX}"\n\n` +
        '<b>Приклад:</b> Київ Черга 3.1\n' +
        '<b>Результат:</b> Вольтик ⚡️ Київ Черга 3.1',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        }
      );
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle channel_info - show channel information
    if (data === 'channel_info') {
      if (!user || !user.channel_id) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Канал не підключено',
          show_alert: true
        });
        return;
      }
      
      const statusText = user.channel_status === 'blocked' ? '🔴 Заблокований' : '🟢 Активний';
      const infoText = 
        `📺 <b>Інформація про канал</b>\n\n` +
        `ID: <code>${user.channel_id}</code>\n` +
        `Назва: ${user.channel_title || 'Не налаштовано'}\n` +
        `Статус: ${statusText}\n\n` +
        (user.channel_status === 'blocked' 
          ? `⚠️ Канал заблокований через ручну зміну налаштувань.\nВикористайте "Перепідключити канал" для відновлення.`
          : `✅ Канал активний і готовий до публікацій.`);
      
      await bot.answerCallbackQuery(query.id, {
        text: infoText.replace(/<[^>]*>/g, ''), // Remove HTML tags for popup
        show_alert: true
      });
      return;
    }
    
    // Handle channel_disable - show confirmation first
    if (data === 'channel_disable') {
      if (!user || !user.channel_id) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Канал не підключено',
          show_alert: true
        });
        return;
      }
      
      // Show confirmation dialog
      const confirmKeyboard = {
        inline_keyboard: [
          [
            { text: '✓ Так, вимкнути', callback_data: 'channel_disable_confirm' },
            { text: '✕ Скасувати', callback_data: 'settings_channel' }
          ]
        ]
      };
      
      await safeEditMessageText(bot, 
        `⚠️ <b>Точно вимкнути публікації?</b>\n\n` +
        `Канал буде відключено від бота.\n` +
        `Графіки більше не будуть публікуватись.\n\n` +
        `Для повторного підключення потрібно буде використати:\n` +
        `<code>/setchannel @your_channel</code>`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: confirmKeyboard
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle confirmed channel disable
    if (data === 'channel_disable_confirm') {
      if (!user || !user.channel_id) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Канал не підключено',
          show_alert: true
        });
        return;
      }
      
      // Remove channel from user
      usersDb.updateUserChannel(telegramId, null);
      
      await safeEditMessageText(bot, 
        `✅ <b>Публікації вимкнено</b>\n\n` +
        `Канал відключено. Графіки більше не будуть публікуватись.\n\n` +
        `Для повторного підключення використайте:\n` +
        `<code>/setchannel @your_channel</code>`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        }
      );
      await bot.answerCallbackQuery(query.id, { text: '✅ Канал відключено' });
      return;
    }
    
    // Handle channel_pause - pause channel operations
    if (data === 'channel_pause') {
      await safeEditMessageText(bot, 
        `<b>Ви впевнені, що хочете тимчасово зупинити свій канал?</b>\n\n` +
        `Користувачі отримають повідомлення, що канал зупинено.\n` +
        `Поки ви не відновите роботу каналу, повідомлення про статус світла приходити не будуть.`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Скасувати', callback_data: 'back_to_main' },
                { text: 'Так, зупинити', callback_data: 'channel_pause_confirm' }
              ]
            ]
          }
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle channel_pause_confirm - confirm pause
    if (data === 'channel_pause_confirm') {
      // Оновити статус в БД
      usersDb.updateUserChannelPaused(telegramId, true);
      
      // Відправити повідомлення в канал
      const updatedUser = usersDb.getUserByTelegramId(telegramId);
      if (updatedUser.channel_id) {
        try {
          await bot.sendMessage(updatedUser.channel_id, '<b>⚠ Канал зупинено на технічну перерву!</b>', { parse_mode: 'HTML' });
        } catch (error) {
          console.error('Помилка відправки повідомлення про паузу в канал:', error);
        }
      }
      
      await bot.answerCallbackQuery(query.id, { text: '✅ Канал зупинено' });
      
      // Повернутися в головне меню з оновленою кнопкою
      const { getMainMenu } = require('../keyboards/inline');
      const { REGIONS } = require('../constants/regions');
      const region = REGIONS[updatedUser.region]?.name || updatedUser.region;
      
      let botStatus = 'active';
      if (!updatedUser.channel_id) {
        botStatus = 'no_channel';
      } else if (!updatedUser.is_active) {
        botStatus = 'paused';
      }
      
      let message = '<b>🚧 Бот у розробці</b>\n';
      message += '<i>Деякі функції можуть працювати нестабільно</i>\n\n';
      message += '<i>Допоможіть нам стати краще!</i>\n';
      message += '<i>Натисніть ❓ Допомога → 💬 Обговорення/Підтримка</i>\n\n';
      message += '🏠 <b>Головне меню</b>\n\n';
      message += `📍 Регіон: ${region} • ${updatedUser.queue}\n`;
      message += `📺 Канал: ${updatedUser.channel_id ? updatedUser.channel_id + ' ✅' : 'не підключено'}\n`;
      message += `🔔 Сповіщення: ${updatedUser.is_active ? 'увімкнено ✅' : 'вимкнено'}\n`;
      
      await safeEditMessageText(bot, 
        message,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getMainMenu(botStatus, true).reply_markup,
        }
      );
      return;
    }
    
    // Handle channel_resume - resume channel operations
    if (data === 'channel_resume') {
      await safeEditMessageText(bot, 
        `<b>Ви впевнені, що хочете відновити роботу каналу?</b>\n\n` +
        `Користувачі отримають повідомлення, що роботу каналу відновлено, і потім почнуть приходити повідомлення про статус світла.`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Скасувати', callback_data: 'back_to_main' },
                { text: 'Так, відновити', callback_data: 'channel_resume_confirm' }
              ]
            ]
          }
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle channel_resume_confirm - confirm resume
    if (data === 'channel_resume_confirm') {
      // Оновити статус в БД
      usersDb.updateUserChannelPaused(telegramId, false);
      
      // Відправити повідомлення в канал
      const updatedUser = usersDb.getUserByTelegramId(telegramId);
      if (updatedUser.channel_id) {
        try {
          await bot.sendMessage(updatedUser.channel_id, '<b>✅ Роботу каналу відновлено!</b>', { parse_mode: 'HTML' });
        } catch (error) {
          console.error('Помилка відправки повідомлення про відновлення в канал:', error);
        }
      }
      
      await bot.answerCallbackQuery(query.id, { text: '✅ Канал відновлено' });
      
      // Повернутися в головне меню з оновленою кнопкою
      const { getMainMenu } = require('../keyboards/inline');
      const { REGIONS } = require('../constants/regions');
      const region = REGIONS[updatedUser.region]?.name || updatedUser.region;
      
      let botStatus = 'active';
      if (!updatedUser.channel_id) {
        botStatus = 'no_channel';
      } else if (!updatedUser.is_active) {
        botStatus = 'paused';
      }
      
      let message = '<b>🚧 Бот у розробці</b>\n';
      message += '<i>Деякі функції можуть працювати нестабільно</i>\n\n';
      message += '<i>Допоможіть нам стати краще!</i>\n';
      message += '<i>Натисніть ❓ Допомога → 💬 Обговорення/Підтримка</i>\n\n';
      message += '🏠 <b>Головне меню</b>\n\n';
      message += `📍 Регіон: ${region} • ${updatedUser.queue}\n`;
      message += `📺 Канал: ${updatedUser.channel_id ? updatedUser.channel_id + ' ✅' : 'не підключено'}\n`;
      message += `🔔 Сповіщення: ${updatedUser.is_active ? 'увімкнено ✅' : 'вимкнено'}\n`;
      
      await safeEditMessageText(bot, 
        message,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getMainMenu(botStatus, false).reply_markup,
        }
      );
      return;
    }
    
    // Handle channel_edit_title - edit channel title
    if (data === 'channel_edit_title') {
      if (!user || !user.channel_id) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Канал не підключено',
          show_alert: true
        });
        return;
      }
      
      conversationStates.set(telegramId, {
        state: 'editing_title',
        channelId: user.channel_id
      });
      
      await safeEditMessageText(bot, 
        `📝 <b>Зміна назви каналу</b>\n\n` +
        `Поточна назва: ${user.channel_title || 'Не налаштовано'}\n\n` +
        `Введіть нову назву для каналу.\n` +
        `Вона буде додана після префіксу "${CHANNEL_NAME_PREFIX}"\n\n` +
        `<b>Приклад:</b> Київ Черга 3.1\n` +
        `<b>Результат:</b> ${CHANNEL_NAME_PREFIX}Київ Черга 3.1\n\n` +
        `Або введіть /cancel для скасування`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        }
      );
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle channel_edit_description - edit channel description
    if (data === 'channel_edit_description') {
      if (!user || !user.channel_id) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Канал не підключено',
          show_alert: true
        });
        return;
      }
      
      conversationStates.set(telegramId, {
        state: 'editing_description',
        channelId: user.channel_id
      });
      
      await safeEditMessageText(bot, 
        `📝 <b>Зміна опису каналу</b>\n\n` +
        `Поточний опис: ${user.user_description || 'Не налаштовано'}\n\n` +
        `Введіть новий опис для каналу.\n\n` +
        `<b>Приклад:</b> ЖК "Сонячний", під'їзд 2\n\n` +
        `Або введіть /cancel для скасування`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        }
      );
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle existing conversation state callbacks
    const state = conversationStates.get(telegramId);
    if (!state) {
      // No conversation state - these callbacks need a state
      if (data === 'channel_add_desc' || data === 'channel_skip_desc') {
        await bot.answerCallbackQuery(query.id, { text: '❌ Сесія закінчилась. Почніть заново.' });
        return;
      }
    } else {
      // Has conversation state - handle description choice callbacks
      if (data === 'channel_add_desc') {
        state.state = 'waiting_for_description';
        conversationStates.set(telegramId, state);
        
        await safeEditMessageText(bot, 
          '📝 <b>Введіть опис каналу:</b>\n\n' +
          'Наприклад: ЖК "Сонячний", під\'їзд 2\n\n' +
          'Або введіть /cancel для скасування',
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML'
          }
        );
        
        await bot.answerCallbackQuery(query.id);
        return;
      }
      
      if (data === 'channel_skip_desc') {
        state.userDescription = null;
        await applyChannelBranding(bot, chatId, telegramId, state);
        conversationStates.delete(telegramId);
        await bot.deleteMessage(chatId, query.message.message_id);
        await bot.answerCallbackQuery(query.id);
        return;
      }
    }
    
    // Handle channel_format - show format settings menu
    if (data === 'channel_format') {
      if (!user || !user.channel_id) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Канал не підключено',
          show_alert: true
        });
        return;
      }
      
      const { getFormatSettingsKeyboard } = require('../keyboards/inline');
      await safeEditMessageText(bot, 
        '📋 <b>Формат публікацій</b>\n\n' +
        'Налаштуйте формат повідомлень для вашого каналу:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getFormatSettingsKeyboard(user).reply_markup
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle format_noop - ignore non-interactive header clicks
    if (data === 'format_noop' || data.startsWith('format_header_')) {
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle format_toggle_delete - toggle delete old message
    if (data === 'format_toggle_delete') {
      const newValue = !user.delete_old_message;
      usersDb.updateUserFormatSettings(telegramId, { deleteOldMessage: newValue });
      
      await bot.answerCallbackQuery(query.id, {
        text: newValue ? '✅ Буде видалятись попереднє' : '❌ Не видалятиметься'
      });
      
      const updatedUser = usersDb.getUserByTelegramId(telegramId);
      const { getFormatSettingsKeyboard } = require('../keyboards/inline');
      await safeEditMessageText(bot, 
        '📋 <b>Формат публікацій</b>\n\n' +
        'Налаштуйте формат повідомлень для вашого каналу:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getFormatSettingsKeyboard(updatedUser).reply_markup
        }
      );
      return;
    }
    
    // Handle format_toggle_piconly - toggle picture only
    if (data === 'format_toggle_piconly') {
      const newValue = !user.picture_only;
      usersDb.updateUserFormatSettings(telegramId, { pictureOnly: newValue });
      
      await bot.answerCallbackQuery(query.id, {
        text: newValue ? '✅ Тільки картинка' : '❌ Картинка з підписом'
      });
      
      const updatedUser = usersDb.getUserByTelegramId(telegramId);
      const { getFormatSettingsKeyboard } = require('../keyboards/inline');
      await safeEditMessageText(bot, 
        '📋 <b>Формат публікацій</b>\n\n' +
        'Налаштуйте формат повідомлень для вашого каналу:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getFormatSettingsKeyboard(updatedUser).reply_markup
        }
      );
      return;
    }
    
    // Handle format_schedule_caption - edit schedule caption template
    if (data === 'format_schedule_caption') {
      conversationStates.set(telegramId, {
        state: 'waiting_for_schedule_caption',
        previousMessageId: query.message.message_id
      });
      
      const currentTemplate = user.schedule_caption || 'Графік на {dd}, {dm} для черги {queue}';
      
      await safeEditMessageText(bot, 
        '📝 <b>Шаблон підпису під графіком</b>\n\n' +
        'Доступні змінні:\n' +
        '• {d} - дата (01.02.2026)\n' +
        '• {dm} - дата коротко (01.02)\n' +
        '• {dd} - "сьогодні" або "завтра"\n' +
        '• {sdw} - Пн, Вт, Ср...\n' +
        '• {fdw} - Понеділок, Вівторок...\n' +
        '• {queue} - номер черги (3.1)\n' +
        '• {region} - назва регіону\n' +
        '• <br> - новий рядок\n\n' +
        `Поточний шаблон:\n<code>${currentTemplate}</code>\n\n` +
        'Введіть новий шаблон або /cancel для скасування:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle format_schedule_periods - edit period format template
    if (data === 'format_schedule_periods') {
      conversationStates.set(telegramId, {
        state: 'waiting_for_period_format',
        previousMessageId: query.message.message_id
      });
      
      const currentTemplate = user.period_format || '{s} - {f} ({h} год)';
      
      await safeEditMessageText(bot, 
        '⏰ <b>Формат періодів відключень</b>\n\n' +
        'Доступні змінні:\n' +
        '• {s} - початок (08:00)\n' +
        '• {f} - кінець (12:00)\n' +
        '• {h} - тривалість (4)\n\n' +
        'Можна використовувати HTML теги:\n' +
        '<b>жирний</b>, <i>курсив</i>, <code>код</code>\n\n' +
        `Поточний формат:\n<code>${currentTemplate}</code>\n\n` +
        'Приклади:\n' +
        '• {s} - {f} ({h} год)\n' +
        '• <b>{s}-{f}</b>\n' +
        '• <i>{s} - {f}</i> ({h}г)\n\n' +
        'Введіть новий формат або /cancel для скасування:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle format_power_off - edit power off text template
    if (data === 'format_power_off') {
      conversationStates.set(telegramId, {
        state: 'waiting_for_power_off_text',
        previousMessageId: query.message.message_id
      });
      
      const currentTemplate = user.power_off_text || '🔴 {time} Світло зникло\n🕓 Воно було {duration}\n🗓 Очікуємо за графіком о {schedule}';
      
      await safeEditMessageText(bot, 
        '📴 <b>Текст при відключенні світла</b>\n\n' +
        'Доступні змінні:\n' +
        '• {time} - час події (14:35)\n' +
        '• {date} - дата (01.02.2026)\n' +
        '• {duration} - тривалість (якщо відомо)\n' +
        '• {schedule} - інформація про графік\n\n' +
        `Поточний текст:\n<code>${currentTemplate}</code>\n\n` +
        'Введіть новий текст або /cancel для скасування:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle format_power_on - edit power on text template
    if (data === 'format_power_on') {
      conversationStates.set(telegramId, {
        state: 'waiting_for_power_on_text',
        previousMessageId: query.message.message_id
      });
      
      const currentTemplate = user.power_on_text || '🟢 {time} Світло з\'явилося\n🕓 Його не було {duration}\n🗓 Наступне планове: {schedule}';
      
      await safeEditMessageText(bot, 
        '💡 <b>Текст при появі світла</b>\n\n' +
        'Доступні змінні:\n' +
        '• {time} - час події (14:35)\n' +
        '• {date} - дата (01.02.2026)\n' +
        '• {duration} - скільки не було світла\n' +
        '• {schedule} - інформація про графік\n\n' +
        `Поточний текст:\n<code>${currentTemplate}</code>\n\n` +
        'Введіть новий текст або /cancel для скасування:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle channel_test - show test publication menu
    if (data === 'channel_test') {
      if (!user || !user.channel_id) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Канал не підключено',
          show_alert: true
        });
        return;
      }
      
      const { getTestPublicationKeyboard } = require('../keyboards/inline');
      await safeEditMessageText(bot, 
        '🧪 <b>Тест публікації</b>\n\n' +
        'Що опублікувати в канал?',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getTestPublicationKeyboard().reply_markup
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle test_schedule - test schedule publication
    if (data === 'test_schedule') {
      if (!user || !user.channel_id) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Канал не підключено',
          show_alert: true
        });
        return;
      }
      
      try {
        const { publishScheduleWithPhoto } = require('../publisher');
        await publishScheduleWithPhoto(bot, user, user.region, user.queue);
        
        await bot.answerCallbackQuery(query.id, {
          text: '✅ Графік опубліковано в канал!',
          show_alert: true
        });
      } catch (error) {
        console.error('Error publishing test schedule:', error);
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Помилка публікації графіка',
          show_alert: true
        });
      }
      return;
    }
    
    // Handle test_power_on - test power on publication
    if (data === 'test_power_on') {
      if (!user || !user.channel_id) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Канал не підключено',
          show_alert: true
        });
        return;
      }
      
      try {
        const { formatTemplate, getCurrentDateTimeForTemplate } = require('../formatter');
        const { timeStr, dateStr } = getCurrentDateTimeForTemplate();
        
        const template = user.power_on_text || '🟢 {time} Світло з\'явилося\n🕓 Його не було {duration}\n🗓 Наступне планове: {schedule}';
        const text = formatTemplate(template, {
          time: timeStr,
          date: dateStr,
          duration: '2 год 15 хв',
          schedule: '18:00 - 20:00'
        });
        
        await bot.sendMessage(user.channel_id, text, { parse_mode: 'HTML' });
        
        await bot.answerCallbackQuery(query.id, {
          text: '✅ Тестове повідомлення опубліковано!',
          show_alert: true
        });
      } catch (error) {
        console.error('Error publishing test power on:', error);
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Помилка публікації',
          show_alert: true
        });
      }
      return;
    }
    
    // Handle test_power_off - test power off publication
    if (data === 'test_power_off') {
      if (!user || !user.channel_id) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Канал не підключено',
          show_alert: true
        });
        return;
      }
      
      try {
        const { formatTemplate, getCurrentDateTimeForTemplate } = require('../formatter');
        const { timeStr, dateStr } = getCurrentDateTimeForTemplate();
        
        const template = user.power_off_text || '🔴 {time} Світло зникло\n🕓 Воно було {duration}\n🗓 Очікуємо за графіком о {schedule}';
        const text = formatTemplate(template, {
          time: timeStr,
          date: dateStr,
          duration: '1 год 30 хв',
          schedule: '16:00'
        });
        
        await bot.sendMessage(user.channel_id, text, { parse_mode: 'HTML' });
        
        await bot.answerCallbackQuery(query.id, {
          text: '✅ Тестове повідомлення опубліковано!',
          show_alert: true
        });
      } catch (error) {
        console.error('Error publishing test power off:', error);
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Помилка публікації',
          show_alert: true
        });
      }
      return;
    }
    
    // Handle test_custom - ask for custom message
    if (data === 'test_custom') {
      if (!user || !user.channel_id) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Канал не підключено',
          show_alert: true
        });
        return;
      }
      
      conversationStates.set(telegramId, {
        state: 'waiting_for_custom_test',
        previousMessageId: query.message.message_id
      });
      
      await safeEditMessageText(bot, 
        '✏️ <b>Своє повідомлення</b>\n\n' +
        'Введіть текст, який буде опубліковано в канал.\n' +
        'Можна використовувати HTML форматування.\n\n' +
        'Або введіть /cancel для скасування:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
  } catch (error) {
    console.error('Помилка в handleChannelCallback:', error);
    await bot.answerCallbackQuery(query.id, { text: '😅 Щось пішло не так. Спробуй ще раз!' });
  }
}

// Apply branding to the channel
async function applyChannelBranding(bot, chatId, telegramId, state) {
  try {
    // Show typing indicator
    await bot.sendChatAction(chatId, 'typing');
    await bot.sendMessage(chatId, '⏳ Налаштовую канал...');
    
    const fullTitle = CHANNEL_NAME_PREFIX + state.userTitle;
    let fullDescription = CHANNEL_DESCRIPTION_BASE;
    if (state.userDescription) {
      fullDescription += '\n📍 ' + state.userDescription;
    }
    
    // Set channel title
    try {
      await bot.setChatTitle(state.channelId, fullTitle);
    } catch (error) {
      console.error('Error setting channel title:', error);
      await bot.sendMessage(
        chatId,
        '❌ Не вдалося змінити назву каналу. Переконайтесь, що бот має права на редагування інформації каналу.'
      );
      conversationStates.delete(telegramId);
      return;
    }
    
    // Set channel description
    try {
      await bot.setChatDescription(state.channelId, fullDescription);
    } catch (error) {
      console.error('Error setting channel description:', error);
      await bot.sendMessage(
        chatId,
        '❌ Не вдалося змінити опис каналу. Переконайтесь, що бот має права на редагування інформації каналу.'
      );
      conversationStates.delete(telegramId);
      return;
    }
    
    // Set channel photo
    let photoFileId = null;
    try {
      if (fs.existsSync(PHOTO_PATH)) {
        const photoBuffer = fs.readFileSync(PHOTO_PATH);
        const result = await bot.setChatPhoto(state.channelId, photoBuffer);
        
        // Get the file_id by fetching chat info
        const chatInfo = await bot.getChat(state.channelId);
        if (chatInfo.photo && chatInfo.photo.big_file_id) {
          photoFileId = chatInfo.photo.big_file_id;
        }
      } else {
        console.warn('Photo file not found:', PHOTO_PATH);
      }
    } catch (error) {
      console.error('Error setting channel photo:', error);
      // Continue even if photo upload fails
    }
    
    // Save branding info to database
    usersDb.updateChannelBranding(telegramId, {
      channelTitle: fullTitle,
      channelDescription: fullDescription,
      channelPhotoFileId: photoFileId,
      userTitle: state.userTitle,
      userDescription: state.userDescription
    });
    
    // Send first publication message to channel
    try {
      const user = usersDb.getUserByTelegramId(telegramId);
      await bot.sendMessage(
        state.channelId,
        `👋 Канал підключено до Вольтик!\n\n` +
        `Тут будуть з'являтись:\n` +
        `• 📊 Графіки відключень\n` +
        `• ⚡ Сповіщення про світло\n\n` +
        `Черга: ${user.queue}`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('Error sending first publication:', error);
      // Continue even if first publication fails
    }
    
    // Send success message with warning
    await bot.sendMessage(
      chatId,
      `✅ <b>Канал успішно налаштовано!</b>\n\n` +
      `📺 Канал: ${state.channelUsername}\n` +
      `📝 Назва: ${fullTitle}\n\n` +
      `⚠️ <b>УВАГА:</b> Не змінюйте назву, опис або фото каналу!\n` +
      `Якщо ви їх зміните — бот перестане працювати і\n` +
      `потрібно буде налаштовувати канал заново.`,
      { parse_mode: 'HTML' }
    );
    
    // Затримка 4 секунди
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Send main menu after successful channel setup
    const user = usersDb.getUserByTelegramId(telegramId);
    let botStatus = 'active';
    if (!user.channel_id) {
      botStatus = 'no_channel';
    } else if (!user.is_active) {
      botStatus = 'paused';
    }
    
    const channelPaused = user.channel_paused === 1;
    
    const { getMainMenu } = require('../keyboards/inline');
    await bot.sendMessage(
      chatId,
      '🏠 <b>Головне меню</b>',
      {
        parse_mode: 'HTML',
        ...getMainMenu(botStatus, channelPaused),
      }
    );
    
  } catch (error) {
    console.error('Помилка в applyChannelBranding:', error);
    await bot.sendMessage(chatId, '😅 Щось пішло не так при налаштуванні каналу. Спробуй ще раз!');
  }
}

// Handle /cancel command
async function handleCancelChannel(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  
  if (conversationStates.has(telegramId)) {
    conversationStates.delete(telegramId);
    await bot.sendMessage(chatId, '❌ Налаштування каналу скасовано.');
  }
}

// Обробник пересланих повідомлень для підключення каналу (deprecated but kept for compatibility)
async function handleForwardedMessage(bot, msg) {
  const chatId = msg.chat.id;
  
  // Just inform user about new method
  await bot.sendMessage(
    chatId,
    '📺 Тепер для підключення каналу використовуйте команду:\n\n' +
    '<code>/setchannel @your_channel</code>',
    { parse_mode: 'HTML' }
  );
}

module.exports = {
  handleChannel,
  handleSetChannel,
  handleConversation,
  handleChannelCallback,
  handleCancelChannel,
  handleForwardedMessage,
  conversationStates,
};
