require('dotenv').config();
const logger = require('./utils/logger');

// Helper to get setting from DB with fallback to default (no env fallback)
// Note: This is synchronous for backwards compatibility during initialization
// The actual async getSetting is available from db.js for runtime use
function getIntervalSetting(dbKey, defaultValue) {
  // During initialization, just return default
  // Runtime updates will use the async getSetting from db.js
  return parseInt(defaultValue, 10);
}

// Validate required environment variables
if (!process.env.BOT_TOKEN) {
  logger.error('[CONFIG] BOT_TOKEN не встановлений в .env файлі');
  process.exit(1);
}

if (!process.env.OWNER_ID) {
  logger.error('[CONFIG] OWNER_ID не встановлений в .env файлі - це обов\'язковий параметр для безпеки');
  process.exit(1);
}

// Validate OWNER_ID is a valid Telegram ID
if (!/^\d+$/.test(process.env.OWNER_ID)) {
  logger.error('[CONFIG] OWNER_ID має бути числовим Telegram ID');
  process.exit(1);
}

// Validate DATABASE_URL if needed
if (!process.env.DATABASE_URL && !process.env.PGDATABASE) {
  logger.warn('[CONFIG] DATABASE_URL не встановлений - переконайтесь що налаштовано окремі параметри PostgreSQL');
}

const config = {
  botToken: process.env.BOT_TOKEN,
  ownerId: process.env.OWNER_ID, // Owner ID with full permissions - required from env
  adminIds: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [],
  checkIntervalSeconds: getIntervalSetting('schedule_check_interval', '60'), // секунди
  timezone: process.env.TZ || 'Europe/Kyiv',
  
  // URLs для отримання даних
  dataUrlTemplate: 'https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/data/{region}.json',
  imageUrlTemplate: 'https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/images/{region}/gpv-{queue}-emergency.png',
  
  // Моніторинг світла
  ROUTER_HOST: process.env.ROUTER_HOST || null,
  ROUTER_PORT: parseInt(process.env.ROUTER_PORT || '80', 10),
  POWER_CHECK_INTERVAL: getIntervalSetting('power_check_interval', '2'), // секунди
  POWER_DEBOUNCE_MINUTES: getIntervalSetting('power_debounce_minutes', '5'), // хвилини
};

// Validate numeric config values
if (config.checkIntervalSeconds <= 0 || isNaN(config.checkIntervalSeconds)) {
  logger.error('[CONFIG] checkIntervalSeconds має бути додатнім числом');
  process.exit(1);
}

if (config.ROUTER_PORT < 1 || config.ROUTER_PORT > 65535) {
  logger.error('[CONFIG] ROUTER_PORT має бути від 1 до 65535');
  process.exit(1);
}

if (config.POWER_CHECK_INTERVAL <= 0 || isNaN(config.POWER_CHECK_INTERVAL)) {
  logger.error('[CONFIG] POWER_CHECK_INTERVAL має бути додатнім числом');
  process.exit(1);
}

if (config.POWER_DEBOUNCE_MINUTES <= 0 || isNaN(config.POWER_DEBOUNCE_MINUTES)) {
  logger.error('[CONFIG] POWER_DEBOUNCE_MINUTES має бути додатнім числом');
  process.exit(1);
}

// Validate URL templates contain required placeholders
if (!config.dataUrlTemplate.includes('{region}')) {
  logger.error('[CONFIG] dataUrlTemplate має містити {region} placeholder');
  process.exit(1);
}

if (!config.imageUrlTemplate.includes('{region}') || !config.imageUrlTemplate.includes('{queue}')) {
  logger.error('[CONFIG] imageUrlTemplate має містити {region} та {queue} placeholders');
  process.exit(1);
}

// Warnings for optional but recommended settings
if (config.adminIds.length === 0) {
  logger.warn('[CONFIG] ADMIN_IDS не встановлений - адмін команди будуть недоступні');
}

// Log effective configuration (mask sensitive values)
logger.info('[CONFIG] Конфігурація завантажена:', {
  botToken: '***' + config.botToken.slice(-4),
  ownerId: config.ownerId,
  adminCount: config.adminIds.length,
  checkIntervalSeconds: config.checkIntervalSeconds,
  timezone: config.timezone,
  routerHost: config.ROUTER_HOST || 'не налаштовано',
  routerPort: config.ROUTER_PORT
});

module.exports = config;
