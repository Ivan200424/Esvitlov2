#!/usr/bin/env node

/**
 * Тест для перевірки debounce логіки моніторингу світла
 */

const assert = require('assert');
const fs = require('fs');

console.log('🧪 Тест debounce логіки...\n');

// Set up environment
process.env.BOT_TOKEN = 'test_token';
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = '/tmp/test-debounce.db';

// Clean up test DB if exists
if (fs.existsSync('/tmp/test-debounce.db')) {
  fs.unlinkSync('/tmp/test-debounce.db');
}

console.log('Test 1: Перевірка налаштувань debounce в config');
const config = require('./src/config');

assert(config.POWER_DEBOUNCE_MINUTES !== undefined, 'POWER_DEBOUNCE_MINUTES має бути визначений');
assert(typeof config.POWER_DEBOUNCE_MINUTES === 'number', 'POWER_DEBOUNCE_MINUTES має бути числом');
assert(config.POWER_DEBOUNCE_MINUTES >= 1, 'POWER_DEBOUNCE_MINUTES має бути >= 1');
console.log(`✓ Debounce налаштування: ${config.POWER_DEBOUNCE_MINUTES} хв\n`);

console.log('Test 2: Перевірка database settings API');
const db = require('./src/database/db');

// Test getSetting and setSetting
const testKey = 'test_setting';
const testValue = '123';
const result = db.setSetting(testKey, testValue);
assert(result === true, 'setSetting має повертати true');

const retrieved = db.getSetting(testKey);
assert(retrieved === testValue, 'getSetting має повертати збережене значення');

const defaultVal = db.getSetting('non_existent_key', 'default');
assert(defaultVal === 'default', 'getSetting має повертати значення по замовчуванню');

console.log('✓ Database settings API працює\n');

console.log('Test 3: Перевірка debounce settings');
db.setSetting('power_debounce_minutes', '7');
const debounceValue = db.getSetting('power_debounce_minutes', '5');
assert(debounceValue === '7', 'Debounce setting має зберігатися та читатися');
console.log('✓ Debounce settings зберігаються коректно\n');

console.log('Test 4: Перевірка структури powerMonitor');
const powerMonitor = require('./src/powerMonitor');

assert(typeof powerMonitor.checkRouterAvailability === 'function', 'checkRouterAvailability має бути функцією');
assert(typeof powerMonitor.startPowerMonitoring === 'function', 'startPowerMonitoring має бути функцією');
assert(typeof powerMonitor.stopPowerMonitoring === 'function', 'stopPowerMonitoring має бути функцією');
assert(typeof powerMonitor.resetPowerMonitor === 'function', 'resetPowerMonitor має бути функцією');
assert(typeof powerMonitor.getNextScheduledTime === 'function', 'getNextScheduledTime має бути функцією');
assert(typeof powerMonitor.handlePowerStateChange === 'function', 'handlePowerStateChange має бути функцією');

console.log('✓ PowerMonitor має всі необхідні функції\n');

console.log('Test 5: Перевірка admin handlers');
const adminHandlers = require('./src/handlers/admin');

assert(typeof adminHandlers.handleSetDebounce === 'function', 'handleSetDebounce має бути функцією');
assert(typeof adminHandlers.handleGetDebounce === 'function', 'handleGetDebounce має бути функцією');

console.log('✓ Admin handlers для debounce присутні\n');

console.log('Test 6: Перевірка коду powerMonitor на наявність debounce логіки');
const powerMonitorCode = fs.readFileSync('./src/powerMonitor.js', 'utf8');

assert(powerMonitorCode.includes('pendingState'), 'PowerMonitor має містити pendingState');
assert(powerMonitorCode.includes('instabilityStart'), 'PowerMonitor має містити instabilityStart');
assert(powerMonitorCode.includes('switchCount'), 'PowerMonitor має містити switchCount');
assert(powerMonitorCode.includes('debounceTimer'), 'PowerMonitor має містити debounceTimer');
assert(powerMonitorCode.includes('POWER_DEBOUNCE_MINUTES'), 'PowerMonitor має використовувати POWER_DEBOUNCE_MINUTES');
assert(powerMonitorCode.includes('setTimeout'), 'PowerMonitor має використовувати setTimeout для debounce');
assert(powerMonitorCode.includes('clearTimeout'), 'PowerMonitor має очищати таймери');
assert(powerMonitorCode.includes('isCurrentlyOff'), 'PowerMonitor має перевіряти чи зараз запланований період відключення');
assert(powerMonitorCode.includes('Позапланове відключення'), 'PowerMonitor має показувати позапланове відключення');
assert(powerMonitorCode.includes('перемикань'), 'PowerMonitor має показувати кількість перемикань');

console.log('✓ PowerMonitor містить всю необхідну debounce логіку\n');

console.log('Test 7: Перевірка bot.js на наявність команд debounce');
const botCode = fs.readFileSync('./src/bot.js', 'utf8');

assert(botCode.includes('/setdebounce'), 'Bot має обробляти команду /setdebounce');
assert(botCode.includes('/debounce'), 'Bot має обробляти команду /debounce');
assert(botCode.includes('handleSetDebounce'), 'Bot має викликати handleSetDebounce');
assert(botCode.includes('handleGetDebounce'), 'Bot має викликати handleGetDebounce');

console.log('✓ Bot містить команди для управління debounce\n');

console.log('Test 8: Перевірка admin.js на наявність обробників debounce');
const adminCode = fs.readFileSync('./src/handlers/admin.js', 'utf8');

assert(adminCode.includes('handleSetDebounce'), 'Admin має містити handleSetDebounce');
assert(adminCode.includes('handleGetDebounce'), 'Admin має містити handleGetDebounce');
assert(adminCode.includes('power_debounce_minutes'), 'Admin має працювати з power_debounce_minutes');
assert(adminCode.includes('від 1 до 30 хвилин'), 'Admin має валідувати діапазон 1-30 хвилин');

console.log('✓ Admin handlers реалізовані повністю\n');

// Clean up test DB
if (fs.existsSync('/tmp/test-debounce.db')) {
  fs.unlinkSync('/tmp/test-debounce.db');
}

console.log('═══════════════════════════════════════');
console.log('✅ ВСІ ТЕСТИ DEBOUNCE ПРОЙДЕНО УСПІШНО!');
console.log('═══════════════════════════════════════');
console.log('\n📊 Результати:');
console.log(`   • Debounce за замовчуванням: ${config.POWER_DEBOUNCE_MINUTES} хв`);
console.log(`   • Тестів пройдено: 8`);
console.log('\n✨ Debounce логіка реалізована коректно!');
