#!/usr/bin/env node

const bot = require('./bot');
const { restorePendingChannels } = require('./bot');
const { initScheduler, schedulerManager } = require('./scheduler');
const { startPowerMonitoring, stopPowerMonitoring, saveAllUserStates } = require('./powerMonitor');
const { initChannelGuard, checkExistingUsers } = require('./channelGuard');
const { formatInterval } = require('./utils');
const config = require('./config');
const { initializeDatabase, runMigrations, cleanupOldStates } = require('./database/db');
const { initStateManager, stopCleanup } = require('./state/stateManager');
const { monitoringManager } = require('./monitoring/monitoringManager');
const logger = require('./utils/logger');

// Флаг для запобігання подвійного завершення
let isShuttingDown = false;

// Головна async функція для запуску
async function main() {
  logger.info('[MAIN] 🚀 Запуск Вольтик...');
  logger.info('[MAIN] 📍 Timezone: ' + config.timezone);
  logger.info('[MAIN] 📊 Перевірка графіків: кожні ' + formatInterval(config.checkIntervalSeconds));
  logger.info('[MAIN] 💾 База даних: PostgreSQL');
  
  // КРИТИЧНО: Ініціалізація та міграція бази даних перед запуском
  await initializeDatabase();
  await runMigrations();

  // Ініціалізація централізованого state manager
  await initStateManager();

  // State restoration - centralized state manager handles most of this
  // restorePendingChannels() still needed as it restores from database
  logger.info('[MAIN] 🔄 Відновлення станів...');
  await restorePendingChannels();

  // Очистка старих станів (старше 24 годин)
  await cleanupOldStates();

  // Ініціалізація планувальника
  initScheduler(bot);

  // Ініціалізація захисту каналів
  initChannelGuard(bot);

  // Ініціалізація моніторингу живлення
  await startPowerMonitoring(bot);

  // Ініціалізація системи моніторингу та алертів
  logger.info('[MAIN] 🔎 Ініціалізація системи моніторингу...');
  monitoringManager.init(bot, {
    checkIntervalMinutes: 5,
    errorSpikeThreshold: 10,
    errorSpikeWindow: 5,
    repeatedErrorThreshold: 5,
    memoryThresholdMB: 500,
    maxUptimeDays: 7
  });
  await monitoringManager.start();
  logger.info('[MAIN] ✅ Система моніторингу запущена');

  // Check existing users for migration (run once on startup)
  setTimeout(() => {
    checkExistingUsers(bot);
  }, 5000); // Wait 5 seconds after startup
  
  logger.info('[MAIN] ✨ Бот успішно запущено та готовий до роботи!');
}

// Запуск з обробкою помилок
main().catch(error => {
  logger.error('[MAIN] ❌ Критична помилка запуску:', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Graceful shutdown з захистом від подвійного виклику
const shutdown = async (signal) => {
  if (isShuttingDown) {
    logger.warn('[SHUTDOWN] ⏳ Завершення вже виконується...');
    return;
  }
  isShuttingDown = true;
  
  logger.info(`[SHUTDOWN] ⏳ Отримано ${signal}, завершую роботу...`);
  
  try {
    // 1. Зупиняємо polling (припиняємо прийом нових повідомлень)
    await bot.stopPolling();
    logger.info('[SHUTDOWN] ✅ Polling зупинено');
    
    // 2. Зупиняємо scheduler manager
    schedulerManager.stop();
    logger.info('[SHUTDOWN] ✅ Scheduler manager зупинено');
    
    // 3. Зупиняємо state manager cleanup
    stopCleanup();
    logger.info('[SHUTDOWN] ✅ State manager зупинено');
    
    // 4. Зупиняємо cache cleanup
    const { stopCacheCleanup } = require('./api');
    stopCacheCleanup();
    logger.info('[SHUTDOWN] ✅ Cache cleanup зупинено');
    
    // 5. Зупиняємо систему моніторингу
    monitoringManager.stop();
    logger.info('[SHUTDOWN] ✅ Система моніторингу зупинена');
    
    // 6. Зупиняємо моніторинг живлення
    stopPowerMonitoring();
    logger.info('[SHUTDOWN] ✅ Моніторинг живлення зупинено');
    
    // 7. Зберігаємо всі стани користувачів
    await saveAllUserStates();
    logger.info('[SHUTDOWN] ✅ Стани користувачів збережено');
    
    // 8. Закриваємо базу даних коректно
    const { closeDatabase } = require('./database/db');
    await closeDatabase();
    
    logger.info('[SHUTDOWN] 👋 Бот завершив роботу');
    process.exit(0);
  } catch (error) {
    logger.error('[SHUTDOWN] ❌ Помилка при завершенні:', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

// Обробка сигналів завершення
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Обробка необроблених помилок
process.on('uncaughtException', async (error) => {
  logger.error('[PROCESS] ❌ Необроблена помилка:', { error: error.message, stack: error.stack });
  // Track error in monitoring system
  const metricsCollector = monitoringManager.getMetricsCollector();
  metricsCollector.trackError(error, { context: 'uncaughtException' });
  await shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[PROCESS] ❌ Необроблене відхилення промісу:', { reason: reason instanceof Error ? reason.message : reason });
  // Track error in monitoring system
  const metricsCollector = monitoringManager.getMetricsCollector();
  const error = reason instanceof Error ? reason : new Error(String(reason));
  metricsCollector.trackError(error, { context: 'unhandledRejection' });
});
