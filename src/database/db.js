const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Отримуємо шлях до БД напряму з змінної середовища
const databasePath = process.env.DATABASE_PATH || './data/bot.db';

// Переконуємось, що директорія для БД існує
const dbDir = path.dirname(databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Підключення до БД
const db = new Database(databasePath, {
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
      channel_title TEXT,
      channel_description TEXT,
      channel_photo_file_id TEXT,
      channel_user_title TEXT,
      channel_user_description TEXT,
      channel_status TEXT DEFAULT 'active',
      router_ip TEXT,
      is_active BOOLEAN DEFAULT 1,
      notify_before_off INTEGER DEFAULT 15,
      notify_before_on INTEGER DEFAULT 15,
      alerts_off_enabled BOOLEAN DEFAULT 1,
      alerts_on_enabled BOOLEAN DEFAULT 1,
      last_hash TEXT,
      last_published_hash TEXT,
      last_post_id INTEGER,
      power_state TEXT,
      power_changed_at DATETIME,
      last_alert_off_period TEXT,
      last_alert_on_period TEXT,
      alert_off_message_id INTEGER,
      alert_on_message_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_region_queue ON users(region, queue);
    CREATE INDEX IF NOT EXISTS idx_telegram_id ON users(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_channel_id ON users(channel_id);

    CREATE TABLE IF NOT EXISTS outage_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      duration_minutes INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_id ON outage_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_start_time ON outage_history(start_time);

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
  `);

  console.log('✅ База даних ініціалізована');
}

// Міграція: додавання нових полів для існуючих БД
function runMigrations() {
  console.log('🔄 Запуск міграції бази даних...');
  
  const newColumns = [
    { name: 'power_state', type: 'TEXT' },
    { name: 'power_changed_at', type: 'DATETIME' },
    { name: 'last_alert_off_period', type: 'TEXT' },
    { name: 'last_alert_on_period', type: 'TEXT' },
    { name: 'alert_off_message_id', type: 'INTEGER' },
    { name: 'alert_on_message_id', type: 'INTEGER' },
    { name: 'router_ip', type: 'TEXT' },
    { name: 'notify_before_off', type: 'INTEGER DEFAULT 15' },
    { name: 'notify_before_on', type: 'INTEGER DEFAULT 15' },
    { name: 'alerts_off_enabled', type: 'BOOLEAN DEFAULT 1' },
    { name: 'alerts_on_enabled', type: 'BOOLEAN DEFAULT 1' },
    { name: 'last_published_hash', type: 'TEXT' },
    { name: 'channel_title', type: 'TEXT' },
    { name: 'channel_description', type: 'TEXT' },
    { name: 'channel_photo_file_id', type: 'TEXT' },
    { name: 'channel_user_title', type: 'TEXT' },
    { name: 'channel_user_description', type: 'TEXT' },
    { name: 'channel_status', type: "TEXT DEFAULT 'active'" }
  ];
  
  let addedCount = 0;
  for (const col of newColumns) {
    try {
      db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
      console.log(`✅ Додано колонку: ${col.name}`);
      addedCount++;
    } catch (error) {
      // Колонка вже існує - це нормально, ігноруємо
      if (!error.message.includes('duplicate column name')) {
        console.error(`⚠️ Помилка при додаванні колонки ${col.name}:`, error.message);
      }
    }
  }
  
  if (addedCount > 0) {
    console.log(`✅ Міграція завершена: додано ${addedCount} нових колонок`);
  } else {
    console.log('✅ Міграція: всі колонки вже існують');
  }
}

// Налаштування для кращої продуктивності
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Ініціалізація БД при запуску
initializeDatabase();
runMigrations();

// Helper functions for settings table
function getSetting(key, defaultValue = null) {
  try {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key);
    return result ? result.value : defaultValue;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return defaultValue;
  }
}

function setSetting(key, value) {
  try {
    const stmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(key, String(value));
    return true;
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
    return false;
  }
}

module.exports = db;
module.exports.getSetting = getSetting;
module.exports.setSetting = setSetting;
