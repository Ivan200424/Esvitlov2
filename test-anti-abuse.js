#!/usr/bin/env node

/**
 * Тест для anti-abuse модуля
 */

const assert = require('assert');

console.log('🧪 Тестування Anti-Abuse модуля...\n');

// Test 1: Import anti-abuse modules
console.log('Test 1: Імпорт модулів');
try {
  const {
    UserRateLimiter,
    ActionCooldownManager,
    StateConflictManager,
    IpValidator,
    ActionLogger,
    userRateLimiter,
    actionCooldownManager,
    stateConflictManager
  } = require('./src/utils/antiAbuse');
  
  assert(userRateLimiter instanceof UserRateLimiter, 'userRateLimiter має бути інстансом UserRateLimiter');
  assert(actionCooldownManager instanceof ActionCooldownManager, 'actionCooldownManager має бути інстансом ActionCooldownManager');
  assert(stateConflictManager instanceof StateConflictManager, 'stateConflictManager має бути інстансом StateConflictManager');
  console.log('✓ Модулі імпортовано успішно\n');
} catch (error) {
  console.error('✗ Помилка імпорту:', error.message);
  process.exit(1);
}

// Test 2: Rate Limiter
console.log('Test 2: UserRateLimiter');
try {
  const { UserRateLimiter } = require('./src/utils/antiAbuse');
  const limiter = new UserRateLimiter();
  
  // Перша дія має бути дозволена
  let result = limiter.checkAction('test_user_1', 'button');
  assert.strictEqual(result.allowed, true, 'Перша дія має бути дозволена');
  
  // Швидкі повтори мають бути заблоковані (cooldown)
  result = limiter.checkAction('test_user_1', 'button');
  assert.strictEqual(result.allowed, false, 'Швидкий повтор має бути заблокований');
  assert.strictEqual(result.reason, 'cooldown', 'Причина має бути cooldown');
  
  console.log('✓ UserRateLimiter працює коректно\n');
} catch (error) {
  console.error('✗ Помилка в UserRateLimiter:', error.message);
  process.exit(1);
}

// Test 3: Cooldown Manager
console.log('Test 3: ActionCooldownManager');
try {
  const { ActionCooldownManager } = require('./src/utils/antiAbuse');
  const manager = new ActionCooldownManager();
  
  // Перша дія має бути дозволена
  let result = manager.checkCooldown('test_user_2', 'wizard_start');
  assert.strictEqual(result.allowed, true, 'Перша дія має бути дозволена');
  
  // Записуємо дію
  manager.recordAction('test_user_2', 'wizard_start');
  
  // Повтор має бути заблокований
  result = manager.checkCooldown('test_user_2', 'wizard_start');
  assert.strictEqual(result.allowed, false, 'Повтор має бути заблокований');
  assert(result.remainingSeconds > 0, 'Має бути час очікування');
  
  console.log('✓ ActionCooldownManager працює коректно\n');
} catch (error) {
  console.error('✗ Помилка в ActionCooldownManager:', error.message);
  process.exit(1);
}

// Test 4: State Conflict Manager
console.log('Test 4: StateConflictManager');
try {
  const { StateConflictManager } = require('./src/utils/antiAbuse');
  const manager = new StateConflictManager();
  
  // Перша дія не має конфлікту
  let result = manager.checkConflict('test_user_3', 'wizard');
  assert.strictEqual(result.hasConflict, false, 'Не має бути конфлікту');
  
  // Встановлюємо активний flow
  manager.setActiveFlow('test_user_3', 'wizard');
  
  // Інший flow має конфліктувати
  result = manager.checkConflict('test_user_3', 'ip_setup');
  assert.strictEqual(result.hasConflict, true, 'Має бути конфлікт');
  assert.strictEqual(result.currentFlow, 'wizard', 'Поточний flow має бути wizard');
  
  // Той самий flow не конфліктує
  result = manager.checkConflict('test_user_3', 'wizard');
  assert.strictEqual(result.hasConflict, false, 'Той самий flow не має конфліктувати');
  
  // Очищаємо flow
  manager.clearActiveFlow('test_user_3');
  result = manager.checkConflict('test_user_3', 'ip_setup');
  assert.strictEqual(result.hasConflict, false, 'Після очищення не має бути конфлікту');
  
  console.log('✓ StateConflictManager працює коректно\n');
} catch (error) {
  console.error('✗ Помилка в StateConflictManager:', error.message);
  process.exit(1);
}

// Test 5: IP Validator
console.log('Test 5: IpValidator');
try {
  const { IpValidator } = require('./src/utils/antiAbuse');
  
  // localhost має бути заборонений
  let result = IpValidator.validateIp('127.0.0.1');
  assert.strictEqual(result.valid, false, '127.0.0.1 має бути заборонений');
  assert.strictEqual(result.reason, 'localhost_forbidden', 'Причина має бути localhost_forbidden');
  
  result = IpValidator.validateIp('localhost');
  assert.strictEqual(result.valid, false, 'localhost має бути заборонений');
  
  // Приватні IP мають бути заборонені
  result = IpValidator.validateIp('192.168.1.1');
  assert.strictEqual(result.valid, false, '192.168.1.1 має бути заборонений');
  assert.strictEqual(result.reason, 'private_ip_forbidden', 'Причина має бути private_ip_forbidden');
  
  result = IpValidator.validateIp('10.0.0.1');
  assert.strictEqual(result.valid, false, '10.0.0.1 має бути заборонений');
  
  result = IpValidator.validateIp('172.16.0.1');
  assert.strictEqual(result.valid, false, '172.16.0.1 має бути заборонений');
  
  // Публічний IP має бути дозволений
  result = IpValidator.validateIp('8.8.8.8');
  assert.strictEqual(result.valid, true, '8.8.8.8 має бути дозволений');
  
  console.log('✓ IpValidator працює коректно\n');
} catch (error) {
  console.error('✗ Помилка в IpValidator:', error.message);
  process.exit(1);
}

// Test 6: Middleware
console.log('Test 6: Anti-Abuse Middleware');
try {
  const {
    checkRateLimit,
    checkCooldown,
    checkStateConflict
  } = require('./src/middleware/antiAbuseMiddleware');
  
  assert(typeof checkRateLimit === 'function', 'checkRateLimit має бути функцією');
  assert(typeof checkCooldown === 'function', 'checkCooldown має бути функцією');
  assert(typeof checkStateConflict === 'function', 'checkStateConflict має бути функцією');
  
  console.log('✓ Middleware імпортовано успішно\n');
} catch (error) {
  console.error('✗ Помилка імпорту middleware:', error.message);
  process.exit(1);
}

console.log('✅ Всі тести пройдено успішно!');
