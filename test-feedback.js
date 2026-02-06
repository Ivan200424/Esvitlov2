#!/usr/bin/env node

/**
 * Test for feedback loop functionality
 */

const assert = require('assert');

console.log('🧪 Testing Feedback Loop...\n');

// Test 1: Database functions
console.log('Test 1: Database functions');
const {
  saveFeedback,
  updateFeedbackStats,
  getFeedbackStats,
  canSubmitFeedback,
  getAllFeedback,
  getFeedbackByType,
  getFeedbackCount
} = require('./src/database/db');

// Test canSubmitFeedback for new user (should be allowed)
const testUserId = 'test_user_' + Date.now();
const permission1 = canSubmitFeedback(testUserId);
assert.strictEqual(permission1.allowed, true, 'New user should be allowed to submit feedback');
console.log('✓ New user can submit feedback');

// Test saving feedback
const feedbackId = saveFeedback(testUserId, 'test_username', 'bug', 'This is a test feedback', 'test_context', { data: 'test' });
assert(feedbackId, 'Feedback should be saved and return an ID');
console.log('✓ Feedback saved successfully');

// Update stats
const statsUpdated = updateFeedbackStats(testUserId);
assert.strictEqual(statsUpdated, true, 'Stats should be updated');
console.log('✓ Feedback stats updated');

// Test rate limiting
const permission2 = canSubmitFeedback(testUserId);
assert.strictEqual(permission2.allowed, false, 'User should be rate limited immediately after feedback');
assert.strictEqual(permission2.reason, 'rate_limit', 'Reason should be rate_limit');
console.log('✓ Rate limiting works correctly');

// Test getting feedback
const allFeedback = getAllFeedback();
assert(Array.isArray(allFeedback), 'getAllFeedback should return an array');
assert(allFeedback.length > 0, 'Should have at least our test feedback');
console.log('✓ Can retrieve all feedback');

// Test getting feedback by type
const bugFeedback = getFeedbackByType('bug');
assert(Array.isArray(bugFeedback), 'getFeedbackByType should return an array');
assert(bugFeedback.length > 0, 'Should have at least our test bug feedback');
console.log('✓ Can retrieve feedback by type');

// Test feedback count
const count = getFeedbackCount();
assert(typeof count === 'number', 'Count should be a number');
assert(count > 0, 'Count should be greater than 0');
console.log('✓ Can get feedback count');

console.log('\n');

// Test 2: Keyboard functions
console.log('Test 2: Keyboard functions');
const { getFeedbackTypeKeyboard, getFeedbackCancelKeyboard } = require('./src/keyboards/inline');

const typeKeyboard = getFeedbackTypeKeyboard();
assert(typeKeyboard.reply_markup, 'Type keyboard should have reply_markup');
assert(typeKeyboard.reply_markup.inline_keyboard, 'Should have inline_keyboard');
assert(typeKeyboard.reply_markup.inline_keyboard.length === 4, 'Should have 4 buttons (3 types + cancel)');
console.log('✓ Feedback type keyboard is correct');

const cancelKeyboard = getFeedbackCancelKeyboard();
assert(cancelKeyboard.reply_markup, 'Cancel keyboard should have reply_markup');
assert(cancelKeyboard.reply_markup.inline_keyboard, 'Should have inline_keyboard');
assert(cancelKeyboard.reply_markup.inline_keyboard.length === 1, 'Should have 1 cancel button');
console.log('✓ Feedback cancel keyboard is correct');

console.log('\n');

// Test 3: State management
console.log('Test 3: State management');
const { getState, setState, clearState, hasState } = require('./src/state/stateManager');

const testStateUserId = 'state_test_' + Date.now();
setState('feedback', testStateUserId, { step: 'type_selection', timestamp: Date.now() });

const state = getState('feedback', testStateUserId);
assert(state, 'Should be able to retrieve feedback state');
assert.strictEqual(state.step, 'type_selection', 'State should have correct step');
console.log('✓ Can set and get feedback state');

const hasStateResult = hasState('feedback', testStateUserId);
assert.strictEqual(hasStateResult, true, 'Should detect that state exists');
console.log('✓ Can check if state exists');

clearState('feedback', testStateUserId);
const clearedState = getState('feedback', testStateUserId);
assert.strictEqual(clearedState, null, 'State should be cleared');
console.log('✓ Can clear feedback state');

console.log('\n');

// Test 4: Handler module import
console.log('Test 4: Handler module');
const feedbackHandler = require('./src/handlers/feedback');

assert(typeof feedbackHandler.handleFeedback === 'function', 'handleFeedback should be a function');
assert(typeof feedbackHandler.handleFeedbackCallback === 'function', 'handleFeedbackCallback should be a function');
assert(typeof feedbackHandler.handleFeedbackConversation === 'function', 'handleFeedbackConversation should be a function');
assert(typeof feedbackHandler.offerFeedbackAfterCancel === 'function', 'offerFeedbackAfterCancel should be a function');
assert(typeof feedbackHandler.offerFeedbackAfterError === 'function', 'offerFeedbackAfterError should be a function');
console.log('✓ All feedback handler functions exported correctly');

console.log('\n');

console.log('✅ All feedback loop tests passed!');
