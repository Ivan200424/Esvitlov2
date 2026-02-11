require('dotenv').config();

// Helper to get setting from DB with fallback to default (no env fallback)
// Note: This is synchronous for backwards compatibility during initialization
// The actual async getSetting is available from db.js for runtime use
function getIntervalSetting(dbKey, defaultValue) {
  // During initialization, just return default
  // Runtime updates will use the async getSetting from db.js
  return parseInt(defaultValue, 10);
}

const config = {
  botToken: process.env.BOT_TOKEN,
  ownerId: process.env.OWNER_ID || '1026177113', // Owner ID with full permissions
  adminIds: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [],
  checkIntervalSeconds: getIntervalSetting('schedule_check_interval', '60'), // секунди
  timezone: process.env.TZ || 'Europe/Kyiv',
  
  // URLs для отримання даних
  dataUrlTemplate: 'https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/data/{region}.json',
  imageUrlTemplate: 'https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/images/{region}/gpv-{queue}-emergency.png',
  
  // Моніторинг світла
  ROUTER_HOST: process.env.ROUTER_HOST || null,
  ROUTER_PORT: process.env.ROUTER_PORT || 80,
  POWER_CHECK_INTERVAL: getIntervalSetting('power_check_interval', '2'), // секунди
  POWER_DEBOUNCE_MINUTES: getIntervalSetting('power_debounce_minutes', '5'), // хвилини
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
