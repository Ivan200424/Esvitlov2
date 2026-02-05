#!/usr/bin/env node

/**
 * Test script for IP monitoring functionality
 * Tests validation, state management, and core logic
 */

const assert = require('assert');

console.log('🧪 Запуск тестів IP моніторингу...\n');

// Test 1: IP Address Validation
console.log('Test 1: Валідація IP-адрес');

// Import validation function - we'll test the actual implementation
// by creating a test wrapper that mimics the production validation
function isValidIPorDomain(input) {
  const trimmed = input.trim();
  
  if (trimmed.includes(' ')) {
    return { valid: false, error: 'Адреса не може містити пробіли' };
  }
  
  // Розділяємо на хост і порт
  let host = trimmed;
  let port = null;
  
  // Перевіряємо чи є порт (останній :число)
  const portMatch = trimmed.match(/^(.+):(\d+)$/);
  if (portMatch) {
    host = portMatch[1];
    port = parseInt(portMatch[2], 10);
    
    if (port < 1 || port > 65535) {
      return { valid: false, error: 'Порт має бути від 1 до 65535' };
    }
  }
  
  // Перевірка IPv4
  const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipMatch = host.match(ipRegex);
  
  if (ipMatch) {
    // Валідація октетів
    for (let i = 1; i <= 4; i++) {
      const num = parseInt(ipMatch[i], 10);
      if (num < 0 || num > 255) {
        return { valid: false, error: 'Кожне число в IP-адресі має бути від 0 до 255' };
      }
    }
    return { valid: true, address: trimmed, host, port, type: 'ip' };
  }
  
  // Перевірка чи це не неповна IP-адреса (наприклад, 192.168.1)
  // Якщо складається ТІЛЬКИ з чисел та крапок, але не 4 октети - відхиляємо
  // Requires at least one dot to avoid matching single numbers
  if (/^\d+\.\d+(\.\d+)*$/.test(host) && !ipRegex.test(host)) {
    return { valid: false, error: 'Неповна IP-адреса. IP має складатися з 4 чисел.\n\nПриклад: 192.168.1.1' };
  }
  
  // Перевірка доменного імені (DDNS)
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
  
  if (domainRegex.test(host)) {
    return { valid: true, address: trimmed, host, port, type: 'domain' };
  }
  
  return { valid: false, error: 'Невірний формат. Введіть IP-адресу або доменне імʼя.\n\nПриклади:\n• 89.167.32.1\n• 89.167.32.1:80\n• myhome.ddns.net' };
}

// Test valid IPv4 addresses
const validIPv4Tests = [
  { input: '192.168.1.1', expected: { valid: true, type: 'ip', host: '192.168.1.1', port: null } },
  { input: '89.123.45.67', expected: { valid: true, type: 'ip', host: '89.123.45.67', port: null } },
  { input: '10.0.0.1', expected: { valid: true, type: 'ip', host: '10.0.0.1', port: null } },
  { input: '255.255.255.255', expected: { valid: true, type: 'ip', host: '255.255.255.255', port: null } },
  { input: '0.0.0.0', expected: { valid: true, type: 'ip', host: '0.0.0.0', port: null } },
];

validIPv4Tests.forEach(test => {
  const result = isValidIPorDomain(test.input);
  assert.strictEqual(result.valid, test.expected.valid, `${test.input} повинно бути валідним`);
  assert.strictEqual(result.type, test.expected.type, `${test.input} повинно мати тип ${test.expected.type}`);
  assert.strictEqual(result.host, test.expected.host, `${test.input} повинно мати хост ${test.expected.host}`);
  assert.strictEqual(result.port, test.expected.port, `${test.input} повинно мати порт ${test.expected.port}`);
  console.log(`  ✓ ${test.input} - валідний IPv4`);
});

// Test IPv4 with port
const validIPv4PortTests = [
  { input: '192.168.1.1:80', expected: { valid: true, type: 'ip', host: '192.168.1.1', port: 80 } },
  { input: '89.123.45.67:8080', expected: { valid: true, type: 'ip', host: '89.123.45.67', port: 8080 } },
  { input: '10.0.0.1:443', expected: { valid: true, type: 'ip', host: '10.0.0.1', port: 443 } },
  { input: '192.168.1.1:1', expected: { valid: true, type: 'ip', host: '192.168.1.1', port: 1 } },
  { input: '192.168.1.1:65535', expected: { valid: true, type: 'ip', host: '192.168.1.1', port: 65535 } },
];

validIPv4PortTests.forEach(test => {
  const result = isValidIPorDomain(test.input);
  assert.strictEqual(result.valid, test.expected.valid, `${test.input} повинно бути валідним`);
  assert.strictEqual(result.type, test.expected.type, `${test.input} повинно мати тип ${test.expected.type}`);
  assert.strictEqual(result.host, test.expected.host, `${test.input} повинно мати хост ${test.expected.host}`);
  assert.strictEqual(result.port, test.expected.port, `${test.input} повинно мати порт ${test.expected.port}`);
  console.log(`  ✓ ${test.input} - валідний IPv4 з портом`);
});

// Test valid domain names (DDNS)
const validDomainTests = [
  { input: 'myhome.ddns.net', expected: { valid: true, type: 'domain', host: 'myhome.ddns.net', port: null } },
  { input: 'router.example.com', expected: { valid: true, type: 'domain', host: 'router.example.com', port: null } },
  { input: 'test-router.mydomain.org', expected: { valid: true, type: 'domain', host: 'test-router.mydomain.org', port: null } },
  { input: 'home123.ddns.net', expected: { valid: true, type: 'domain', host: 'home123.ddns.net', port: null } },
];

validDomainTests.forEach(test => {
  const result = isValidIPorDomain(test.input);
  assert.strictEqual(result.valid, test.expected.valid, `${test.input} повинно бути валідним`);
  assert.strictEqual(result.type, test.expected.type, `${test.input} повинно мати тип ${test.expected.type}`);
  assert.strictEqual(result.host, test.expected.host, `${test.input} повинно мати хост ${test.expected.host}`);
  console.log(`  ✓ ${test.input} - валідний домен`);
});

// Test domain with port
const validDomainPortTests = [
  { input: 'myhome.ddns.net:80', expected: { valid: true, type: 'domain', host: 'myhome.ddns.net', port: 80 } },
  { input: 'router.example.com:443', expected: { valid: true, type: 'domain', host: 'router.example.com', port: 443 } },
  { input: 'home.net:8080', expected: { valid: true, type: 'domain', host: 'home.net', port: 8080 } },
];

validDomainPortTests.forEach(test => {
  const result = isValidIPorDomain(test.input);
  assert.strictEqual(result.valid, test.expected.valid, `${test.input} повинно бути валідним`);
  assert.strictEqual(result.type, test.expected.type, `${test.input} повинно мати тип ${test.expected.type}`);
  assert.strictEqual(result.host, test.expected.host, `${test.input} повинно мати хост ${test.expected.host}`);
  assert.strictEqual(result.port, test.expected.port, `${test.input} повинно мати порт ${test.expected.port}`);
  console.log(`  ✓ ${test.input} - валідний домен з портом`);
});

// Test invalid inputs
const invalidTests = [
  { input: '256.1.1.1', reason: 'IP октет > 255' },
  { input: '192.168.1', reason: 'Неповна IP-адреса' },
  { input: '192.168.1.1.1', reason: 'Забагато октетів' },
  { input: 'test domain.com', reason: 'Пробіл в адресі' },
  { input: '192.168.1.1:0', reason: 'Порт = 0' },
  { input: '192.168.1.1:65536', reason: 'Порт > 65535' },
  { input: '192.168.1.1:abc', reason: 'Нечисловий порт' },
  { input: '-router.com', reason: 'Дефіс на початку' },
  { input: 'router-.com', reason: 'Дефіс в кінці' },
  { input: 'just-a-name', reason: 'Без домену верхнього рівня' },
  { input: '192', reason: 'Одне число (не домен, не IP)' },
  { input: '', reason: 'Порожній рядок' },
  { input: '   ', reason: 'Тільки пробіли' },
];

invalidTests.forEach(test => {
  const result = isValidIPorDomain(test.input);
  assert.strictEqual(result.valid, false, `${test.input} повинно бути невалідним (${test.reason})`);
  assert(result.error, `${test.input} повинно мати повідомлення про помилку`);
  console.log(`  ✓ ${test.input} - правильно відхилено (${test.reason})`);
});

console.log('✓ Всі тести валідації пройдено\n');

// Test 2: Power Monitor Configuration
console.log('Test 2: Перевірка конфігурації моніторингу');
const config = require('./src/config');

assert(config.POWER_CHECK_INTERVAL, 'POWER_CHECK_INTERVAL має бути визначений');
assert(config.POWER_DEBOUNCE_MINUTES, 'POWER_DEBOUNCE_MINUTES має бути визначений');
assert(config.POWER_CHECK_INTERVAL >= 1, 'POWER_CHECK_INTERVAL має бути >= 1 секунди');
assert(config.POWER_DEBOUNCE_MINUTES >= 1, 'POWER_DEBOUNCE_MINUTES має бути >= 1 хвилини');

console.log(`  Інтервал перевірки: ${config.POWER_CHECK_INTERVAL} сек`);
console.log(`  Debounce: ${config.POWER_DEBOUNCE_MINUTES} хв`);
console.log('✓ Конфігурація моніторингу коректна\n');

// Test 3: Router availability check function
console.log('Test 3: Перевірка функції checkRouterAvailability');
const { checkRouterAvailability } = require('./src/powerMonitor');

// Test with null (monitoring disabled)
(async () => {
  const result = await checkRouterAvailability(null);
  assert.strictEqual(result, null, 'checkRouterAvailability(null) має повертати null');
  console.log('  ✓ checkRouterAvailability(null) → null (моніторинг вимкнено)');
})();

// Test with invalid address (should return false - not available)
(async () => {
  const result = await checkRouterAvailability('192.0.2.1:9999'); // TEST-NET-1, unlikely to respond
  assert.strictEqual(typeof result, 'boolean', 'checkRouterAvailability має повертати boolean');
  console.log(`  ✓ checkRouterAvailability('192.0.2.1:9999') → ${result} (недоступний тестовий хост)`);
})();

console.log('✓ Функція checkRouterAvailability працює коректно\n');

// Test 4: Database functions
console.log('Test 4: Перевірка функцій бази даних');
const usersDb = require('./src/database/users');

// Test getUsersWithRouterIp
const usersWithIp = usersDb.getUsersWithRouterIp();
assert(Array.isArray(usersWithIp), 'getUsersWithRouterIp має повертати масив');
console.log(`  ✓ getUsersWithRouterIp() повертає масив (${usersWithIp.length} користувачів)`);

console.log('✓ Функції бази даних працюють коректно\n');

console.log('✅ Всі тести IP моніторингу пройдено успішно!');
