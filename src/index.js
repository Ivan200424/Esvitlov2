#!/usr/bin/env node

const bot = require('./bot');
const { initScheduler } = require('./scheduler');
const { initAlerts } = require('./alerts');
const config = require('./config');

console.log('🚀 Запуск eSvitlo Monitor Bot...');
console.log(`📍 Timezone: ${config.timezone}`);
console.log(`📊 Перевірка графіків: кожні ${config.checkIntervalMinutes} хв`);
console.log(`💾 База даних: ${config.databasePath}`);

// Ініціалізація планувальника та алертів
initScheduler(bot);
initAlerts(bot);

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n${signal} отримано, завершення роботи...`);
  
  try {
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

process.on('uncaughtException', (error) => {
  console.error('Необроблена помилка:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

console.log('✨ Бот успішно запущено та готовий до роботи!');
