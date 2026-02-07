require('dotenv').config();

// Helper to get setting from DB with fallback to env/default
function getIntervalSetting(dbKey, envKey, defaultValue) {
  try {
    // Only try to read from DB if not in test mode
    if (process.env.NODE_ENV !== 'test') {
      const db = require('./database/db');
      if (db.getSetting) {
        const dbValue = db.getSetting(dbKey);
        if (dbValue !== null) {
          return parseInt(dbValue, 10);
        }
      }
    }
  } catch (error) {
    // Database might not be initialized yet, fallback to env
  }
  return parseInt(process.env[envKey] || defaultValue, 10);
}

const config = {
  botToken: process.env.BOT_TOKEN,
  ownerId: '1026177113', // Owner ID with full permissions
  adminIds: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [],
  checkIntervalSeconds: getIntervalSetting('schedule_check_interval', 'CHECK_INTERVAL_SECONDS', '60'), // секунди
  timezone: process.env.TZ || 'Europe/Kyiv',
  databasePath: process.env.DATABASE_PATH || './data/bot.db',
  
  // Bot mode (webhook or polling)
  botMode: process.env.BOT_MODE || 'polling',
  webhookUrl: process.env.WEBHOOK_URL || '',
  webhookPort: parseInt(process.env.WEBHOOK_PORT || '3000', 10),
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  
  // URLs для отримання даних
  dataUrlTemplate: 'https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/data/{region}.json',
  imageUrlTemplate: 'https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/images/{region}/gpv-{queue}-emergency.png',
  
  // Моніторинг світла
  ROUTER_HOST: process.env.ROUTER_HOST || null,
  ROUTER_PORT: process.env.ROUTER_PORT || 80,
  POWER_CHECK_INTERVAL: getIntervalSetting('power_check_interval', 'POWER_CHECK_INTERVAL', '2'), // секунди
  POWER_DEBOUNCE_MINUTES: getIntervalSetting('power_debounce_minutes', 'POWER_DEBOUNCE_MINUTES', '5'), // хвилини
};

// Валідація обов'язкових параметрів
if (!config.botToken) {
  console.error('❌ Помилка: BOT_TOKEN не встановлений в .env файлі');
  process.exit(1);
}

if (config.adminIds.length === 0) {
  console.warn('⚠️  Попередження: ADMIN_IDS не встановлений - адмін команди будуть недоступні');
}

module.exports = config;
