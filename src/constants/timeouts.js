/**
 * Централізовані константи для таймаутів та інтервалів
 * Використовуються по всьому застосунку для уникнення "магічних чисел"
 */

module.exports = {
  // Cache timeouts
  CACHE_TTL: 2 * 60 * 1000, // 2 хвилини - TTL для кешу API
  CACHE_CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 хвилин - інтервал очистки кешу
  MAX_CACHE_SIZE: 100, // Максимальний розмір кешу
  
  // API retry delays (exponential backoff)
  RETRY_DELAYS: [5000, 15000, 45000], // 5с, 15с, 45с
  API_TIMEOUT: 30000, // 30 секунд - таймаут для API запитів
  
  // Router/IP monitoring
  PING_TIMEOUT: 5000, // 5 секунд - таймаут для ping роутера
  
  // Cleanup intervals
  CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 година - інтервал очистки Maps/старих даних
  
  // Schedule history
  SCHEDULE_HISTORY_RETENTION: '7 days', // Час зберігання історії графіків (SQL interval)
  SCHEDULE_HISTORY_CLEANUP_MS: 3600000, // 1 година в мілісекундах для порівняння
  
  // State cleanup
  STATE_EXPIRY_HOURS: 24, // Години до видалення старих станів
  
  // Telegram rate limiting
  TELEGRAM_MESSAGE_DELAY: 50, // мс - затримка між повідомленнями для rate limiting
  TELEGRAM_MAX_MESSAGES_PER_SECOND: 25, // Максимум повідомлень на секунду
};
