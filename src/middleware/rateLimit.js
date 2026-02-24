const { isAdmin } = require('../utils');
const config = require('../config');
const logger = require('../logger').child({ module: 'rateLimit' });

function createRateLimitMiddleware(options = {}) {
  const {
    limit = 3,
    windowMs = 5000,
    message = '⏳ Занадто багато запитів. Зачекайте кілька секунд.',
  } = options;

  const userRequests = new Map(); // userId -> [timestamps]

  // Автоочистка старих записів кожні 60 секунд
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamps] of userRequests.entries()) {
      const valid = timestamps.filter(t => now - t < windowMs);
      if (valid.length === 0) {
        userRequests.delete(userId);
      } else {
        userRequests.set(userId, valid);
      }
    }
  }, 60000);

  // Prevent cleanup interval from keeping the process alive
  if (cleanupInterval.unref) cleanupInterval.unref();

  const middleware = async (ctx, next) => {
    const userId = String(ctx.from?.id);
    if (!userId || !ctx.from) {
      return await next();
    }

    // Адміни без обмежень
    if (isAdmin(userId, config.adminIds, config.ownerId)) {
      return await next();
    }

    const now = Date.now();
    const timestamps = userRequests.get(userId) || [];
    const valid = timestamps.filter(t => now - t < windowMs);

    if (valid.length >= limit) {
      logger.debug({ userId, count: valid.length, limit }, 'Rate limit exceeded');
      try {
        await ctx.reply(message);
      } catch (_e) { /* ignore send errors */ }
      return; // НЕ викликаємо next()
    }

    valid.push(now);
    userRequests.set(userId, valid);
    return await next();
  };

  middleware.stop = () => clearInterval(cleanupInterval);
  return middleware;
}

module.exports = { createRateLimitMiddleware };
