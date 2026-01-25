require('dotenv').config();

const config = {
  botToken: process.env.BOT_TOKEN,
  adminIds: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [],
  checkIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES || '3', 10),
  timezone: process.env.TZ || 'Europe/Kyiv',
  databasePath: process.env.DATABASE_PATH || './data/bot.db',
  
  // URLs для отримання даних
  dataUrlTemplate: 'https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/data/{region}.json',
  imageUrlTemplate: 'https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/images/{region}/gpv-{group}-{queue}-emergency.png',
  
  // Моніторинг світла
  ROUTER_HOST: process.env.ROUTER_HOST || null,
  ROUTER_PORT: process.env.ROUTER_PORT || 80,
  POWER_CHECK_INTERVAL: parseInt(process.env.POWER_CHECK_INTERVAL || '30', 10), // секунди
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
