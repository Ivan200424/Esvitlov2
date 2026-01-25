const usersDb = require('../database/users');
const { getSettingsKeyboard, getRegionKeyboard, getAlertsSettingsKeyboard, getAlertTimeKeyboard, getDeactivateConfirmKeyboard } = require('../keyboards/inline');
const { REGIONS } = require('../constants/regions');

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
    
    const region = REGIONS[user.region]?.name || user.region;
    const message = 
      `⚙️ <b>Налаштування</b>\n\n` +
      `📍 Регіон: ${region}\n` +
      `⚡️ Черга: GPV${user.queue}\n` +
      `📺 Канал: ${user.channel_id || 'не підключено'}\n` +
      `🔔 Сповіщення: ${user.is_active ? 'увімкнено' : 'вимкнено'}\n\n` +
      `Оберіть опцію:`;
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...getSettingsKeyboard(),
    });
    
  } catch (error) {
    console.error('Помилка в handleSettings:', error);
    await bot.sendMessage(chatId, '❌ Виникла помилка.');
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
      await bot.editMessageText(
        '📍 Оберіть новий регіон:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: getRegionKeyboard().reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Налаштування алертів
    if (data === 'settings_alerts') {
      const message = 
        `🔔 <b>Налаштування сповіщень</b>\n\n` +
        `⏰ Сповіщення перед відключенням: ${user.notify_before_off} хв\n` +
        `⏰ Сповіщення перед включенням: ${user.notify_before_on} хв\n` +
        `🔴 Сповіщення про відключення: ${user.alerts_off_enabled ? 'увімкнено' : 'вимкнено'}\n` +
        `🟢 Сповіщення про включення: ${user.alerts_on_enabled ? 'увімкнено' : 'вимкнено'}\n\n` +
        `Оберіть опцію:`;
      
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
        '⏰ Оберіть час сповіщення перед відключенням:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: getAlertTimeKeyboard('off').reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Час сповіщення перед включенням
    if (data === 'alert_on_time') {
      await bot.editMessageText(
        '⏰ Оберіть час сповіщення перед включенням:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
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
        text: `✅ Сповіщення про відключення ${newValue ? 'увімкнено' : 'вимкнено'}`,
      });
      
      // Оновлюємо повідомлення
      const updatedUser = usersDb.getUserByTelegramId(telegramId);
      const message = 
        `🔔 <b>Налаштування сповіщень</b>\n\n` +
        `⏰ Сповіщення перед відключенням: ${updatedUser.notify_before_off} хв\n` +
        `⏰ Сповіщення перед включенням: ${updatedUser.notify_before_on} хв\n` +
        `🔴 Сповіщення про відключення: ${updatedUser.alerts_off_enabled ? 'увімкнено' : 'вимкнено'}\n` +
        `🟢 Сповіщення про включення: ${updatedUser.alerts_on_enabled ? 'увімкнено' : 'вимкнено'}\n\n` +
        `Оберіть опцію:`;
      
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
        text: `✅ Сповіщення про включення ${newValue ? 'увімкнено' : 'вимкнено'}`,
      });
      
      // Оновлюємо повідомлення
      const updatedUser = usersDb.getUserByTelegramId(telegramId);
      const message = 
        `🔔 <b>Налаштування сповіщень</b>\n\n` +
        `⏰ Сповіщення перед відключенням: ${updatedUser.notify_before_off} хв\n` +
        `⏰ Сповіщення перед включенням: ${updatedUser.notify_before_on} хв\n` +
        `🔴 Сповіщення про відключення: ${updatedUser.alerts_off_enabled ? 'увімкнено' : 'вимкнено'}\n` +
        `🟢 Сповіщення про включення: ${updatedUser.alerts_on_enabled ? 'увімкнено' : 'вимкнено'}\n\n` +
        `Оберіть опцію:`;
      
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
      } else {
        usersDb.updateUserAlertSettings(telegramId, { notifyBeforeOn: minutes });
      }
      
      await bot.answerCallbackQuery(query.id, {
        text: `✅ Час сповіщення встановлено: ${minutes} хв`,
      });
      
      // Повертаємось до меню алертів
      const updatedUser = usersDb.getUserByTelegramId(telegramId);
      const message = 
        `🔔 <b>Налаштування сповіщень</b>\n\n` +
        `⏰ Сповіщення перед відключенням: ${updatedUser.notify_before_off} хв\n` +
        `⏰ Сповіщення перед включенням: ${updatedUser.notify_before_on} хв\n` +
        `🔴 Сповіщення про відключення: ${updatedUser.alerts_off_enabled ? 'увімкнено' : 'вимкнено'}\n` +
        `🟢 Сповіщення про включення: ${updatedUser.alerts_on_enabled ? 'увімкнено' : 'вимкнено'}\n\n` +
        `Оберіть опцію:`;
      
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getAlertsSettingsKeyboard().reply_markup,
      });
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
      return;
    }
    
    // Назад до налаштувань
    if (data === 'back_to_settings') {
      const updatedUser = usersDb.getUserByTelegramId(telegramId);
      const region = REGIONS[updatedUser.region]?.name || updatedUser.region;
      const message = 
        `⚙️ <b>Налаштування</b>\n\n` +
        `📍 Регіон: ${region}\n` +
        `⚡️ Черга: GPV${updatedUser.queue}\n` +
        `📺 Канал: ${updatedUser.channel_id || 'не підключено'}\n` +
        `🔔 Сповіщення: ${updatedUser.is_active ? 'увімкнено' : 'вимкнено'}\n\n` +
        `Оберіть опцію:`;
      
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: getSettingsKeyboard().reply_markup,
      });
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
  } catch (error) {
    console.error('Помилка в handleSettingsCallback:', error);
    await bot.answerCallbackQuery(query.id, { text: '❌ Виникла помилка' });
  }
}

module.exports = {
  handleSettings,
  handleSettingsCallback,
};
