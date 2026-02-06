#!/usr/bin/env node

/**
 * V2 Bot Entry Point
 * 
 * NEW implementation for v2 bot rewrite.
 * This replaces the old index.js with the new v2 bot.
 * 
 * Maintains compatibility with existing infrastructure:
 * - Power monitoring
 * - Scheduler
 * - Channel guard
 * - Database
 */

// Import v2 bot
const { bot } = require('./bot');

// Import existing infrastructure (preserve functionality)
const { initScheduler, schedulerManager } = require('../scheduler');
const { startPowerMonitoring, stopPowerMonitoring, saveAllUserStates } = require('../powerMonitor');
const { initChannelGuard } = require('../channelGuard');
const { formatInterval } = require('../utils');
const config = require('../config');
const { cleanupOldStates } = require('../database/db');
const { monitoringManager } = require('../monitoring/monitoringManager');

// Flag to prevent double shutdown
let isShuttingDown = false;

console.log('🚀 Запуск Вольтик V2...');
console.log(`📍 Timezone: ${config.timezone}`);
console.log(`📊 Перевірка графіків: кожні ${formatInterval(config.checkIntervalSeconds)}`);
console.log(`💾 База даних: ${config.databasePath}`);

// Clean up old states (older than 24 hours)
cleanupOldStates();

// Initialize scheduler
initScheduler(bot);

// Initialize channel guard
initChannelGuard(bot);

// Initialize power monitoring
startPowerMonitoring(bot);

// Initialize monitoring system
console.log('🔎 Ініціалізація системи моніторингу...');
monitoringManager.init(bot, {
  checkIntervalMinutes: 5,
  errorSpikeThreshold: 10,
  errorSpikeWindow: 5,
  repeatedErrorThreshold: 5,
  memoryThresholdMB: 500,
  maxUptimeDays: 7
});
monitoringManager.start();
console.log('✅ Система моніторингу запущена');

// Initialize capacity monitoring
console.log('📊 Ініціалізація системи контролю навантаження...');
const capacityMonitor = require('../monitoring/capacityMonitor');
capacityMonitor.init({
  checkIntervalMs: 60 * 1000, // Check every minute
});
capacityMonitor.start();
console.log('✅ Контроль навантаження запущено');

// Graceful shutdown
const shutdown = async (signal) => {
  if (isShuttingDown) {
    console.log('⏳ Завершення вже виконується...');
    return;
  }
  isShuttingDown = true;

  console.log(`\n⏳ Отримано ${signal}, завершую роботу...`);

  try {
    // 1. Stop polling
    await bot.stopPolling();
    console.log('✅ Polling зупинено');

    // 2. Stop scheduler
    schedulerManager.stop();
    console.log('✅ Scheduler manager зупинено');

    // 3. Stop capacity monitor
    capacityMonitor.stop();
    console.log('✅ Контроль навантаження зупинено');

    // 4. Stop monitoring system
    monitoringManager.stop();
    console.log('✅ Система моніторингу зупинена');

    // 5. Stop power monitoring
    stopPowerMonitoring();
    console.log('✅ Моніторинг живлення зупинено');

    // 6. Save all user states
    await saveAllUserStates();
    console.log('✅ Стани користувачів збережено');

    // 7. Close database
    const { closeDatabase } = require('../database/db');
    closeDatabase();

    console.log('👋 Бот завершив роботу');
    process.exit(0);
  } catch (error) {
    console.error('❌ Помилка при завершенні:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('❌ Необроблена помилка:', error);
  const metricsCollector = monitoringManager.getMetricsCollector();
  metricsCollector.trackError(error, { context: 'uncaughtException' });
  await shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Необроблене відхилення промісу:', reason);
  const metricsCollector = monitoringManager.getMetricsCollector();
  const error = reason instanceof Error ? reason : new Error(String(reason));
  metricsCollector.trackError(error, { context: 'unhandledRejection' });
});

console.log('✨ Вольтик V2 успішно запущено та готовий до роботи!');
