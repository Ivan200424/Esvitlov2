#!/usr/bin/env node

const bot = require('./bot');
const { restorePendingChannels } = require('./bot');
const { initScheduler, schedulerManager } = require('./scheduler');
const { startPowerMonitoring, stopPowerMonitoring, saveAllUserStates } = require('./powerMonitor');
const { initChannelGuard, checkExistingUsers } = require('./channelGuard');
const { formatInterval } = require('./utils');
const config = require('./config');
const { initializeDatabase, runMigrations, cleanupOldStates, checkPoolHealth, startPoolMetricsLogging } = require('./database/db');
const { restoreWizardStates } = require('./handlers/start');
const { restoreConversationStates } = require('./handlers/channel');
const { restoreIpSetupStates } = require('./handlers/settings');
const { initStateManager, stopCleanup } = require('./state/stateManager');
const { monitoringManager } = require('./monitoring/monitoringManager');
const { startHealthCheck, stopHealthCheck } = require('./healthcheck');
const messageQueue = require('./utils/messageQueue');

// Флаг для запобігання подвійного завершення
let isShuttingDown = false;

// Головна async функція для запуску
async function main() {
  console.log('🚀 Запуск Вольтик...');
  console.log(`📍 Timezone: ${config.timezone}`);
  console.log(`📊 Перевірка графіків: кожні ${formatInterval(config.checkIntervalSeconds)}`);
  console.log(`💾 База даних: PostgreSQL`);
  
  // КРИТИЧНО: Ініціалізація та міграція бази даних перед запуском
  await initializeDatabase();
  await runMigrations();
  
  // Перевірка здоров'я пулу підключень
  await checkPoolHealth();
  
  // Запуск логування метрик пулу
  startPoolMetricsLogging();

  // Ініціалізація message queue
  messageQueue.init(bot);
  
  // Ініціалізація централізованого state manager
  await initStateManager();

  // Legacy state restoration calls - can be removed once state manager migration is complete
  // These are now handled by initStateManager() but kept for backward compatibility
  console.log('🔄 Відновлення станів...');
  await restorePendingChannels(); // TODO: Migrate to state manager
  restoreWizardStates(); // Handled by state manager
  restoreConversationStates(); // Handled by state manager
  restoreIpSetupStates(); // Handled by state manager

  // Очистка старих станів (старше 24 годин)
  await cleanupOldStates();

  // Ініціалізація планувальника
  initScheduler(bot);

  // Ініціалізація захисту каналів
  initChannelGuard(bot);

  // Ініціалізація моніторингу живлення
  await startPowerMonitoring(bot);

  // Ініціалізація системи моніторингу та алертів
  console.log('🔎 Ініціалізація системи моніторингу...');
  monitoringManager.init(bot, {
    checkIntervalMinutes: 5,
    errorSpikeThreshold: 10,
    errorSpikeWindow: 5,
    repeatedErrorThreshold: 5,
    memoryThresholdMB: 500,
    maxUptimeDays: 7
  });
  await monitoringManager.start();
  console.log('✅ Система моніторингу запущена');
  
  // Запуск health check server
  startHealthCheck(bot, config.HEALTH_PORT);

  // Check existing users for migration (run once on startup)
  setTimeout(() => {
    checkExistingUsers(bot);
  }, 5000); // Wait 5 seconds after startup
  
  console.log('✨ Бот успішно запущено та готовий до роботи!');
}

// Запуск з обробкою помилок
main().catch(error => {
  console.error('❌ Критична помилка запуску:', error);
  process.exit(1);
});

// Graceful shutdown з захистом від подвійного виклику
const shutdown = async (signal) => {
  if (isShuttingDown) {
    console.log('⏳ Завершення вже виконується...');
    return;
  }
  isShuttingDown = true;
  
  console.log(`\n⏳ Отримано ${signal}, завершую роботу...`);
  
  try {
    // 1. Зупиняємо прийом повідомлень
    if (config.USE_WEBHOOK) {
      await bot.deleteWebHook();
      console.log('✅ Webhook видалено');
    } else {
      await bot.stopPolling();
      console.log('✅ Polling зупинено');
    }
    
    // 2. Drain message queue (wait for pending messages)
    await messageQueue.drain();
    console.log('✅ Message queue drained');
    
    // 3. Зупиняємо scheduler manager
    schedulerManager.stop();
    console.log('✅ Scheduler manager зупинено');
    
    // 4. Зупиняємо state manager cleanup
    stopCleanup();
    console.log('✅ State manager зупинено');
    
    // 5. Зупиняємо cache cleanup
    const { stopCacheCleanup } = require('./api');
    stopCacheCleanup();
    console.log('✅ Cache cleanup зупинено');
    
    // 6. Зупиняємо систему моніторингу
    monitoringManager.stop();
    console.log('✅ Система моніторингу зупинена');
    
    // 7. Зупиняємо моніторинг живлення
    stopPowerMonitoring();
    console.log('✅ Моніторинг живлення зупинено');
    
    // 8. Зберігаємо всі стани користувачів
    await saveAllUserStates();
    console.log('✅ Стани користувачів збережено');
    
    // 9. Зупиняємо health check server
    stopHealthCheck();
    console.log('✅ Health check server stopped');
    
    // 10. Закриваємо базу даних коректно
    const { closeDatabase } = require('./database/db');
    await closeDatabase();
    
    console.log('👋 Бот завершив роботу');
    process.exit(0);
  } catch (error) {
    console.error('❌ Помилка при завершенні:', error);
    process.exit(1);
  }
};

// Обробка сигналів завершення
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Обробка необроблених помилок
process.on('uncaughtException', async (error) => {
  console.error('❌ Необроблена помилка:', error);
  // Track error in monitoring system
  const metricsCollector = monitoringManager.getMetricsCollector();
  metricsCollector.trackError(error, { context: 'uncaughtException' });
  await shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Необроблене відхилення промісу:', reason);
  // Track error in monitoring system
  const metricsCollector = monitoringManager.getMetricsCollector();
  const error = reason instanceof Error ? reason : new Error(String(reason));
  metricsCollector.trackError(error, { context: 'unhandledRejection' });
});
