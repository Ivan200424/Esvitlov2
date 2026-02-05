/**
 * Test for Enhanced Admin Panel Implementation
 * 
 * Tests:
 * 1. Database tables creation (pause_log, admin_action_log)
 * 2. Pause mode with types (update, emergency, testing)
 * 3. Pause action logging
 * 4. Admin action logging for debounce and intervals
 * 5. Guards functions with pause types
 * 6. Keyboard generation with new options
 */

const assert = require('assert');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'test_token';
process.env.DATABASE_PATH = ':memory:';

console.log('🧪 Starting Enhanced Admin Panel Tests\n');

// Test 1: Database tables and functions
console.log('Test 1: Database Schema');
try {
  const db = require('./src/database/db');
  
  // Check if new tables exist by trying to query them
  const pauseLogQuery = db.prepare('SELECT name FROM sqlite_master WHERE type="table" AND name="pause_log"');
  const adminActionLogQuery = db.prepare('SELECT name FROM sqlite_master WHERE type="table" AND name="admin_action_log"');
  
  const pauseLogExists = pauseLogQuery.get();
  const adminActionLogExists = adminActionLogQuery.get();
  
  assert.ok(pauseLogExists, 'pause_log table should exist');
  assert.ok(adminActionLogExists, 'admin_action_log table should exist');
  
  console.log('✅ pause_log table exists');
  console.log('✅ admin_action_log table exists');
  
  // Test logging functions
  const testAdminId = 'test_admin_123';
  const testUsername = 'test_admin';
  
  // Test pause action logging
  const pauseLogResult = db.logPauseAction(
    testAdminId,
    testUsername,
    'enable',
    'update',
    'Test pause message',
    null
  );
  assert.ok(pauseLogResult, 'logPauseAction should succeed');
  console.log('✅ Pause action logging works');
  
  // Test admin action logging
  const adminLogResult = db.logAdminAction(
    testAdminId,
    testUsername,
    'debounce_change',
    'Test action',
    '5',
    '10',
    true,
    null
  );
  assert.ok(adminLogResult, 'logAdminAction should succeed');
  console.log('✅ Admin action logging works');
  
  // Test history retrieval
  const pauseHistory = db.getPauseHistory(10);
  assert.ok(Array.isArray(pauseHistory), 'getPauseHistory should return array');
  assert.ok(pauseHistory.length > 0, 'Should have at least one pause log entry');
  console.log(`✅ Retrieved ${pauseHistory.length} pause log entries`);
  
  const adminHistory = db.getAdminActionHistory(10);
  assert.ok(Array.isArray(adminHistory), 'getAdminActionHistory should return array');
  assert.ok(adminHistory.length > 0, 'Should have at least one admin action entry');
  console.log(`✅ Retrieved ${adminHistory.length} admin action entries`);
  
} catch (error) {
  console.error('❌ Database test failed:', error.message);
  process.exit(1);
}

console.log('\n' + '='.repeat(60) + '\n');

// Test 2: Guards functions
console.log('Test 2: Guards Functions');
try {
  const guards = require('./src/utils/guards');
  const db = require('./src/database/db');
  
  // Test without pause
  db.setSetting('bot_paused', '0');
  assert.strictEqual(guards.isBotPaused(), false, 'Should not be paused');
  console.log('✅ isBotPaused() works when not paused');
  
  // Test with pause - update type
  db.setSetting('bot_paused', '1');
  db.setSetting('pause_type', 'update');
  db.setSetting('pause_message', 'Test pause message');
  
  assert.strictEqual(guards.isBotPaused(), true, 'Should be paused');
  assert.strictEqual(guards.getPauseType(), 'update', 'Should return correct pause type');
  console.log('✅ isBotPaused() works when paused');
  console.log('✅ getPauseType() returns correct type');
  
  const pauseMessage = guards.getPauseMessage();
  assert.ok(pauseMessage.includes('Test pause message') || pauseMessage.startsWith('🛠'), 'Message should include emoji or text');
  console.log('✅ getPauseMessage() returns formatted message');
  
  // Test checkPauseForWizard
  const wizardCheck = guards.checkPauseForWizard();
  assert.strictEqual(wizardCheck.blocked, true, 'Wizard should be blocked');
  assert.ok(wizardCheck.message, 'Should have message');
  assert.strictEqual(wizardCheck.pauseType, 'update', 'Should have pause type');
  console.log('✅ checkPauseForWizard() blocks correctly');
  
  // Test checkPauseForChannelActions
  const channelCheck = guards.checkPauseForChannelActions();
  assert.strictEqual(channelCheck.blocked, true, 'Channel actions should be blocked');
  assert.ok(channelCheck.message, 'Should have message');
  console.log('✅ checkPauseForChannelActions() blocks correctly');
  
  // Test different pause types
  const pauseTypes = ['update', 'emergency', 'testing'];
  for (const type of pauseTypes) {
    db.setSetting('pause_type', type);
    const check = guards.checkPauseForWizard();
    assert.strictEqual(check.pauseType, type, `Should return ${type} pause type`);
    assert.ok(check.message.length > 0, `Should have message for ${type}`);
    console.log(`✅ Pause type "${type}" works correctly`);
  }
  
  // Clean up
  db.setSetting('bot_paused', '0');
  db.setSetting('pause_type', null);
  
} catch (error) {
  console.error('❌ Guards test failed:', error.message);
  process.exit(1);
}

console.log('\n' + '='.repeat(60) + '\n');

// Test 3: Keyboard functions
console.log('Test 3: Keyboard Functions');
try {
  const keyboards = require('./src/keyboards/inline');
  
  // Test getPauseMenuKeyboard with type
  const pauseMenu = keyboards.getPauseMenuKeyboard(true, 'update');
  assert.ok(pauseMenu.reply_markup, 'Should have reply_markup');
  assert.ok(pauseMenu.reply_markup.inline_keyboard, 'Should have inline_keyboard');
  assert.ok(pauseMenu.reply_markup.inline_keyboard.length > 0, 'Should have buttons');
  console.log('✅ getPauseMenuKeyboard() works with pause type');
  
  // Test getPauseTypeKeyboard
  const typeMenu = keyboards.getPauseTypeKeyboard();
  assert.ok(typeMenu.reply_markup.inline_keyboard.length >= 4, 'Should have at least 4 rows (3 types + cancel)');
  console.log('✅ getPauseTypeKeyboard() generates correct options');
  
  // Test getPauseDisableConfirmKeyboard
  const confirmMenu = keyboards.getPauseDisableConfirmKeyboard();
  assert.ok(confirmMenu.reply_markup.inline_keyboard.length >= 2, 'Should have confirm and cancel buttons');
  console.log('✅ getPauseDisableConfirmKeyboard() works');
  
  // Test getDebounceConfirmKeyboard
  const debounceConfirm = keyboards.getDebounceConfirmKeyboard(5);
  assert.ok(debounceConfirm.reply_markup.inline_keyboard.length >= 2, 'Should have confirm and cancel');
  console.log('✅ getDebounceConfirmKeyboard() works');
  
  // Test getScheduleIntervalConfirmKeyboard
  const scheduleConfirm = keyboards.getScheduleIntervalConfirmKeyboard(10);
  assert.ok(scheduleConfirm.reply_markup.inline_keyboard.length >= 2, 'Should have confirm and cancel');
  console.log('✅ getScheduleIntervalConfirmKeyboard() works');
  
  // Test getIpIntervalConfirmKeyboard
  const ipConfirm = keyboards.getIpIntervalConfirmKeyboard(30);
  assert.ok(ipConfirm.reply_markup.inline_keyboard.length >= 2, 'Should have confirm and cancel');
  console.log('✅ getIpIntervalConfirmKeyboard() works');
  
} catch (error) {
  console.error('❌ Keyboard test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}

console.log('\n' + '='.repeat(60) + '\n');

// Test 4: Settings and configuration
console.log('Test 4: Settings Management');
try {
  const db = require('./src/database/db');
  
  // Test pause settings
  db.setSetting('bot_paused', '1');
  db.setSetting('pause_type', 'emergency');
  db.setSetting('pause_message', 'Emergency maintenance');
  db.setSetting('pause_started_at', String(Math.floor(Date.now() / 1000)));
  
  assert.strictEqual(db.getSetting('bot_paused'), '1', 'Should save pause state');
  assert.strictEqual(db.getSetting('pause_type'), 'emergency', 'Should save pause type');
  assert.ok(db.getSetting('pause_started_at'), 'Should save pause start time');
  console.log('✅ Pause settings saved correctly');
  
  // Test debounce setting
  db.setSetting('power_debounce_minutes', '10');
  assert.strictEqual(db.getSetting('power_debounce_minutes'), '10', 'Should save debounce');
  console.log('✅ Debounce setting saved correctly');
  
  // Test interval settings
  db.setSetting('schedule_check_interval', '300');
  db.setSetting('power_check_interval', '10');
  assert.strictEqual(db.getSetting('schedule_check_interval'), '300', 'Should save schedule interval');
  assert.strictEqual(db.getSetting('power_check_interval'), '10', 'Should save power interval');
  console.log('✅ Interval settings saved correctly');
  
  // Clean up
  db.setSetting('bot_paused', '0');
  
} catch (error) {
  console.error('❌ Settings test failed:', error.message);
  process.exit(1);
}

console.log('\n' + '='.repeat(60) + '\n');

// Test 5: Logging completeness
console.log('Test 5: Logging System Verification');
try {
  const db = require('./src/database/db');
  
  // Log multiple pause actions
  db.logPauseAction('admin1', 'user1', 'enable', 'update', 'Starting update', null);
  db.logPauseAction('admin1', 'user1', 'disable', 'update', null, 3600);
  db.logPauseAction('admin2', 'user2', 'enable', 'emergency', 'Emergency!', null);
  
  // Log multiple admin actions
  db.logAdminAction('admin1', 'user1', 'debounce_change', 'Changed debounce', '5', '10', true, null);
  db.logAdminAction('admin1', 'user1', 'schedule_interval_change', 'Changed schedule', '60', '300', true, null);
  db.logAdminAction('admin2', 'user2', 'ip_interval_change', 'Changed IP interval', '2', '10', true, null);
  
  // Retrieve and verify
  const pauseHistory = db.getPauseHistory(10);
  const adminHistory = db.getAdminActionHistory(10);
  
  assert.ok(pauseHistory.length >= 3, 'Should have at least 3 pause log entries');
  assert.ok(adminHistory.length >= 3, 'Should have at least 3 admin action entries');
  
  // Verify pause log structure
  const pauseEntry = pauseHistory[0];
  assert.ok(pauseEntry.id, 'Pause log should have id');
  assert.ok(pauseEntry.admin_id, 'Pause log should have admin_id');
  assert.ok(pauseEntry.action, 'Pause log should have action');
  assert.ok(pauseEntry.created_at, 'Pause log should have created_at');
  console.log('✅ Pause log entries have correct structure');
  
  // Verify admin action log structure
  const actionEntry = adminHistory[0];
  assert.ok(actionEntry.id, 'Admin action should have id');
  assert.ok(actionEntry.admin_id, 'Admin action should have admin_id');
  assert.ok(actionEntry.action_type, 'Admin action should have action_type');
  assert.ok(actionEntry.created_at, 'Admin action should have created_at');
  console.log('✅ Admin action entries have correct structure');
  
  console.log(`✅ Logged ${pauseHistory.length} pause actions`);
  console.log(`✅ Logged ${adminHistory.length} admin actions`);
  
} catch (error) {
  console.error('❌ Logging verification failed:', error.message);
  process.exit(1);
}

console.log('\n' + '='.repeat(60) + '\n');

console.log('🎉 All tests passed!\n');
console.log('Summary:');
console.log('  ✅ Database schema with audit tables');
console.log('  ✅ Pause mode with types (update/emergency/testing)');
console.log('  ✅ Pause action logging');
console.log('  ✅ Admin action logging');
console.log('  ✅ Guards functions with type awareness');
console.log('  ✅ Keyboard generation with confirmations');
console.log('  ✅ Settings management');
console.log('  ✅ Logging system completeness\n');

console.log('✅ Enhanced Admin Panel Implementation: COMPLETE');
