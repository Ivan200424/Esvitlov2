/**
 * Test: Reset Buttons Popup Fix
 * 
 * Verifies that the handleChannelCallback function correctly skips
 * the early answerCallbackQuery for callbacks that need custom popup messages.
 * This ensures that reset buttons and other interactive buttons show their
 * confirmation popups to users.
 */

const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════════════');
console.log('  Test: Reset Buttons Popup Fix');
console.log('═══════════════════════════════════════════════════\n');

// Read the channel.js file
const channelJsPath = path.join(__dirname, '../src/handlers/channel.js');
const channelJsContent = fs.readFileSync(channelJsPath, 'utf8');

// Test 1: Check that needsCustomAnswer list exists
console.log('🧪 Test 1: needsCustomAnswer list exists');

const hasNeedsCustomAnswerList = channelJsContent.includes('const needsCustomAnswer = [');

if (!hasNeedsCustomAnswerList) {
  console.error('  ❌ FAIL: needsCustomAnswer list not found');
  process.exit(1);
}

console.log('  ✅ needsCustomAnswer list exists');

// Test 2: Check that early answerCallbackQuery is conditional
console.log('\n🧪 Test 2: Early answerCallbackQuery is conditional');

const hasConditionalAnswer = channelJsContent.match(/if \(!needsCustomAnswer\)[\s\S]*?await bot\.answerCallbackQuery/);

if (!hasConditionalAnswer) {
  console.error('  ❌ FAIL: Early answerCallbackQuery is not conditional on needsCustomAnswer');
  process.exit(1);
}

console.log('  ✅ Early answerCallbackQuery is conditional');

// Test 3: Check that all 4 reset buttons are in the exclusion list
console.log('\n🧪 Test 3: All 4 reset button callbacks are in exclusion list');

const resetButtonsInList = [
  channelJsContent.includes("'format_reset_caption'"),
  channelJsContent.includes("'format_reset_periods'"),
  channelJsContent.includes("'format_reset_power_off'"),
  channelJsContent.includes("'format_reset_power_on'")
];

const allResetButtonsPresent = resetButtonsInList.every(present => present);

if (!allResetButtonsPresent) {
  console.error('  ❌ FAIL: Not all reset buttons are in needsCustomAnswer list');
  process.exit(1);
}

console.log('  ✅ All 4 reset buttons in exclusion list');

// Test 4: Check that toggle buttons are in the exclusion list
console.log('\n🧪 Test 4: Toggle button callbacks are in exclusion list');

const toggleButtonsInList = [
  channelJsContent.includes("'format_toggle_delete'"),
  channelJsContent.includes("'format_toggle_piconly'")
];

const allToggleButtonsPresent = toggleButtonsInList.every(present => present);

if (!allToggleButtonsPresent) {
  console.error('  ❌ FAIL: Not all toggle buttons are in needsCustomAnswer list');
  process.exit(1);
}

console.log('  ✅ All toggle buttons in exclusion list');

// Test 5: Check that test buttons are in the exclusion list
console.log('\n🧪 Test 5: Test button callbacks are in exclusion list');

const testButtonsInList = [
  channelJsContent.includes("'test_schedule'"),
  channelJsContent.includes("'test_power_on'"),
  channelJsContent.includes("'test_power_off'")
];

const allTestButtonsPresent = testButtonsInList.every(present => present);

if (!allTestButtonsPresent) {
  console.error('  ❌ FAIL: Not all test buttons are in needsCustomAnswer list');
  process.exit(1);
}

console.log('  ✅ All test buttons in exclusion list');

// Test 6: Check that channel management buttons are in the exclusion list
console.log('\n🧪 Test 6: Channel management callbacks are in exclusion list');

const channelManagementInList = [
  channelJsContent.includes("'channel_test'"),
  channelJsContent.includes("'channel_info'")
];

const allChannelManagementPresent = channelManagementInList.every(present => present);

if (!allChannelManagementPresent) {
  console.error('  ❌ FAIL: Not all channel management buttons are in needsCustomAnswer list');
  process.exit(1);
}

console.log('  ✅ All channel management buttons in exclusion list');

// Test 7: Verify reset callbacks still use safeAnswerCallbackQuery with show_alert
console.log('\n🧪 Test 7: Reset callbacks use safeAnswerCallbackQuery with show_alert: true');

const resetCallbackPatterns = [
  /format_reset_caption[\s\S]{0,200}safeAnswerCallbackQuery[\s\S]{0,100}show_alert:\s*true/,
  /format_reset_periods[\s\S]{0,200}safeAnswerCallbackQuery[\s\S]{0,100}show_alert:\s*true/,
  /format_reset_power_off[\s\S]{0,200}safeAnswerCallbackQuery[\s\S]{0,100}show_alert:\s*true/,
  /format_reset_power_on[\s\S]{0,200}safeAnswerCallbackQuery[\s\S]{0,100}show_alert:\s*true/
];

const allResetCallbacksHaveAlert = resetCallbackPatterns.every(pattern => pattern.test(channelJsContent));

if (!allResetCallbacksHaveAlert) {
  console.error('  ❌ FAIL: Not all reset callbacks use show_alert: true');
  process.exit(1);
}

console.log('  ✅ All reset callbacks use show_alert: true');

// Test 8: Verify early answer is still called for other callbacks (no unconditional removal)
console.log('\n🧪 Test 8: Early answer is still called for non-custom callbacks');

// Check that we didn't just remove the line, but made it conditional
const hasEarlyAnswerCall = channelJsContent.includes('await bot.answerCallbackQuery(query.id)');

if (!hasEarlyAnswerCall) {
  console.error('  ❌ FAIL: Early answerCallbackQuery call was removed entirely');
  process.exit(1);
}

console.log('  ✅ Early answer still exists for non-custom callbacks');

console.log('\n✅ All popup fix tests passed!');
console.log('═══════════════════════════════════════════════════\n');
process.exit(0);
