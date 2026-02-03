const usersDb = require('../database/users');
const { getSettingsKeyboard, getAlertsSettingsKeyboard, getAlertTimeKeyboard, getDeactivateConfirmKeyboard, getDeleteDataConfirmKeyboard, getDeleteDataFinalKeyboard, getIpMonitoringKeyboard, getIpCancelKeyboard, getChannelMenuKeyboard, getErrorKeyboard, getNotifyTargetKeyboard } = require('../keyboards/inline');
const { REGIONS } = require('../constants/regions');
const { startWizard } = require('./start');
const { isAdmin, generateLiveStatusMessage } = require('../utils');
const config = require('../config');
const { formatErrorMessage } = require('../formatter');
const { safeSendMessage, safeDeleteMessage } = require('../utils/errorHandler');

// Store IP setup conversation states
const ipSetupStates = new Map();

// IP address validation regex
const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

// Обробник команди /settings
async function handleSettings(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  
  try {
    const user = usersDb.getUserByTelegramId(telegramId);
    
    if (!user) {
      await safeSendMessage(bot, chatId, '❌ Спочатку налаштуйте бота командою /start');
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
    await safeSendMessage(bot, chatId, formatErrorMessage(), {
      parse_mode: 'HTML',
      ...getErrorKeyboard()
    });
  }
}

// Обробник callback для налаштувань
async function handleSettingsCallback(bot, query) {
  const chatId = query.message.chat.id;
  const telegramId = String(query.from.id);
  const data = query.data;
  
  try {
    const user = usersDb.getUserByTelegramId(telegramId);
    
    if (!user) {
      await bot.answerCallbackQuery(query.id, { text: '❌ Користувача не знайдено' });
      return;
    }
    
    // Змінити регіон/чергу
    if (data === 'settings_region') {
      // Видаляємо попереднє повідомлення з настройками
      try {
        await bot.deleteMessage(chatId, query.message.message_id);
      } catch (e) {
        // Ігноруємо помилки видалення
      }
      
      // Запускаємо wizard в режимі редагування
      const username = query.from.username || query.from.first_name;
      await startWizard(bot, chatId, telegramId, username, 'edit');
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Налаштування алертів
    if (data === 'settings_alerts') {
      const message = 
        `🔔 <b>Сповіщення</b>\n\n` +
        `Статус: <b>${user.is_active ? '✅ Увімкнено' : '❌ Вимкнено'}</b>\n\n` +
        (user.is_active ? 
          'Ви отримуєте:\n' +
          '• Зміни графіка\n' +
          '• Фактичні відключення' : 
          'Сповіщення вимкнено');
      
      // Simple keyboard with toggle button
      const keyboard = {
        inline_keyboard: [
          [{ text: user.is_active ? '🔕 Вимкнути' : '🔔 Увімкнути', callback_data: 'alert_toggle' }],
          [{ text: '← Назад', callback_data: 'back_to_settings' }]
        ]
      };
      
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Toggle alerts on/off
    if (data === 'alert_toggle') {
      const newValue = !user.is_active;
      usersDb.setUserActive(telegramId, newValue);
      
      const updatedUser = usersDb.getUserByTelegramId(telegramId);
      const message = 
        `🔔 <b>Сповіщення</b>\n\n` +
        `Статус: <b>${updatedUser.is_active ? '✅ Увімкнено' : '❌ Вимкнено'}</b>\n\n` +
        (updatedUser.is_active ? 
          'Ви отримуєте:\n' +
          '• Зміни графіка\n' +
          '• Фактичні відключення' : 
          'Сповіщення вимкнено');
      
      const keyboard = {
        inline_keyboard: [
          [{ text: updatedUser.is_active ? '🔕 Вимкнути' : '🔔 Увімкнути', callback_data: 'alert_toggle' }],
          [{ text: '← Назад', callback_data: 'back_to_settings' }]
        ]
      };
      
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      await bot.answerCallbackQuery(query.id, {
        text: `✅ Сповіщення ${newValue ? 'увімкнено' : 'вимкнено'}`,
      });
      return;
    }
    
    // Delete data - Step 1
    if (data === 'settings_delete_data') {
      await bot.editMessageText(
        '⚠️ <b>Увага</b>\n\n' +
        'Ви збираєтесь видалити всі дані.\n' +
        'Цю дію неможливо скасувати.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getDeleteDataConfirmKeyboard().reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Delete data - Step 2
    if (data === 'delete_data_step2') {
      await bot.editMessageText(
        '❗ <b>Підтвердження</b>\n\n' +
        'Видалити всі дані?',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getDeleteDataFinalKeyboard().reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Confirm delete data - Final
    if (data === 'confirm_delete_data') {
      // Delete user from database
      usersDb.deleteUser(telegramId);
      
      await bot.editMessageText(
        '👋 <b>Сумно, але ок!</b>\n\n' +
        'Всі твої дані видалено. Канал відключено.\n\n' +
        'Якщо захочеш повернутись - просто напиши /start\n\n' +
        'Бувай! 🤖',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Деактивувати бота
    if (data === 'settings_deactivate') {
      await bot.editMessageText(
        '❗️ Ви впевнені, що хочете деактивувати бота?\n\n' +
        'Ви перестанете отримувати сповіщення про зміни графіка.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: getDeactivateConfirmKeyboard().reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Підтвердження деактивації
    if (data === 'confirm_deactivate') {
      usersDb.setUserActive(telegramId, false);
      
      await bot.editMessageText(
        '✅ Бот деактивовано.\n\n' +
        'Використайте /start для повторної активації.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
        }
      );
      await bot.answerCallbackQuery(query.id);
      
      // Send main menu after successful deactivation
      const { getMainMenu } = require('../keyboards/inline');
      await bot.sendMessage(
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
      await bot.editMessageText(
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
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // IP setup
    if (data === 'ip_setup') {
      await bot.editMessageText(
        '🌐 <b>Налаштування IP</b>\n\n' +
        'Надішліть IP-адресу вашого роутера.\n\n' +
        'Формат: 192.168.1.1 або 91.123.45.67\n\n' +
        '⏰ Час очікування: 5 хвилин',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getIpCancelKeyboard().reply_markup,
        }
      );
      
      // Set up warning timeout (4 minutes = 5 minutes - 1 minute)
      const warningTimeout = setTimeout(() => {
        bot.sendMessage(
          chatId,
          '⏳ Залишилась 1 хвилина.\n' +
          'Надішліть IP-адресу або продовжіть пізніше.'
        ).catch(() => {});
      }, 240000); // 4 minutes
      
      // Set up final timeout (5 minutes)
      const finalTimeout = setTimeout(() => {
        ipSetupStates.delete(telegramId);
        bot.sendMessage(
          chatId,
          '⌛ <b>Час вийшов.</b>\n' +
          'Режим налаштування IP завершено.',
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }, 300000); // 5 minutes
      
      ipSetupStates.set(telegramId, {
        messageId: query.message.message_id,
        warningTimeout: warningTimeout,
        finalTimeout: finalTimeout,
      });
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // IP cancel
    if (data === 'ip_cancel') {
      const state = ipSetupStates.get(telegramId);
      if (state) {
        if (state.warningTimeout) clearTimeout(state.warningTimeout);
        if (state.finalTimeout) clearTimeout(state.finalTimeout);
        if (state.timeout) clearTimeout(state.timeout); // backwards compatibility
        ipSetupStates.delete(telegramId);
      }
      
      await bot.editMessageText(
        '❌ Налаштування IP скасовано.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // IP show
    if (data === 'ip_show') {
      const message = user.router_ip 
        ? `📍 Ваша IP-адреса: ${user.router_ip}`
        : 'ℹ️ IP-адреса не налаштована';
      
      await bot.answerCallbackQuery(query.id, { 
        text: message,
        show_alert: true 
      });
      return;
    }
    
    // IP delete
    if (data === 'ip_delete') {
      if (!user.router_ip) {
        await bot.answerCallbackQuery(query.id, { text: 'ℹ️ IP-адреса не налаштована' });
        return;
      }
      
      usersDb.updateUserRouterIp(telegramId, null);
      
      await bot.editMessageText(
        '✅ IP-адресу видалено.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
        }
      );
      await bot.answerCallbackQuery(query.id);
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
      
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getChannelMenuKeyboard(user.channel_id, isPublic, channelStatus).reply_markup,
      });
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Channel reconnect
    if (data === 'channel_reconnect') {
      if (!user.channel_id) {
        await bot.answerCallbackQuery(query.id, { 
          text: '❌ Канал не підключено',
          show_alert: true 
        });
        return;
      }
      
      // Reset channel status to active
      usersDb.updateChannelStatus(telegramId, 'active');
      
      await bot.editMessageText(
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
      await bot.answerCallbackQuery(query.id, { text: '✅ Канал розблоковано' });
      return;
    }
    
    // Test button
    if (data === 'settings_test') {
      if (!user.channel_id) {
        await bot.answerCallbackQuery(query.id, { 
          text: '❌ Спочатку підключіть канал',
          show_alert: true 
        });
        return;
      }
      
      try {
        const { publishScheduleWithPhoto } = require('../publisher');
        await publishScheduleWithPhoto(bot, user, user.region, user.queue);
        
        await bot.answerCallbackQuery(query.id, { 
          text: '✅ Тестове повідомлення відправлено!',
          show_alert: true 
        });
      } catch (error) {
        await bot.answerCallbackQuery(query.id, { 
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
        await bot.answerCallbackQuery(query.id, { text: '❌ Доступ заборонено' });
        return;
      }
      
      // Show admin panel directly
      const { getAdminKeyboard } = require('../keyboards/inline');
      
      await bot.editMessageText(
        '🔧 <b>Адмін-панель</b>',
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
    
    // Налаштування куди публікувати сповіщення про світло
    if (data === 'settings_notify_target' || data === 'notify_target_menu') {
      const currentTarget = user.power_notify_target || 'both';
      
      const targetLabels = {
        'bot': '📱 Тільки в бот',
        'channel': '📺 Тільки в канал',
        'both': '📱📺 В бот і канал'
      };
      
      await bot.editMessageText(
        `🔔 <b>Сповіщення про світло</b>\n\n` +
        `Куди публікувати повідомлення про увімкнення/вимкнення світла?\n\n` +
        `Поточне: <b>${targetLabels[currentTarget]}</b>`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getNotifyTargetKeyboard(currentTarget).reply_markup
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Встановити налаштування куди публікувати
    if (data.startsWith('notify_target_')) {
      const target = data.replace('notify_target_', '');
      if (['bot', 'channel', 'both'].includes(target)) {
        const success = usersDb.updateUserPowerNotifyTarget(telegramId, target);
        
        if (!success) {
          await bot.answerCallbackQuery(query.id, {
            text: '❌ Помилка оновлення налаштування',
            show_alert: true
          });
          return;
        }
        
        const targetLabels = {
          'bot': '📱 Тільки в бот',
          'channel': '📺 Тільки в канал',
          'both': '📱📺 В бот і канал'
        };
        
        await bot.answerCallbackQuery(query.id, {
          text: `✅ Встановлено: ${targetLabels[target]}`,
          show_alert: false
        });
        
        // Оновити повідомлення з новою клавіатурою
        await bot.editMessageText(
          `🔔 <b>Сповіщення про світло</b>\n\n` +
          `Куди публікувати повідомлення про увімкнення/вимкнення світла?\n\n` +
          `Поточне: <b>${targetLabels[target]}</b>`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: getNotifyTargetKeyboard(target).reply_markup
          }
        );
      }
      return;
    }
    
    // Відкрити меню налаштувань попереджень про графік
    if (data === 'settings_schedule_alerts') {
      await showScheduleAlertSettings(bot, chatId, query.message.message_id, user);
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Увімкнути/вимкнути попередження про графік
    if (data === 'schedule_alert_on') {
      usersDb.updateScheduleAlertEnabled(telegramId, true);
      await bot.answerCallbackQuery(query.id, { text: '✅ Попередження увімкнено' });
      const updatedUser = usersDb.getUserByTelegramId(telegramId);
      await showScheduleAlertSettings(bot, chatId, query.message.message_id, updatedUser);
      return;
    }
    
    if (data === 'schedule_alert_off') {
      usersDb.updateScheduleAlertEnabled(telegramId, false);
      await bot.answerCallbackQuery(query.id, { text: '❌ Попередження вимкнено' });
      const updatedUser = usersDb.getUserByTelegramId(telegramId);
      await showScheduleAlertSettings(bot, chatId, query.message.message_id, updatedUser);
      return;
    }
    
    // За скільки хвилин попереджати
    if (data.startsWith('schedule_alert_time_')) {
      const minutes = parseInt(data.replace('schedule_alert_time_', ''));
      if ([5, 10, 15, 30, 60].includes(minutes)) {
        usersDb.updateScheduleAlertMinutes(telegramId, minutes);
        await bot.answerCallbackQuery(query.id, { text: `✅ Попереджати за ${minutes} хв` });
        const updatedUser = usersDb.getUserByTelegramId(telegramId);
        await showScheduleAlertSettings(bot, chatId, query.message.message_id, updatedUser);
      }
      return;
    }
    
    // Куди надсилати попередження
    if (data.startsWith('schedule_alert_target_')) {
      const target = data.replace('schedule_alert_target_', '');
      if (['bot', 'channel', 'both'].includes(target)) {
        usersDb.updateScheduleAlertTarget(telegramId, target);
        const labels = { bot: '📱 Бот', channel: '📺 Канал', both: '📱📺 Обидва' };
        await bot.answerCallbackQuery(query.id, { text: `✅ ${labels[target]}` });
        const updatedUser = usersDb.getUserByTelegramId(telegramId);
        await showScheduleAlertSettings(bot, chatId, query.message.message_id, updatedUser);
      }
      return;
    }
    
    // Назад до налаштувань
    if (data === 'back_to_settings') {
      const updatedUser = usersDb.getUserByTelegramId(telegramId);
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
      
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getSettingsKeyboard(userIsAdmin).reply_markup,
      });
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
  } catch (error) {
    console.error('Помилка в handleSettingsCallback:', error);
    await bot.answerCallbackQuery(query.id, { text: '😅 Щось пішло не так. Спробуй ще раз!' });
  }
}

// Handle IP setup conversation
async function handleIpConversation(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const text = msg.text;
  
  const state = ipSetupStates.get(telegramId);
  if (!state) return false;
  
  try {
    // Clear all timeouts
    if (state.timeout) clearTimeout(state.timeout);
    if (state.warningTimeout) clearTimeout(state.warningTimeout);
    if (state.finalTimeout) clearTimeout(state.finalTimeout);
    
    // Validate IP address format
    if (!IP_REGEX.test(text)) {
      await bot.sendMessage(chatId, '❌ Невірний формат IP-адреси. Спробуйте ще раз.\n\nПриклад: 192.168.1.1');
      
      // Reset timeout with new 5-minute timer
      const warningTimeout = setTimeout(() => {
        bot.sendMessage(
          chatId,
          '⏳ Залишилась 1 хвилина.\n' +
          'Надішліть IP-адресу або продовжіть пізніше.'
        ).catch(() => {});
      }, 240000); // 4 minutes
      
      const finalTimeout = setTimeout(() => {
        ipSetupStates.delete(telegramId);
        bot.sendMessage(
          chatId,
          '⌛ <b>Час вийшов.</b>\n' +
          'Режим налаштування IP завершено.',
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }, 300000); // 5 minutes
      
      state.warningTimeout = warningTimeout;
      state.finalTimeout = finalTimeout;
      ipSetupStates.set(telegramId, state);
      
      return true;
    }
    
    // Additional validation: check if octets are in valid range
    const octets = text.split('.').map(Number);
    if (octets.some(octet => octet < 0 || octet > 255)) {
      await bot.sendMessage(chatId, '❌ Невірні значення в IP-адресі (кожне число має бути від 0 до 255). Спробуйте ще раз.');
      
      // Reset timeout with new 5-minute timer
      const warningTimeout = setTimeout(() => {
        bot.sendMessage(
          chatId,
          '⏳ Залишилась 1 хвилина.\n' +
          'Надішліть IP-адресу або продовжіть пізніше.'
        ).catch(() => {});
      }, 240000); // 4 minutes
      
      const finalTimeout = setTimeout(() => {
        ipSetupStates.delete(telegramId);
        bot.sendMessage(
          chatId,
          '⌛ <b>Час вийшов.</b>\n' +
          'Режим налаштування IP завершено.',
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }, 300000); // 5 minutes
      
      state.warningTimeout = warningTimeout;
      state.finalTimeout = finalTimeout;
      ipSetupStates.set(telegramId, state);
      
      return true;
    }
    
    // Save IP address
    usersDb.updateUserRouterIp(telegramId, text);
    ipSetupStates.delete(telegramId);
    
    await bot.sendMessage(
      chatId,
      `✅ IP-адресу збережено: ${text}\n\n` +
      `Тепер бот буде моніторити доступність цієї адреси для визначення наявності світла.`
    );
    
    // Send main menu after successful IP setup
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
    
    return true;
  } catch (error) {
    console.error('Помилка в handleIpConversation:', error);
    ipSetupStates.delete(telegramId);
    await bot.sendMessage(chatId, '😅 Щось пішло не так. Спробуй ще раз командою /settings');
    return true;
  }
}

// Функція показу меню налаштувань попереджень про графік
async function showScheduleAlertSettings(bot, chatId, messageId, user) {
  const enabled = user.schedule_alert_enabled !== 0;
  const minutes = user.schedule_alert_minutes || 15;
  const target = user.schedule_alert_target || 'both';
  
  const statusText = enabled ? '✅ Увімкнено' : '❌ Вимкнено';
  const targetLabels = { bot: '📱 Бот', channel: '📺 Канал', both: '📱📺 Бот і канал' };
  
  const text = `⏰ <b>Попередження про графік</b>\n\n` +
    `Бот може сповіщати заздалегідь:\n` +
    `• 💡 Коли світло має з'явитись\n` +
    `• ⚠️ Коли наближається відключення\n\n` +
    `Стан: <b>${statusText}</b>\n` +
    `Попереджати за: <b>${minutes} хв</b>\n` +
    `Куди: <b>${targetLabels[target]}</b>`;
  
  const timeOptions = [5, 10, 15, 30, 60];
  const targetOptions = [
    { value: 'bot', label: '📱 Бот' },
    { value: 'channel', label: '📺 Канал' },
    { value: 'both', label: '📱📺 Обидва' }
  ];
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: enabled ? '✅ Увімкнено (натисни щоб вимкнути)' : '❌ Вимкнено (натисни щоб увімкнути)', callback_data: enabled ? 'schedule_alert_off' : 'schedule_alert_on' }
      ],
      timeOptions.map(t => ({
        text: t === minutes ? `✓ ${t} хв` : `${t} хв`,
        callback_data: `schedule_alert_time_${t}`
      })),
      targetOptions.map(opt => ({
        text: opt.value === target ? `✓ ${opt.label}` : opt.label,
        callback_data: `schedule_alert_target_${opt.value}`
      })),
      [{ text: '← Назад', callback_data: 'back_to_settings' }]
    ]
  };
  
  await bot.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

module.exports = {
  handleSettings,
  handleSettingsCallback,
  handleIpConversation,
  ipSetupStates,
};
