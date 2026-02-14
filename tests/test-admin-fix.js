#!/usr/bin/env node

/**
 * Test for admin panel fix and main menu UX improvements
 */

const assert = require('assert');

console.log('🧪 Testing admin panel fix and UX improvements...\n');

// Test 1: Check that settings.js doesn't call handleAdmin anymore
console.log('Test 1: Verify settings.js admin panel implementation');
const settingsContent = require('fs').readFileSync('./src/handlers/settings.js', 'utf8');

// Check that the problematic handleAdmin call is removed
const hasProblematicCall = settingsContent.includes("await handleAdmin(bot, query.message);");
assert(!hasProblematicCall, 'settings.js should NOT call handleAdmin with query.message');

// Check that the fix is in place
const hasDirectEditCall = settingsContent.includes("bot.editMessageText") && 
                          settingsContent.includes("getAdminKeyboard");
assert(hasDirectEditCall, 'settings.js should use editMessageText with getAdminKeyboard');

console.log('✓ Admin panel fix is correctly implemented\n');

// Test 2: Check that main menu is sent after successful actions
console.log('Test 2: Verify main menu is sent after successful actions');

// Check settings.js
const hasMainMenuAfterDeactivate = settingsContent.includes("confirm_deactivate") && 
                                   settingsContent.match(/confirm_deactivate[\s\S]*?getMainMenu/);
assert(hasMainMenuAfterDeactivate, 'Main menu should be sent after deactivation');

const hasMainMenuAfterIP = settingsContent.includes("updateUserRouterIp") && 
                           settingsContent.match(/updateUserRouterIp[\s\S]*?getMainMenu/);
assert(hasMainMenuAfterIP, 'Main menu should be sent after IP setup');

console.log('✓ settings.js sends main menu after successful actions\n');

// Check channel.js
console.log('Test 3: Verify channel.js sends main menu after setup');
const channelContent = require('fs').readFileSync('./src/handlers/channel.js', 'utf8');

const hasMainMenuAfterChannel = channelContent.includes("Канал успішно налаштовано") && 
                                channelContent.match(/Канал успішно налаштовано[\s\S]*?getMainMenu/);
assert(hasMainMenuAfterChannel, 'Main menu should be sent after channel setup');

console.log('✓ channel.js sends main menu after successful setup\n');

// Check start.js
console.log('Test 4: Verify start.js sends main menu after region/queue update');
const startContent = require('fs').readFileSync('./src/handlers/start.js', 'utf8');

const hasMainMenuAfterEdit = startContent.includes("Налаштування оновлено") && 
                             startContent.match(/Налаштування оновлено[\s\S]*?getMainMenu/);
assert(hasMainMenuAfterEdit, 'Main menu should be sent after region/queue update');

console.log('✓ start.js sends main menu after successful update\n');

// Test 5: Verify inline keyboard buttons removed from edit mode in start.js
console.log('Test 5: Verify inline keyboard buttons are removed in edit mode');
const editModeSection = startContent.match(/mode === 'edit'[\s\S]*?} else {/);
if (editModeSection) {
  const editModeText = editModeSection[0];
  // Should not have inline_keyboard with back buttons inside editMessageText for edit mode
  const hasInlineKeyboardInEdit = editModeText.includes("reply_markup: {") && 
                                  editModeText.includes("inline_keyboard:") &&
                                  editModeText.includes("'← Назад'");
  assert(!hasInlineKeyboardInEdit, 'Edit mode should not have inline keyboard buttons in editMessageText');
}

console.log('✓ Inline keyboard buttons correctly removed from edit mode\n');

console.log('✅ All tests passed!\n');
console.log('Summary:');
console.log('  ✓ Admin panel now uses direct editMessageText instead of handleAdmin');
console.log('  ✓ Main menu is sent after channel setup');
console.log('  ✓ Main menu is sent after region/queue update');
console.log('  ✓ Main menu is sent after IP setup');
console.log('  ✓ Main menu is sent after deactivation');
console.log('  ✓ Inline buttons removed from edit mode success message');
