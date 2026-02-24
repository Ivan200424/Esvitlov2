const { fetchScheduleData } = require('./api');
const { parseScheduleForQueue, findNextEvent } = require('./parser');
const { calculateHash } = require('./utils');
const usersDb = require('./database/users');
const { REGION_CODES } = require('./constants/regions');
const schedulerManager = require('./scheduler/schedulerManager');
const { getSetting } = require('./database/db');
const { InputFile } = require('grammy');
const { isTelegramUserInactiveError } = require('./utils/errorHandler');
const logger = require('./logger').child({ module: 'scheduler' });

let bot = null;

/**
 * Initialize scheduler using centralized scheduler manager
 * @param {object} botInstance - Telegram bot instance
 */
async function initScheduler(botInstance) {
  bot = botInstance;
  logger.info('📅 Ініціалізація планувальника...');

  // Read interval from database instead of config
  const intervalStr = await getSetting('schedule_check_interval', '60');
  let checkIntervalSeconds = parseInt(intervalStr, 10);

  // Validate the interval
  if (isNaN(checkIntervalSeconds) || checkIntervalSeconds < 1) {
    logger.warn(`⚠️ Invalid schedule_check_interval "${intervalStr}", using default 60 seconds`);
    checkIntervalSeconds = 60;
  }

  // Initialize scheduler manager
  schedulerManager.init({
    checkIntervalSeconds: checkIntervalSeconds
  });

  // Start schedulers with dependencies
  schedulerManager.start({
    bot: botInstance,
    checkAllSchedules: checkAllSchedules
  });

  logger.info(`✅ Планувальник запущено через scheduler manager`);
}

// Guard against overlapping checkAllSchedules calls
let isCheckingSchedules = false;

// Перевірка всіх графіків
async function checkAllSchedules() {
  if (isCheckingSchedules) {
    logger.info('⚠️ checkAllSchedules already running, skipping');
    return;
  }
  isCheckingSchedules = true;

  try {
    // Use Promise.allSettled for parallel region checking
    const results = await Promise.allSettled(
      REGION_CODES.map(region => checkRegionSchedule(region))
    );

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(`Помилка перевірки регіону ${REGION_CODES[index]}:`, result.reason);
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Помилка при перевірці графіків');
  } finally {
    isCheckingSchedules = false;
  }
}

// Перевірка графіка конкретного регіону
async function checkRegionSchedule(region) {
  try {
    // Отримуємо дані для регіону
    const data = await fetchScheduleData(region);

    // Отримуємо всіх користувачів для цього регіону
    const users = await usersDb.getUsersByRegion(region);

    if (users.length === 0) {
      return;
    }

    logger.info(`Перевірка ${region}: знайдено ${users.length} користувачів`);

    for (const user of users) {
      try {
        await checkUserSchedule(user, data);
      } catch (error) {
        logger.error({ err: error }, `Помилка перевірки графіка для користувача ${user.telegram_id}`);
      }
    }

  } catch (error) {
    logger.error({ err: error }, `Помилка при перевірці графіка для ${region}`);
  }
}

// Перевірка графіка для конкретного користувача
async function checkUserSchedule(user, data) {
  try {
    // Skip blocked channels
    if (user.channel_status === 'blocked') {
      logger.info(`[${user.telegram_id}] Пропущено - канал заблоковано`);
      return;
    }

    const queueKey = `GPV${user.queue}`;

    // Отримуємо timestamps для сьогодні та завтра
    const availableTimestamps = Object.keys(data?.fact?.data || {}).map(Number).sort((a, b) => a - b);
    const todayTimestamp = availableTimestamps[0] || null;
    const tomorrowTimestamp = availableTimestamps.length > 1 ? availableTimestamps[1] : null;

    const newHash = calculateHash(data, queueKey, todayTimestamp, tomorrowTimestamp);

    // Перевіряємо чи хеш змінився з останньої перевірки
    const hasChanged = newHash !== user.last_hash;

    // ВАЖЛИВО: Якщо хеш не змінився - нічого не робимо (запобігає дублікатам при перезапуску)
    if (!hasChanged) {
      return;
    }

    // Перевіряємо чи графік вже опублікований з цим хешем
    if (newHash === user.last_published_hash) {
      // Оновлюємо last_hash для синхронізації
      await usersDb.updateUserHash(user.id, newHash);
      return;
    }

    // Парсимо графік
    const scheduleData = parseScheduleForQueue(data, user.queue);
    const nextEvent = findNextEvent(scheduleData);

    // Отримуємо налаштування куди публікувати
    const notifyTarget = user.power_notify_target || 'both';

    logger.info(`[${user.telegram_id}] Графік оновлено, публікуємо (target: ${notifyTarget})`);

    // Відправляємо в особистий чат користувача
    if (notifyTarget === 'bot' || notifyTarget === 'both') {
      try {
        const { formatScheduleMessage } = require('./formatter');
        const { fetchScheduleImage } = require('./api');

        const message = formatScheduleMessage(user.region, user.queue, scheduleData, nextEvent);

        // Спробуємо з фото
        try {
          const imageBuffer = await fetchScheduleImage(user.region, user.queue);
          const photoInput = Buffer.isBuffer(imageBuffer) ? new InputFile(imageBuffer, 'schedule.png') : imageBuffer;
          await bot.api.sendPhoto(user.telegram_id, photoInput, {
            caption: message,
            parse_mode: 'HTML'
          });
        } catch (_imgError) {
          // Без фото
          await bot.api.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
        }

        logger.info(`📱 Графік відправлено користувачу ${user.telegram_id}`);
      } catch (error) {
        if (isTelegramUserInactiveError(error)) {
          logger.info(`ℹ️ Користувач ${user.telegram_id} заблокував бота або недоступний — сповіщення вимкнено`);
          await usersDb.setUserActive(user.telegram_id, false);
        } else {
          logger.error({ err: error }, `Помилка відправки графіка користувачу ${user.telegram_id}`);
        }
      }
    }

    // Оновлюємо хеші після відправки в бот, але перед каналом
    // Це запобігає дублікатам, якщо публікація в канал не вдається
    await usersDb.updateUserHashes(user.id, newHash);

    // Відправляємо в канал (незалежно від відправки в бот)
    if (user.channel_id && (notifyTarget === 'channel' || notifyTarget === 'both')) {
      try {
        const { publishScheduleWithPhoto } = require('./publisher');
        const sentMsg = await publishScheduleWithPhoto(bot, user, user.region, user.queue, { force: true });
        if (sentMsg && sentMsg.message_id) {
          await usersDb.updateUserPostId(user.id, sentMsg.message_id);
        }
        logger.info(`📢 Графік опубліковано в канал ${user.channel_id}`);
      } catch (channelError) {
        if (isTelegramUserInactiveError(channelError)) {
          logger.info(`ℹ️ Канал ${user.channel_id} недоступний — публікацію пропущено`);
        } else {
          logger.error({ err: channelError }, `Не вдалося відправити в канал ${user.channel_id}`);
        }
        // Channel error doesn't affect hash — prevents duplicates in bot
      }
    }

  } catch (error) {
    logger.error({ err: error }, `Помилка checkUserSchedule для користувача ${user.telegram_id}`);
  }
}

module.exports = {
  initScheduler,
  checkAllSchedules,
  schedulerManager, // Export manager for external control
};
