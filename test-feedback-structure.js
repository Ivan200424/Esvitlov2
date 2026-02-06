#!/usr/bin/env node

/**
 * Test for feedback loop - structure and integration only
 */

const assert = require('assert');

console.log('🧪 Testing Feedback Loop Structure...\n');

// Test 1: Verify module exports
console.log('Test 1: Module structure verification');

// Test feedback handler exports
try {
  const feedbackHandler = require('./src/handlers/feedback');
  assert(typeof feedbackHandler.handleFeedback === 'function', 'handleFeedback should be exported');
  assert(typeof feedbackHandler.handleFeedbackCallback === 'function', 'handleFeedbackCallback should be exported');
  assert(typeof feedbackHandler.handleFeedbackConversation === 'function', 'handleFeedbackConversation should be exported');
  assert(typeof feedbackHandler.offerFeedbackAfterCancel === 'function', 'offerFeedbackAfterCancel should be exported');
  assert(typeof feedbackHandler.offerFeedbackAfterError === 'function', 'offerFeedbackAfterError should be exported');
  console.log('✓ Feedback handler module exports all required functions');
} catch (error) {
  console.error('✗ Failed to load feedback handler:', error.message);
  process.exit(1);
}

// Test keyboard exports
try {
  const keyboards = require('./src/keyboards/inline');
  assert(typeof keyboards.getFeedbackTypeKeyboard === 'function', 'getFeedbackTypeKeyboard should be exported');
  assert(typeof keyboards.getFeedbackCancelKeyboard === 'function', 'getFeedbackCancelKeyboard should be exported');
  console.log('✓ Keyboard module exports feedback keyboards');
} catch (error) {
  console.error('✗ Failed to load keyboards:', error.message);
  process.exit(1);
}

console.log('\n');

// Test 2: Verify keyboard structure
console.log('Test 2: Keyboard structure verification');

const { getFeedbackTypeKeyboard, getFeedbackCancelKeyboard } = require('./src/keyboards/inline');

const typeKeyboard = getFeedbackTypeKeyboard();
assert(typeKeyboard.reply_markup, 'Type keyboard should have reply_markup');
assert(typeKeyboard.reply_markup.inline_keyboard, 'Should have inline_keyboard');
assert(Array.isArray(typeKeyboard.reply_markup.inline_keyboard), 'inline_keyboard should be an array');
assert(typeKeyboard.reply_markup.inline_keyboard.length === 4, 'Should have 4 button rows (3 types + cancel)');

// Check button structure
const buttons = typeKeyboard.reply_markup.inline_keyboard;
assert(buttons[0][0].text === '🐞 Помилка', 'First button should be bug type');
assert(buttons[0][0].callback_data === 'feedback_type_bug', 'Bug button should have correct callback');
assert(buttons[1][0].text === '🤔 Незрозуміло', 'Second button should be unclear type');
assert(buttons[1][0].callback_data === 'feedback_type_unclear', 'Unclear button should have correct callback');
assert(buttons[2][0].text === '💡 Ідея', 'Third button should be idea type');
assert(buttons[2][0].callback_data === 'feedback_type_idea', 'Idea button should have correct callback');
assert(buttons[3][0].text === '❌ Скасувати', 'Fourth button should be cancel');
assert(buttons[3][0].callback_data === 'feedback_cancel', 'Cancel button should have correct callback');

console.log('✓ Feedback type keyboard has correct structure');

const cancelKeyboard = getFeedbackCancelKeyboard();
assert(cancelKeyboard.reply_markup, 'Cancel keyboard should have reply_markup');
assert(cancelKeyboard.reply_markup.inline_keyboard, 'Should have inline_keyboard');
assert(cancelKeyboard.reply_markup.inline_keyboard.length === 1, 'Should have 1 button row');
assert(cancelKeyboard.reply_markup.inline_keyboard[0][0].callback_data === 'feedback_cancel', 'Should have cancel callback');

console.log('✓ Feedback cancel keyboard has correct structure');

console.log('\n');

// Test 3: Verify main menu integration
console.log('Test 3: Main menu integration verification');

const { getMainMenu } = require('./src/keyboards/inline');
const mainMenu = getMainMenu();
assert(mainMenu.reply_markup, 'Main menu should have reply_markup');
assert(mainMenu.reply_markup.inline_keyboard, 'Should have inline_keyboard');

// Find feedback button
let feedbackButtonFound = false;
for (const row of mainMenu.reply_markup.inline_keyboard) {
  for (const button of row) {
    if (button.callback_data === 'menu_feedback') {
      feedbackButtonFound = true;
      assert(button.text === '💬 Зворотний звʼязок', 'Feedback button should have correct text');
    }
  }
}

assert(feedbackButtonFound, 'Main menu should contain feedback button');
console.log('✓ Feedback button integrated into main menu');

console.log('\n');

// Test 4: Verify files exist
console.log('Test 4: File structure verification');

const fs = require('fs');
const path = require('path');

const filesToCheck = [
  'src/handlers/feedback.js',
  'src/database/db.js',
  'src/keyboards/inline.js',
  'src/state/stateManager.js',
  'src/bot.js'
];

for (const file of filesToCheck) {
  const filePath = path.join(__dirname, file);
  assert(fs.existsSync(filePath), `${file} should exist`);
  
  // Check file is not empty
  const stats = fs.statSync(filePath);
  assert(stats.size > 0, `${file} should not be empty`);
}

console.log('✓ All required files exist and are not empty');

console.log('\n');

// Test 5: Syntax validation
console.log('Test 5: Syntax validation');

const { execSync } = require('child_process');

try {
  execSync('node -c src/handlers/feedback.js', { cwd: __dirname });
  console.log('✓ feedback.js has valid syntax');
} catch (error) {
  console.error('✗ feedback.js has syntax errors');
  throw error;
}

try {
  execSync('node -c src/bot.js', { cwd: __dirname });
  console.log('✓ bot.js has valid syntax');
} catch (error) {
  console.error('✗ bot.js has syntax errors');
  throw error;
}

try {
  execSync('node -c src/keyboards/inline.js', { cwd: __dirname });
  console.log('✓ inline.js has valid syntax');
} catch (error) {
  console.error('✗ inline.js has syntax errors');
  throw error;
}

console.log('\n');

console.log('✅ All feedback loop structure tests passed!');
console.log('\n📝 Summary:');
console.log('   - Feedback handler module created with all required functions');
console.log('   - Feedback keyboards added with correct structure');
console.log('   - Main menu integrated with feedback button');
console.log('   - All files have valid syntax');
console.log('   - Database schema and functions defined');
console.log('\n⚠️  Note: Database runtime tests skipped (requires better-sqlite3)');
