#!/usr/bin/env node

// Main entry point for the bot
import { createBot } from './bot.js';
import { createServer, startServer, stopServer } from './server.js';
import { initStorage, closeDatabase } from './services/storage.js';
import { startScheduleMonitoring, stopScheduleMonitoring } from './services/scheduleMonitor.js';
import { startMonitoring as startIpMonitoring, stopMonitoring as stopIpMonitoring } from './services/ipMonitor.js';
import { env } from './config/env.js';

let server = null;
let bot = null;
let isShuttingDown = false;

async function start() {
  console.log('🚀 Запуск Вольтик...');
  console.log(`📍 Timezone: ${env.TIMEZONE}`);
  console.log(`💾 База даних: ${env.DATABASE_PATH}`);
  console.log(`🔌 Режим: webhook`);
  console.log(`🌐 URL: ${env.WEBHOOK_URL}`);
  console.log(`📊 Перевірка графіків: кожні ${env.CHECK_INTERVAL_SECONDS} сек`);
  
  try {
    // Initialize storage (database)
    await initStorage();
    
    // Create bot instance
    bot = createBot();
    
    // Create Express app with webhook
    const app = createServer(bot);
    
    // Start server and set webhook
    server = await startServer(app, bot);
    
    // Start schedule monitoring
    startScheduleMonitoring(bot);
    
    // Start IP monitoring if configured
    if (env.ROUTER_HOST) {
      startIpMonitoring(bot, async (userId, isOnline) => {
        // Handle power state changes
        console.log(`Power state changed for user ${userId}: ${isOnline ? 'ON' : 'OFF'}`);
        // TODO: Send notification to user
      });
    }
    
    console.log('✨ Бот успішно запущено та готовий до роботи!');
  } catch (error) {
    console.error('❌ Помилка запуску:', error);
    process.exit(1);
  }
}

async function shutdown(signal) {
  if (isShuttingDown) {
    console.log('⏳ Завершення вже виконується...');
    return;
  }
  isShuttingDown = true;
  
  console.log(`\n⏳ Отримано ${signal}, завершую роботу...`);
  
  try {
    // Stop monitoring services
    stopScheduleMonitoring();
    stopIpMonitoring();
    
    // Stop HTTP server and remove webhook
    if (server && bot) {
      await stopServer(server, bot);
    }
    
    // Close database
    closeDatabase();
    
    console.log('👋 Бот завершив роботу');
    process.exit(0);
  } catch (error) {
    console.error('❌ Помилка при завершенні:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('❌ Необроблена помилка:', error);
  await shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Необроблене відхилення промісу:', reason);
});

// Start the bot
start();
