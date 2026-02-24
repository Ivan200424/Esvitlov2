const { hydrate } = require('@grammyjs/hydrate');
const { autoRetry } = require('@grammyjs/auto-retry');
const { createRateLimitMiddleware } = require('./rateLimit');

/**
 * Register middleware on the bot instance.
 * @param {import('grammy').Bot} bot
 */
function applyMiddleware(bot) {
  // Rate limiting — захист від спаму (ПЕРЕД іншими middleware)
  bot.use(createRateLimitMiddleware());

  // Register hydrate middleware to allow convenient message editing
  bot.use(hydrate());

  // Auto-retry on 429 (Too Many Requests) errors from Telegram API
  bot.api.config.use(autoRetry({
    maxRetryAttempts: 3,
    maxDelaySeconds: 10,
  }));
}

module.exports = { applyMiddleware };
