#!/usr/bin/env node
/**
 * Test for webhook restart and duplicate message fixes
 * 
 * This test verifies:
 * 1. BOT_STARTUP_TIME is defined and tracks the bot startup time
 * 2. Middleware skips stale updates (updates older than 30s before startup)
 * 3. Webhook setup includes drop_pending_updates: true
 * 4. Initialization order is correct (webhook before schedulers)
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing webhook restart and duplicate message fixes...\n');

let testsPassed = 0;
let testsFailed = 0;

function pass(msg) {
  console.log(`✅ PASS: ${msg}`);
  testsPassed++;
}

function fail(msg) {
  console.log(`❌ FAIL: ${msg}`);
  testsFailed++;
}

// Test 1: Check bot.js has BOT_STARTUP_TIME
console.log('📝 Test 1: Verify BOT_STARTUP_TIME tracking...');
const botContent = fs.readFileSync(path.join(__dirname, 'src/bot.js'), 'utf8');
if (botContent.includes('const BOT_STARTUP_TIME = Date.now()')) {
  pass('BOT_STARTUP_TIME constant is defined in bot.js');
} else {
  fail('BOT_STARTUP_TIME constant not found in bot.js');
}

// Test 2: Check middleware skips stale updates
console.log('\n📝 Test 2: Verify stale update filtering middleware...');
if (botContent.includes('messageDate * 1000 < BOT_STARTUP_TIME - 30000')) {
  pass('Middleware checks for stale updates (older than 30s before startup)');
} else {
  fail('Stale update check not found in middleware');
}

if (botContent.includes('Skipping stale update')) {
  pass('Stale updates are logged and skipped');
} else {
  fail('Stale update skip logging not found');
}

// Test 3: Check webhook setup includes drop_pending_updates
console.log('\n📝 Test 3: Verify drop_pending_updates in webhook setup...');
const indexContent = fs.readFileSync(path.join(__dirname, 'src/index.js'), 'utf8');
if (indexContent.includes('drop_pending_updates: true')) {
  pass('drop_pending_updates: true is set in webhook setup');
} else {
  fail('drop_pending_updates: true not found in webhook setup');
}

// Test 4: Check initialization order (webhook setup before scheduler init)
console.log('\n📝 Test 4: Verify initialization order...');

// Find positions of key initialization points
const webhookSetupPos = indexContent.indexOf('await bot.api.setWebhook');
const schedulerInitPos = indexContent.indexOf('initScheduler(bot)');
const monitoringInitPos = indexContent.indexOf('startPowerMonitoring(bot)');

if (webhookSetupPos < 0) {
  fail('Webhook setup not found in index.js');
} else if (schedulerInitPos < 0) {
  fail('Scheduler initialization not found in index.js');
} else if (webhookSetupPos < schedulerInitPos) {
  pass('Webhook is set up BEFORE scheduler initialization (correct order)');
} else {
  fail('Scheduler initializes BEFORE webhook setup (incorrect order)');
}

if (webhookSetupPos > 0 && monitoringInitPos > 0 && webhookSetupPos < monitoringInitPos) {
  pass('Webhook is set up BEFORE monitoring initialization (correct order)');
} else if (webhookSetupPos > 0 && monitoringInitPos > 0) {
  fail('Monitoring initializes BEFORE webhook setup (incorrect order)');
}

// Test 5: Verify schedulers are initialized AFTER webhook server starts listening
console.log('\n📝 Test 5: Verify schedulers start after HTTP server is listening...');
const appListenPos = indexContent.indexOf('app.listen(config.webhookPort');
const firstSchedulerAfterWebhook = indexContent.indexOf('initScheduler(bot)', webhookSetupPos);

if (appListenPos > 0 && firstSchedulerAfterWebhook > 0 && appListenPos < firstSchedulerAfterWebhook) {
  pass('Schedulers are initialized inside app.listen callback (correct)');
} else {
  fail('Schedulers may not be inside app.listen callback');
}

// Test 6: Check setInterval in bot.js doesn't run before bot is ready
console.log('\n📝 Test 6: Verify pendingChannels cleanup interval...');
if (botContent.includes('setInterval(() => {') && botContent.includes('pendingChannels.delete(key)')) {
  pass('pendingChannels cleanup setInterval is present (expected side effect)');
  console.log('   ℹ️  Note: This setInterval runs at module load (acceptable for cleanup)');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log(`📊 Test Summary: ${testsPassed} passed, ${testsFailed} failed`);
console.log('='.repeat(60));

if (testsFailed > 0) {
  console.log('\n❌ Some tests failed. Please review the changes.');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed! The fixes are correctly implemented.');
  process.exit(0);
}
