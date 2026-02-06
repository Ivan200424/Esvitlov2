/**
 * Start and Reset Flow
 * 
 * NEW implementation for v2 bot rewrite.
 * Handles /start and /reset commands.
 */

const { getUserData, isUserConfigured } = require('../migration/UserMigration');
const { showMainMenu } = require('../ui/MainMenu');
const { startOnboarding } = require('./Onboarding');

/**
 * Handle /start command
 * Routes to main menu for existing users or onboarding for new users
 * 
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message
 * @param {Object} stateMachine - State machine instance (injected by bot)
 */
async function handleStart(bot, msg, stateMachine) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  try {
    // Check if user exists
    const userData = getUserData(userId);

    if (userData && isUserConfigured(userData)) {
      // Existing configured user - show main menu
      if (!userData.is_active) {
        // Reactivate user
        const { setUserActive } = require('../migration/UserMigration');
        setUserActive(userId, true);
        
        await bot.sendMessage(
          chatId,
          '👋 <b>З поверненням!</b>\n\n' +
          'Ваш профіль відновлено.\n' +
          'Сповіщення знову активні.',
          { parse_mode: 'HTML' }
        );
      }

      await showMainMenu(bot, chatId, userId);
    } else if (userData && !isUserConfigured(userData)) {
      // User exists but not configured - restart onboarding
      await bot.sendMessage(
        chatId,
        '⚠️ <b>Налаштування не завершені</b>\n\n' +
        'Давайте завершимо налаштування.',
        { parse_mode: 'HTML' }
      );
      
      await startOnboarding(bot, chatId, userId, stateMachine);
    } else {
      // New user - start onboarding
      await startOnboarding(bot, chatId, userId, stateMachine);
    }
  } catch (error) {
    console.error('Error handling /start:', error);
    await bot.sendMessage(
      chatId,
      '❌ Помилка при запуску бота.\nСпробуйте ще раз: /start',
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Handle /reset command
 * Resets user configuration and restarts onboarding
 * 
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message
 * @param {Object} stateMachine - State machine instance (injected by bot)
 */
async function handleReset(bot, msg, stateMachine) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  try {
    // Check if user exists
    const userData = getUserData(userId);

    if (!userData) {
      // No user data to reset
      await bot.sendMessage(
        chatId,
        '⚠️ Немає даних для скидання.\nВведіть /start для початку.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Ask for confirmation
    await bot.sendMessage(
      chatId,
      '⚠️ <b>Скидання налаштувань</b>\n\n' +
      'Це видалить всі ваші налаштування:\n' +
      '• Регіон та чергу\n' +
      '• Підключений канал\n' +
      '• IP моніторинг\n' +
      '• Налаштування сповіщень\n\n' +
      'Ви впевнені? Введіть /reset ще раз для підтвердження\n' +
      'або /cancel для скасування.',
      { parse_mode: 'HTML' }
    );

    // TODO: Implement confirmation state
    // For now, just show warning

  } catch (error) {
    console.error('Error handling /reset:', error);
    await bot.sendMessage(
      chatId,
      '❌ Помилка при скиданні налаштувань.',
      { parse_mode: 'HTML' }
    );
  }
}

module.exports = {
  handleStart,
  handleReset
};
