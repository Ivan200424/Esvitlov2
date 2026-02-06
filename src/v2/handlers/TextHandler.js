/**
 * Text Message Handler
 * 
 * NEW implementation for v2 bot rewrite.
 * 
 * CRITICAL: This handles Reply keyboard button presses.
 * Reply buttons send TEXT messages, NOT commands.
 * 
 * When user presses "📊 Графік" button, msg.text === "📊 Графік"
 * This is NOT a /command, it's plain text.
 * 
 * We must handle these texts explicitly to avoid "unknown command" errors.
 */

const { showMainMenu } = require('../ui/MainMenu');
const { showSchedule } = require('../flows/Schedule');
const { showSettings } = require('../flows/Settings');
const { showStatistics } = require('../flows/Statistics');
const { showHelp } = require('../ui/Help');

/**
 * Handle text messages from Reply keyboard
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message
 * @param {Object} stateMachine - State machine instance
 * @returns {Promise<boolean>} - true if handled
 */
async function handleTextMessage(bot, msg, stateMachine) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = msg.text;

  if (!text) {
    return false;
  }

  // First, check if user is in a state that handles text
  const inState = await stateMachine.handleText(bot, msg);
  if (inState) {
    return true;
  }

  // Handle Reply keyboard button presses
  // These are TEXT messages, not commands
  switch (text) {
    case '🏠 Меню':
      await showMainMenu(bot, chatId, userId);
      return true;

    case '📊 Графік':
      await showSchedule(bot, chatId, userId);
      return true;

    case '⚙️ Налаштування':
      await showSettings(bot, chatId, userId);
      return true;

    case '📈 Статистика':
      await showStatistics(bot, chatId, userId);
      return true;

    case '❓ Допомога':
      await showHelp(bot, chatId, userId);
      return true;

    default:
      // Text not recognized
      return false;
  }
}

/**
 * Handle unknown text (not a Reply button, not handled by state)
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message
 */
async function handleUnknownText(bot, msg) {
  const chatId = msg.chat.id;
  
  await bot.sendMessage(
    chatId,
    '❓ Не розумію вашу команду.\n\n' +
    'Використовуйте кнопки меню нижче або введіть /start',
    { parse_mode: 'HTML' }
  );
}

module.exports = {
  handleTextMessage,
  handleUnknownText
};
