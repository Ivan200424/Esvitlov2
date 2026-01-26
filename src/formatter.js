const { formatTime, formatDate, formatTimeRemaining, escapeHtml, formatDurationFromMs } = require('./utils');
const { REGIONS } = require('./constants/regions');

// Форматувати повідомлення про графік
function formatScheduleMessage(region, queue, scheduleData, nextEvent) {
  const regionName = REGIONS[region]?.name || region;
  const lines = [];
  
  if (!scheduleData.hasData) {
    lines.push(`💡 Графік відключень для черги ${queue}`);
    lines.push('');
    lines.push('ℹ️ Немає даних про відключення');
    return lines.join('\n');
  }
  
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  tomorrowEnd.setMilliseconds(-1);
  
  // Get day name
  const dayNames = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота'];
  const todayName = dayNames[now.getDay()];
  const tomorrowName = dayNames[(now.getDay() + 1) % 7];
  
  // Format dates
  const todayDate = formatDate(now);
  const tomorrowDate = formatDate(tomorrowStart);
  
  // Split events by day
  const todayEvents = [];
  const tomorrowEvents = [];
  
  scheduleData.events.forEach(event => {
    const eventStart = new Date(event.start);
    if (eventStart >= todayStart && eventStart <= todayEnd) {
      todayEvents.push(event);
    } else if (eventStart >= tomorrowStart && eventStart <= tomorrowEnd) {
      tomorrowEvents.push(event);
    }
  });
  
  // Today's schedule
  if (todayEvents.length > 0) {
    lines.push(`💡 Оновлено графік відключень <b>на сьогодні, ${todayDate} (${todayName})</b>, для черги ${queue}:`);
    lines.push('');
    todayEvents.forEach(event => {
      const start = formatTime(event.start);
      const end = formatTime(event.end);
      const durationMs = new Date(event.end) - new Date(event.start);
      const durationStr = formatDurationFromMs(durationMs);
      lines.push(`🪫 <b>${start} - ${end} (~${durationStr})</b>`);
    });
  } else {
    lines.push(`💡 Графік відключень <b>на сьогодні, ${todayDate} (${todayName})</b>, для черги ${queue}:`);
    lines.push('');
    lines.push('✅ Відключень не заплановано');
  }
  
  lines.push('');
  
  // Tomorrow's schedule - only show if there are actual outages
  if (tomorrowEvents.length > 0) {
    lines.push(`💡 Оновлено графік відключень <b>на завтра, ${tomorrowDate} (${tomorrowName})</b>, для черги ${queue}:`);
    lines.push('');
    tomorrowEvents.forEach(event => {
      const start = formatTime(event.start);
      const end = formatTime(event.end);
      const durationMs = new Date(event.end) - new Date(event.start);
      const durationStr = formatDurationFromMs(durationMs);
      lines.push(`🪫 <b>${start} - ${end} (~${durationStr})</b>`);
    });
  }
  
  return lines.join('\n');
}

// Форматувати повідомлення про наступну подію
function formatNextEventMessage(nextEvent) {
  if (!nextEvent) {
    return '✅ Наступні відключення не заплановані';
  }
  
  const lines = [];
  
  if (nextEvent.type === 'power_off') {
    lines.push('⏰ <b>Наступне відключення</b>');
    lines.push(`🔴 Через: ${formatTimeRemaining(nextEvent.minutes)}`);
    lines.push(`🕐 Час: ${formatTime(nextEvent.time)}`);
    if (nextEvent.isPossible) {
      lines.push('⚠️ Можливе відключення');
    }
  } else {
    lines.push('⏰ <b>Наступне включення</b>');
    lines.push(`🟢 Через: ${formatTimeRemaining(nextEvent.minutes)}`);
    lines.push(`🕐 Час: ${formatTime(nextEvent.time)}`);
    if (nextEvent.isPossible) {
      lines.push('⚠️ Можливе включення');
    }
  }
  
  return lines.join('\n');
}

// Форматувати повідомлення про таймер
function formatTimerMessage(nextEvent) {
  if (!nextEvent) {
    return '✅ Наступні відключення не заплановані';
  }
  
  const lines = [];
  
  if (nextEvent.type === 'power_off') {
    lines.push('⏰ <b>Відключення через:</b>');
    lines.push(`🔴 ${formatTimeRemaining(nextEvent.minutes)}`);
  } else {
    lines.push('⏰ <b>Включення через:</b>');
    lines.push(`🟢 ${formatTimeRemaining(nextEvent.minutes)}`);
  }
  
  lines.push(`🕐 ${formatTime(nextEvent.time)}`);
  
  return lines.join('\n');
}

// Форматувати алерт про відключення
function formatPowerOffAlert(minutes, startTime, endTime, durationText, isPossible = false) {
  const lines = [];
  if (isPossible) {
    lines.push(`⚠️ <b>Через ${minutes} хвилин можливе відключення!</b>`);
    lines.push('');
    lines.push('🟡 Можливе:');
  } else {
    lines.push(`⚠️ <b>Через ${minutes} хвилин відключення!</b>`);
    lines.push('');
    lines.push('🔴 Планове:');
  }
  lines.push(`🪫 <b>${startTime} - ${endTime} (~${durationText})</b>`);
  return lines.join('\n');
}

// Форматувати алерт про включення
function formatPowerOnAlert(minutes, startTime, endTime, durationText) {
  const lines = [];
  lines.push(`💡 <b>Через ${minutes} хвилин світло має з'явитись!</b>`);
  lines.push('');
  lines.push('Поточне відключення:');
  lines.push(`🪫 <b>${startTime} - ${endTime} (~${durationText})</b>`);
  return lines.join('\n');
}

// Форматувати повідомлення про зміну графіка
function formatScheduleUpdateMessage(region, queue) {
  const regionName = REGIONS[region]?.name || region;
  const lines = [];
  lines.push('🔄 <b>Графік оновлено!</b>');
  lines.push(`📍 ${escapeHtml(regionName)}, GPV${queue}`);
  lines.push('');
  lines.push('Перевірте новий графік командою /schedule');
  return lines.join('\n');
}

// Форматувати welcome message
function formatWelcomeMessage(username) {
  const name = username ? escapeHtml(username) : 'друже';
  const lines = [];
  lines.push(`👋 Привіт, ${name}!`);
  lines.push('');
  lines.push('Я бот для моніторингу відключень електроенергії в Україні.');
  lines.push('');
  lines.push('Давайте налаштуємо бота:');
  lines.push('1️⃣ Виберіть ваш регіон');
  lines.push('2️⃣ Виберіть вашу чергу');
  lines.push('3️⃣ (Опціонально) Підключіть канал');
  return lines.join('\n');
}

// Форматувати help message
function formatHelpMessage() {
  const lines = [];
  lines.push('<b>📖 Довідка</b>');
  lines.push('');
  lines.push('<b>Основні команди:</b>');
  lines.push('/start - Почати роботу з ботом');
  lines.push('📊 Графік - Показати графік відключень');
  lines.push('💡 Статус - Перевірити наявність світла');
  lines.push('⚙️ Налаштування - Налаштування бота');
  lines.push('❓ Допомога - Ця довідка');
  lines.push('');
  lines.push('<b>Як працює бот:</b>');
  lines.push('• Бот автоматично перевіряє графіки');
  lines.push('• При зміні графіка ви отримаєте сповіщення');
  lines.push('• Можна налаштувати алерти перед відключенням');
  lines.push('• Можна підключити бота до свого каналу');
  lines.push('• Можна моніторити наявність світла через роутер');
  lines.push('');
  
  // Add bot version from package.json
  try {
    const packageJson = require('../package.json');
    lines.push(`<i>GridBot v${packageJson.version}</i>`);
  } catch (e) {
    lines.push('<i>GridBot</i>');
  }
  
  return lines.join('\n');
}

// Форматувати повідомлення про графік для каналу (новий формат)
function formatScheduleForChannel(region, queue, scheduleData, todayDate) {
  const { REGIONS } = require('./constants/regions');
  const { formatDurationFromMs } = require('./utils');
  
  const regionName = REGIONS[region]?.name || region;
  const lines = [];
  
  // Заголовок
  const date = todayDate || new Date();
  const dayNames = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота'];
  const dayName = dayNames[date.getDay()];
  const dateStr = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
  
  lines.push(`💡 Оновлено графік відключень <b>на сьогодні, ${dateStr} (${dayName})</b>, для черги ${queue}:`);
  lines.push('');
  
  if (!scheduleData.hasData || scheduleData.events.length === 0) {
    lines.push('✅ Відключень не заплановано');
    return lines.join('\n');
  }
  
  // Розділяємо події на планові та можливі (тільки на сьогодні)
  const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
  
  const todayPlanned = [];
  const todayPossible = [];
  
  scheduleData.events.forEach(event => {
    if (event.start >= todayStart && event.start <= todayEnd) {
      if (event.isPossible) {
        todayPossible.push(event);
      } else {
        todayPlanned.push(event);
      }
    }
  });
  
  // Планові відключення
  if (todayPlanned.length > 0) {
    todayPlanned.forEach(event => {
      const start = formatTime(event.start);
      const end = formatTime(event.end);
      const durationMs = event.end - event.start;
      const durationStr = formatDurationFromMs(durationMs);
      lines.push(`🪫 <b>${start} - ${end} (~${durationStr})</b>`);
    });
  }
  
  return lines.join('\n');
}

// Форматувати статистику для popup в каналі
function formatStatsForChannelPopup(stats) {
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

module.exports = {
  formatScheduleMessage,
  formatNextEventMessage,
  formatTimerMessage,
  formatPowerOffAlert,
  formatPowerOnAlert,
  formatScheduleUpdateMessage,
  formatWelcomeMessage,
  formatHelpMessage,
  formatScheduleForChannel,
  formatStatsForChannelPopup,
};
