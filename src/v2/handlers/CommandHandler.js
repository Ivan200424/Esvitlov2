/**
 * Command Handler
 * 
 * NEW implementation for v2 bot rewrite.
 * Handles /commands (things that start with /).
 * 
 * CRITICAL: This does NOT handle Reply keyboard buttons.
 * Reply buttons send text, not commands.
 */

const { handleStart, handleReset } = require('../flows/Start');
const { showMainMenu } = require('../ui/MainMenu');
const { showSchedule } = require('../flows/Schedule');
const { showSettings } = require('../flows/Settings');
const { showStatistics } = require('../flows/Statistics');
const { showHelp } = require('../ui/Help');

/**
 * Handle /start command
 */
async function handleStartCommand(bot, msg, stateMachine) {
  await handleStart(bot, msg, stateMachine);
}

/**
 * Handle /reset command
 */
async function handleResetCommand(bot, msg, stateMachine) {
  await handleReset(bot, msg, stateMachine);
}

/**
 * Handle /menu command
 */
async function handleMenuCommand(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  await showMainMenu(bot, chatId, userId);
}

/**
 * Handle /schedule command
 */
async function handleScheduleCommand(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  await showSchedule(bot, chatId, userId);
}

/**
 * Handle /settings command
 */
async function handleSettingsCommand(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  await showSettings(bot, chatId, userId);
}

/**
 * Handle /stats command
 */
async function handleStatsCommand(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  await showStatistics(bot, chatId, userId);
}

/**
 * Handle /help command
 */
async function handleHelpCommand(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  await showHelp(bot, chatId, userId);
}

/**
 * Handle /cancel command
 */
async function handleCancelCommand(bot, msg, stateMachine) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  
  await stateMachine.cancelUserState(bot, userId, chatId);
  await bot.sendMessage(chatId, '✖️ Скасовано', { parse_mode: 'HTML' });
  await showMainMenu(bot, chatId, userId);
}

/**
 * Handle unknown command
 */
async function handleUnknownCommand(bot, msg) {
  const chatId = msg.chat.id;
  
  await bot.sendMessage(
    chatId,
    '❓ Невідома команда.\n\n' +
    'Доступні команди:\n' +
    '/start - Почати роботу з ботом\n' +
    '/menu - Головне меню\n' +
    '/schedule - Показати графік\n' +
    '/settings - Налаштування\n' +
    '/help - Допомога',
    { parse_mode: 'HTML' }
  );
}

/**
 * Register all command handlers
 * @param {Object} bot - Telegram bot instance
 * @param {Object} stateMachine - State machine instance
 */
function registerCommandHandlers(bot, stateMachine) {
  // Main commands (pass stateMachine where needed)
  bot.onText(/^\/start$/, (msg) => handleStartCommand(bot, msg, stateMachine));
  bot.onText(/^\/reset$/, (msg) => handleResetCommand(bot, msg, stateMachine));
  bot.onText(/^\/menu$/, (msg) => handleMenuCommand(bot, msg));
  bot.onText(/^\/schedule$/, (msg) => handleScheduleCommand(bot, msg));
  bot.onText(/^\/settings$/, (msg) => handleSettingsCommand(bot, msg));
  bot.onText(/^\/stats$/, (msg) => handleStatsCommand(bot, msg));
  bot.onText(/^\/help$/, (msg) => handleHelpCommand(bot, msg));
  bot.onText(/^\/cancel$/, (msg) => handleCancelCommand(bot, msg, stateMachine));
}

/**
 * Check if message is an unknown command
 * @param {string} text - Message text
 * @returns {boolean} - true if unknown command
 */
function isUnknownCommand(text) {
  if (!text || !text.startsWith('/')) {
    return false;
  }

  const knownCommands = [
    '/start', '/reset', '/menu', '/schedule', '/settings', 
    '/stats', '/help', '/cancel', '/admin'
  ];

  const command = text.split(' ')[0].toLowerCase();
  return !knownCommands.includes(command);
}

module.exports = {
  registerCommandHandlers,
  handleUnknownCommand,
  isUnknownCommand
};
