/**
 * Anti-Abuse Middleware
 * Перевірки перед виконанням дій користувача
 */

const { 
  userRateLimiter, 
  actionCooldownManager, 
  stateConflictManager,
  ActionLogger 
} = require('../utils/antiAbuse');

/**
 * Middleware для перевірки rate limit
 * @param {String} actionType - Тип дії ('command', 'button', 'text')
 * @returns {Function} Middleware функція
 */
function rateLimitMiddleware(actionType = 'button') {
  return async (bot, message, telegramId, next) => {
    const result = userRateLimiter.checkAction(telegramId, actionType);
    
    if (!result.allowed) {
      // Логуємо спрацьовування
      ActionLogger.logRateLimit(telegramId, actionType, result.waitMs);
      
      // Повідомляємо користувача
      const chatId = message.chat?.id || message.message?.chat?.id;
      if (chatId) {
        await bot.sendMessage(
          chatId,
          `⏳ Зачекайте ${result.waitMs} ${getPluralForm(result.waitMs, 'секунду', 'секунди', 'секунд')} і спробуйте ще раз.`,
          { parse_mode: 'HTML' }
        ).catch(() => {
          // Intentionally ignore send errors - user may have blocked bot or chat is unavailable
        });
      }
      
      return false; // Блокуємо дію
    }
    
    if (next) {
      return next();
    }
    return true;
  };
}

/**
 * Middleware для перевірки cooldown критичних дій
 * @param {String} actionName - Назва дії
 * @returns {Function} Middleware функція
 */
function cooldownMiddleware(actionName) {
  return async (bot, message, telegramId, next) => {
    const result = actionCooldownManager.checkCooldown(telegramId, actionName);
    
    if (!result.allowed) {
      // Логуємо спрацьовування
      ActionLogger.logCooldown(telegramId, actionName, result.remainingSeconds);
      
      // Повідомляємо користувача
      const chatId = message.chat?.id || message.message?.chat?.id;
      if (chatId) {
        await bot.sendMessage(
          chatId,
          `⏱ Цю дію можна виконувати не так часто.\n\nСпробуйте через ${result.remainingSeconds} ${getPluralForm(result.remainingSeconds, 'секунду', 'секунди', 'секунд')}.`,
          { parse_mode: 'HTML' }
        ).catch(() => {
          // Intentionally ignore send errors - user may have blocked bot or chat is unavailable
        });
      }
      
      return false; // Блокуємо дію
    }
    
    // Записуємо виконання дії
    actionCooldownManager.recordAction(telegramId, actionName);
    
    if (next) {
      return next();
    }
    return true;
  };
}

/**
 * Middleware для перевірки конфліктів state
 * @param {String} flowType - Тип flow ('wizard', 'ip_setup', 'channel_setup')
 * @returns {Function} Middleware функція
 */
function stateConflictMiddleware(flowType) {
  return async (bot, message, telegramId, next) => {
    const result = stateConflictManager.checkConflict(telegramId, flowType);
    
    if (result.hasConflict) {
      // Логуємо конфлікт
      ActionLogger.logStateConflict(telegramId, flowType, result.currentFlow);
      
      // Повідомляємо користувача
      const chatId = message.chat?.id || message.message?.chat?.id;
      if (chatId) {
        const flowNames = {
          wizard: 'налаштування профілю',
          ip_setup: 'налаштування IP',
          channel_setup: 'підключення каналу'
        };
        
        const currentFlowName = flowNames[result.currentFlow] || result.currentFlow;
        
        await bot.sendMessage(
          chatId,
          `⚠️ Спочатку завершіть <b>${currentFlowName}</b>.\n\nВи не можете мати кілька активних дій одночасно.`,
          { parse_mode: 'HTML' }
        ).catch(() => {
          // Intentionally ignore send errors - user may have blocked bot or chat is unavailable
        });
      }
      
      return false; // Блокуємо дію
    }
    
    // Встановлюємо активний flow
    stateConflictManager.setActiveFlow(telegramId, flowType);
    
    if (next) {
      return next();
    }
    return true;
  };
}

/**
 * Допоміжна функція для правильного відмінювання
 * @param {Number} num - Число
 * @param {String} one - Форма для 1 (секунду)
 * @param {String} few - Форма для 2-4 (секунди)
 * @param {String} many - Форма для 5+ (секунд)
 * @returns {String}
 */
function getPluralForm(num, one, few, many) {
  const mod10 = num % 10;
  const mod100 = num % 100;
  
  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return few;
  }
  return many;
}

/**
 * Простий wrapper для швидкої перевірки rate limit
 * @param {Object} bot - Telegram bot instance
 * @param {Object} message - Telegram message
 * @param {String} telegramId - ID користувача
 * @param {String} actionType - Тип дії
 * @returns {Promise<Boolean>} true якщо дія дозволена
 */
async function checkRateLimit(bot, message, telegramId, actionType = 'button') {
  return rateLimitMiddleware(actionType)(bot, message, telegramId);
}

/**
 * Простий wrapper для швидкої перевірки cooldown
 * @param {Object} bot - Telegram bot instance
 * @param {Object} message - Telegram message
 * @param {String} telegramId - ID користувача
 * @param {String} actionName - Назва дії
 * @returns {Promise<Boolean>} true якщо дія дозволена
 */
async function checkCooldown(bot, message, telegramId, actionName) {
  return cooldownMiddleware(actionName)(bot, message, telegramId);
}

/**
 * Простий wrapper для швидкої перевірки state conflict
 * @param {Object} bot - Telegram bot instance
 * @param {Object} message - Telegram message
 * @param {String} telegramId - ID користувача
 * @param {String} flowType - Тип flow
 * @returns {Promise<Boolean>} true якщо дія дозволена
 */
async function checkStateConflict(bot, message, telegramId, flowType) {
  return stateConflictMiddleware(flowType)(bot, message, telegramId);
}

module.exports = {
  rateLimitMiddleware,
  cooldownMiddleware,
  stateConflictMiddleware,
  checkRateLimit,
  checkCooldown,
  checkStateConflict,
  getPluralForm
};
