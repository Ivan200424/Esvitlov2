#!/usr/bin/env node
const path = require('path');

/**
 * Test script to verify region request navigation during wizard flow
 * Uses static code analysis to avoid requiring database modules
 */

const assert = require('assert');
const fs = require('fs');

console.log('🧪 Testing wizard region request navigation fix...\n');

// Load source file
const regionRequestCode = fs.readFileSync(path.join(__dirname, '../src/handlers/regionRequest.js'), 'utf8');

// Test 1: Check handleRegionRequestConfirm has wizard state check
console.log('Test 1: Verify handleRegionRequestConfirm checks wizard state');
assert(
  regionRequestCode.includes("const wizardState = getState('wizard', telegramId);") &&
  regionRequestCode.includes("const isInWizardFlow = !!(wizardState && wizardState.step);"),
  'handleRegionRequestConfirm should check wizard state'
);
console.log('✓ handleRegionRequestConfirm checks wizard state\n');

// Test 2: Check handleRegionRequestConfirm has conditional navigation button
console.log('Test 2: Verify handleRegionRequestConfirm has conditional navigation');
assert(
  regionRequestCode.includes("const navigationButton = isInWizardFlow") &&
  regionRequestCode.includes("? [{ text: '← Назад', callback_data: 'back_to_region' }]") &&
  regionRequestCode.includes(": [{ text: '⤴ Меню', callback_data: 'back_to_main' }]"),
  'handleRegionRequestConfirm should have conditional navigation button'
);
console.log('✓ handleRegionRequestConfirm has conditional navigation\n');

// Test 3: Check handleRegionRequestCancel has wizard state check
console.log('Test 3: Verify handleRegionRequestCancel checks wizard state');
const cancelFunctionMatch = regionRequestCode.match(/async function handleRegionRequestCancel[\s\S]*?^}/m);
assert(cancelFunctionMatch, 'handleRegionRequestCancel function should exist');
const cancelFunction = cancelFunctionMatch[0];
assert(
  cancelFunction.includes("const wizardState = getState('wizard', telegramId);") &&
  cancelFunction.includes("const isInWizardFlow = !!(wizardState && wizardState.step);"),
  'handleRegionRequestCancel should check wizard state'
);
console.log('✓ handleRegionRequestCancel checks wizard state\n');

// Test 4: Check handleRegionRequestCancel has conditional navigation button
console.log('Test 4: Verify handleRegionRequestCancel has conditional navigation');
assert(
  cancelFunction.includes("const navigationButton = isInWizardFlow") &&
  cancelFunction.includes("? [{ text: '← Назад', callback_data: 'back_to_region' }]") &&
  cancelFunction.includes(": [{ text: '⤴ Меню', callback_data: 'back_to_main' }]"),
  'handleRegionRequestCancel should have conditional navigation button'
);
console.log('✓ handleRegionRequestCancel has conditional navigation\n');

// Test 5: Check timeout handler has wizard state check
console.log('Test 5: Verify timeout handler checks wizard state');
const timeoutMatch = regionRequestCode.match(/const timeout = setTimeout\(async \(\) => \{[\s\S]*?\}, REGION_REQUEST_TIMEOUT_MS\)/);
assert(timeoutMatch, 'Timeout handler should exist');
const timeoutHandler = timeoutMatch[0];
assert(
  timeoutHandler.includes("const wizardState = getState('wizard', telegramId);") &&
  timeoutHandler.includes("const isInWizardFlow = !!(wizardState && wizardState.step);"),
  'Timeout handler should check wizard state'
);
console.log('✓ Timeout handler checks wizard state\n');

// Test 6: Check timeout handler has conditional navigation button
console.log('Test 6: Verify timeout handler has conditional navigation');
assert(
  timeoutHandler.includes("const navigationButton = isInWizardFlow") &&
  timeoutHandler.includes("? [{ text: '← Назад', callback_data: 'back_to_region' }]") &&
  timeoutHandler.includes(": [{ text: '⤴ Меню', callback_data: 'back_to_main' }]"),
  'Timeout handler should have conditional navigation button'
);
console.log('✓ Timeout handler has conditional navigation\n');

// Test 7: Verify navigation buttons are used in inline_keyboard
console.log('Test 7: Verify navigation buttons are properly used');
// Check that all three places use [navigationButton] not [[navigationButton]]
const confirmMatch = regionRequestCode.match(/async function handleRegionRequestConfirm[\s\S]*?notifyAdminsAboutRegionRequest/);
assert(confirmMatch, 'handleRegionRequestConfirm section should exist');
const confirmSection = confirmMatch[0];
assert(
  confirmSection.includes('inline_keyboard: [navigationButton]'),
  'handleRegionRequestConfirm should use inline_keyboard: [navigationButton]'
);

assert(
  cancelFunction.includes('inline_keyboard: [navigationButton]'),
  'handleRegionRequestCancel should use inline_keyboard: [navigationButton]'
);

assert(
  timeoutHandler.includes('inline_keyboard: [navigationButton]'),
  'Timeout handler should use inline_keyboard: [navigationButton]'
);
console.log('✓ Navigation buttons are properly used in all three places\n');

// Summary
console.log('═══════════════════════════════════════');
console.log('✅ ALL TESTS PASSED!');
console.log('═══════════════════════════════════════');
console.log('\n📊 Verified features:');
console.log('   • handleRegionRequestConfirm checks wizard state ✓');
console.log('   • handleRegionRequestConfirm shows correct button ✓');
console.log('   • handleRegionRequestCancel checks wizard state ✓');
console.log('   • handleRegionRequestCancel shows correct button ✓');
console.log('   • Timeout handler checks wizard state ✓');
console.log('   • Timeout handler shows correct button ✓');
console.log('   • All navigation buttons properly integrated ✓');
console.log('\n✨ Region request navigation during wizard is fixed!');
