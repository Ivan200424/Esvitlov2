const crypto = require('crypto');

// Обчислити хеш для даних графіка
function calculateHash(data, queueKey) {
  try {
    const relevantData = data[queueKey] || data;
    const dataString = JSON.stringify(relevantData);
    return crypto.createHash('md5').update(dataString).digest('hex');
  } catch (error) {
    console.error('Помилка обчислення хешу:', error.message);
    return null;
  }
}

// Форматувати час для відображення
function formatTime(date) {
  if (!date) return 'невідомо';
  
  try {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (error) {
    return 'невідомо';
  }
}

// Форматувати дату для відображення
function formatDate(date) {
  if (!date) return 'невідомо';
  
  try {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch (error) {
    return 'невідомо';
  }
}

// Форматувати дату та час
function formatDateTime(date) {
  if (!date) return 'невідомо';
  return `${formatDate(date)} ${formatTime(date)}`;
}

// Обчислити різницю в хвилинах між двома датами
function getMinutesDifference(date1, date2 = new Date()) {
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.floor((d1 - d2) / (1000 * 60));
  } catch (error) {
    return null;
  }
}

// Форматувати час, що залишився
function formatTimeRemaining(minutes) {
  if (minutes < 0) return 'минуло';
  if (minutes === 0) return 'зараз';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours} год ${mins} хв`;
  }
  return `${mins} хв`;
}

// Перевірити, чи є користувач адміном
function isAdmin(userId, adminIds) {
  return adminIds.includes(String(userId));
}

// Екранувати HTML символи для Telegram
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Парсити час з рядка (формат HH:MM)
function parseTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const now = new Date();
  const time = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  return time;
}

// Отримати поточний час у timezone
function getCurrentTime() {
  return new Date();
}

// Форматувати uptime для відображення
function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}д`);
  if (hours > 0) parts.push(`${hours}г`);
  if (minutes > 0) parts.push(`${minutes}хв`);
  
  return parts.join(' ') || '< 1хв';
}

// Форматувати тривалість з мілісекунд
function formatDurationFromMs(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0 && minutes > 0) return `${hours}год ${minutes}хв`;
  if (hours > 0) return `${hours}год`;
  if (minutes > 0) return `${minutes}хв`;
  return '< 1хв';
}

// Форматувати розмір пам'яті
function formatMemory(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}

module.exports = {
  calculateHash,
  formatTime,
  formatDate,
  formatDateTime,
  getMinutesDifference,
  formatTimeRemaining,
  isAdmin,
  escapeHtml,
  parseTime,
  getCurrentTime,
  formatUptime,
  formatMemory,
  formatDurationFromMs,
};
