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
 * Отримати тип паузи
 * @returns {String|null} Тип паузи (update/emergency/testing) або null
 */
function getPauseType() {
  return getSetting('pause_type', null);
}

/**
 * Отримати повідомлення паузи з типом
 * @returns {String} Текст повідомлення паузи з емодзі типу
 */
function getPauseMessage() {
  const baseMessage = getSetting('pause_message', '🔧 Бот тимчасово недоступний. Спробуйте пізніше.');
  const pauseType = getPauseType();
  
  // Додаємо emoji в залежності від типу паузи
  const typeEmojis = {
    'update': '🛠',
    'emergency': '🚨',
    'testing': '🧪'
  };
  
  const emoji = pauseType ? typeEmojis[pauseType] || '🔧' : '🔧';
  
  // Якщо повідомлення вже починається з emoji, не додаємо ще один
  if (baseMessage.match(/^[\u{1F300}-\u{1F9FF}]/u)) {
    return baseMessage;
  }
  
  return `${emoji} ${baseMessage}`;
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
 * @returns {Object} { blocked: Boolean, message: String, pauseType: String|null }
 */
function checkPauseForChannelActions() {
  if (isBotPaused()) {
    return {
      blocked: true,
      message: getPauseMessage(),
      showSupport: shouldShowSupport(),
      pauseType: getPauseType()
    };
  }
  return { blocked: false };
}

/**
 * Перевірка паузи для wizard
 * @returns {Object} { blocked: Boolean, message: String }
 */
function checkPauseForWizard() {
  if (isBotPaused()) {
    const pauseType = getPauseType();
    
    // Різні повідомлення в залежності від типу паузи
    const messages = {
      'update': '🛠 Бот тимчасово оновлюється. Деякі дії недоступні.',
      'emergency': '🚧 Тимчасова технічна проблема. Ми вже працюємо над вирішенням.',
      'testing': '🧪 Бот у режимі тестування. Можливі тимчасові збої.'
    };
    
    const message = pauseType ? messages[pauseType] : getPauseMessage();
    
    return {
      blocked: true,
      message: message,
      showSupport: shouldShowSupport(),
      pauseType: pauseType
    };
  }
  return { blocked: false };
}

module.exports = {
  isBotPaused,
  getPauseType,
  getPauseMessage,
  shouldShowSupport,
  checkPauseForChannelActions,
  checkPauseForWizard
};
