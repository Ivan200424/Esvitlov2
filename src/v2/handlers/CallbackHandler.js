/**
 * Callback Query Handler
 * 
 * NEW implementation for v2 bot rewrite.
 * Handles all inline keyboard button presses.
 */

const { showMainMenu } = require('../ui/MainMenu');
const { handleOnboardingCallback } = require('../flows/Onboarding');
const { handleMainMenuCallback } = require('../ui/MainMenu');
const { handleSettingsCallback } = require('../flows/Settings');
const { handleScheduleCallback } = require('../flows/Schedule');
const { handleStatisticsCallback } = require('../flows/Statistics');
const { handleHelpCallback } = require('../ui/Help');

/**
 * Route callback queries to appropriate handlers
 * @param {Object} bot - Telegram bot instance
 * @param {Object} query - Telegram callback query
 * @param {Object} stateMachine - State machine instance
 * @returns {Promise<boolean>} - true if handled
 */
async function handleCallbackQuery(bot, query, stateMachine) {
  const data = query.data;
  const chatId = query.message.chat.id;
  const userId = String(query.from.id);

  // First, check if user is in a state that handles callbacks
  const inState = await stateMachine.handleCallback(bot, query);
  if (inState) {
    await bot.answerCallbackQuery(query.id);
    return true;
  }

  // Route based on callback data prefix
  if (data.startsWith('region:') || data.startsWith('queue:') || 
      data.startsWith('notify_target:') || data.startsWith('onboarding:')) {
    await handleOnboardingCallback(bot, query);
    await bot.answerCallbackQuery(query.id);
    return true;
  }

  if (data.startsWith('main:')) {
    await handleMainMenuCallback(bot, query);
    await bot.answerCallbackQuery(query.id);
    return true;
  }

  if (data.startsWith('settings:')) {
    await handleSettingsCallback(bot, query);
    await bot.answerCallbackQuery(query.id);
    return true;
  }

  if (data.startsWith('schedule:') || data.startsWith('timer:')) {
    await handleScheduleCallback(bot, query);
    await bot.answerCallbackQuery(query.id);
    return true;
  }

  if (data.startsWith('stats:')) {
    await handleStatisticsCallback(bot, query);
    await bot.answerCallbackQuery(query.id);
    return true;
  }

  if (data.startsWith('help:')) {
    await handleHelpCallback(bot, query);
    await bot.answerCallbackQuery(query.id);
    return true;
  }

  // Special: menu and back buttons
  if (data === 'menu' || data === 'main:menu') {
    await showMainMenu(bot, chatId, userId, query.message.message_id);
    await bot.answerCallbackQuery(query.id);
    return true;
  }

  if (data === 'cancel') {
    await stateMachine.cancelUserState(bot, userId, chatId);
    await showMainMenu(bot, chatId, userId, query.message.message_id);
    await bot.answerCallbackQuery(query.id, { text: '✖️ Скасовано' });
    return true;
  }

  // Unknown callback
  await bot.answerCallbackQuery(query.id, {
    text: '❓ Невідома дія',
    show_alert: false
  });
  return false;
}

module.exports = {
  handleCallbackQuery
};
