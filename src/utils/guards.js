/**
 * Централізовані guard-функції для перевірки стану бота
 * Забезпечує однакову логіку перевірок по всьому боту
 */

const { getSetting } = require('../database/db');

/**
 * Перевірка чи бот на паузі
 * @returns {Boolean} true якщо бот на паузі
 */
function isBotPaused() {
  return getSetting('bot_paused', '0') === '1';
}

/**
 * Отримати повідомлення паузи
 * @returns {String} Текст повідомлення паузи
 */
function getPauseMessage() {
  return getSetting('pause_message', '🔧 Бот тимчасово недоступний. Спробуйте пізніше.');
}

/**
 * Отримати налаштування показу посилання на підтримку
 * @returns {Boolean} true якщо показувати посилання
 */
function shouldShowSupport() {
  return getSetting('pause_show_support', '1') === '1';
}

/**
 * Перевірка паузи для дій з каналом
 * @returns {Object} { blocked: Boolean, message: String }
 */
function checkPauseForChannelActions() {
  if (isBotPaused()) {
    return {
      blocked: true,
      message: getPauseMessage(),
      showSupport: shouldShowSupport()
    };
  }
  return { blocked: false };
}

module.exports = {
  isBotPaused,
  getPauseMessage,
  shouldShowSupport,
  checkPauseForChannelActions
};
