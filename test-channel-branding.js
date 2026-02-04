#!/usr/bin/env node

/**
 * Test script for channel branding functionality
 */

console.log('🧪 Тестування функціоналу брендування каналів...\n');

// Test 1: Database schema
console.log('Test 1: Перевірка схеми бази даних');
try {
  const db = require('./src/database/db');
  const tableInfo = db.pragma('table_info(users)');
  const columnNames = tableInfo.map(col => col.name);
  
  const requiredColumns = [
    'channel_title',
    'channel_description',
    'channel_photo_file_id',
    'channel_user_title',
    'channel_user_description',
    'channel_status',
    'channel_branding_updated_at'
  ];
  
  const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
  
  if (missingColumns.length === 0) {
    console.log('✓ Всі необхідні колонки присутні\n');
  } else {
    console.log(`✗ Відсутні колонки: ${missingColumns.join(', ')}\n`);
    process.exit(1);
  }
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

// Test 2: Database methods
console.log('Test 2: Перевірка методів бази даних');
try {
  const usersDb = require('./src/database/users');
  
  const requiredMethods = [
    'resetUserChannel',
    'updateChannelBranding',
    'updateChannelBrandingPartial',
    'updateChannelStatus',
    'getUsersWithActiveChannels',
    'getUsersWithChannelsForVerification'
  ];
  
  const missingMethods = requiredMethods.filter(method => typeof usersDb[method] !== 'function');
  
  if (missingMethods.length === 0) {
    console.log('✓ Всі методи присутні\n');
  } else {
    console.log(`✗ Відсутні методи: ${missingMethods.join(', ')}\n`);
    process.exit(1);
  }
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

// Test 3: Channel handler exports
console.log('Test 3: Перевірка обробників каналу');
try {
  const channelHandlers = require('./src/handlers/channel');
  
  const requiredHandlers = [
    'handleChannel',
    'handleSetChannel',
    'handleConversation',
    'handleChannelCallback',
    'handleCancelChannel',
    'handleForwardedMessage'
  ];
  
  const missingHandlers = requiredHandlers.filter(handler => typeof channelHandlers[handler] !== 'function');
  
  if (missingHandlers.length === 0) {
    console.log('✓ Всі обробники присутні\n');
  } else {
    console.log(`✗ Відсутні обробники: ${missingHandlers.join(', ')}\n`);
    process.exit(1);
  }
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

// Test 4: Channel guard exports
console.log('Test 4: Перевірка модуля захисту каналів');
try {
  const channelGuard = require('./src/channelGuard');
  
  const requiredFunctions = [
    'initChannelGuard',
    'verifyAllChannels',
    'checkExistingUsers'
  ];
  
  const missingFunctions = requiredFunctions.filter(func => typeof channelGuard[func] !== 'function');
  
  if (missingFunctions.length === 0) {
    console.log('✓ Всі функції присутні\n');
  } else {
    console.log(`✗ Відсутні функції: ${missingFunctions.join(', ')}\n`);
    process.exit(1);
  }
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

// Test 5: Photo file exists
console.log('Test 5: Перевірка наявності фото');
try {
  const fs = require('fs');
  const path = require('path');
  const photoPath = path.join(__dirname, 'photo_for_channels.PNG.jpg');
  
  if (fs.existsSync(photoPath)) {
    const stats = fs.statSync(photoPath);
    console.log(`✓ Файл фото знайдено (${(stats.size / 1024).toFixed(2)} KB)\n`);
  } else {
    console.log('✗ Файл фото не знайдено\n');
    process.exit(1);
  }
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

// Test 6: Constants
console.log('Test 6: Перевірка констант');
try {
  const channelHandlers = require('./src/handlers/channel');
  const fs = require('fs');
  const content = fs.readFileSync('./src/handlers/channel.js', 'utf8');
  
  const hasPrefix = content.includes("CHANNEL_NAME_PREFIX = 'Вольтик ⚡️ '");
  const hasDescription = content.includes('CHANNEL_DESCRIPTION_BASE');
  const hasPhotoPath = content.includes('PHOTO_PATH');
  
  if (hasPrefix && hasDescription && hasPhotoPath) {
    console.log('✓ Всі константи визначені\n');
  } else {
    console.log('✗ Деякі константи відсутні\n');
    process.exit(1);
  }
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

console.log('✅ Всі тести пройдено успішно!');
console.log('\n📝 Функціонал брендування каналів готовий до використання.');
console.log('   Команди:');
console.log('   • /channel - інформація про підключення каналу');
console.log('   • /setchannel @channel - налаштування каналу');
console.log('   • /cancel - скасування налаштування');
