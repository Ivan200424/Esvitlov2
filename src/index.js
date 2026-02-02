#!/usr/bin/env node

const bot = require('./bot');
const { initScheduler } = require('./scheduler');
const { initAlerts } = require('./alerts');
const { startPowerMonitoring, stopPowerMonitoring, saveAllUserStates } = require('./powerMonitor');
const { initChannelGuard, checkExistingUsers } = require('./channelGuard');
const { formatInterval } = require('./utils');
const config = require('./config');

console.log('🚀 Запуск СвітлоЧек...');
console.log(`📍 Timezone: ${config.timezone}`);
console.log(`📊 Перевірка графіків: кожні ${formatInterval(config.checkIntervalSeconds)}`);
console.log(`💾 База даних: ${config.databasePath}`);

// Ініціалізація планувальника та алертів
initScheduler(bot);
initAlerts(bot);

// Ініціалізація захисту каналів
initChannelGuard(bot);

// Ініціалізація моніторингу живлення
startPowerMonitoring(bot);

// Check existing users for migration (run once on startup)
setTimeout(() => {
  checkExistingUsers(bot);
}, 5000); // Wait 5 seconds after startup

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n⏳ Отримано ${signal}, завершую роботу...`);
  
  try {
    // Зупиняємо моніторинг живлення
    stopPowerMonitoring();
    console.log('✅ Моніторинг живлення зупинено');
    
    // Зберігаємо всі стани користувачів
    await saveAllUserStates();
    console.log('✅ Стани користувачів збережено');
    
    // Зупиняємо polling
    await bot.stopPolling();
    console.log('✅ Polling зупинено');
    
    // Закриваємо базу даних
    const db = require('./database/db');
    db.close();
    console.log('✅ База даних закрита');
    
    console.log('👋 Бот завершив роботу');
    process.exit(0);
  } catch (error) {
    console.error('❌ Помилка при завершенні:', error);
    process.exit(1);
  }
};

// Обробка сигналів завершення
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Обробка необроблених помилок
process.on('unhandledRejection', (reason, promise) => {
  console.error('Необроблене відхилення промісу:', reason);
});

process.on('uncaughtException', async (error) => {
  console.error('❌ Необроблена помилка:', error);
  await shutdown('UNCAUGHT_EXCEPTION');
});

console.log('✨ Бот успішно запущено та готовий до роботи!');
