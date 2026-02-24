const { Bot } = require('grammy');
const config = require('./config');
const { savePendingChannel, deletePendingChannel, getAllPendingChannels } = require('./database/db');
const { MAX_INSTRUCTION_MESSAGES_MAP_SIZE, MAX_PENDING_CHANNELS_MAP_SIZE, PENDING_CHANNEL_CLEANUP_INTERVAL_MS } = require('./constants/timeouts');
const { notifyAdminsAboutError } = require('./utils/adminNotifier');
const { applyMiddleware } = require('./middleware');
const { registerCommands } = require('./routes/commands');
const { registerCallbacks } = require('./routes/callbacks');
const { registerMessages } = require('./routes/messages');
const { registerChatMember } = require('./routes/chatMember');

// Store pending channel connections
const pendingChannels = new Map();

// Store channel instruction message IDs (для видалення старих інструкцій)
const channelInstructionMessages = new Map();

// Автоочистка застарілих записів з pendingChannels (кожну годину)
const botCleanupInterval = setInterval(() => {
  const oneHourAgo = Date.now() - PENDING_CHANNEL_CLEANUP_INTERVAL_MS;

  // Cleanup pendingChannels with size limit
  for (const [key, value] of pendingChannels.entries()) {
    if (value && value.timestamp && value.timestamp < oneHourAgo) {
      pendingChannels.delete(key);
    }
  }

  // Enforce max size limit for pendingChannels (LRU-style)
  if (pendingChannels.size >= MAX_PENDING_CHANNELS_MAP_SIZE) {
    const entriesToDelete = pendingChannels.size - MAX_PENDING_CHANNELS_MAP_SIZE;
    const keys = Array.from(pendingChannels.keys()).slice(0, entriesToDelete);
    keys.forEach(key => pendingChannels.delete(key));
    console.log(`🧹 Очищено ${entriesToDelete} старих pending channels (перевищено ліміт ${MAX_PENDING_CHANNELS_MAP_SIZE})`);
  }

  // Cleanup channelInstructionMessages with size limit
  if (channelInstructionMessages.size >= MAX_INSTRUCTION_MESSAGES_MAP_SIZE) {
    const entriesToDelete = channelInstructionMessages.size - MAX_INSTRUCTION_MESSAGES_MAP_SIZE;
    const keys = Array.from(channelInstructionMessages.keys()).slice(0, entriesToDelete);
    keys.forEach(key => channelInstructionMessages.delete(key));
    console.log(`🧹 Очищено ${entriesToDelete} старих instruction messages (перевищено ліміт ${MAX_INSTRUCTION_MESSAGES_MAP_SIZE})`);
  }
}, PENDING_CHANNEL_CLEANUP_INTERVAL_MS); // Кожну годину

// Helper functions to manage pending channels with DB persistence
async function setPendingChannel(channelId, data) {
  // Enforce max size before adding
  if (pendingChannels.size >= MAX_PENDING_CHANNELS_MAP_SIZE) {
    // Remove oldest entry (first in iteration)
    const firstKey = pendingChannels.keys().next().value;
    pendingChannels.delete(firstKey);
  }

  pendingChannels.set(channelId, data);
  await savePendingChannel(channelId, data.channelUsername, data.channelTitle, data.telegramId);
}

async function removePendingChannel(channelId) {
  pendingChannels.delete(channelId);
  await deletePendingChannel(channelId);
}

/**
 * Відновити pending channels з БД при запуску бота
 */
async function restorePendingChannels() {
  const channels = await getAllPendingChannels();
  for (const channel of channels) {
    // Don't call setPendingChannel here to avoid double-writing to DB
    pendingChannels.set(channel.channel_id, {
      channelId: channel.channel_id,
      channelUsername: channel.channel_username,
      channelTitle: channel.channel_title,
      telegramId: channel.telegram_id,
      timestamp: new Date(channel.created_at).getTime()
    });
  }
  console.log(`✅ Відновлено ${channels.length} pending каналів`);
}

// Визначаємо режим роботи
const useWebhook = config.USE_WEBHOOK;

// Create bot instance
const bot = new Bot(config.botToken);
// Polling will be started in index.js via bot.start()

console.log(`🤖 Telegram Bot ініціалізовано (режим: ${useWebhook ? 'Webhook' : 'Polling'})`);

// Compatibility for bot.options.id used in handlers
bot.options = {};
Object.defineProperty(bot.options, 'id', {
  get() { return bot.botInfo?.id; },
  set(_val) { /* ignore, grammY manages this */ }
});

// Apply middleware (hydrate, autoRetry)
applyMiddleware(bot);

// Register routes
registerCommands(bot);
registerCallbacks(bot);
registerMessages(bot);
registerChatMember(bot, { channelInstructionMessages, setPendingChannel, removePendingChannel });

// Error handling
bot.catch((err) => {
  console.error('Помилка бота:', err.message || err);
  notifyAdminsAboutError(bot, err.error || err, 'bot error');
});

module.exports = bot;
module.exports.pendingChannels = pendingChannels;
module.exports.channelInstructionMessages = channelInstructionMessages;
module.exports.restorePendingChannels = restorePendingChannels;
module.exports.removePendingChannel = removePendingChannel;
module.exports.useWebhook = useWebhook;
module.exports.stopBotCleanup = function() {
  clearInterval(botCleanupInterval);
};
