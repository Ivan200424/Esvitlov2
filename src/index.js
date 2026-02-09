#!/usr/bin/env node

const express = require('express');
const bot = require('./bot');
const { restorePendingChannels } = require('./bot');
const { initScheduler, schedulerManager } = require('./scheduler');
const { startPowerMonitoring, stopPowerMonitoring, saveAllUserStates } = require('./powerMonitor');
const { initChannelGuard, checkExistingUsers } = require('./channelGuard');
const { formatInterval } = require('./utils');
const config = require('./config');
const { cleanupOldStates, closeDatabase } = require('./database/db');
const { restoreWizardStates } = require('./handlers/start');
const { restoreConversationStates } = require('./handlers/channel');
const { restoreIpSetupStates } = require('./handlers/settings');
const { initStateManager, stopCleanup } = require('./state/stateManager');
const { monitoringManager } = require('./monitoring/monitoringManager');
const { webhookCallback } = require('grammy');

// Constants
const WEBHOOK_TIMEOUT_MS = 25000; // 25 seconds safety timeout for webhook responses

// Флаг для запобігання подвійного завершення
let isShuttingDown = false;

// HTTP server for webhook mode
let server = null;

// Capacity monitor reference (assigned in initializeServices, used in shutdown)
let capacityMonitor = null;

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

// Shared function to initialize schedulers and monitoring services
function initializeServices(bot) {
  console.log('⏰ Ініціалізація планувальника...');
  initScheduler(bot);
  
  console.log('🛡️ Ініціалізація захисту каналів...');
  initChannelGuard(bot);
  
  console.log('⚡ Ініціалізація моніторингу живлення...');
  startPowerMonitoring(bot);
  
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
  
  console.log('📊 Ініціалізація системи контролю навантаження...');
  capacityMonitor = require('./monitoring/capacityMonitor');
  capacityMonitor.init({
    checkIntervalMs: 60 * 1000, // Check every minute
  });
  capacityMonitor.start();
  console.log('✅ Контроль навантаження запущено');
  
  // Check existing users for migration (run once on startup)
  setTimeout(() => {
    checkExistingUsers(bot);
  }, 5000); // Wait 5 seconds after startup
}

// Start the bot based on mode
if (config.botMode === 'webhook') {
  // Webhook mode
  if (!config.webhookUrl) {
    console.error('❌ WEBHOOK_URL не встановлений для webhook режиму');
    process.exit(1);
  }

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Configure webhookCallback options once
  const webhookCallbackOptions = config.webhookSecret ? { secretToken: config.webhookSecret } : undefined;

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      uptime: process.uptime(),
      mode: 'webhook'
    });
  });

  // Webhook status endpoint for debugging
  app.get('/webhook-status', async (req, res) => {
    try {
      const info = await bot.api.getWebhookInfo();
      res.json({
        status: 'ok',
        webhook: {
          url: info.url,
          has_custom_certificate: info.has_custom_certificate,
          pending_update_count: info.pending_update_count,
          last_error_date: info.last_error_date,
          last_error_message: info.last_error_message,
          max_connections: info.max_connections,
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Webhook endpoint with logging and timeout protection
  app.post('/webhook',
    // Middleware 1: logging
    (req, res, next) => {
      const updateId = req.body?.update_id || 'unknown';
      let updateType = 'other';
      if (req.body?.message) updateType = 'message';
      else if (req.body?.callback_query) updateType = 'callback_query';
      else if (req.body?.my_chat_member) updateType = 'my_chat_member';
      
      const hasSecretToken = !!req.headers['x-telegram-bot-api-secret-token'];
      console.log(`📨 Webhook IN: update_id=${updateId}, type=${updateType}, secret=${hasSecretToken}`);
      
      res.on('finish', () => {
        console.log(`📤 Webhook OUT: update_id=${updateId}, status=${res.statusCode}`);
      });
      
      next();
    },
    // Middleware 2: timeout protection
    (req, res, next) => {
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          console.error('⚠️ Webhook timeout - sending 200 to prevent Telegram retry storm');
          res.status(200).json({ ok: true });
        }
      }, WEBHOOK_TIMEOUT_MS);

      const cleanupTimeout = () => clearTimeout(timeout);
      res.on('finish', cleanupTimeout);
      res.on('close', cleanupTimeout);
      next();
    },
    // Middleware 3: grammY webhook handler — LAST, no wrapper
    webhookCallback(bot, 'express', webhookCallbackOptions)
  );

  // Express error handler - must be AFTER all routes (4 params required for error handler)
  app.use((err, req, res, _next) => {
    console.error('❌ Express error handler:', err);
    // Track error in monitoring system
    const metricsCollector = monitoringManager.getMetricsCollector();
    metricsCollector.trackError(err, { context: 'expressErrorHandler' });
    // Always respond 200 to prevent issues
    if (!res.headersSent) {
      res.status(200).json({ ok: true });
    }
  });

  // Start HTTP server
  server = app.listen(config.webhookPort, async () => {
    console.log(`🌐 HTTP сервер запущено на порті ${config.webhookPort}`);
    
    // Initialize bot (required in webhook mode - bot.start() does this automatically in polling mode)
    try {
      await bot.init();
      console.log('✅ Бот ініціалізовано');
    } catch (error) {
      console.error('❌ Помилка ініціалізації бота:', error);
      process.exit(1);
    }

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
        secret_token: webhookOptions.secret_token,
        drop_pending_updates: true
      });
      
      console.log(`✅ Webhook встановлено: ${webhookOptions.url}`);
      if (config.webhookSecret) {
        console.log('🔐 Secret token активовано');
      }
      
      // Initialize schedulers and monitoring AFTER webhook is ready
      initializeServices(bot);
    } catch (error) {
      console.error('❌ Помилка встановлення webhook:', error);
      process.exit(1);
    }
    
    console.log('✨ Бот успішно запущено та готовий до роботи (webhook режим)!');
  });
} else {
  // Polling mode (default)
  
  // Start minimal HTTP server for Railway health checks
  const healthApp = express();
  healthApp.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      uptime: process.uptime(),
      mode: 'polling',
      memory: process.memoryUsage()
    });
  });
  
  const healthPort = parseInt(process.env.PORT || process.env.WEBHOOK_PORT || '3000', 10);
  server = healthApp.listen(healthPort, () => {
    console.log(`🏥 Health-check сервер запущено на порті ${healthPort}`);
  });
  
  bot.start();
  console.log('✨ Бот успішно запущено та готовий до роботи (polling режим)!');
  
  // Initialize schedulers and monitoring for polling mode
  initializeServices(bot);
}

// Обробка сигналів завершення
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Обробка необроблених помилок
process.on('uncaughtException', async (error) => {
  console.error('🚨 Uncaught Exception:', error);
  // Track error in monitoring system
  const metricsCollector = monitoringManager.getMetricsCollector();
  metricsCollector.trackError(error, { context: 'uncaughtException' });
  
  // In webhook mode, try to keep running instead of shutting down
  if (config.botMode !== 'webhook') {
    await shutdown('UNCAUGHT_EXCEPTION');
  }
  // Don't exit — try to keep running in webhook mode
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection:', reason);
  // Track error in monitoring system
  const metricsCollector = monitoringManager.getMetricsCollector();
  const error = reason instanceof Error ? reason : new Error(String(reason));
  metricsCollector.trackError(error, { context: 'unhandledRejection' });
  // Don't exit — try to keep running
});

// Graceful shutdown з захистом від подвійного виклику
const shutdown = async (signal) => {
  if (isShuttingDown) {
    console.log('⏳ Завершення вже виконується...');
    return;
  }
  isShuttingDown = true;
  
  console.log(`\n⏳ Отримано ${signal}, завершую роботу...`);
  
  let hasError = false;
  
  // 1. Зупиняємо бота (припиняємо прийом нових повідомлень)
  try {
    if (config.botMode === 'webhook') {
      try {
        await bot.api.deleteWebhook();
        console.log('✅ Webhook видалено');
      } catch (error) {
        console.error('Помилка видалення webhook:', error.message);
      }
      
      if (server) {
        await new Promise((resolve) => {
          server.close(() => {
            console.log('✅ HTTP сервер зупинено');
            resolve();
          });
        });
      }
    } else {
      await bot.stop();
      console.log('✅ Polling зупинено');
      
      // Close health check server in polling mode
      if (server) {
        await new Promise((resolve) => {
          server.close(() => {
            console.log('✅ Health-check сервер зупинено');
            resolve();
          });
        });
      }
    }
  } catch (error) {
    console.error('❌ Помилка зупинки бота:', error.message);
    hasError = true;
  }
  
  // 2. Зупиняємо scheduler manager
  try {
    schedulerManager.stop();
    console.log('✅ Scheduler manager зупинено');
  } catch (error) {
    console.error('❌ Помилка зупинки scheduler:', error.message);
    hasError = true;
  }
  
  // 3. Зупиняємо state manager cleanup
  try {
    stopCleanup();
    console.log('✅ State manager зупинено');
  } catch (error) {
    console.error('❌ Помилка зупинки state manager:', error.message);
    hasError = true;
  }
  
  // 4. Зупиняємо контроль навантаження
  try {
    if (capacityMonitor) {
      capacityMonitor.stop();
    }
    console.log('✅ Контроль навантаження зупинено');
  } catch (error) {
    console.error('❌ Помилка зупинки capacity monitor:', error.message);
    hasError = true;
  }
  
  // 5. Зупиняємо систему моніторингу
  try {
    monitoringManager.stop();
    console.log('✅ Система моніторингу зупинена');
  } catch (error) {
    console.error('❌ Помилка зупинки моніторингу:', error.message);
    hasError = true;
  }
  
  // 6. Зупиняємо моніторинг живлення
  try {
    stopPowerMonitoring();
    console.log('✅ Моніторинг живлення зупинено');
  } catch (error) {
    console.error('❌ Помилка зупинки моніторингу живлення:', error.message);
    hasError = true;
  }
  
  // 7. Зберігаємо всі стани користувачів
  try {
    await saveAllUserStates();
    console.log('✅ Стани користувачів збережено');
  } catch (error) {
    console.error('❌ Помилка збереження станів:', error.message);
    hasError = true;
  }
  
  // 8. Закриваємо базу даних коректно
  try {
    closeDatabase();
    console.log('✅ Базу даних закрито');
  } catch (error) {
    console.error('❌ Помилка закриття бази даних:', error.message);
    hasError = true;
  }
  
  console.log('👋 Бот завершив роботу');
  process.exit(hasError ? 1 : 0);
};
