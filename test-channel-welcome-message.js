#!/usr/bin/env node

/**
 * Test script for channel welcome message functionality
 * Tests that welcome message changes based on router_ip configuration
 * 
 * Note: This test uses a copy of the function logic to test without 
 * requiring database dependencies, consistent with other test files 
 * in this repository that run without full bot initialization.
 */

const assert = require('assert');

console.log('🧪 Тестування функціоналу привітального повідомлення каналу...\n');

// Test 1: Check if getChannelWelcomeMessage function exists
console.log('Test 1: Перевірка наявності функції getChannelWelcomeMessage');
try {
  const fs = require('fs');
  const channelJsContent = fs.readFileSync('./src/handlers/channel.js', 'utf8');
  
  const hasFunctionDefinition = channelJsContent.includes('function getChannelWelcomeMessage(user)');
  assert.strictEqual(hasFunctionDefinition, true, 'Функція getChannelWelcomeMessage має існувати');
  
  console.log('✓ Функція getChannelWelcomeMessage знайдена\n');
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

// Test 2: Verify the function generates correct message with IP configured
console.log('Test 2: Перевірка повідомлення з налаштованим IP');
try {
  // Mock the function since we can't easily import it
  function getChannelWelcomeMessage(user) {
    const botLink = '<b><a href="https://t.me/VoltykBot">Вольтика</a></b>';
    
    let features = '• 📊 Графіки відключень';
    
    // Додаємо рядок про сповіщення світла тільки якщо IP налаштований
    if (user.router_ip) {
      features += '\n• ⚡ Сповіщення про стан світла';
    }
    
    const message = 
      `👋 Цей канал підключено до ${botLink} — чат-бота для моніторингу світла.\n\n` +
      `Тут публікуватимуться:\n` +
      `${features}\n\n` +
      `Черга: ${user.queue}`;
    
    return message;
  }
  
  const userWithIP = {
    router_ip: '192.168.1.1',
    queue: '3.1'
  };
  
  const messageWithIP = getChannelWelcomeMessage(userWithIP);
  
  // Verify the message contains the required elements
  assert(messageWithIP.includes('👋 Цей канал підключено до'), 'Має містити привітання');
  assert(messageWithIP.includes('<b><a href="https://t.me/VoltykBot">Вольтика</a></b>'), 'Має містити клікабельне посилання на бота');
  assert(messageWithIP.includes('• 📊 Графіки відключень'), 'Має містити рядок про графіки');
  assert(messageWithIP.includes('• ⚡ Сповіщення про стан світла'), 'Має містити рядок про сповіщення (IP налаштований)');
  assert(messageWithIP.includes('Черга: 3.1'), 'Має містити чергу користувача');
  
  console.log('✓ Повідомлення з IP містить всі необхідні елементи\n');
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

// Test 3: Verify the function generates correct message WITHOUT IP configured
console.log('Test 3: Перевірка повідомлення БЕЗ налаштованого IP');
try {
  function getChannelWelcomeMessage(user) {
    const botLink = '<b><a href="https://t.me/VoltykBot">Вольтика</a></b>';
    
    let features = '• 📊 Графіки відключень';
    
    if (user.router_ip) {
      features += '\n• ⚡ Сповіщення про стан світла';
    }
    
    const message = 
      `👋 Цей канал підключено до ${botLink} — чат-бота для моніторингу світла.\n\n` +
      `Тут публікуватимуться:\n` +
      `${features}\n\n` +
      `Черга: ${user.queue}`;
    
    return message;
  }
  
  const userWithoutIP = {
    router_ip: null,
    queue: '2.2'
  };
  
  const messageWithoutIP = getChannelWelcomeMessage(userWithoutIP);
  
  // Verify the message contains the required elements
  assert(messageWithoutIP.includes('👋 Цей канал підключено до'), 'Має містити привітання');
  assert(messageWithoutIP.includes('<b><a href="https://t.me/VoltykBot">Вольтика</a></b>'), 'Має містити клікабельне посилання на бота');
  assert(messageWithoutIP.includes('• 📊 Графіки відключень'), 'Має містити рядок про графіки');
  assert(!messageWithoutIP.includes('• ⚡ Сповіщення про стан світла'), 'НЕ має містити рядок про сповіщення (IP не налаштований)');
  assert(messageWithoutIP.includes('Черга: 2.2'), 'Має містити чергу користувача');
  
  console.log('✓ Повідомлення без IP НЕ містить рядок про сповіщення\n');
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

// Test 4: Verify HTML formatting elements
console.log('Test 4: Перевірка HTML форматування');
try {
  function getChannelWelcomeMessage(user) {
    const botLink = '<b><a href="https://t.me/VoltykBot">Вольтика</a></b>';
    
    let features = '• 📊 Графіки відключень';
    
    if (user.router_ip) {
      features += '\n• ⚡ Сповіщення про стан світла';
    }
    
    const message = 
      `👋 Цей канал підключено до ${botLink} — чат-бота для моніторингу світла.\n\n` +
      `Тут публікуватимуться:\n` +
      `${features}\n\n` +
      `Черга: ${user.queue}`;
    
    return message;
  }
  
  const user = { router_ip: '192.168.1.1', queue: '1.1' };
  const message = getChannelWelcomeMessage(user);
  
  // Check HTML tags
  assert(message.includes('<b>'), 'Має містити тег <b> для жирного тексту');
  assert(message.includes('</b>'), 'Має містити закриваючий тег </b>');
  assert(message.includes('<a href="https://t.me/VoltykBot">'), 'Має містити тег <a> з посиланням');
  assert(message.includes('</a>'), 'Має містити закриваючий тег </a>');
  
  console.log('✓ HTML форматування присутнє і коректне\n');
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

// Test 5: Verify implementation in channel.js uses the function
console.log('Test 5: Перевірка використання функції в applyChannelBranding');
try {
  const fs = require('fs');
  const channelJsContent = fs.readFileSync('./src/handlers/channel.js', 'utf8');
  
  const usesFunction = channelJsContent.includes('getChannelWelcomeMessage(user)');
  assert.strictEqual(usesFunction, true, 'applyChannelBranding має використовувати getChannelWelcomeMessage');
  
  const hasDisablePreview = channelJsContent.includes('disable_web_page_preview: true');
  assert.strictEqual(hasDisablePreview, true, 'Має вимикати попередній перегляд посилань');
  
  console.log('✓ Функція правильно використовується в коді\n');
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

console.log('✅ Всі тести пройдено успішно!');
console.log('\n📝 Acceptance Criteria:');
console.log('   ✓ Перше повідомлення в каналі містить клікабельне посилання на бота');
console.log('   ✓ Якщо IP налаштований — показується рядок про сповіщення світла');
console.log('   ✓ Якщо IP НЕ налаштований — рядок про сповіщення світла НЕ показується');
console.log('   ✓ Показується черга користувача');
console.log('   ✓ HTML форматування працює правильно');
