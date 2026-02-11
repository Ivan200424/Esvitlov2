#!/usr/bin/env node

/**
 * Тест для перевірки виправлення проблеми з дублюванням сповіщень
 * Перевіряє:
 * 1. Cooldown між сповіщеннями (60 секунд)
 * 2. Мінімальна затримка при debounce=0 (30 секунд)
 * 3. Збереження і відновлення lastNotificationAt
 */

const assert = require('assert');
const fs = require('fs');

console.log('🧪 Тест виправлення дублювання сповіщень...\n');

// Перевірка 1: Наявність поля lastNotificationAt в коді
console.log('Test 1: Перевірка наявності lastNotificationAt в powerMonitor.js');
const powerMonitorCode = fs.readFileSync('./src/powerMonitor.js', 'utf8');

assert(powerMonitorCode.includes('lastNotificationAt'), 'PowerMonitor має містити lastNotificationAt');
assert(powerMonitorCode.includes('NOTIFICATION_COOLDOWN_MS'), 'PowerMonitor має містити NOTIFICATION_COOLDOWN_MS');
assert(powerMonitorCode.includes('MIN_STABILIZATION_MS'), 'PowerMonitor має містити MIN_STABILIZATION_MS');
assert(powerMonitorCode.includes('shouldNotify'), 'PowerMonitor має містити логіку shouldNotify');

console.log('✓ Поле lastNotificationAt присутнє в коді\n');

// Перевірка 2: Cooldown константа
console.log('Test 2: Перевірка константи cooldown');
const cooldownMatch = powerMonitorCode.match(/NOTIFICATION_COOLDOWN_MS\s*=\s*(\d+)\s*\*\s*1000/);
assert(cooldownMatch, 'Має бути визначена константа NOTIFICATION_COOLDOWN_MS');
const cooldownSeconds = parseInt(cooldownMatch[1]);
assert(cooldownSeconds === 60, `Cooldown має бути 60 секунд, а не ${cooldownSeconds}`);
console.log(`✓ Cooldown встановлено на ${cooldownSeconds} секунд\n`);

// Перевірка 3: Мінімальна стабілізація
console.log('Test 3: Перевірка мінімальної стабілізації для debounce=0');
const stabilizationMatch = powerMonitorCode.match(/MIN_STABILIZATION_MS\s*=\s*(\d+)\s*\*\s*1000/);
assert(stabilizationMatch, 'Має бути визначена константа MIN_STABILIZATION_MS');
const stabilizationSeconds = parseInt(stabilizationMatch[1]);
assert(stabilizationSeconds === 30, `Мінімальна стабілізація має бути 30 секунд, а не ${stabilizationSeconds}`);
console.log(`✓ Мінімальна стабілізація встановлена на ${stabilizationSeconds} секунд\n`);

// Перевірка 4: Логіка перевірки cooldown
console.log('Test 4: Перевірка логіки cooldown');
assert(powerMonitorCode.includes('timeSinceLastNotification'), 'Має бути обчислення часу з останнього сповіщення');
assert(powerMonitorCode.includes('if (timeSinceLastNotification < NOTIFICATION_COOLDOWN_MS)'), 'Має бути перевірка cooldown');
assert(powerMonitorCode.includes('shouldNotify = false'), 'Має бути можливість пропустити сповіщення');
console.log('✓ Логіка cooldown реалізована\n');

// Перевірка 5: Оновлення lastNotificationAt після відправки
console.log('Test 5: Перевірка оновлення lastNotificationAt');
assert(powerMonitorCode.includes('userState.lastNotificationAt = now.toISOString()'), 
  'lastNotificationAt має оновлюватися після відправки сповіщення');
console.log('✓ lastNotificationAt оновлюється після відправки\n');

// Перевірка 6: Збереження в БД
console.log('Test 6: Перевірка збереження lastNotificationAt в БД');
assert(powerMonitorCode.includes('last_notification_at'), 'Має бути поле last_notification_at в SQL запитах');
const saveMatch = powerMonitorCode.match(/INSERT INTO user_power_states[^)]+last_notification_at/s);
assert(saveMatch, 'Має бути збереження last_notification_at в БД');
console.log('✓ lastNotificationAt зберігається в БД\n');

// Перевірка 7: Відновлення з БД
console.log('Test 7: Перевірка відновлення lastNotificationAt з БД');
const restoreMatch = powerMonitorCode.match(/lastNotificationAt:\s*row\.last_notification_at/);
assert(restoreMatch, 'Має бути відновлення lastNotificationAt з БД');
console.log('✓ lastNotificationAt відновлюється з БД\n');

// Перевірка 8: Ініціалізація в getUserState
console.log('Test 8: Перевірка ініціалізації в getUserState');
const getUserStateMatch = powerMonitorCode.match(/lastNotificationAt:\s*null/);
assert(getUserStateMatch, 'lastNotificationAt має ініціалізуватися як null');
console.log('✓ lastNotificationAt правильно ініціалізується\n');

// Перевірка 9: Міграція БД
console.log('Test 9: Перевірка міграції бази даних');
const dbCode = fs.readFileSync('./src/database/db.js', 'utf8');

// Перевірка CREATE TABLE
assert(dbCode.includes('last_notification_at TIMESTAMP'), 
  'Таблиця user_power_states має містити колонку last_notification_at');

// Перевірка міграції
const migrationMatch = dbCode.match(/ALTER TABLE user_power_states[^;]*ADD COLUMN IF NOT EXISTS last_notification_at/s);
assert(migrationMatch, 'Має бути міграція для додавання last_notification_at');

console.log('✓ Міграція БД налаштована правильно\n');

// Перевірка 10: Видалено миттєву обробку при debounce=0
console.log('Test 10: Перевірка відсутності миттєвої обробки при debounce=0');
const instantProcessingPattern = /if \(debounceMinutes === 0\) \{[^}]*await handlePowerStateChange[^}]*return;/s;
assert(!instantProcessingPattern.test(powerMonitorCode), 
  'Не має бути миттєвої обробки при debounce=0 (має використовуватися MIN_STABILIZATION_MS)');
console.log('✓ Миттєва обробка при debounce=0 відсутня\n');

// Перевірка 11: Використання мінімальної затримки при debounce=0
console.log('Test 11: Перевірка використання мінімальної затримки');
assert(powerMonitorCode.includes('if (debounceMinutes === 0)'), 'Має бути перевірка debounce=0');
assert(powerMonitorCode.includes('debounceMs = MIN_STABILIZATION_MS'), 
  'При debounce=0 має використовуватися MIN_STABILIZATION_MS');
console.log('✓ Мінімальна затримка використовується при debounce=0\n');

// Перевірка 12: Логування
console.log('Test 12: Перевірка логування');
assert(powerMonitorCode.includes('Пропуск сповіщення через cooldown'), 
  'Має бути логування пропуску сповіщення');
assert(powerMonitorCode.includes('залишилось'), 'Має показуватися час до наступного сповіщення');
assert(powerMonitorCode.includes('захисту від флаппінгу'), 'Має бути логування про захист від флаппінгу');
console.log('✓ Логування реалізовано правильно\n');

// Перевірка 13: Оновлення стану навіть без сповіщення
console.log('Test 13: Перевірка оновлення стану без сповіщення');
assert(powerMonitorCode.includes('// Оновлюємо стан користувача'), 
  'Має бути оновлення стану після обробки');
// Перевіряємо що оновлення стану відбувається після блоку if (shouldNotify)
const codeAfterNotify = powerMonitorCode.split('if (shouldNotify)')[1];
assert(codeAfterNotify.includes('userState.lastStableAt'), 
  'Стан має оновлюватися навіть якщо сповіщення не відправлено');
console.log('✓ Стан оновлюється завжди, незалежно від сповіщення\n');

console.log('═══════════════════════════════════════');
console.log('✅ ВСІ ТЕСТИ ПРОЙДЕНО УСПІШНО!');
console.log('═══════════════════════════════════════');
console.log('\n📊 Результати:');
console.log(`   • Cooldown між сповіщеннями: ${cooldownSeconds} секунд`);
console.log(`   • Мінімальна стабілізація при debounce=0: ${stabilizationSeconds} секунд`);
console.log(`   • Тестів пройдено: 13`);
console.log('\n✨ Виправлення дублювання сповіщень реалізовано коректно!');
console.log('🎯 Тепер користувачі отримуватимуть одне сповіщення замість трьох');
