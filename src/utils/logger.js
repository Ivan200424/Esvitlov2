/**
 * Структуроване логування для бота на базі pino
 * Підтримує різні рівні логування та форматування
 */

const rootLogger = require('../logger');

/**
 * Логування помилки
 * @param {String} msg - Повідомлення про помилку
 * @param {Object} data - Додаткові дані
 */
function error(msg, data) {
  if (data !== undefined) {
    rootLogger.error(data, msg);
  } else {
    rootLogger.error(msg);
  }
}

/**
 * Логування попередження
 * @param {String} msg - Повідомлення попередження
 * @param {Object} data - Додаткові дані
 */
function warn(msg, data) {
  if (data !== undefined) {
    rootLogger.warn(data, msg);
  } else {
    rootLogger.warn(msg);
  }
}

/**
 * Логування інформації
 * @param {String} msg - Інформаційне повідомлення
 * @param {Object} data - Додаткові дані
 */
function info(msg, data) {
  if (data !== undefined) {
    rootLogger.info(data, msg);
  } else {
    rootLogger.info(msg);
  }
}

/**
 * Логування для налагодження
 * @param {String} msg - Повідомлення для налагодження
 * @param {Object} data - Додаткові дані
 */
function debug(msg, data) {
  if (data !== undefined) {
    rootLogger.debug(data, msg);
  } else {
    rootLogger.debug(msg);
  }
}

/**
 * Створює контекстний логгер з префіксом (child logger)
 * @param {String} context - Контекст логування (наприклад, 'PowerMonitor', 'Scheduler')
 * @returns {Object} - Об'єкт з методами логування
 */
function createLogger(context) {
  const child = rootLogger.child({ module: context });
  return {
    error: (msg, data) => {
      if (data !== undefined) {
        child.error(data, msg);
      } else {
        child.error(msg);
      }
    },
    warn: (msg, data) => {
      if (data !== undefined) {
        child.warn(data, msg);
      } else {
        child.warn(msg);
      }
    },
    info: (msg, data) => {
      if (data !== undefined) {
        child.info(data, msg);
      } else {
        child.info(msg);
      }
    },
    debug: (msg, data) => {
      if (data !== undefined) {
        child.debug(data, msg);
      } else {
        child.debug(msg);
      }
    },
    success: (msg, data) => {
      if (data !== undefined) {
        child.info(data, msg);
      } else {
        child.info(msg);
      }
    },
    time: (label) => {
      const start = Date.now();
      return {
        end: (msg) => {
          const duration = Date.now() - start;
          child.info({ duration }, msg || label);
          return duration;
        }
      };
    }
  };
}

module.exports = {
  error,
  warn,
  info,
  debug,
  createLogger
};
