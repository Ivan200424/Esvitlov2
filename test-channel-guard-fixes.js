#!/usr/bin/env node

/**
 * Test script for channel guard bug fixes
 */

console.log('🧪 Тестування виправлень в Channel Guard...\n');

// Test 1: Verify bot name is "Вольтик" not "GridBot"
console.log('Test 1: Перевірка назви бота в повідомленнях');
try {
  const fs = require('fs');
  const channelGuardContent = fs.readFileSync('./src/channelGuard.js', 'utf8');
  
  const hasGridBot = channelGuardContent.includes('GridBot');
  const hasVoltyk = channelGuardContent.includes('Вольтик');
  
  if (hasGridBot) {
    console.log('✗ Знайдено "GridBot" в channelGuard.js\n');
    process.exit(1);
  } else if (hasVoltyk) {
    console.log('✓ Назву бота виправлено на "Вольтик"\n');
  } else {
    console.log('✗ Не знайдено жодної назви бота\n');
    process.exit(1);
  }
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

// Test 2: Verify timestamp column exists
console.log('Test 2: Перевірка колонки channel_branding_updated_at');
try {
  const db = require('./src/database/db');
  const tableInfo = db.pragma('table_info(users)');
  const columnNames = tableInfo.map(col => col.name);
  
  if (columnNames.includes('channel_branding_updated_at')) {
    console.log('✓ Колонка channel_branding_updated_at додана\n');
  } else {
    console.log('✗ Колонка channel_branding_updated_at відсутня\n');
    process.exit(1);
  }
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

// Test 3: Verify updateChannelBrandingPartial method exists
console.log('Test 3: Перевірка методу updateChannelBrandingPartial');
try {
  const usersDb = require('./src/database/users');
  
  if (typeof usersDb.updateChannelBrandingPartial === 'function') {
    console.log('✓ Метод updateChannelBrandingPartial існує\n');
  } else {
    console.log('✗ Метод updateChannelBrandingPartial відсутній\n');
    process.exit(1);
  }
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

// Test 4: Verify timestamp tracking in channelGuard
console.log('Test 4: Перевірка відстеження timestamp в channelGuard');
try {
  const fs = require('fs');
  const channelGuardContent = fs.readFileSync('./src/channelGuard.js', 'utf8');
  
  const hasTimestampCheck = channelGuardContent.includes('channel_branding_updated_at') &&
                            channelGuardContent.includes('hoursSinceUpdate');
  
  if (hasTimestampCheck) {
    console.log('✓ Логіка перевірки timestamp додана\n');
  } else {
    console.log('✗ Логіка перевірки timestamp відсутня\n');
    process.exit(1);
  }
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

// Test 5: Verify improved error handling in applyChannelBranding
console.log('Test 5: Перевірка покращеної обробки помилок');
try {
  const fs = require('fs');
  const channelHandlerContent = fs.readFileSync('./src/handlers/channel.js', 'utf8');
  
  const hasOperationsTracking = channelHandlerContent.includes('const operations = {') &&
                                channelHandlerContent.includes('operations.title') &&
                                channelHandlerContent.includes('operations.description');
  
  if (hasOperationsTracking) {
    console.log('✓ Відстеження операцій додано\n');
  } else {
    console.log('✗ Відстеження операцій відсутнє\n');
    process.exit(1);
  }
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

// Test 6: Verify channel validation in publisher
console.log('Test 6: Перевірка валідації каналу в publisher');
try {
  const fs = require('fs');
  const publisherContent = fs.readFileSync('./src/publisher.js', 'utf8');
  
  const hasChannelValidation = publisherContent.includes('// Validate channel before publishing') &&
                               publisherContent.includes('getChat(user.channel_id)') &&
                               publisherContent.includes('updateChannelStatus');
  
  if (hasChannelValidation) {
    console.log('✓ Валідація каналу додана\n');
  } else {
    console.log('✗ Валідація каналу відсутня\n');
    process.exit(1);
  }
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

// Test 7: Verify updateChannelBranding sets timestamp
console.log('Test 7: Перевірка оновлення timestamp в updateChannelBranding');
try {
  const fs = require('fs');
  const usersDbContent = fs.readFileSync('./src/database/users.js', 'utf8');
  
  const setsTimestamp = usersDbContent.includes('channel_branding_updated_at = CURRENT_TIMESTAMP');
  
  if (setsTimestamp) {
    console.log('✓ Timestamp оновлюється при зміні брендування\n');
  } else {
    console.log('✗ Timestamp не оновлюється\n');
    process.exit(1);
  }
} catch (error) {
  console.log(`✗ Помилка: ${error.message}\n`);
  process.exit(1);
}

console.log('✅ Всі виправлення перевірено успішно!');
console.log('\n📝 Виправлення:');
console.log('   1. ✅ Назва бота змінена з "GridBot" на "Вольтик"');
console.log('   2. ✅ Додано відстеження timestamp змін через бота');
console.log('   3. ✅ Нічна перевірка враховує зміни через бота (24 години)');
console.log('   4. ✅ Покращена обробка помилок при додаванні каналу');
console.log('   5. ✅ Додана валідація каналу перед публікацією');
console.log('   6. ✅ Канал блокується якщо недоступний');

