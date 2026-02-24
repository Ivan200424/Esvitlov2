const { handleWizardCallback } = require('../handlers/start');
const { handleSettingsCallback } = require('../handlers/settings');
const { handleAdminCallback } = require('../handlers/admin');
const { handleChannelCallback } = require('../handlers/channel');
const { handleFeedbackCallback } = require('../handlers/feedback');
const { handleRegionRequestCallback } = require('../handlers/regionRequest');
const {
  handleMenuSchedule,
  handleMenuTimer,
  handleMenuStats,
  handleMenuHelp,
  handleMenuSettings,
  handleBackToMain,
  handleHelpHowto,
  handleHelpFaq,
  handleTimerCallback,
  handleStatsCallback,
} = require('../handlers/menu');
const { safeAnswerCallbackQuery } = require('../utils/errorHandler');
const { notifyAdminsAboutError } = require('../utils/adminNotifier');

/**
 * Register the callback_query:data handler on the bot instance.
 * @param {import('grammy').Bot} bot
 */
function registerCallbacks(bot) {
  bot.on('callback_query:data', async (ctx) => {
    const query = ctx.callbackQuery;
    const data = query.data;

    try {
      // Region request callbacks - MUST be before region_ check to avoid conflict!
      if (data.startsWith('region_request_')) {
        await handleRegionRequestCallback(bot, query);
        return;
      }

      // Wizard callbacks (region selection, group selection, etc.)
      if (data.startsWith('region_') ||
          data.startsWith('queue_') ||
          data === 'confirm_setup' ||
          data === 'back_to_region' ||
          data === 'restore_profile' ||
          data === 'create_new_profile' ||
          data === 'wizard_notify_bot' ||
          data === 'wizard_notify_channel' ||
          data === 'wizard_notify_back' ||
          data.startsWith('wizard_channel_confirm_')) {
        await handleWizardCallback(bot, query);
        return;
      }

      // Menu callbacks
      if (data === 'menu_schedule') {
        await handleMenuSchedule(bot, query);
        return;
      }

      if (data === 'menu_timer') {
        await handleMenuTimer(bot, query);
        return;
      }

      if (data === 'menu_stats') {
        await handleMenuStats(bot, query);
        return;
      }

      if (data === 'menu_help') {
        await handleMenuHelp(bot, query);
        return;
      }

      if (data === 'menu_settings') {
        await handleMenuSettings(bot, query);
        return;
      }

      if (data === 'back_to_main') {
        await handleBackToMain(bot, query);
        return;
      }

      // Handle inline button callbacks from channel schedule messages
      // These callbacks include user_id like: timer_123, stats_123

      if (data.startsWith('timer_')) {
        await handleTimerCallback(bot, query, data);
        return;
      }

      if (data.startsWith('stats_')) {
        await handleStatsCallback(bot, query, data);
        return;
      }

      // Settings callbacks
      if (data.startsWith('settings_') ||
          data.startsWith('alert_') ||
          data.startsWith('ip_') ||
          data.startsWith('notify_target_') ||
          data.startsWith('schedule_alert_') ||
          data === 'channel_reconnect' ||
          data === 'confirm_deactivate' ||
          data === 'confirm_delete_data' ||
          data === 'delete_data_step2' ||
          data === 'back_to_settings') {
        await handleSettingsCallback(bot, query);
        return;
      }

      // Feedback callbacks
      if (data.startsWith('feedback_')) {
        await handleFeedbackCallback(bot, query);
        return;
      }

      // Admin callbacks (including pause mode, debounce, and growth)
      if (data.startsWith('admin_') || data.startsWith('pause_') || data.startsWith('debounce_') || data.startsWith('growth_')) {
        await handleAdminCallback(bot, query);
        return;
      }

      // Channel callbacks (including auto-connect, test, and format)
      if (data.startsWith('channel_') ||
          data.startsWith('brand_') ||
          data.startsWith('test_') ||
          data.startsWith('format_') ||
          data.startsWith('connect_channel_') ||
          data.startsWith('replace_channel_') ||
          data === 'cancel_channel_connect' ||
          data === 'keep_current_channel') {
        await handleChannelCallback(bot, query);
        return;
      }

      // Help callbacks
      if (data === 'help_howto') {
        await handleHelpHowto(bot, query);
        return;
      }

      if (data === 'help_faq') {
        await handleHelpFaq(bot, query);
        return;
      }

      // Default: just acknowledge
      await bot.api.answerCallbackQuery(query.id);

    } catch (error) {
      console.error('Помилка обробки callback query:', error);
      notifyAdminsAboutError(bot, error, `callback_query: ${data}`);
      await safeAnswerCallbackQuery(bot, query.id, {
        text: '❌ Виникла помилка',
        show_alert: false
      });
    }
  });
}

module.exports = { registerCallbacks };
