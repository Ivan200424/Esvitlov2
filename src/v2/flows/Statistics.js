/**
 * Statistics Flow
 * 
 * NEW implementation for v2 bot rewrite.
 * Handles statistics display.
 */

const { getStatisticsKeyboard, getNavigationKeyboard } = require('../keyboards/InlineKeyboard');
const { getUserData } = require('../migration/UserMigration');

/**
 * Show statistics menu
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {string} userId - User ID
 * @param {number} editMessageId - Message ID to edit (optional)
 */
async function showStatistics(bot, chatId, userId, editMessageId = null) {
  const message =
    '📈 <b>Статистика</b>\n\n' +
    'Оберіть період для перегляду статистики\n' +
    'відключень світла:';

  const keyboard = getStatisticsKeyboard();

  try {
    if (editMessageId) {
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: editMessageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    } else {
      await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    }
  } catch (error) {
    console.error('Error showing statistics:', error);
  }
}

/**
 * Show statistics for a period
 * @param {Object} bot - Telegram bot instance
 * @param {Object} query - Callback query
 * @param {string} period - Period (day, week, month)
 */
async function showStatisticsPeriod(bot, query, period) {
  const userId = String(query.from.id);
  const chatId = query.message.chat.id;

  try {
    // Get user data
    const userData = getUserData(userId);

    if (!userData) {
      await bot.answerCallbackQuery(query.id, {
        text: '❌ Користувач не знайдений',
        show_alert: true
      });
      return;
    }

    // Get statistics from database
    const { getOutageHistory } = require('../../database/db');

    let title = '';
    let daysAgo = 0;

    switch (period) {
      case 'day':
        title = 'за сьогодні';
        daysAgo = 1;
        break;
      case 'week':
        title = 'за тиждень';
        daysAgo = 7;
        break;
      case 'month':
        title = 'за місяць';
        daysAgo = 30;
        break;
      default:
        title = 'за період';
        daysAgo = 7;
    }

    // Calculate statistics
    const stats = await calculateStatistics(userData.id, daysAgo);

    const message =
      `📈 <b>Статистика ${title}</b>\n\n` +
      `⏱ <b>Всього без світла:</b> ${stats.totalOffTime}\n` +
      `✅ <b>Всього зі світлом:</b> ${stats.totalOnTime}\n` +
      `🔄 <b>Кількість відключень:</b> ${stats.outageCount}\n` +
      `📊 <b>Середня тривалість відключення:</b> ${stats.avgOutageDuration}\n\n` +
      `<i>Статистика базується на даних\n` +
      `IP моніторингу та графіках</i>`;

    await bot.editMessageText(message, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: getNavigationKeyboard('stats:back')
    });

  } catch (error) {
    console.error('Error showing statistics period:', error);
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Помилка отримання статистики',
      show_alert: true
    });
  }
}

/**
 * Calculate statistics for user
 * @param {number} userId - Internal user ID
 * @param {number} daysAgo - Number of days to look back
 * @returns {Object} - Statistics object
 */
async function calculateStatistics(userId, daysAgo) {
  try {
    const db = require('../../database/db');
    
    // Get outage history
    const stmt = db.prepare(`
      SELECT 
        state,
        changed_at,
        duration_minutes
      FROM power_history
      WHERE user_id = ?
        AND changed_at >= datetime('now', '-' || ? || ' days')
      ORDER BY changed_at DESC
    `);
    
    const history = stmt.all(userId, daysAgo);

    let totalOffMinutes = 0;
    let totalOnMinutes = 0;
    let outageCount = 0;

    for (const record of history) {
      if (record.state === 'off') {
        totalOffMinutes += record.duration_minutes || 0;
        outageCount++;
      } else if (record.state === 'on') {
        totalOnMinutes += record.duration_minutes || 0;
      }
    }

    return {
      totalOffTime: formatDuration(totalOffMinutes),
      totalOnTime: formatDuration(totalOnMinutes),
      outageCount,
      avgOutageDuration: outageCount > 0
        ? formatDuration(Math.round(totalOffMinutes / outageCount))
        : '0 хв'
    };
  } catch (error) {
    console.error('Error calculating statistics:', error);
    return {
      totalOffTime: '—',
      totalOnTime: '—',
      outageCount: 0,
      avgOutageDuration: '—'
    };
  }
}

/**
 * Format duration in minutes to human-readable string
 * @param {number} minutes - Duration in minutes
 * @returns {string} - Formatted duration
 */
function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes} хв`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours < 24) {
    return mins > 0 ? `${hours} год ${mins} хв` : `${hours} год`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  let result = `${days} д`;
  if (remainingHours > 0) {
    result += ` ${remainingHours} год`;
  }
  return result;
}

/**
 * Handle statistics callback queries
 * @param {Object} bot - Telegram bot instance
 * @param {Object} query - Callback query
 */
async function handleStatisticsCallback(bot, query) {
  const action = query.data.replace('stats:', '');
  const chatId = query.message.chat.id;
  const userId = String(query.from.id);

  switch (action) {
    case 'day':
    case 'week':
    case 'month':
      await showStatisticsPeriod(bot, query, action);
      break;

    case 'back':
      await showStatistics(bot, chatId, userId, query.message.message_id);
      break;

    default:
      await bot.answerCallbackQuery(query.id, {
        text: '❓ Невідома дія',
        show_alert: false
      });
  }
}

module.exports = {
  showStatistics,
  showStatisticsPeriod,
  handleStatisticsCallback
};
