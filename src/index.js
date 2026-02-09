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

// Constants
const WEBHOOK_TIMEOUT_MS = 25000; // 25 seconds safety timeout for webhook responses

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

  // Webhook endpoint with timeout protection and error boundary
  app.post('/webhook', (req, res, next) => {
    // Log incoming webhook requests for debugging
    const updateId = req.body?.update_id || 'unknown';
    let updateType = 'other';
    if (req.body?.message) updateType = 'message';
    else if (req.body?.callback_query) updateType = 'callback_query';
    else if (req.body?.my_chat_member) updateType = 'my_chat_member';
    
    // Check for secret token header
    const hasSecretToken = !!req.headers['x-telegram-bot-api-secret-token'];
    console.log(`📨 Webhook IN: update_id=${updateId}, type=${updateType}, secret=${hasSecretToken}`);
    
    // Track response
    const origEnd = res.end;
    res.end = function(...args) {
      console.log(`📤 Webhook OUT: update_id=${updateId}, status=${res.statusCode}`);
      origEnd.apply(res, args);
    };
    
    next();
  }, (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        console.error('⚠️ Webhook timeout - sending 200 to prevent Telegram retry storm');
        res.status(200).json({ ok: true });
      }
    }, WEBHOOK_TIMEOUT_MS);

    // Clear timeout on finish, close, or error
    const cleanupTimeout = () => clearTimeout(timeout);
    res.on('finish', cleanupTimeout);
    res.on('close', cleanupTimeout);
    res.on('error', cleanupTimeout);
    next();
  }, async (req, res) => {
    // Global error boundary to prevent webhook processing from ever throwing
    try {
      // Configure webhookCallback with secretToken if one is set
      const webhookOptions = {};
      if (config.webhookSecret) {
        webhookOptions.secretToken = config.webhookSecret;
      }
      await webhookCallback(bot, 'express', webhookOptions)(req, res);
    } catch (error) {
      console.error('❌ Fatal webhook processing error:', error);
      // Track error in monitoring system
      const metricsCollector = monitoringManager.getMetricsCollector();
      metricsCollector.trackError(error, { context: 'webhookCallback' });
      // Always respond 200 to prevent Telegram from retrying
      if (!res.headersSent) {
        res.status(200).json({ ok: true });
      }
    }
  });

  // Express error handler - must be AFTER all routes
  app.use((err, req, res, next) => {
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
