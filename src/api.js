const axios = require('axios');
const config = require('./config');

// Кешування даних для зменшення навантаження на GitHub API
const cache = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 хвилини

// Fetch with retry logic
async function fetchWithRetry(url, retries = 3) {
  const delays = [5000, 15000, 45000];
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, { 
        timeout: 30000,
        responseType: url.endsWith('.png') ? 'arraybuffer' : 'json',
        headers: {
          'User-Agent': 'eSvitlo-Monitor-Bot/1.0',
        },
      });
      return response.data;
    } catch (error) {
      const isLastRetry = i === retries - 1;
      
      if (isLastRetry) {
        throw new Error(`Failed to fetch ${url} after ${retries} attempts: ${error.message}`);
      }
      
      const delay = delays[i] || delays[delays.length - 1];
      console.log(`Retry ${i + 1}/${retries} for ${url} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Отримати URL для даних регіону
function getDataUrl(region) {
  return config.dataUrlTemplate.replace('{region}', region);
}

// Отримати URL для зображення графіка
function getImageUrl(region, queue) {
  return config.imageUrlTemplate
    .replace('{region}', region)
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
    const data = await fetchWithRetry(url);
    
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

// Fetch schedule image as Buffer
async function fetchScheduleImage(region, queue) {
  const timestamp = Date.now();
  const queueFormatted = queue.replace('.', '-'); // Convert "3.1" to "3-1"
  const url = `https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/images/${region}/gpv-${queueFormatted}-emergency.png?t=${timestamp}`;
  console.log(`Fetching schedule image from: ${url}`);
  return await fetchWithRetry(url);
}

// Очистити кеш
function clearCache() {
  cache.clear();
}

module.exports = {
  fetchScheduleData,
  fetchScheduleImage,
  getImageUrl,
  checkImageExists,
  clearCache,
};
