const { formatTime, formatDate, formatTimeRemaining, escapeHtml } = require('./utils');
const { REGIONS } = require('./constants/regions');

// Форматувати повідомлення про графік
function formatScheduleMessage(region, queue, scheduleData, nextEvent) {
  const regionName = REGIONS[region]?.name || region;
  const lines = [];
  
  lines.push(`📋 <b>Графік відключень</b>`);
  lines.push(`📍 Регіон: ${escapeHtml(regionName)}`);
  lines.push(`⚡️ Черга: GPV${queue}`);
  lines.push('');
  
  if (!scheduleData.hasData) {
    lines.push('ℹ️ Немає даних про відключення');
    return lines.join('\n');
  }
  
  // Поточний статус
  const isOff = nextEvent && nextEvent.type === 'power_on';
  if (isOff) {
    lines.push(`🔴 <b>Зараз без світла</b>`);
    lines.push(`⏰ Включення через: ${formatTimeRemaining(nextEvent.minutes)}`);
    if (nextEvent.isPossible) {
      lines.push('⚠️ Можливе відключення');
    }
  } else if (nextEvent && nextEvent.type === 'power_off') {
    lines.push(`🟢 <b>Зараз є світло</b>`);
    lines.push(`⏰ Відключення через: ${formatTimeRemaining(nextEvent.minutes)}`);
    if (nextEvent.isPossible) {
      lines.push('⚠️ Можливе відключення');
    }
  } else {
    lines.push('🟢 <b>Зараз є світло</b>');
    lines.push('ℹ️ Наступні відключення не заплановані');
  }
  
  lines.push('');
  
  // Список відключень
  if (scheduleData.events.length > 0) {
    lines.push('<b>Заплановані відключення:</b>');
    scheduleData.events.forEach((event, index) => {
      const start = formatTime(event.start);
      const end = formatTime(event.end);
      const date = formatDate(event.start);
      const possible = event.isPossible ? ' (можливе)' : '';
      lines.push(`${index + 1}. ${date} ${start} - ${end}${possible}`);
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
function formatPowerOffAlert(minutes, time) {
  const lines = [];
  lines.push('🔴 <b>Увага! Скоро відключення</b>');
  lines.push(`⏰ Через: ${formatTimeRemaining(minutes)}`);
  lines.push(`🕐 Час: ${formatTime(time)}`);
  return lines.join('\n');
}

// Форматувати алерт про включення
function formatPowerOnAlert(minutes, time) {
  const lines = [];
  lines.push('🟢 <b>Скоро включення світла</b>');
  lines.push(`⏰ Через: ${formatTimeRemaining(minutes)}`);
  lines.push(`🕐 Час: ${formatTime(time)}`);
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
  lines.push('/schedule або 📋 - Показати графік');
  lines.push('/next або ⏭ - Наступна подія');
  lines.push('/timer або ⏰ - Таймер до події');
  lines.push('/settings або ⚙️ - Налаштування');
  lines.push('/channel або 📺 - Підключити канал');
  lines.push('/help - Ця довідка');
  lines.push('');
  lines.push('<b>Як працює бот:</b>');
  lines.push('• Бот автоматично перевіряє графіки кожні 3 хвилини');
  lines.push('• При зміні графіка ви отримаєте сповіщення');
  lines.push('• Можна налаштувати алерти перед відключенням');
  lines.push('• Можна підключити бота до свого каналу');
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
};
