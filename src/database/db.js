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
      last_power_state TEXT,
      last_power_change INTEGER,
      power_on_duration INTEGER,
      last_alert_off_period TEXT,
      last_alert_on_period TEXT,
      alert_off_message_id INTEGER,
      alert_on_message_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_region_queue ON users(region, queue);
    CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_users_channel_id ON users(channel_id);

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

    CREATE TABLE IF NOT EXISTS power_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      duration_seconds INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_power_history_user_id ON power_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_power_history_timestamp ON power_history(timestamp);

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

    CREATE TABLE IF NOT EXISTS schedule_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      region TEXT NOT NULL,
      queue TEXT NOT NULL,
      schedule_data TEXT NOT NULL,
      hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_schedule_user_id ON schedule_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_schedule_created_at ON schedule_history(created_at);

    CREATE TABLE IF NOT EXISTS user_power_states (
      telegram_id INTEGER PRIMARY KEY,
      current_state TEXT,
      pending_state TEXT,
      pending_state_time TEXT,
      last_stable_state TEXT,
      last_stable_at TEXT,
      instability_start TEXT,
      switch_count INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_power_states_telegram_id ON user_power_states(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_power_states_updated_at ON user_power_states(updated_at);
  `);

  console.log('✅ База даних ініціалізована');
}

// Міграція: додавання нових полів для існуючих БД
function runMigrations() {
  console.log('🔄 Запуск міграції бази даних...');
  
  const newColumns = [
    { name: 'power_state', type: 'TEXT' },
    { name: 'power_changed_at', type: 'DATETIME' },
    { name: 'last_power_state', type: 'TEXT' },
    { name: 'last_power_change', type: 'INTEGER' },
    { name: 'power_on_duration', type: 'INTEGER' },
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
    { name: 'channel_status', type: "TEXT DEFAULT 'active'" },
    { name: 'schedule_caption', type: 'TEXT DEFAULT NULL' },
    { name: 'period_format', type: 'TEXT DEFAULT NULL' },
    { name: 'power_off_text', type: 'TEXT DEFAULT NULL' },
    { name: 'power_on_text', type: 'TEXT DEFAULT NULL' },
    { name: 'delete_old_message', type: 'INTEGER DEFAULT 0' },
    { name: 'picture_only', type: 'INTEGER DEFAULT 0' },
    { name: 'last_schedule_message_id', type: 'INTEGER DEFAULT NULL' },
    { name: 'channel_paused', type: 'INTEGER DEFAULT 0' },
    { name: 'power_notify_target', type: "TEXT DEFAULT 'both'" },
    { name: 'schedule_alert_enabled', type: 'INTEGER DEFAULT 1' },
    { name: 'schedule_alert_minutes', type: 'INTEGER DEFAULT 15' },
    { name: 'schedule_alert_target', type: "TEXT DEFAULT 'both'" },
    { name: 'last_start_message_id', type: 'INTEGER' },
    { name: 'last_settings_message_id', type: 'INTEGER' },
    { name: 'last_timer_message_id', type: 'INTEGER' },
    { name: 'channel_branding_updated_at', type: 'DATETIME' }
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

// Налаштування для кращої продуктивності та масштабованості
db.pragma('journal_mode = WAL'); // Write-Ahead Logging для швидкості
db.pragma('synchronous = NORMAL'); // Баланс між продуктивністю та безпекою
db.pragma('cache_size = 10000'); // Більший кеш: 10000 сторінок (~40MB) для швидкості
db.pragma('temp_store = MEMORY'); // Тимчасові таблиці в пам'яті
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

/**
 * Коректно закриває з'єднання з БД
 */
function closeDatabase() {
  try {
    db.close();
    console.log('✅ БД закрита коректно');
  } catch (error) {
    console.error('❌ Помилка закриття БД:', error);
  }
}

module.exports = db;
module.exports.getSetting = getSetting;
module.exports.setSetting = setSetting;
module.exports.closeDatabase = closeDatabase;
