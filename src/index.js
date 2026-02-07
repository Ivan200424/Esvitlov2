#!/usr/bin/env node

const express = require('express');
const bot = require('./bot');
const { restorePendingChannels } = require('./bot');
const { initScheduler, schedulerManager } = require('./scheduler');
const { startPowerMonitoring, stopPowerMonitoring, saveAllUserStates } = require('./powerMonitor');
const { initChannelGuard, checkExistingUsers } = require('./channelGuard');
const { formatInterval } = require('./utils');
const config = require('./config');
const { cleanupOldStates } = require('./database/db');
const { restoreWizardStates } = require('./handlers/start');
const { restoreConversationStates } = require('./handlers/channel');
const { restoreIpSetupStates } = require('./handlers/settings');
const { initStateManager, stopCleanup } = require('./state/stateManager');
const { monitoringManager } = require('./monitoring/monitoringManager');
const { webhookCallback } = require('grammy');

// Флаг для запобігання подвійного завершення
let isShuttingDown = false;

// HTTP server for webhook mode
let server = null;

console.log('🚀 Запуск Вольтик...');
console.log(`📍 Timezone: ${config.timezone}`);
console.log(`📊 Перевірка графіків: кожні ${formatInterval(config.checkIntervalSeconds)}`);
console.log(`💾 База даних: ${config.databasePath}`);
console.log(`🔌 Режим: ${config.botMode}`);

// Ініціалізація централізованого state manager
initStateManager();

// Legacy state restoration calls - can be removed once state manager migration is complete
// These are now handled by initStateManager() but kept for backward compatibility
console.log('🔄 Відновлення станів...');
restorePendingChannels(); // TODO: Migrate to state manager
restoreWizardStates(); // Handled by state manager
restoreConversationStates(); // Handled by state manager
restoreIpSetupStates(); // Handled by state manager

// Очистка старих станів (старше 24 годин)
cleanupOldStates();

// Ініціалізація планувальника
initScheduler(bot);

// Ініціалізація захисту каналів
initChannelGuard(bot);

// Ініціалізація моніторингу живлення
startPowerMonitoring(bot);

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
monitoringManager.start();
console.log('✅ Система моніторингу запущена');

// Ініціалізація системи контролю навантаження (capacity planning)
console.log('📊 Ініціалізація системи контролю навантаження...');
const capacityMonitor = require('./monitoring/capacityMonitor');
capacityMonitor.init({
  checkIntervalMs: 60 * 1000, // Check every minute
});
capacityMonitor.start();
console.log('✅ Контроль навантаження запущено');

// Check existing users for migration (run once on startup)
setTimeout(() => {
  checkExistingUsers(bot);
}, 5000); // Wait 5 seconds after startup

// Start the bot based on mode
if (config.botMode === 'webhook') {
  // Webhook mode
  if (!config.webhookUrl) {
    console.error('❌ WEBHOOK_URL не встановлений для webhook режиму');
    process.exit(1);
  }

  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      uptime: process.uptime(),
      mode: 'webhook'
    });
  });

  // Webhook endpoint
  app.post('/webhook', webhookCallback(bot, 'express'));

  // Start HTTP server
  server = app.listen(config.webhookPort, async () => {
    console.log(`🌐 HTTP сервер запущено на порті ${config.webhookPort}`);
    
    // Set webhook with optional secret token
    try {
      const webhookOptions = {
        url: `${config.webhookUrl}/webhook`
      };
      
      // Add secret token if configured (Telegram validates this automatically)
      if (config.webhookSecret) {
        webhookOptions.secret_token = config.webhookSecret;
      }
      
      await bot.api.setWebhook(webhookOptions.url, {
        secret_token: webhookOptions.secret_token
      });
      
      console.log(`✅ Webhook встановлено: ${webhookOptions.url}`);
      if (config.webhookSecret) {
        console.log('🔐 Secret token активовано');
      }
    } catch (error) {
      console.error('❌ Помилка встановлення webhook:', error);
      process.exit(1);
    }
    
    console.log('✨ Бот успішно запущено та готовий до роботи (webhook режим)!');
  });
} else {
  // Polling mode (default)
  bot.start();
  console.log('✨ Бот успішно запущено та готовий до роботи (polling режим)!');
}

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

// Graceful shutdown з захистом від подвійного виклику
const shutdown = async (signal) => {
  if (isShuttingDown) {
    console.log('⏳ Завершення вже виконується...');
    return;
  }
  isShuttingDown = true;
  
  console.log(`\n⏳ Отримано ${signal}, завершую роботу...`);
  
  try {
    // 1. Зупиняємо бота (припиняємо прийом нових повідомлень)
    if (config.botMode === 'webhook') {
      // Remove webhook
      try {
        await bot.api.deleteWebhook();
        console.log('✅ Webhook видалено');
      } catch (error) {
        console.error('Помилка видалення webhook:', error.message);
      }
      
      // Close HTTP server
      if (server) {
        await new Promise((resolve) => {
          server.close(() => {
            console.log('✅ HTTP сервер зупинено');
            resolve();
          });
        });
      }
    } else {
      // Stop polling
      await bot.stop();
      console.log('✅ Polling зупинено');
    }
    
    // 2. Зупиняємо scheduler manager
    schedulerManager.stop();
    console.log('✅ Scheduler manager зупинено');
    
    // 3. Зупиняємо state manager cleanup
    stopCleanup();
    console.log('✅ State manager зупинено');
    
    // 4. Зупиняємо контроль навантаження
    capacityMonitor.stop();
    console.log('✅ Контроль навантаження зупинено');
    
    // 5. Зупиняємо систему моніторингу
    monitoringManager.stop();
    console.log('✅ Система моніторингу зупинена');
    
    // 6. Зупиняємо моніторинг живлення
    stopPowerMonitoring();
    console.log('✅ Моніторинг живлення зупинено');
    
    // 7. Зберігаємо всі стани користувачів
    await saveAllUserStates();
    console.log('✅ Стани користувачів збережено');
    
    // 8. Закриваємо базу даних коректно
    const { closeDatabase } = require('./database/db');
    closeDatabase();
    
    console.log('👋 Бот завершив роботу');
    process.exit(0);
  } catch (error) {
    console.error('❌ Помилка при завершенні:', error);
    process.exit(1);
  }
};
