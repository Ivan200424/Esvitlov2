/**
 * Universal /cancel command handler
 * Cancels any active flow: IP setup, channel setup, wizard, or conversation state
 */

const usersDb = require('../database/users');
const { getMainMenu } = require('../keyboards/inline');

/**
 * Universal cancel handler that clears ALL possible pending states
 */
async function handleCancel(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  
  let cancelled = false;
  let cancelMessage = '❌ Скасовано.';
  
  // Try to clear wizard state
  try {
    const { clearWizardState, isInWizard } = require('./start');
    if (isInWizard(telegramId)) {
      clearWizardState(telegramId);
      cancelled = true;
      cancelMessage = '❌ Майстер налаштування скасовано.';
    }
  } catch (error) {
    // Wizard functions may not be exported, will handle below
  }
  
  // Try to clear IP setup state
  try {
    const { clearIpSetupState, getIpSetupState } = require('./settings');
    if (getIpSetupState(telegramId)) {
      clearIpSetupState(telegramId);
      cancelled = true;
      cancelMessage = '❌ Налаштування IP скасовано.';
    }
  } catch (error) {
    // IP setup functions may not be exported
  }
  
  // Try to clear channel conversation state
  try {
    const { clearConversationState, getConversationState } = require('./channel');
    if (getConversationState(telegramId)) {
      clearConversationState(telegramId);
      cancelled = true;
      cancelMessage = '❌ Налаштування каналу скасовано.';
    }
  } catch (error) {
    // Channel functions may not be exported
  }
  
  // Get user info to show main menu
  const user = usersDb.getUserByTelegramId(telegramId);
  
  if (!cancelled) {
    // User wasn't in any active flow
    cancelMessage = 'ℹ️ Немає активних налаштувань для скасування.';
  }
  
  // Determine bot status for main menu
  let botStatus = 'active';
  let channelPaused = false;
  
  if (user) {
    if (!user.channel_id) {
      botStatus = 'no_channel';
    } else if (!user.is_active) {
      botStatus = 'paused';
    }
    channelPaused = user.channel_paused === 1;
  }
  
  // Send cancel message with navigation
  await bot.sendMessage(
    chatId,
    cancelMessage + '\n\nОберіть наступну дію:',
    user ? getMainMenu(botStatus, channelPaused) : {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⤴ Меню', callback_data: 'back_to_main' }]
        ]
      }
    }
  );
}

module.exports = {
  handleCancel
};
