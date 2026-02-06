/**
 * Onboarding Flow
 * 
 * NEW implementation for v2 bot rewrite.
 * Handles new user registration wizard.
 * 
 * All steps use inline keyboards.
 * Each step has proper back/cancel navigation.
 */

const { State } = require('../state/StateMachine');
const {
  getRegionKeyboard,
  getQueueKeyboard,
  getNotificationTargetKeyboard,
  getConfirmationKeyboard
} = require('../keyboards/InlineKeyboard');
const { getMainReplyKeyboard } = require('../keyboards/ReplyKeyboard');
const { createUser, getUserData } = require('../migration/UserMigration');
const { showMainMenu } = require('../ui/MainMenu');
const { REGIONS } = require('../../constants/regions');

/**
 * Onboarding State
 * Manages the multi-step registration process
 */
class OnboardingState extends State {
  constructor() {
    super('onboarding');
  }

  async enter(context) {
    // Context should have: bot, chatId, userId, step
    const { bot, chatId, step } = context;

    switch (step) {
      case 'region':
        await this.showRegionSelection(bot, chatId);
        break;
      case 'queue':
        await this.showQueueSelection(bot, chatId, context.region);
        break;
      case 'notify_target':
        await this.showNotificationTarget(bot, chatId, context);
        break;
      case 'confirm':
        await this.showConfirmation(bot, chatId, context);
        break;
      default:
        await this.showRegionSelection(bot, chatId);
    }
  }

  async showRegionSelection(bot, chatId) {
    const message =
      '👋 <b>Привіт! Я Вольтик 🤖</b>\n\n' +
      'Я допоможу відстежувати відключення світла\n' +
      'та повідомлю, коли воно зʼявиться або зникне.\n\n' +
      '<b>Крок 1 з 3:</b> Оберіть свій регіон:';

    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: getRegionKeyboard()
    });
  }

  async showQueueSelection(bot, chatId, region) {
    const regionName = REGIONS[region] || region;
    const message =
      `<b>Крок 2 з 3:</b> Оберіть свою чергу\n\n` +
      `📍 Регіон: ${regionName}`;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: getQueueKeyboard(region)
    });
  }

  async showNotificationTarget(bot, chatId, context) {
    const regionName = REGIONS[context.region] || context.region;
    const message =
      `<b>Крок 3 з 3:</b> Куди надсилати сповіщення?\n\n` +
      `📍 Регіон: ${regionName}\n` +
      `⚡️ Черга: ${context.queue}\n\n` +
      `Оберіть опцію:`;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: getNotificationTargetKeyboard()
    });
  }

  async showConfirmation(bot, chatId, context) {
    const regionName = REGIONS[context.region] || context.region;
    let notifyText = 'У бот';
    if (context.notifyTarget === 'channel') {
      notifyText = 'У канал';
    } else if (context.notifyTarget === 'both') {
      notifyText = 'У бот і канал';
    }

    const message =
      '✅ <b>Підтвердження налаштувань</b>\n\n' +
      `📍 <b>Регіон:</b> ${regionName}\n` +
      `⚡️ <b>Черга:</b> ${context.queue}\n` +
      `🔔 <b>Сповіщення:</b> ${notifyText}\n\n` +
      'Все вірно?';

    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: getConfirmationKeyboard(context)
    });
  }

  async handleCallback(bot, query, context) {
    const data = query.data;
    const chatId = query.message.chat.id;

    if (data.startsWith('region:')) {
      const region = data.replace('region:', '');
      context.region = region;
      context.step = 'queue';
      
      // Delete previous message
      await bot.deleteMessage(chatId, query.message.message_id);
      
      await this.showQueueSelection(bot, chatId, region);
      return true;
    }

    if (data.startsWith('queue:')) {
      const queue = data.replace('queue:', '');
      context.queue = queue;
      context.step = 'notify_target';
      
      // Delete previous message
      await bot.deleteMessage(chatId, query.message.message_id);
      
      await this.showNotificationTarget(bot, chatId, context);
      return true;
    }

    if (data.startsWith('notify_target:')) {
      const target = data.replace('notify_target:', '');
      context.notifyTarget = target;
      context.step = 'confirm';
      
      // Delete previous message
      await bot.deleteMessage(chatId, query.message.message_id);
      
      await this.showConfirmation(bot, chatId, context);
      return true;
    }

    if (data === 'onboarding:confirm') {
      await this.confirmSetup(bot, query, context);
      return true;
    }

    if (data === 'onboarding:back_to_region') {
      context.step = 'region';
      await bot.deleteMessage(chatId, query.message.message_id);
      await this.showRegionSelection(bot, chatId);
      return true;
    }

    if (data === 'onboarding:back_to_queue') {
      context.step = 'queue';
      await bot.deleteMessage(chatId, query.message.message_id);
      await this.showQueueSelection(bot, chatId, context.region);
      return true;
    }

    if (data === 'onboarding:change_region') {
      context.step = 'region';
      await bot.deleteMessage(chatId, query.message.message_id);
      await this.showRegionSelection(bot, chatId);
      return true;
    }

    if (data === 'onboarding:change_queue') {
      context.step = 'queue';
      await bot.deleteMessage(chatId, query.message.message_id);
      await this.showQueueSelection(bot, chatId, context.region);
      return true;
    }

    if (data === 'onboarding:cancel') {
      await this.cancel(bot, chatId, context);
      return true;
    }

    return false;
  }

  async confirmSetup(bot, query, context) {
    const chatId = query.message.chat.id;
    const userId = context.userId;
    const username = query.from.username || query.from.first_name;

    try {
      // Create user in database
      createUser(userId, username, context.region, context.queue);

      // Update notification target if specified
      if (context.notifyTarget) {
        const usersDb = require('../../database/users');
        usersDb.updateUserPowerNotifyTarget(userId, context.notifyTarget);
      }

      // Delete confirmation message
      await bot.deleteMessage(chatId, query.message.message_id);

      // Send success message with reply keyboard
      await bot.sendMessage(
        chatId,
        '✅ <b>Налаштування завершено!</b>\n\n' +
        'Тепер ви отримуватимете сповіщення про\n' +
        'відключення та підключення світла.\n\n' +
        'Використовуйте кнопки меню нижче 👇',
        {
          parse_mode: 'HTML',
          reply_markup: getMainReplyKeyboard()
        }
      );

      // Show main menu
      await showMainMenu(bot, chatId, userId);

    } catch (error) {
      console.error('Error confirming setup:', error);
      await bot.answerCallbackQuery(query.id, {
        text: '❌ Помилка при збереженні налаштувань',
        show_alert: true
      });
    }
  }

  async cancel(bot, chatId, context) {
    await bot.sendMessage(
      chatId,
      '✖️ <b>Налаштування скасовано</b>\n\n' +
      'Для початку роботи введіть /start',
      { parse_mode: 'HTML' }
    );
  }

  async exit(context) {
    // Cleanup if needed
  }
}

/**
 * Start onboarding for new user
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {string} userId - User ID
 * @param {Object} stateMachine - State machine instance
 */
async function startOnboarding(bot, chatId, userId, stateMachine) {
  await stateMachine.setUserState(userId, 'onboarding', {
    bot,
    chatId,
    userId,
    step: 'region'
  });
}

/**
 * Handle onboarding callback (for direct callback handling without state)
 * @param {Object} bot - Telegram bot instance
 * @param {Object} query - Callback query
 */
async function handleOnboardingCallback(bot, query) {
  // This function is called when onboarding callbacks come in
  // but the user is not in onboarding state
  // This should not happen in normal flow
  await bot.answerCallbackQuery(query.id, {
    text: '⚠️ Сесія завершена. Почніть заново: /start',
    show_alert: true
  });
}

module.exports = {
  OnboardingState,
  startOnboarding,
  handleOnboardingCallback
};
