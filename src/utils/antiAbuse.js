/**
 * Anti-Abuse / Security Module
 * Захист від зловживань, частих дій та нестабільної поведінки
 */

/**
 * Rate Limiter для користувачів
 * Обмежує частоту дій користувача
 */
class UserRateLimiter {
  constructor() {
    // Зберігаємо записи дій користувачів
    // Структура: Map<telegramId, Array<{ action, timestamp }>>
    this.userActions = new Map();
    
    // Конфігурація лімітів для різних типів дій
    this.limits = {
      // Команди (наприклад /start, /settings)
      command: {
        maxActions: 5,      // максимум 5 команд
        windowMs: 10000,    // за 10 секунд
        cooldownMs: 3000    // cooldown 3 секунди
      },
      // Кнопки inline keyboard
      button: {
        maxActions: 10,     // максимум 10 натискань
        windowMs: 10000,    // за 10 секунд
        cooldownMs: 2000    // cooldown 2 секунди
      },
      // Введення тексту
      text: {
        maxActions: 5,      // максимум 5 повідомлень
        windowMs: 10000,    // за 10 секунд
        cooldownMs: 2000    // cooldown 2 секунди
      }
    };
    
    // Автоочистка старих записів кожні 5 хвилин
    // Note: For global singleton instance, this interval will run for the lifetime of the process
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }
  
  /**
   * Перевіряє чи дозволено дію
   * @param {String} telegramId - ID користувача
   * @param {String} actionType - Тип дії ('command', 'button', 'text')
   * @returns {Object} { allowed: Boolean, reason: String, waitMs: Number }
   */
  checkAction(telegramId, actionType = 'button') {
    const now = Date.now();
    const limit = this.limits[actionType] || this.limits.button;
    
    // Отримуємо історію дій користувача
    if (!this.userActions.has(telegramId)) {
      this.userActions.set(telegramId, []);
    }
    
    const actions = this.userActions.get(telegramId);
    
    // Видаляємо старі дії поза вікном
    const windowStart = now - limit.windowMs;
    const recentActions = actions.filter(a => 
      a.timestamp > windowStart && a.action === actionType
    );
    
    // Перевіряємо кількість дій
    if (recentActions.length >= limit.maxActions) {
      const oldestAction = recentActions[0];
      const waitMs = Math.max(0, limit.windowMs - (now - oldestAction.timestamp));
      
      return {
        allowed: false,
        reason: 'rate_limit',
        waitMs: Math.ceil(waitMs / 1000) // переводимо в секунди
      };
    }
    
    // Перевіряємо cooldown (час між останньою дією)
    if (recentActions.length > 0) {
      const lastAction = recentActions[recentActions.length - 1];
      const timeSinceLastAction = now - lastAction.timestamp;
      
      if (timeSinceLastAction < limit.cooldownMs) {
        const waitMs = Math.ceil((limit.cooldownMs - timeSinceLastAction) / 1000);
        return {
          allowed: false,
          reason: 'cooldown',
          waitMs
        };
      }
    }
    
    // Дія дозволена - зберігаємо запис
    actions.push({
      action: actionType,
      timestamp: now
    });
    
    // Оновлюємо список (залишаємо тільки недавні)
    this.userActions.set(
      telegramId,
      actions.filter(a => a.timestamp > windowStart)
    );
    
    return { allowed: true };
  }
  
  /**
   * Очищує старі записи
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 година
    
    for (const [telegramId, actions] of this.userActions.entries()) {
      const filtered = actions.filter(a => now - a.timestamp < maxAge);
      
      if (filtered.length === 0) {
        this.userActions.delete(telegramId);
      } else {
        this.userActions.set(telegramId, filtered);
      }
    }
  }
  
  /**
   * Очищає інтервал та всі дані (для тестування або shutdown)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.userActions.clear();
  }
  
  /**
   * Скидає всі записи для користувача (для тестування)
   */
  reset(telegramId) {
    if (telegramId) {
      this.userActions.delete(telegramId);
    } else {
      this.userActions.clear();
    }
  }
}

/**
 * Action Cooldown Manager
 * Керує cooldown для критичних дій
 */
class ActionCooldownManager {
  constructor() {
    // Зберігаємо останній час виконання критичних дій
    // Структура: Map<telegramId, Map<actionName, timestamp>>
    this.cooldowns = new Map();
    
    // Конфігурація cooldown для критичних дій (в секундах)
    this.cooldownConfig = {
      // Підключення/відключення каналу
      channel_connect: 60,      // 1 хвилина
      channel_disconnect: 30,   // 30 секунд
      
      // Зміна IP / DDNS
      ip_change: 30,            // 30 секунд
      
      // Повторний запуск wizard
      wizard_start: 30,         // 30 секунд
      
      // Підтвердження налаштувань
      confirm_setup: 5          // 5 секунд
    };
    
    // Автоочистка старих записів кожні 10 хвилин
    // Note: For global singleton instance, this interval will run for the lifetime of the process
    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }
  
  /**
   * Перевіряє чи дозволено дію
   * @param {String} telegramId - ID користувача
   * @param {String} actionName - Назва дії
   * @returns {Object} { allowed: Boolean, remainingSeconds: Number }
   */
  checkCooldown(telegramId, actionName) {
    const cooldownSeconds = this.cooldownConfig[actionName];
    if (!cooldownSeconds) {
      // Дія не має cooldown
      return { allowed: true, remainingSeconds: 0 };
    }
    
    const now = Date.now();
    
    if (!this.cooldowns.has(telegramId)) {
      return { allowed: true, remainingSeconds: 0 };
    }
    
    const userCooldowns = this.cooldowns.get(telegramId);
    const lastActionTime = userCooldowns.get(actionName);
    
    if (!lastActionTime) {
      return { allowed: true, remainingSeconds: 0 };
    }
    
    const elapsedMs = now - lastActionTime;
    const cooldownMs = cooldownSeconds * 1000;
    
    if (elapsedMs < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
      return { allowed: false, remainingSeconds };
    }
    
    return { allowed: true, remainingSeconds: 0 };
  }
  
  /**
   * Записує виконання дії
   * @param {String} telegramId - ID користувача
   * @param {String} actionName - Назва дії
   */
  recordAction(telegramId, actionName) {
    if (!this.cooldowns.has(telegramId)) {
      this.cooldowns.set(telegramId, new Map());
    }
    
    const userCooldowns = this.cooldowns.get(telegramId);
    userCooldowns.set(actionName, Date.now());
  }
  
  /**
   * Очищує старі записи
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 година
    
    for (const [telegramId, userCooldowns] of this.cooldowns.entries()) {
      for (const [actionName, timestamp] of userCooldowns.entries()) {
        if (now - timestamp > maxAge) {
          userCooldowns.delete(actionName);
        }
      }
      
      if (userCooldowns.size === 0) {
        this.cooldowns.delete(telegramId);
      }
    }
  }
  
  /**
   * Очищує інтервал та всі дані (для тестування або shutdown)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cooldowns.clear();
  }
  
  /**
   * Скидає cooldown для користувача (для тестування)
   */
  reset(telegramId, actionName) {
    if (!telegramId) {
      this.cooldowns.clear();
      return;
    }
    
    if (!this.cooldowns.has(telegramId)) {
      return;
    }
    
    if (actionName) {
      this.cooldowns.get(telegramId).delete(actionName);
    } else {
      this.cooldowns.delete(telegramId);
    }
  }
}

/**
 * State Conflict Manager
 * Забезпечує що користувач має тільки ОДИН активний flow
 */
class StateConflictManager {
  constructor() {
    // Зберігаємо активний flow для кожного користувача
    // Структура: Map<telegramId, { type, startedAt }>
    this.activeFlows = new Map();
  }
  
  /**
   * Перевіряє чи є конфлікт з іншим flow
   * @param {String} telegramId - ID користувача
   * @param {String} flowType - Тип flow ('wizard', 'ip_setup', 'channel_setup')
   * @returns {Object} { hasConflict: Boolean, currentFlow: String }
   */
  checkConflict(telegramId, flowType) {
    const activeFlow = this.activeFlows.get(telegramId);
    
    if (!activeFlow) {
      return { hasConflict: false, currentFlow: null };
    }
    
    // Якщо це той самий flow - не конфлікт
    if (activeFlow.type === flowType) {
      return { hasConflict: false, currentFlow: flowType };
    }
    
    // Інший flow активний - конфлікт
    return { hasConflict: true, currentFlow: activeFlow.type };
  }
  
  /**
   * Встановлює активний flow
   * @param {String} telegramId - ID користувача
   * @param {String} flowType - Тип flow
   */
  setActiveFlow(telegramId, flowType) {
    this.activeFlows.set(telegramId, {
      type: flowType,
      startedAt: Date.now()
    });
  }
  
  /**
   * Очищає активний flow
   * @param {String} telegramId - ID користувача
   */
  clearActiveFlow(telegramId) {
    this.activeFlows.delete(telegramId);
  }
  
  /**
   * Отримує поточний активний flow
   * @param {String} telegramId - ID користувача
   * @returns {String|null} Тип flow або null
   */
  getActiveFlow(telegramId) {
    const flow = this.activeFlows.get(telegramId);
    return flow ? flow.type : null;
  }
}

/**
 * IP Address Validator
 * Валідація та захист від недозволених IP адрес
 */
class IpValidator {
  /**
   * Перевіряє чи IP дозволений
   * @param {String} ip - IP адреса
   * @returns {Object} { valid: Boolean, reason: String }
   */
  static validateIp(ip) {
    // Перевірка на localhost
    if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1') {
      return {
        valid: false,
        reason: 'localhost_forbidden',
        message: '❌ Localhost заборонений.\nВведіть публічну або локальну мережеву IP-адресу.'
      };
    }
    
    // Перевірка приватних IP діапазонів
    const octets = ip.split('.').map(Number);
    
    if (octets.length === 4) {
      // 192.168.0.0/16
      if (octets[0] === 192 && octets[1] === 168) {
        return {
          valid: false,
          reason: 'private_ip_forbidden',
          message: '❌ Приватні IP (192.168.*) не підтримуються.\nВведіть публічну IP-адресу або DDNS.'
        };
      }
      
      // 10.0.0.0/8
      if (octets[0] === 10) {
        return {
          valid: false,
          reason: 'private_ip_forbidden',
          message: '❌ Приватні IP (10.*) не підтримуються.\nВведіть публічну IP-адресу або DDNS.'
        };
      }
      
      // 172.16.0.0/12
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
        return {
          valid: false,
          reason: 'private_ip_forbidden',
          message: '❌ Приватні IP (172.16.*-172.31.*) не підтримуються.\nВведіть публічну IP-адресу або DDNS.'
        };
      }
    }
    
    return { valid: true };
  }
}

/**
 * Action Logger
 * Логування дій для аналізу та відлагодження
 */
class ActionLogger {
  /**
   * Логує спрацьовування rate limit
   * @param {String} telegramId - ID користувача
   * @param {String} actionType - Тип дії
   * @param {Number} waitMs - Час очікування
   */
  static logRateLimit(telegramId, actionType, waitMs) {
    console.log(`[RATE_LIMIT] User ${telegramId} | Action: ${actionType} | Wait: ${waitMs}s`);
  }
  
  /**
   * Логує спрацьовування cooldown
   * @param {String} telegramId - ID користувача
   * @param {String} actionName - Назва дії
   * @param {Number} remainingSeconds - Залишок часу
   */
  static logCooldown(telegramId, actionName, remainingSeconds) {
    console.log(`[COOLDOWN] User ${telegramId} | Action: ${actionName} | Remaining: ${remainingSeconds}s`);
  }
  
  /**
   * Логує конфлікт state
   * @param {String} telegramId - ID користувача
   * @param {String} attemptedFlow - Спроба запустити
   * @param {String} currentFlow - Поточний активний flow
   */
  static logStateConflict(telegramId, attemptedFlow, currentFlow) {
    console.log(`[STATE_CONFLICT] User ${telegramId} | Attempted: ${attemptedFlow} | Current: ${currentFlow}`);
  }
  
  /**
   * Логує спробу використання забороненого IP
   * @param {String} telegramId - ID користувача
   * @param {String} ip - IP адреса
   * @param {String} reason - Причина відмови
   */
  static logForbiddenIp(telegramId, ip, reason) {
    console.log(`[FORBIDDEN_IP] User ${telegramId} | IP: ${ip} | Reason: ${reason}`);
  }
  
  /**
   * Логує системну помилку / abort
   * @param {String} context - Контекст помилки
   * @param {Error} error - Об'єкт помилки
   */
  static logSystemAbort(context, error) {
    console.error(`[SYSTEM_ABORT] Context: ${context} | Error:`, error);
  }
}

// Створюємо глобальні інстанси
const userRateLimiter = new UserRateLimiter();
const actionCooldownManager = new ActionCooldownManager();
const stateConflictManager = new StateConflictManager();

module.exports = {
  UserRateLimiter,
  ActionCooldownManager,
  StateConflictManager,
  IpValidator,
  ActionLogger,
  
  // Глобальні інстанси
  userRateLimiter,
  actionCooldownManager,
  stateConflictManager
};
