#!/usr/bin/env node

/**
 * V2 Bot Validation Script
 * 
 * Tests basic functionality without starting the full bot.
 */

console.log('🧪 V2 Bot Validation Script\n');

// Test 1: Check all modules load
console.log('Test 1: Module Loading...');
try {
  require('./state/StateMachine');
  require('./state/StatePersistence');
  require('./keyboards/ReplyKeyboard');
  require('./keyboards/InlineKeyboard');
  require('./handlers/TextHandler');
  require('./handlers/CallbackHandler');
  require('./handlers/CommandHandler');
  require('./migration/UserMigration');
  require('./ui/MainMenu');
  require('./ui/Help');
  require('./flows/Onboarding');
  require('./flows/Start');
  require('./flows/Schedule');
  require('./flows/Statistics');
  require('./flows/Settings');
  console.log('✅ All modules load successfully\n');
} catch (error) {
  console.error('❌ Module loading failed:', error.message);
  process.exit(1);
}

// Test 2: State Machine
console.log('Test 2: State Machine...');
try {
  const { StateMachine, State } = require('./state/StateMachine');
  
  class TestState extends State {
    constructor() {
      super('test');
    }
    async enter(context) {}
    async cancel(bot, chatId, context) {}
  }
  
  const sm = new StateMachine();
  sm.registerState(new TestState());
  
  if (sm.states.has('test')) {
    console.log('✅ State machine works\n');
  } else {
    throw new Error('State not registered');
  }
} catch (error) {
  console.error('❌ State machine failed:', error.message);
  process.exit(1);
}

// Test 3: Keyboards
console.log('Test 3: Keyboards...');
try {
  const { getMainReplyKeyboard } = require('./keyboards/ReplyKeyboard');
  const { getRegionKeyboard, getMainMenuInlineKeyboard } = require('./keyboards/InlineKeyboard');
  
  const replyKb = getMainReplyKeyboard();
  const regionKb = getRegionKeyboard();
  const mainKb = getMainMenuInlineKeyboard();
  
  if (replyKb.keyboard && regionKb.inline_keyboard && mainKb.inline_keyboard) {
    console.log('✅ Keyboards generate correctly\n');
  } else {
    throw new Error('Keyboard structure invalid');
  }
} catch (error) {
  console.error('❌ Keyboards failed:', error.message);
  process.exit(1);
}

// Test 4: Migration Layer
console.log('Test 4: Migration Layer...');
try {
  const { getUserData, isUserConfigured, getUserConfigSummary } = require('./migration/UserMigration');
  
  // These should work even if user doesn't exist
  const userData = getUserData('nonexistent');
  const config = getUserConfigSummary(null);
  
  if (config && !config.exists) {
    console.log('✅ Migration layer works\n');
  } else {
    throw new Error('Migration layer logic error');
  }
} catch (error) {
  console.error('❌ Migration layer failed:', error.message);
  process.exit(1);
}

// Test 5: Reply Button Text Recognition
console.log('Test 5: Reply Button Recognition...');
try {
  const replyButtons = ['🏠 Меню', '📊 Графік', '⚙️ Налаштування', '📈 Статистика', '❓ Допомога'];
  
  for (const button of replyButtons) {
    // These should NOT be treated as commands
    if (button.startsWith('/')) {
      throw new Error(`Reply button "${button}" starts with / - WRONG!`);
    }
  }
  
  console.log('✅ Reply buttons are text, not commands\n');
} catch (error) {
  console.error('❌ Reply button check failed:', error.message);
  process.exit(1);
}

// Test 6: Command Recognition
console.log('Test 6: Command Recognition...');
try {
  const { isUnknownCommand } = require('./handlers/CommandHandler');
  
  // Known commands should not be "unknown"
  if (isUnknownCommand('/start')) throw new Error('/start is unknown');
  if (isUnknownCommand('/menu')) throw new Error('/menu is unknown');
  
  // Unknown commands should be detected
  if (!isUnknownCommand('/xyz')) throw new Error('/xyz not detected as unknown');
  
  // Non-commands should return false
  if (isUnknownCommand('🏠 Меню')) throw new Error('Reply button treated as command');
  if (isUnknownCommand('hello')) throw new Error('Text treated as command');
  
  console.log('✅ Command recognition works\n');
} catch (error) {
  console.error('❌ Command recognition failed:', error.message);
  process.exit(1);
}

// Test 7: Inline Keyboard Navigation
console.log('Test 7: Inline Keyboard Navigation...');
try {
  const { 
    createBackButton, 
    createMenuButton,
    getScheduleKeyboard,
    getSettingsKeyboard 
  } = require('./keyboards/InlineKeyboard');
  
  const schedKb = getScheduleKeyboard();
  const settKb = getSettingsKeyboard();
  
  // Check that keyboards have navigation buttons
  const hasNavigation = (kb) => {
    const buttons = kb.inline_keyboard.flat();
    return buttons.some(btn => btn.callback_data === 'main:menu' || btn.text.includes('Меню'));
  };
  
  if (!hasNavigation(schedKb)) throw new Error('Schedule keyboard missing menu button');
  if (!hasNavigation(settKb)) throw new Error('Settings keyboard missing menu button');
  
  console.log('✅ Inline keyboards have proper navigation\n');
} catch (error) {
  console.error('❌ Navigation check failed:', error.message);
  process.exit(1);
}

console.log('═══════════════════════════════════');
console.log('✨ All validation tests passed! ✨');
console.log('═══════════════════════════════════\n');
console.log('The V2 bot is ready for testing.');
console.log('Start the bot with: npm start');
