const db = require('./database/db');

// Додати запис про відключення
function addOutageRecord(userId, startTime, endTime) {
  try {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMinutes = Math.floor((end - start) / (1000 * 60));
    
    if (durationMinutes < 0) {
      console.error('Invalid outage duration: end time before start time');
      return false;
    }
    
    const stmt = db.prepare(`
      INSERT INTO outage_history (user_id, start_time, end_time, duration_minutes)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(userId, startTime, endTime, durationMinutes);
    return true;
  } catch (error) {
    console.error('Error adding outage record:', error);
    return false;
  }
}

// Отримати статистику за тиждень
function getWeeklyStats(userId) {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const stmt = db.prepare(`
      SELECT * FROM outage_history
      WHERE user_id = ? AND start_time >= ?
      ORDER BY start_time DESC
    `);
    
    const records = stmt.all(userId, weekAgo.toISOString());
    
    if (records.length === 0) {
      return {
        count: 0,
        totalMinutes: 0,
        avgMinutes: 0,
        longest: null,
        shortest: null,
      };
    }
    
    const totalMinutes = records.reduce((sum, r) => sum + r.duration_minutes, 0);
    const avgMinutes = Math.floor(totalMinutes / records.length);
    
    // Знайти найдовше і найкоротше
    let longest = records[0];
    let shortest = records[0];
    
    records.forEach(record => {
      if (record.duration_minutes > longest.duration_minutes) {
        longest = record;
      }
      if (record.duration_minutes < shortest.duration_minutes) {
        shortest = record;
      }
    });
    
    return {
      count: records.length,
      totalMinutes,
      avgMinutes,
      longest,
      shortest,
    };
  } catch (error) {
    console.error('Error getting weekly stats:', error);
    return {
      count: 0,
      totalMinutes: 0,
      avgMinutes: 0,
      longest: null,
      shortest: null,
    };
  }
}

// Форматувати повідомлення статистики
function formatStatsMessage(stats) {
  if (stats.count === 0) {
    return '📊 За тиждень:\n\n✅ Відключень не було';
  }
  
  const { formatExactDuration } = require('./utils');
  
  const lines = [];
  lines.push('📊 За тиждень:');
  lines.push('');
  lines.push(`⚡ Відключень: ${stats.count}`);
  
  // Форматувати загальний час
  const totalDuration = formatExactDuration(stats.totalMinutes);
  lines.push(`🕓 Загальний час без світла: ${totalDuration}`);
  
  // Середня тривалість
  const avgDuration = formatExactDuration(stats.avgMinutes);
  lines.push(`📉 Середня тривалість: ${avgDuration}`);
  
  // Найдовше відключення
  if (stats.longest) {
    const longDuration = formatExactDuration(stats.longest.duration_minutes);
    const longDate = new Date(stats.longest.start_time);
    const longDateStr = `${String(longDate.getDate()).padStart(2, '0')}.${String(longDate.getMonth() + 1).padStart(2, '0')}`;
    const longStartTime = `${String(longDate.getHours()).padStart(2, '0')}:${String(longDate.getMinutes()).padStart(2, '0')}`;
    const longEndDate = new Date(stats.longest.end_time);
    const longEndTime = `${String(longEndDate.getHours()).padStart(2, '0')}:${String(longEndDate.getMinutes()).padStart(2, '0')}`;
    
    lines.push(`🏆 Найдовше: ${longDuration} (${longDateStr} ${longStartTime}-${longEndTime})`);
  }
  
  // Найкоротше відключення
  if (stats.shortest) {
    const shortDuration = formatExactDuration(stats.shortest.duration_minutes);
    const shortDate = new Date(stats.shortest.start_time);
    const shortDateStr = `${String(shortDate.getDate()).padStart(2, '0')}.${String(shortDate.getMonth() + 1).padStart(2, '0')}`;
    const shortStartTime = `${String(shortDate.getHours()).padStart(2, '0')}:${String(shortDate.getMinutes()).padStart(2, '0')}`;
    const shortEndDate = new Date(stats.shortest.end_time);
    const shortEndTime = `${String(shortEndDate.getHours()).padStart(2, '0')}:${String(shortEndDate.getMinutes()).padStart(2, '0')}`;
    
    lines.push(`🔋 Найкоротше: ${shortDuration} (${shortDateStr} ${shortStartTime}-${shortEndTime})`);
  }
  
  return lines.join('\n');
}

// Форматувати повідомлення статистики для popup (коротка версія до 200 символів)
function formatStatsPopup(stats, isChannel = false) {
  let message = '📈 Статистика за 7 днів\n\n';
  
  if (stats.count === 0) {
    message += '📊 Дані ще не зібрані\n';
    message += 'ℹ️ Статистика з\'явиться після першого\n';
    message += 'зафіксованого відключення.';
    // Only show IP monitoring suggestion in bot, not in channel
    if (!isChannel) {
      message += '\n\n💡 Підключіть IP-моніторинг для\n';
      message += 'автоматичного збору даних.';
    }
    return message;
  }
  
  const totalHours = Math.floor(stats.totalMinutes / 60);
  const totalMins = stats.totalMinutes % 60;
  const avgHours = Math.floor(stats.avgMinutes / 60);
  const avgMins = stats.avgMinutes % 60;
  
  message += `⚡ Відключень: ${stats.count}\n`;
  
  // Format total time
  let totalStr = '';
  if (totalHours > 0) {
    totalStr = `${totalHours} год`;
    if (totalMins > 0) totalStr += ` ${totalMins} хв`;
  } else {
    totalStr = `${totalMins} хв`;
  }
  message += `🕓 Загальний час без світла: ${totalStr}\n`;
  
  // Format average time
  let avgStr = '';
  if (avgHours > 0) {
    avgStr = `${avgHours} год`;
    if (avgMins > 0) avgStr += ` ${avgMins} хв`;
  } else {
    avgStr = `${avgMins} хв`;
  }
  message += `📉 Середня тривалість: ${avgStr}`;
  
  // TODO: Add longest and shortest outages if we have that data
  
  return message;
}

module.exports = {
  addOutageRecord,
  getWeeklyStats,
  formatStatsMessage,
  formatStatsPopup,
};
