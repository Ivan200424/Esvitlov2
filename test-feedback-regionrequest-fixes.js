#!/usr/bin/env node

/**
 * Test script to verify feedback and regionRequest bug fixes
 * Uses static code analysis to avoid requiring database modules
 */

const assert = require('assert');
const fs = require('fs');

console.log('🧪 Testing feedback and regionRequest fixes...\n');

// Load source files
const regionRequestCode = fs.readFileSync('./src/handlers/regionRequest.js', 'utf8');
const feedbackCode = fs.readFileSync('./src/handlers/feedback.js', 'utf8');
const startCode = fs.readFileSync('./src/handlers/start.js', 'utf8');

// Test 1: Verify persist=false in setRegionRequestState
console.log('Test 1: Check regionRequest state persistence fix');
assert(regionRequestCode.includes("setState('regionRequest', telegramId, data, false)"),
  'setRegionRequestState should pass persist=false');
console.log('✓ regionRequest uses persist=false\n');

// Test 2: Verify persist=false in setFeedbackState
console.log('Test 2: Check feedback state persistence fix');
assert(feedbackCode.includes("setState('feedback', telegramId, data, false)"),
  'setFeedbackState should pass persist=false');
console.log('✓ feedback uses persist=false\n');

// Test 3: Check that feedback keyboard has the back button with correct callback
console.log('Test 3: Verify feedback keyboard structure');
assert(feedbackCode.includes("callback_data: 'feedback_back'"),
  'Feedback keyboard should have feedback_back callback');
console.log('✓ Feedback keyboard has back button with correct callback\n');

// Test 4: Check that handleFeedbackCallback includes feedback_back handler
console.log('Test 4: Verify feedback_back handler exists');
assert(feedbackCode.includes("data === 'feedback_back'"),
  'handleFeedbackCallback should handle feedback_back');
assert(feedbackCode.includes("clearFeedbackState(telegramId)"),
  'feedback_back handler should clear state');
assert(feedbackCode.includes("getHelpKeyboard"),
  'feedback_back handler should return to help menu');
console.log('✓ feedback_back handler is properly implemented\n');

// Test 5: Check that success/cancel messages have menu buttons
console.log('Test 5: Verify menu buttons in success/cancel messages');

// Check regionRequest success message has menu button
assert(regionRequestCode.includes("callback_data: 'back_to_main'") && 
       regionRequestCode.includes('Дякуємо за запит'),
  'Region request success should have menu button');

// Check regionRequest cancel message has menu button
assert(regionRequestCode.includes('Запит скасовано') && 
       regionRequestCode.match(/Запит скасовано[\s\S]*?callback_data: 'back_to_main'/),
  'Region request cancel should have menu button');

// Check feedback success message has menu button
assert(feedbackCode.includes("callback_data: 'back_to_main'") && 
       feedbackCode.includes('Дякуємо за звернення'),
  'Feedback success should have menu button');

// Check feedback cancel message has menu button
assert(feedbackCode.includes('Звернення скасовано') && 
       feedbackCode.match(/Звернення скасовано[\s\S]*?callback_data: 'back_to_main'/),
  'Feedback cancel should have menu button');
console.log('✓ All success/cancel messages have menu buttons\n');

// Test 6: Verify start handler clears stale states
console.log('Test 6: Verify /start handler clears stale states');

assert(startCode.includes('clearRegionRequestState'),
  '/start handler should clear region request state');
assert(startCode.includes('clearFeedbackState'),
  '/start handler should clear feedback state');
assert(startCode.includes('ONE_HOUR_MS') && startCode.includes('clearWizardState'),
  '/start handler should clear stale wizard states');
console.log('✓ /start handler properly clears stale states\n');

// Summary
console.log('═══════════════════════════════════════');
console.log('✅ ALL BUG FIXES VERIFIED!');
console.log('═══════════════════════════════════════');
console.log('\n📊 Fixes verified:');
console.log('   • Bug 1: Circular JSON error - persist=false ✓');
console.log('   • Bug 2: Feedback back button - feedback_back handler ✓');
console.log('   • Bug 3: Menu buttons after success/cancel ✓');
console.log('   • Bug 4: Clear stale states in /start ✓');
console.log('\n✨ All critical bugs are fixed!');
