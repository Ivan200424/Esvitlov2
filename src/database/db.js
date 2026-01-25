const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Переконуємось, що директорія для БД існує
const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Підключення до БД
const db = new Database(config.databasePath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : null,
});

// Створення таблиць при ініціалізації
function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE NOT NULL,
      username TEXT,
      region TEXT NOT NULL,
      queue TEXT NOT NULL,
      channel_id TEXT,
      is_active BOOLEAN DEFAULT 1,
      notify_before_off INTEGER DEFAULT 15,
      notify_before_on INTEGER DEFAULT 15,
      alerts_off_enabled BOOLEAN DEFAULT 1,
      alerts_on_enabled BOOLEAN DEFAULT 1,
      last_hash TEXT,
      last_post_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_region_queue ON users(region, queue);
    CREATE INDEX IF NOT EXISTS idx_telegram_id ON users(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_channel_id ON users(channel_id);
  `);

  console.log('✅ База даних ініціалізована');
}

// Налаштування для кращої продуктивності
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Ініціалізація БД при запуску
initializeDatabase();

module.exports = db;
