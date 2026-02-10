/**
 * Централізовані guard-функції для перевірки стану бота
 * Забезпечує однакову логіку перевірок по всьому боту
 */

const { getSetting } = require('../database/db');

/**
 * Перевірка чи бот на паузі
 * @returns {Boolean} true якщо бот на паузі
 */
async function isBotPaused() {
  return await getSetting('bot_paused', '0') === '1';
}

/**
 * Отримати повідомлення паузи
 * @returns {String} Текст повідомлення паузи
 */
async function getPauseMessage() {
  return await getSetting('pause_message', '🔧 Бот тимчасово недоступний. Спробуйте пізніше.');
}

/**
 * Отримати налаштування показу посилання на підтримку
 * @returns {Boolean} true якщо показувати посилання
 */
async function shouldShowSupport() {
  return await getSetting('pause_show_support', '1') === '1';
}

/**
 * Перевірка паузи для дій з каналом
 * @returns {Object} { blocked: Boolean, message: String }
 */
async function checkPauseForChannelActions() {
  if (await isBotPaused()) {
    return {
      blocked: true,
      message: await getPauseMessage(),
      showSupport: await shouldShowSupport()
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
