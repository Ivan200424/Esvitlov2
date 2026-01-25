require('dotenv').config();

// Helper to get setting from DB with fallback to env/default
function getIntervalSetting(dbKey, envKey, defaultValue) {
  try {
    const { getSetting } = require('./database/db');
    const dbValue = getSetting(dbKey);
    if (dbValue !== null) {
      return parseInt(dbValue, 10);
    }
  } catch (error) {
    // Database might not be initialized yet
  }
  return parseInt(process.env[envKey] || defaultValue, 10);
}

const config = {
  botToken: process.env.BOT_TOKEN,
  adminIds: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [],
  checkIntervalMinutes: getIntervalSetting('schedule_check_interval', 'CHECK_INTERVAL_MINUTES', '180') / 60, // convert to minutes
  timezone: process.env.TZ || 'Europe/Kyiv',
  databasePath: process.env.DATABASE_PATH || './data/bot.db',
  
  // URLs для отримання даних
  dataUrlTemplate: 'https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/data/{region}.json',
  imageUrlTemplate: 'https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/images/{region}/gpv-{group}-{queue}-emergency.png',
  
  // Моніторинг світла
  ROUTER_HOST: process.env.ROUTER_HOST || null,
  ROUTER_PORT: process.env.ROUTER_PORT || 80,
  POWER_CHECK_INTERVAL: getIntervalSetting('power_check_interval', 'POWER_CHECK_INTERVAL', '10'), // секунди
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
