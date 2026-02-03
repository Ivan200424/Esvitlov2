/**
 * Безпечні операції з Telegram Bot API
 * Забезпечує надійну обробку помилок для всіх критичних операцій
 */

const { createLogger } = require('./logger');
const logger = createLogger('ErrorHandler');

/**
 * Безпечна відправка повідомлення
 * @param {Object} bot - Екземпляр Telegram бота
 * @param {String|Number} chatId - ID чату
 * @param {String} text - Текст повідомлення
 * @param {Object} options - Додаткові опції (parse_mode, reply_markup тощо)
 * @returns {Promise<Object|null>} - Відправлене повідомлення або null при помилці
 */
async function safeSendMessage(bot, chatId, text, options = {}) {
  try {
    return await bot.sendMessage(chatId, text, options);
  } catch (error) {
    logger.error(`Помилка відправки повідомлення ${chatId}:`, { error: error.message });
    return null;
  }
}

/**
 * Безпечне видалення повідомлення
 * @param {Object} bot - Екземпляр Telegram бота
 * @param {String|Number} chatId - ID чату
 * @param {Number} messageId - ID повідомлення
 * @returns {Promise<Boolean>} - true якщо успішно, false при помилці
 */
async function safeDeleteMessage(bot, chatId, messageId) {
  try {
    await bot.deleteMessage(chatId, messageId);
    return true;
  } catch (error) {
    // Ігноруємо — повідомлення могло бути вже видалене
    return false;
  }
}

/**
 * Безпечне редагування повідомлення
 * @param {Object} bot - Екземпляр Telegram бота
 * @param {String|Number} chatId - ID чату
 * @param {Number} messageId - ID повідомлення
 * @param {String} text - Новий текст повідомлення
 * @param {Object} options - Додаткові опції
 * @returns {Promise<Object|null>} - Відредаговане повідомлення або null при помилці
 */
async function safeEditMessage(bot, chatId, messageId, text, options = {}) {
  try {
    return await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, ...options });
  } catch (error) {
    logger.error(`Помилка редагування повідомлення:`, { error: error.message });
    return null;
  }
}

/**
 * Безпечне редагування тексту повідомлення з обробкою помилки "message is not modified"
 * @param {Object} bot - Екземпляр Telegram бота
 * @param {String} text - Новий текст повідомлення
 * @param {Object} options - Опції (chat_id, message_id, parse_mode, reply_markup тощо)
 * @returns {Promise<Object|null>} - Відредаговане повідомлення або null
 */
async function safeEditMessageText(bot, text, options = {}) {
  try {
    return await bot.editMessageText(text, options);
  } catch (error) {
    // Ігноруємо помилку "message is not modified" — це нормальна ситуація
    // Виникає коли користувач натискає ту саму кнопку двічі
    if (error.code === 'ETELEGRAM' && 
        error.response?.body?.description?.includes('message is not modified')) {
      // Повідомлення вже актуальне, нічого робити не потрібно
      return null;
    }
    // Інші помилки логуємо
    logger.error(`Помилка редагування тексту повідомлення:`, { error: error.message });
    throw error;
  }
}

/**
 * Безпечна відправка фото
 * @param {Object} bot - Екземпляр Telegram бота
 * @param {String|Number} chatId - ID чату
 * @param {String|Buffer} photo - Фото (file_id, URL, або Buffer)
 * @param {Object} options - Додаткові опції (caption, parse_mode тощо)
 * @param {Object} fileOpts - Опції файлу (filename, contentType)
 * @returns {Promise<Object|null>} - Відправлене повідомлення або null при помилці
 */
async function safeSendPhoto(bot, chatId, photo, options = {}, fileOpts = {}) {
  try {
    return await bot.sendPhoto(chatId, photo, options, fileOpts);
  } catch (error) {
    logger.error(`Помилка відправки фото ${chatId}:`, { error: error.message });
    return null;
  }
}

/**
 * Безпечна відповідь на callback query
 * @param {Object} bot - Екземпляр Telegram бота
 * @param {String} callbackQueryId - ID callback query
 * @param {Object} options - Додаткові опції (text, show_alert тощо)
 * @returns {Promise<Boolean>} - true якщо успішно, false при помилці
 */
async function safeAnswerCallbackQuery(bot, callbackQueryId, options = {}) {
  try {
    await bot.answerCallbackQuery(callbackQueryId, options);
    return true;
  } catch (error) {
    logger.error(`Помилка відповіді на callback query:`, { error: error.message });
    return false;
  }
}

module.exports = {
  safeSendMessage,
  safeDeleteMessage,
  safeEditMessage,
  safeEditMessageText,
  safeSendPhoto,
  safeAnswerCallbackQuery
};
