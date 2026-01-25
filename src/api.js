const axios = require('axios');
const config = require('./config');

// Кешування даних для зменшення навантаження на GitHub API
const cache = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 хвилини

// Отримати URL для даних регіону
function getDataUrl(region) {
  return config.dataUrlTemplate.replace('{region}', region);
}

// Отримати URL для зображення графіка
function getImageUrl(region, queue) {
  const [group, subgroup] = queue.split('.');
  return config.imageUrlTemplate
    .replace('{region}', region)
    .replace('{group}', group)
    .replace('{queue}', queue.replace('.', '-'));  // Замінюємо "3.1" на "3-1"
}

// Отримати дані графіка для регіону
async function fetchScheduleData(region) {
  const cacheKey = `schedule_${region}`;
  const cached = cache.get(cacheKey);
  
  // Перевірка кешу
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    const url = getDataUrl(region);
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'eSvitlo-Monitor-Bot/1.0',
      },
    });
    
    const data = response.data;
    
    // Збереження в кеш
    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });
    
    return data;
  } catch (error) {
    console.error(`Помилка отримання даних для ${region}:`, error.message);
    
    // Повернути дані з кешу якщо є помилка
    if (cached) {
      console.log(`Використання застарілих даних з кешу для ${region}`);
      return cached.data;
    }
    
    throw error;
  }
}

// Перевірити доступність зображення
async function checkImageExists(region, queue) {
  try {
    const url = getImageUrl(region, queue);
    const response = await axios.head(url, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Очистити кеш
function clearCache() {
  cache.clear();
}

module.exports = {
  fetchScheduleData,
  getImageUrl,
  checkImageExists,
  clearCache,
};
