#!/usr/bin/env node

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

// Флаг для запобігання подвійного завершення
let isShuttingDown = false;

console.log('🚀 Запуск Вольтик...');
console.log(`📍 Timezone: ${config.timezone}`);
console.log(`📊 Перевірка графіків: кожні ${formatInterval(config.checkIntervalSeconds)}`);
console.log(`💾 База даних: ${config.databasePath}`);

// Ініціалізація централізованого state manager
initStateManager();

// Відновлення станів з БД (legacy - буде мігровано до state manager)
console.log('🔄 Відновлення станів...');
restorePendingChannels();
restoreWizardStates();
restoreConversationStates();
restoreIpSetupStates();

// Очистка старих станів (старше 24 годин)
cleanupOldStates();

// Ініціалізація планувальника
initScheduler(bot);

// Ініціалізація захисту каналів
initChannelGuard(bot);

// Ініціалізація моніторингу живлення
startPowerMonitoring(bot);

// Check existing users for migration (run once on startup)
setTimeout(() => {
  checkExistingUsers(bot);
}, 5000); // Wait 5 seconds after startup

// Graceful shutdown з захистом від подвійного виклику
const shutdown = async (signal) => {
  if (isShuttingDown) {
    console.log('⏳ Завершення вже виконується...');
    return;
  }
  isShuttingDown = true;
  
  console.log(`\n⏳ Отримано ${signal}, завершую роботу...`);
  
  try {
    // 1. Зупиняємо polling (припиняємо прийом нових повідомлень)
    await bot.stopPolling();
    console.log('✅ Polling зупинено');
    
    // 2. Зупиняємо scheduler manager
    schedulerManager.stop();
    console.log('✅ Scheduler manager зупинено');
    
    // 3. Зупиняємо state manager cleanup
    stopCleanup();
    console.log('✅ State manager зупинено');
    
    // 4. Зупиняємо моніторинг живлення
    stopPowerMonitoring();
    console.log('✅ Моніторинг живлення зупинено');
    
    // 5. Зберігаємо всі стани користувачів
    await saveAllUserStates();
    console.log('✅ Стани користувачів збережено');
    
    // 6. Закриваємо базу даних коректно
    const { closeDatabase } = require('./database/db');
    closeDatabase();
    
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
  await shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Необроблене відхилення промісу:', reason);
});

console.log('✨ Бот успішно запущено та готовий до роботи!');
