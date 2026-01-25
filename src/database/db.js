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
      router_ip TEXT,
      is_active BOOLEAN DEFAULT 1,
      notify_before_off INTEGER DEFAULT 15,
      notify_before_on INTEGER DEFAULT 15,
      alerts_off_enabled BOOLEAN DEFAULT 1,
      alerts_on_enabled BOOLEAN DEFAULT 1,
      last_hash TEXT,
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
  `);

  console.log('✅ База даних ініціалізована');
}

// Міграція: додавання нових полів для існуючих БД
function runMigrations() {
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const columnNames = columns.map(c => c.name);
  
  const newColumns = [
    { name: 'power_state', type: 'TEXT' },
    { name: 'power_changed_at', type: 'DATETIME' },
    { name: 'last_alert_off_period', type: 'TEXT' },
    { name: 'last_alert_on_period', type: 'TEXT' },
    { name: 'alert_off_message_id', type: 'INTEGER' },
    { name: 'alert_on_message_id', type: 'INTEGER' }
  ];
  
  let addedCount = 0;
  for (const col of newColumns) {
    if (!columnNames.includes(col.name)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
      console.log(`✅ Додано колонку: ${col.name}`);
      addedCount++;
    }
  }
  
  if (addedCount > 0) {
    console.log(`✅ Міграція завершена: додано ${addedCount} нових колонок`);
  }
}

// Налаштування для кращої продуктивності
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Ініціалізація БД при запуску
initializeDatabase();
runMigrations();

module.exports = db;
