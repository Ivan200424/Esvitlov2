/**
 * V2 Bot - NEW Implementation
 * 
 * This is a COMPLETE REWRITE from scratch.
 * DO NOT reuse old bot logic.
 * 
 * Key differences from v1:
 * 1. Reply keyboard buttons handled as TEXT, not commands
 * 2. Clean state machine with strict lifecycle
 * 3. All flows use inline keyboards
 * 4. Existing users preserve all data
 * 5. NO "unknown command" errors for Reply buttons
 */

const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');

// State machine
const { StateMachine } = require('./state/StateMachine');
const { OnboardingState } = require('./flows/Onboarding');

// Handlers
const { registerCommandHandlers, isUnknownCommand, handleUnknownCommand } = require('./handlers/CommandHandler');
const { handleTextMessage, handleUnknownText } = require('./handlers/TextHandler');
const { handleCallbackQuery } = require('./handlers/CallbackHandler');

// Create bot instance
const bot = new TelegramBot(config.botToken, { polling: true });

// Create state machine
const stateMachine = new StateMachine();

// Register states
stateMachine.registerState(new OnboardingState());

// Start state cleanup
stateMachine.startCleanup();

console.log('🤖 V2 Bot initialized');

// Register command handlers
registerCommandHandlers(bot, stateMachine);

// Handle text messages
bot.on('message', async (msg) => {
  const text = msg.text;

  // Skip if no text
  if (!text) return;

  try {
    // Check if it's an unknown command
    if (isUnknownCommand(text)) {
      await handleUnknownCommand(bot, msg);
      return;
    }

    // Skip known commands (they're handled by onText)
    if (text.startsWith('/')) {
      return;
    }

    // Handle Reply keyboard buttons and state text input
    const handled = await handleTextMessage(bot, msg, stateMachine);

    if (!handled) {
      // Text not recognized by any handler
      await handleUnknownText(bot, msg);
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

// Handle callback queries
bot.on('callback_query', async (query) => {
  try {
    await handleCallbackQuery(bot, query, stateMachine);
  } catch (error) {
    console.error('Error handling callback query:', error);
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Помилка обробки дії',
      show_alert: false
    });
  }
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

// Export bot and state machine for use in other modules
module.exports = {
  bot,
  stateMachine
};
