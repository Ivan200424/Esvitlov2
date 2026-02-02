/**
 * Test for graceful shutdown functionality
 * 
 * This test verifies:
 * 1. User states are saved to database on shutdown
 * 2. User states are restored from database on startup
 * 3. Database table is created correctly
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Test database path
const TEST_DB_PATH = './data/test-graceful-shutdown.db';

async function runTests() {
  console.log('🧪 Тест graceful shutdown functionality\n');

  // Clean up test database if exists
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
    console.log('🗑️  Видалено стару тестову БД');
  }

  // Set environment for test
  process.env.DATABASE_PATH = TEST_DB_PATH;
  process.env.NODE_ENV = 'test';
  process.env.BOT_TOKEN = 'test_token';

  // Create test database
  const db = require('./src/database/db');

  console.log('✅ База даних створена');

  // Verify user_power_states table exists
  try {
    const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_power_states'").get();
    if (tableInfo) {
      console.log('✅ Таблиця user_power_states створена');
    } else {
      console.error('❌ Таблиця user_power_states не знайдена');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Помилка перевірки таблиці:', error.message);
    process.exit(1);
  }

  // Import functions to test
  const { saveUserStateToDb, saveAllUserStates, restoreUserStates } = require('./src/powerMonitor');

  // Test 1: Save user state to DB
  console.log('\n📝 Тест 1: Збереження стану користувача');
  const testState = {
    currentState: 'on',
    pendingState: 'off',
    pendingStateTime: new Date().toISOString(),
    lastStableState: 'on',
    lastStableAt: new Date().toISOString(),
    instabilityStart: null,
    switchCount: 0
  };

  try {
    saveUserStateToDb(12345, testState);
    console.log('✅ Стан користувача збережено');
  } catch (error) {
    console.error('❌ Помилка збереження:', error.message);
    process.exit(1);
  }

  // Test 2: Verify state was saved
  console.log('\n🔍 Тест 2: Перевірка збереженого стану');
  try {
    const savedState = db.prepare('SELECT * FROM user_power_states WHERE telegram_id = ?').get(12345);
    if (savedState) {
      console.log('✅ Стан знайдено в БД');
      console.log('   Current state:', savedState.current_state);
      console.log('   Pending state:', savedState.pending_state);
      console.log('   Switch count:', savedState.switch_count);
    } else {
      console.error('❌ Стан не знайдено в БД');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Помилка перевірки:', error.message);
    process.exit(1);
  }

  // Test 3: Save multiple user states
  console.log('\n📝 Тест 3: Збереження кількох станів');
  const mockUserStates = new Map();
  mockUserStates.set(54321, {
    currentState: 'off',
    pendingState: null,
    pendingStateTime: null,
    lastStableState: 'off',
    lastStableAt: new Date().toISOString(),
    instabilityStart: null,
    switchCount: 3
  });
  mockUserStates.set(11111, {
    currentState: 'on',
    pendingState: null,
    pendingStateTime: null,
    lastStableState: 'on',
    lastStableAt: new Date().toISOString(),
    instabilityStart: new Date().toISOString(),
    switchCount: 1
  });

  // Manually save states since we can't access the internal Map
  for (const [userId, state] of mockUserStates) {
    saveUserStateToDb(userId, state);
  }

  console.log('✅ Кілька станів збережено');

  // Test 4: Verify all states were saved
  console.log('\n🔍 Тест 4: Перевірка всіх збережених станів');
  try {
    const allStates = db.prepare('SELECT * FROM user_power_states').all();
    console.log(`✅ Знайдено ${allStates.length} станів в БД`);
    
    if (allStates.length !== 3) {
      console.error(`❌ Очікувалось 3 стани, знайдено ${allStates.length}`);
      process.exit(1);
    }
    
    for (const state of allStates) {
      console.log(`   User ${state.telegram_id}: ${state.current_state}, switches: ${state.switch_count}`);
    }
  } catch (error) {
    console.error('❌ Помилка перевірки:', error.message);
    process.exit(1);
  }

  // Test 5: Restore states from DB
  console.log('\n🔄 Тест 5: Відновлення станів з БД');
  try {
    const restoredCount = await restoreUserStates();
    if (restoredCount === 3) {
      console.log(`✅ Відновлено ${restoredCount} станів`);
    } else {
      console.error(`❌ Очікувалось 3 стани, відновлено ${restoredCount}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Помилка відновлення:', error.message);
    process.exit(1);
  }

  // Test 6: Test state expiry (only restore states updated within 1 hour)
  console.log('\n⏰ Тест 6: Перевірка застарілих станів');
  try {
    // Add an old state (more than 1 hour ago)
    db.prepare(`
      INSERT INTO user_power_states 
      (telegram_id, current_state, pending_state, updated_at)
      VALUES (99999, 'on', null, datetime('now', '-2 hours'))
    `).run();
    
    const restoredCount = await restoreUserStates();
    // Should still be 3, not 4, because the old state should be ignored
    if (restoredCount === 3) {
      console.log(`✅ Застарілі стани правильно проігноровано (відновлено ${restoredCount})`);
    } else {
      console.error(`❌ Очікувалось 3 стани (застарілий ігнорується), відновлено ${restoredCount}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Помилка тесту застарілих станів:', error.message);
    process.exit(1);
  }

  // Clean up
  console.log('\n🧹 Очищення');
  db.close();
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
    console.log('✅ Тестова БД видалена');
  }

  console.log('\n✨ Всі тести пройдено успішно!\n');
  process.exit(0);
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
