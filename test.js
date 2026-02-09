#!/usr/bin/env node

/**
 * Тестовий скрипт для перевірки функціональності бота
 * Без підключення до Telegram API
 */

const assert = require('assert');

console.log('🧪 Запуск тестів...\n');

// Test 1: Константи та регіони
console.log('Test 1: Перевірка констант та регіонів');
const { REGIONS, REGION_CODES, QUEUES, GROUPS, SUBGROUPS } = require('./src/constants/regions');

assert.strictEqual(REGION_CODES.length, 4, 'Має бути 4 регіони');
assert.strictEqual(QUEUES.length, 12, 'Має бути 12 черг (6 груп × 2 підгрупи)');
assert.strictEqual(GROUPS.length, 6, 'Має бути 6 груп');
assert.strictEqual(SUBGROUPS.length, 2, 'Має бути 2 підгрупи');
assert(REGIONS.kyiv, 'Регіон Київ має існувати');
assert.strictEqual(REGIONS.kyiv.name, 'Київ', 'Назва регіону має бути правильною');
console.log('✓ Константи та регіони коректні\n');

// Test 2: Утиліти
console.log('Test 2: Перевірка утиліт');
const utils = require('./src/utils');

// Тест calculateHash з правильною структурою даних
const testData1 = {
  fact: {
    today: 1737849600, // Стабільний timestamp з API
    data: {
      1737849600: {
        'GPV1.1': { '1': 'yes', '2': 'no', '3': 'yes' }
      },
      1737936000: {
        'GPV1.1': { '1': 'yes', '2': 'yes', '3': 'no' }
      }
    }
  }
};

// Той самий графік, але з іншими timestamps
const testData2 = {
  fact: {
    today: 1737849600, // ВАЖЛИВО: той самий today як у testData1!
    data: {
      1737863200: { // Інший timestamp для "сьогодні"
        'GPV1.1': { '1': 'yes', '2': 'no', '3': 'yes' } // Ті самі дані!
      },
      1737949600: { // Інший timestamp для "завтра"
        'GPV1.1': { '1': 'yes', '2': 'yes', '3': 'no' } // Ті самі дані!
      }
    }
  }
};

// Графік з іншими даними
const testData3 = {
  fact: {
    today: 1737849600,
    data: {
      1737849600: {
        'GPV1.1': { '1': 'no', '2': 'yes', '3': 'yes' } // Різні дані
      },
      1737936000: {
        'GPV1.1': { '1': 'yes', '2': 'yes', '3': 'no' }
      }
    }
  }
};

// Тест 1: Однакові дані з однаковими timestamps повинні давати ОДНАКОВИЙ хеш
const hash1a = utils.calculateHash(testData1, 'GPV1.1', 1737849600, 1737936000);
const hash1b = utils.calculateHash(testData1, 'GPV1.1', 1737849600, 1737936000);
assert.strictEqual(hash1a, hash1b, 'Однакові дані мають давати однаковий хеш');

// Тест 2: КРИТИЧНИЙ ТЕСТ - Однакові дані графіка з різними timestamps мають давати ОДНАКОВИЙ хеш
// Це і є фікс проблеми: хеш не повинен залежати від timestamps!
const hash2a = utils.calculateHash(testData1, 'GPV1.1', 1737849600, 1737936000);
const hash2b = utils.calculateHash(testData2, 'GPV1.1', 1737863200, 1737949600);
assert.strictEqual(hash2a, hash2b, 'Однакові дані графіка з різними timestamps мають давати однаковий хеш (ФІХ!)');

// Тест 3: Різні дані графіка повинні давати РІЗНИЙ хеш
const hash3 = utils.calculateHash(testData3, 'GPV1.1', 1737849600, 1737936000);
assert.notStrictEqual(hash1a, hash3, 'Різні дані мають давати різний хеш');

const escaped = utils.escapeHtml('<script>alert("test")</script>');
assert(!escaped.includes('<script>'), 'HTML має бути екрановано');

const uptime = utils.formatUptime(3665);
assert(uptime.includes('г'), 'Uptime має містити години');

const memory = utils.formatMemory(1024 * 1024 * 100);
assert(memory.includes('MB'), 'Пам\'ять має бути в MB');

console.log('✓ Утиліти працюють коректно\n');

// Test 3: Форматування
console.log('Test 3: Перевірка форматування повідомлень');
const formatter = require('./src/formatter');

const welcomeMsg = formatter.formatWelcomeMessage('Тест');
assert(welcomeMsg.includes('Тест'), 'Welcome message має містити ім\'я');
assert(welcomeMsg.includes('Привіт'), 'Welcome message має містити привітання');

const helpMsg = formatter.formatHelpMessage();
assert(helpMsg.includes('/start'), 'Help message має містити команди');
assert(helpMsg.includes('Довідка'), 'Help message має містити заголовок');

console.log('✓ Форматування повідомлень коректне\n');

// Test 4: Parser
console.log('Test 4: Перевірка парсера');
const parser = require('./src/parser');

// Створюємо mock data у новому форматі
const now = new Date();
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const todayTimestamp = Math.floor(todayStart.getTime() / 1000);

const mockData = {
  fact: {
    today: todayTimestamp, // Додаємо стабільний timestamp з API
    data: {
      [todayTimestamp]: {
        'GPV1.1': {
          '1': 'yes',
          '2': 'yes',
          '3': 'yes',
          '4': 'yes',
          '5': 'yes',
          '6': 'yes',
          '7': 'yes',
          '8': 'yes',
          '9': 'yes',
          '10': 'yes',
          '11': 'yes',
          '12': 'yes',
          '13': 'yes',
          '14': 'no',  // 13:00-14:00 відключення
          '15': 'no',  // 14:00-15:00 відключення
          '16': 'yes',
          '17': 'yes',
          '18': 'yes',
          '19': 'yes',
          '20': 'yes',
          '21': 'yes',
          '22': 'yes',
          '23': 'yes',
          '24': 'yes',
        }
      }
    }
  }
};

const scheduleData = parser.parseScheduleForQueue(mockData, '1.1');
assert(scheduleData.hasData, 'Має бути розпарсена черга');
assert(scheduleData.events.length > 0, 'Має бути хоча б 1 подія');
assert.strictEqual(scheduleData.queue, '1.1', 'Черга має відповідати');

const nextEvent = parser.findNextEvent(scheduleData);
// nextEvent може бути null якщо відключення вже минуло, це нормально

console.log('✓ Парсер працює коректно\n');

// Test 5: Клавіатури
console.log('Test 5: Перевірка клавіатур');
const keyboards = require('./src/keyboards/inline');

const mainMenu = keyboards.getMainMenu();
assert(mainMenu.reply_markup, 'Головне меню має мати reply_markup');
assert(mainMenu.reply_markup.keyboard, 'Головне меню має мати клавіатуру');

const regionKeyboard = keyboards.getRegionKeyboard();
assert(regionKeyboard.reply_markup.inline_keyboard, 'Клавіатура регіонів має бути inline');
assert(regionKeyboard.reply_markup.inline_keyboard.length > 0, 'Має бути хоча б один рядок кнопок');

const groupKeyboard = keyboards.getGroupKeyboard();
assert(groupKeyboard.reply_markup.inline_keyboard, 'Клавіатура груп має бути inline');

const settingsKeyboard = keyboards.getSettingsKeyboard();
assert(settingsKeyboard.reply_markup.inline_keyboard, 'Клавіатура налаштувань має бути inline');

console.log('✓ Клавіатури коректні\n');

// Test 6: API URLs
console.log('Test 6: Перевірка API');
const config = require('./src/config');

assert(config.dataUrlTemplate, 'Має бути URL template для даних');
assert(config.dataUrlTemplate.includes('{region}'), 'URL має містити placeholder для регіону');
assert(config.imageUrlTemplate, 'Має бути URL template для зображень');
assert(config.imageUrlTemplate.includes('{region}'), 'URL має містити placeholder для регіону');

console.log('✓ API конфігурація коректна\n');

// Test 7: Database schema (without actual DB connection)
console.log('Test 7: Перевірка структури бази даних');
const fs = require('fs');
const dbPath = './src/database/db.js';
const dbContent = fs.readFileSync(dbPath, 'utf8');

assert(dbContent.includes('CREATE TABLE IF NOT EXISTS users'), 'Має бути створена таблиця users');
assert(dbContent.includes('telegram_id'), 'Таблиця має містити telegram_id');
assert(dbContent.includes('region'), 'Таблиця має містити region');
assert(dbContent.includes('queue'), 'Таблиця має містити queue');
assert(dbContent.includes('channel_id'), 'Таблиця має містити channel_id');
assert(dbContent.includes('CREATE INDEX'), 'Мають бути створені індекси');

console.log('✓ Структура бази даних коректна\n');

// Summary
console.log('═══════════════════════════════════════');
console.log('✅ ВСІ ТЕСТИ ПРОЙДЕНО УСПІШНО!');
console.log('═══════════════════════════════════════');
console.log('\n📊 Статистика:');
console.log(`   • Регіони: ${REGION_CODES.length}`);
console.log(`   • Черги: ${QUEUES.length}`);
console.log(`   • Тестів пройдено: 7`);
console.log('\n✨ Бот готовий до розгортання!');
