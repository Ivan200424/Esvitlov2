const usersDb = require('../database/users');
const { getSettingsKeyboard, getAlertsSettingsKeyboard, getAlertTimeKeyboard, getDeactivateConfirmKeyboard, getDeleteDataConfirmKeyboard, getIpMonitoringKeyboard, getIpCancelKeyboard, getChannelMenuKeyboard } = require('../keyboards/inline');
const { REGIONS } = require('../constants/regions');
const { startWizard } = require('./start');
const { isAdmin } = require('../utils');
const config = require('../config');

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
      await bot.sendMessage(chatId, '❌ Спочатку налаштуйте бота командою /start');
      return;
    }
    
    const userIsAdmin = isAdmin(telegramId, config.adminIds, config.ownerId);
    const region = REGIONS[user.region]?.name || user.region;
    const message = 
      `⚙️ <b>Налаштування</b>\n\n` +
      `📍 Регіон: ${region}\n` +
      `⚡️ Черга: ${user.queue}\n` +
      `📺 Канал: ${user.channel_id ? '✅' : '❌'}\n` +
      `🌐 IP: ${user.router_ip ? '✅' : '❌'}\n` +
      `🔔 Сповіщення: ${user.is_active ? '✅' : '❌'}\n\n` +
      `Обери опцію:`;
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...getSettingsKeyboard(userIsAdmin),
    });
    
  } catch (error) {
    console.error('Помилка в handleSettings:', error);
    await bot.sendMessage(chatId, '😅 Щось пішло не так. Спробуй ще раз!');
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
      const offTime = user.notify_before_off === 0 ? 'Вимкнено' : `${user.notify_before_off} хв`;
      const onTime = user.notify_before_on === 0 ? 'Вимкнено' : `${user.notify_before_on} хв`;
      const offStatus = user.alerts_off_enabled && user.notify_before_off > 0 ? '✅' : '❌';
      const onStatus = user.alerts_on_enabled && user.notify_before_on > 0 ? '✅' : '❌';
      
      const message = 
        `🔔 <b>Налаштування сповіщень</b>\n\n` +
        `📴 <b>Сповіщення перед ВІДКЛЮЧЕННЯМ світла</b>\n` +
        `(попередить за X хвилин до планового відключення)\n` +
        `⏰ Зараз: ${offTime} | Статус: ${offStatus}\n\n` +
        `📳 <b>Сповіщення перед ВКЛЮЧЕННЯМ світла</b>\n` +
        `(попередить за X хвилин до планового включення)\n` +
        `⏰ Зараз: ${onTime} | Статус: ${onStatus}\n\n` +
        `Обери опцію:`;
      
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getAlertsSettingsKeyboard().reply_markup,
      });
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Час сповіщення перед відключенням
    if (data === 'alert_off_time') {
      await bot.editMessageText(
        '⏰ <b>Оберіть час сповіщення перед відключенням:</b>\n\n' +
        'Бот попередить вас за обраний час до планового відключення світла.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getAlertTimeKeyboard('off').reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Час сповіщення перед включенням
    if (data === 'alert_on_time') {
      await bot.editMessageText(
        '⏰ <b>Оберіть час сповіщення перед включенням:</b>\n\n' +
        'Бот попередить вас за обраний час до планового включення світла.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getAlertTimeKeyboard('on').reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Увімк/Вимк сповіщення про відключення
    if (data === 'alert_off_toggle') {
      const newValue = !user.alerts_off_enabled;
      usersDb.updateUserAlertSettings(telegramId, { alertsOffEnabled: newValue });
      
      await bot.answerCallbackQuery(query.id, {
        text: `✅ Відключення ${newValue ? '✅' : '❌'}`,
      });
      
      // Оновлюємо повідомлення
      const updatedUser = usersDb.getUserByTelegramId(telegramId);
      const offTime = updatedUser.notify_before_off === 0 ? 'Вимкнено' : `${updatedUser.notify_before_off} хв`;
      const onTime = updatedUser.notify_before_on === 0 ? 'Вимкнено' : `${updatedUser.notify_before_on} хв`;
      const offStatus = updatedUser.alerts_off_enabled && updatedUser.notify_before_off > 0 ? '✅' : '❌';
      const onStatus = updatedUser.alerts_on_enabled && updatedUser.notify_before_on > 0 ? '✅' : '❌';
      
      const message = 
        `🔔 <b>Налаштування сповіщень</b>\n\n` +
        `📴 <b>Сповіщення перед ВІДКЛЮЧЕННЯМ світла</b>\n` +
        `(попередить за X хвилин до планового відключення)\n` +
        `⏰ Зараз: ${offTime} | Статус: ${offStatus}\n\n` +
        `📳 <b>Сповіщення перед ВКЛЮЧЕННЯМ світла</b>\n` +
        `(попередить за X хвилин до планового включення)\n` +
        `⏰ Зараз: ${onTime} | Статус: ${onStatus}\n\n` +
        `Обери опцію:`;
      
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getAlertsSettingsKeyboard().reply_markup,
      });
      return;
    }
    
    // Увімк/Вимк сповіщення про включення
    if (data === 'alert_on_toggle') {
      const newValue = !user.alerts_on_enabled;
      usersDb.updateUserAlertSettings(telegramId, { alertsOnEnabled: newValue });
      
      await bot.answerCallbackQuery(query.id, {
        text: `✅ Включення ${newValue ? '✅' : '❌'}`,
      });
      
      // Оновлюємо повідомлення
      const updatedUser = usersDb.getUserByTelegramId(telegramId);
      const offTime = updatedUser.notify_before_off === 0 ? 'Вимкнено' : `${updatedUser.notify_before_off} хв`;
      const onTime = updatedUser.notify_before_on === 0 ? 'Вимкнено' : `${updatedUser.notify_before_on} хв`;
      const offStatus = updatedUser.alerts_off_enabled && updatedUser.notify_before_off > 0 ? '✅' : '❌';
      const onStatus = updatedUser.alerts_on_enabled && updatedUser.notify_before_on > 0 ? '✅' : '❌';
      
      const message = 
        `🔔 <b>Налаштування сповіщень</b>\n\n` +
        `📴 <b>Сповіщення перед ВІДКЛЮЧЕННЯМ світла</b>\n` +
        `(попередить за X хвилин до планового відключення)\n` +
        `⏰ Зараз: ${offTime} | Статус: ${offStatus}\n\n` +
        `📳 <b>Сповіщення перед ВКЛЮЧЕННЯМ світла</b>\n` +
        `(попередить за X хвилин до планового включення)\n` +
        `⏰ Зараз: ${onTime} | Статус: ${onStatus}\n\n` +
        `Обери опцію:`;
      
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getAlertsSettingsKeyboard().reply_markup,
      });
      return;
    }
    
    // Встановити час алерту
    if (data.startsWith('alert_time_')) {
      const [, , type, time] = data.split('_');
      const minutes = parseInt(time, 10);
      
      if (type === 'off') {
        usersDb.updateUserAlertSettings(telegramId, { notifyBeforeOff: minutes });
        if (minutes === 0) {
          usersDb.updateUserAlertSettings(telegramId, { alertsOffEnabled: false });
        } else {
          usersDb.updateUserAlertSettings(telegramId, { alertsOffEnabled: true });
        }
      } else {
        usersDb.updateUserAlertSettings(telegramId, { notifyBeforeOn: minutes });
        if (minutes === 0) {
          usersDb.updateUserAlertSettings(telegramId, { alertsOnEnabled: false });
        } else {
          usersDb.updateUserAlertSettings(telegramId, { alertsOnEnabled: true });
        }
      }
      
      const displayText = minutes === 0 ? 'Вимкнено' : `${minutes} хв`;
      await bot.answerCallbackQuery(query.id, {
        text: `✅ Час сповіщення встановлено: ${displayText}`,
      });
      
      // Повертаємось до меню алертів
      const updatedUser = usersDb.getUserByTelegramId(telegramId);
      const offTime = updatedUser.notify_before_off === 0 ? 'Вимкнено' : `${updatedUser.notify_before_off} хв`;
      const onTime = updatedUser.notify_before_on === 0 ? 'Вимкнено' : `${updatedUser.notify_before_on} хв`;
      const offStatus = updatedUser.alerts_off_enabled && updatedUser.notify_before_off > 0 ? '✅' : '❌';
      const onStatus = updatedUser.alerts_on_enabled && updatedUser.notify_before_on > 0 ? '✅' : '❌';
      
      const message = 
        `🔔 <b>Налаштування сповіщень</b>\n\n` +
        `📴 <b>Сповіщення перед ВІДКЛЮЧЕННЯМ світла</b>\n` +
        `(попередить за X хвилин до планового відключення)\n` +
        `⏰ Зараз: ${offTime} | Статус: ${offStatus}\n\n` +
        `📳 <b>Сповіщення перед ВКЛЮЧЕННЯМ світла</b>\n` +
        `(попередить за X хвилин до планового включення)\n` +
        `⏰ Зараз: ${onTime} | Статус: ${onStatus}\n\n` +
        `Обери опцію:`;
      
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getAlertsSettingsKeyboard().reply_markup,
      });
      return;
    }
    
    // Delete data
    if (data === 'settings_delete_data') {
      await bot.editMessageText(
        '⚠️ <b>Точно видалити всі дані?</b>\n\n' +
        'Це видалить:\n' +
        '• Налаштування\n' +
        '• Історію статистики\n' +
        '• Відключить канал\n\n' +
        'Цю дію неможливо скасувати!',
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
    
    // Confirm delete data
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
          ...getMainMenu('paused'),
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
        '⏰ Час очікування: 2 хвилини',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getIpCancelKeyboard().reply_markup,
        }
      );
      
      // Set up IP conversation state with timeout
      const timeout = setTimeout(() => {
        ipSetupStates.delete(telegramId);
        bot.answerCallbackQuery(query.id, { 
          text: '⏰ Час вийшов. Спробуйте ще раз.',
          show_alert: true 
        }).catch(() => {});
      }, 120000); // 2 minutes
      
      ipSetupStates.set(telegramId, {
        messageId: query.message.message_id,
        timeout: timeout,
      });
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // IP cancel
    if (data === 'ip_cancel') {
      const state = ipSetupStates.get(telegramId);
      if (state && state.timeout) {
        clearTimeout(state.timeout);
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
        '👨‍💼 <b>Адмін панель</b>\n\nОберіть опцію:',
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
    
    // Назад до налаштувань
    if (data === 'back_to_settings') {
      const updatedUser = usersDb.getUserByTelegramId(telegramId);
      const userIsAdmin = isAdmin(telegramId, config.adminIds, config.ownerId);
      const region = REGIONS[updatedUser.region]?.name || updatedUser.region;
      const message = 
        `⚙️ <b>Налаштування</b>\n\n` +
        `📍 Регіон: ${region}\n` +
        `⚡️ Черга: ${updatedUser.queue}\n` +
        `📺 Канал: ${updatedUser.channel_id ? '✅' : '❌'}\n` +
        `🌐 IP: ${updatedUser.router_ip ? '✅' : '❌'}\n` +
        `🔔 Сповіщення: ${updatedUser.is_active ? '✅' : '❌'}\n\n` +
        `Обери опцію:`;
      
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
    // Clear timeout
    if (state.timeout) {
      clearTimeout(state.timeout);
    }
    
    // Validate IP address format
    if (!IP_REGEX.test(text)) {
      await bot.sendMessage(chatId, '❌ Невірний формат IP-адреси. Спробуйте ще раз.\n\nПриклад: 192.168.1.1');
      
      // Reset timeout
      const timeout = setTimeout(() => {
        ipSetupStates.delete(telegramId);
      }, 120000);
      state.timeout = timeout;
      ipSetupStates.set(telegramId, state);
      
      return true;
    }
    
    // Additional validation: check if octets are in valid range
    const octets = text.split('.').map(Number);
    if (octets.some(octet => octet < 0 || octet > 255)) {
      await bot.sendMessage(chatId, '❌ Невірні значення в IP-адресі (кожне число має бути від 0 до 255). Спробуйте ще раз.');
      
      // Reset timeout
      const timeout = setTimeout(() => {
        ipSetupStates.delete(telegramId);
      }, 120000);
      state.timeout = timeout;
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
    
    const { getMainMenu } = require('../keyboards/inline');
    await bot.sendMessage(
      chatId,
      '🏠 <b>Головне меню</b>',
      {
        parse_mode: 'HTML',
        ...getMainMenu(botStatus),
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

module.exports = {
  handleSettings,
  handleSettingsCallback,
  handleIpConversation,
  ipSetupStates,
};
