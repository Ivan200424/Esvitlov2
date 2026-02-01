const usersDb = require('../database/users');
const fs = require('fs');
const path = require('path');

// Store conversation states
const conversationStates = new Map();

// Constants
const CHANNEL_NAME_PREFIX = 'СвітлоЧек 🤖 ';
const CHANNEL_DESCRIPTION_BASE = '🤖 СвітлоЧек — слідкує, щоб ти не слідкував';
const PHOTO_PATH = path.join(__dirname, '../../photo_for_channels.PNG');
const PENDING_CHANNEL_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutes

// Обробник команди /channel
async function handleChannel(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  
  try {
    const user = usersDb.getUserByTelegramId(telegramId);
    
    if (!user) {
      await bot.sendMessage(chatId, '❌ Спочатку налаштуйте бота командою /start');
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
    
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Помилка в handleChannel:', error);
    await bot.sendMessage(chatId, '😅 Щось пішло не так. Спробуй ще раз!');
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
      '<b>Результат:</b> СвітлоЧек 🤖 Київ Черга 3.1',
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
        
        await bot.editMessageText(
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
        await bot.editMessageText(
          `📺 <b>Підключення каналу</b>\n\n` +
          `1️⃣ Додайте бота як адміністратора вашого каналу\n` +
          `2️⃣ Дайте боту права на:\n` +
          `   • Публікацію повідомлень\n` +
          `   • Редагування інформації каналу\n` +
          `3️⃣ Поверніться сюди і натисніть "✚ Підключити"\n\n` +
          `⏳ Очікую додавання бота в канал...`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Перевірити', callback_data: 'channel_connect' }],
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
        await bot.editMessageText(
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
          await bot.editMessageText(
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
      
      await bot.editMessageText(
        '📝 <b>Введіть назву для каналу</b>\n\n' +
        `Вона буде додана після префіксу "${CHANNEL_NAME_PREFIX}"\n\n` +
        '<b>Приклад:</b> Київ Черга 3.1\n' +
        '<b>Результат:</b> СвітлоЧек 🤖 Київ Черга 3.1',
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
      
      await bot.editMessageText(
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
      
      await bot.editMessageText(
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
      
      await bot.editMessageText(
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
      
      await bot.editMessageText(
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
        
        await bot.editMessageText(
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
        `👋 Канал підключено до СвітлоЧек!\n\n` +
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
};
