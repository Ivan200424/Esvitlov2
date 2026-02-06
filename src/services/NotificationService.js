/**
 * Notification Service - Centralized Notification Logic
 * 
 * Handles all notification delivery with proper error handling and retries
 * Isolates notification failures from business logic
 */

const { logger } = require('../core/Logger');
const { eventBus, Events } = require('../core/EventEmitter');
const { fetchScheduleImage } = require('../api');
const usersDb = require('../database/users');

class NotificationService {
  constructor() {
    this.log = logger.child({ service: 'NotificationService' });
    this.retryAttempts = 3;
    this.retryDelay = 1000; // ms
  }

  /**
   * Sleep helper for retry delays
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send message with retry logic
   * @private
   */
  async _sendWithRetry(bot, chatId, sendFn, attempt = 1) {
    try {
      return await sendFn();
    } catch (error) {
      if (attempt >= this.retryAttempts) {
        throw error;
      }

      this.log.warn('Message send failed, retrying', {
        chatId,
        attempt,
        error: error.message
      });

      await this._sleep(this.retryDelay * attempt);
      return this._sendWithRetry(bot, chatId, sendFn, attempt + 1);
    }
  }

  /**
   * Check if error indicates channel access lost
   * @private
   */
  _isChannelAccessError(error) {
    const errorMsg = error.message || '';
    return errorMsg.includes('chat not found') || 
           errorMsg.includes('bot was blocked') ||
           errorMsg.includes('bot was kicked') ||
           errorMsg.includes('not enough rights') ||
           errorMsg.includes('have no rights');
  }

  /**
   * Handle channel access error
   * @private
   */
  async _handleChannelAccessError(bot, user) {
    this.log.warn('Channel access lost', {
      userId: user.telegram_id,
      channelId: user.channel_id
    });

    // Mark channel as blocked
    usersDb.updateUser(user.telegram_id, { channel_status: 'blocked' });

    eventBus.emitSync(Events.CHANNEL_BLOCKED, {
      userId: user.telegram_id,
      channelId: user.channel_id
    });

    // Notify user about channel access loss
    const notifyTarget = user.power_notify_target || 'both';
    if (notifyTarget === 'bot' || notifyTarget === 'both') {
      try {
        await bot.sendMessage(
          user.telegram_id,
          '⚠️ <b>Втрачено доступ до каналу</b>\n\n' +
          `Не вдалося опублікувати графік у канал.\n` +
          `Можливі причини:\n` +
          `• Бот видалений з каналу\n` +
          `• Бот втратив права адміністратора\n\n` +
          `Перевірте налаштування каналу в меню.`,
          { parse_mode: 'HTML' }
        );
      } catch (notifyError) {
        this.log.error('Failed to notify user about channel access loss', notifyError, {
          userId: user.telegram_id
        });
      }
    }
  }

  /**
   * Send schedule notification to user's personal chat
   */
  async sendToUser(bot, user, message) {
    try {
      this.log.debug('Sending schedule to user', {
        userId: user.telegram_id
      });

      // Try with photo
      try {
        const imageBuffer = await fetchScheduleImage(user.region, user.queue);
        await this._sendWithRetry(bot, user.telegram_id, async () => {
          return await bot.sendPhoto(user.telegram_id, imageBuffer, {
            caption: message,
            parse_mode: 'HTML'
          }, { filename: 'schedule.png', contentType: 'image/png' });
        });
      } catch (imgError) {
        // Without photo
        await this._sendWithRetry(bot, user.telegram_id, async () => {
          return await bot.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
        });
      }

      this.log.info('Schedule sent to user', {
        userId: user.telegram_id
      });

      return true;
    } catch (error) {
      this.log.error('Failed to send schedule to user', error, {
        userId: user.telegram_id
      });
      return false;
    }
  }

  /**
   * Send schedule notification to channel
   */
  async sendToChannel(bot, user, message) {
    try {
      this.log.debug('Sending schedule to channel', {
        userId: user.telegram_id,
        channelId: user.channel_id
      });

      // Check if channel is paused
      if (user.channel_paused) {
        this.log.debug('Channel is paused, skipping', {
          userId: user.telegram_id,
          channelId: user.channel_id
        });
        return false;
      }

      // Delete previous schedule message if delete_old_message is enabled
      if (user.delete_old_message && user.last_schedule_message_id) {
        try {
          await bot.deleteMessage(user.channel_id, user.last_schedule_message_id);
          this.log.debug('Deleted previous schedule message', {
            userId: user.telegram_id,
            channelId: user.channel_id,
            messageId: user.last_schedule_message_id
          });
        } catch (deleteError) {
          this.log.warn('Failed to delete previous message', {
            userId: user.telegram_id,
            error: deleteError.message
          });
        }
      }

      let sentMessage;

      // Try with photo
      try {
        const imageBuffer = await fetchScheduleImage(user.region, user.queue);

        if (user.picture_only) {
          // Send only photo without caption
          sentMessage = await this._sendWithRetry(bot, user.channel_id, async () => {
            return await bot.sendPhoto(user.channel_id, imageBuffer, {}, 
              { filename: 'schedule.png', contentType: 'image/png' });
          });
        } else {
          // Send photo with caption
          sentMessage = await this._sendWithRetry(bot, user.channel_id, async () => {
            return await bot.sendPhoto(user.channel_id, imageBuffer, {
              caption: message,
              parse_mode: 'HTML'
            }, { filename: 'schedule.png', contentType: 'image/png' });
          });
        }
      } catch (imgError) {
        // Without photo
        sentMessage = await this._sendWithRetry(bot, user.channel_id, async () => {
          return await bot.sendMessage(user.channel_id, message, { parse_mode: 'HTML' });
        });
      }

      // Save the message_id for potential deletion later
      if (sentMessage && sentMessage.message_id) {
        usersDb.updateLastScheduleMessageId(user.telegram_id, sentMessage.message_id);
      }

      this.log.info('Schedule published to channel', {
        userId: user.telegram_id,
        channelId: user.channel_id,
        messageId: sentMessage?.message_id
      });

      eventBus.emitSync(Events.SCHEDULE_PUBLISHED, {
        userId: user.telegram_id,
        channelId: user.channel_id,
        messageId: sentMessage?.message_id
      });

      return true;
    } catch (error) {
      this.log.error('Failed to send schedule to channel', error, {
        userId: user.telegram_id,
        channelId: user.channel_id
      });

      // Check if error indicates channel access lost
      if (this._isChannelAccessError(error)) {
        await this._handleChannelAccessError(bot, user);
      }

      return false;
    }
  }

  /**
   * Send schedule notification according to user's notification target
   */
  async sendScheduleNotification(bot, publicationData) {
    const { user, message, todayHash, tomorrowHash, todayDateStr, tomorrowDateStr } = publicationData;
    const notifyTarget = user.power_notify_target || 'both';

    let userSuccess = false;
    let channelSuccess = false;

    // Send to user's personal chat
    if (notifyTarget === 'bot' || notifyTarget === 'both') {
      userSuccess = await this.sendToUser(bot, user, message);
    }

    // Send to channel
    if (user.channel_id && (notifyTarget === 'channel' || notifyTarget === 'both')) {
      channelSuccess = await this.sendToChannel(bot, user, message);
    }

    // Always update hashes to prevent infinite retry loops
    // even if publication failed, as the user will be notified
    usersDb.updateUserScheduleHashes(
      user.id,
      todayHash,
      tomorrowHash,
      todayDateStr,
      tomorrowDateStr
    );

    return {
      userSuccess,
      channelSuccess,
      anySuccess: userSuccess || channelSuccess
    };
  }

  /**
   * Send power state notification
   */
  async sendPowerNotification(bot, userId, message, options = {}) {
    try {
      this.log.debug('Sending power notification', {
        userId
      });

      await this._sendWithRetry(bot, userId, async () => {
        return await bot.sendMessage(userId, message, {
          parse_mode: 'HTML',
          ...options
        });
      });

      this.log.info('Power notification sent', {
        userId
      });

      return true;
    } catch (error) {
      this.log.error('Failed to send power notification', error, {
        userId
      });
      return false;
    }
  }
}

// Export singleton instance
const notificationService = new NotificationService();

module.exports = {
  NotificationService,
  notificationService
};
