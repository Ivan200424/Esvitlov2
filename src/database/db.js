const { Pool } = require('pg');

// Підключення до PostgreSQL через DATABASE_URL
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL не знайдено в змінних середовища');
  process.exit(1);
}

// Створення connection pool для кращої продуктивності
const pool = new Pool({
  connectionString,
  // SSL налаштування для Railway та інших хмарних провайдерів
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
  // Налаштування пулу для масштабованості (оновлено для 2000+ користувачів)
  max: parseInt(process.env.DB_POOL_MAX || '50', 10),  // Збільшено з 20 до 50
  min: parseInt(process.env.DB_POOL_MIN || '5', 10),    // Мінімум 5 вільних з'єднань у пулі
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Таймаут для запитів для запобігання блокуванню
  statement_timeout: 30000,
});

// Validate pool configuration
const poolMax = pool.options.max;
const poolMin = pool.options.min;
if (isNaN(poolMax) || poolMax < 1) {
  console.error('❌ DB_POOL_MAX must be a positive integer');
  process.exit(1);
}
if (isNaN(poolMin) || poolMin < 0) {
  console.error('❌ DB_POOL_MIN must be a non-negative integer');
  process.exit(1);
}
if (poolMin > poolMax) {
  console.error('❌ DB_POOL_MIN cannot be greater than DB_POOL_MAX');
  process.exit(1);
}

// Перевірка підключення
pool.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ PostgreSQL pool connected');
  }
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
});

// Створення таблиць при ініціалізації
async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
      
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
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
        is_active BOOLEAN DEFAULT TRUE,
        migration_notified INTEGER DEFAULT 0,
        notify_before_off INTEGER DEFAULT 15,
        notify_before_on INTEGER DEFAULT 15,
        alerts_off_enabled BOOLEAN DEFAULT TRUE,
        alerts_on_enabled BOOLEAN DEFAULT TRUE,
        last_hash TEXT,
        last_published_hash TEXT,
        last_post_id INTEGER,
        power_state TEXT,
        power_changed_at TIMESTAMPTZ,
        pending_power_state TEXT,
        pending_power_change_at TIMESTAMPTZ,
        last_power_state TEXT,
        last_power_change INTEGER,
        power_on_duration INTEGER,
        last_alert_off_period TEXT,
        last_alert_on_period TEXT,
        alert_off_message_id INTEGER,
        alert_on_message_id INTEGER,
        today_snapshot_hash TEXT,
        tomorrow_snapshot_hash TEXT,
        tomorrow_published_date TEXT,
        schedule_caption TEXT DEFAULT NULL,
        period_format TEXT DEFAULT NULL,
        power_off_text TEXT DEFAULT NULL,
        power_on_text TEXT DEFAULT NULL,
        delete_old_message BOOLEAN DEFAULT FALSE,
        picture_only BOOLEAN DEFAULT FALSE,
        last_schedule_message_id INTEGER DEFAULT NULL,
        channel_paused BOOLEAN DEFAULT FALSE,
        power_notify_target TEXT DEFAULT 'both',
        schedule_alert_enabled BOOLEAN DEFAULT TRUE,
        schedule_alert_minutes INTEGER DEFAULT 15,
        schedule_alert_target TEXT DEFAULT 'both',
        last_start_message_id INTEGER,
        last_settings_message_id INTEGER,
        last_timer_message_id INTEGER,
        channel_branding_updated_at TIMESTAMP,
        last_menu_message_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_region_queue ON users(region, queue);
      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_users_channel_id ON users(channel_id);

      CREATE TABLE IF NOT EXISTS outage_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        duration_minutes INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_id ON outage_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_start_time ON outage_history(start_time);

      CREATE TABLE IF NOT EXISTS power_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        duration_seconds INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_power_history_user_id ON power_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_power_history_timestamp ON power_history(timestamp);

      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

      CREATE TABLE IF NOT EXISTS schedule_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        region TEXT NOT NULL,
        queue TEXT NOT NULL,
        schedule_data TEXT NOT NULL,
        hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_schedule_user_id ON schedule_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_schedule_created_at ON schedule_history(created_at);

      CREATE TABLE IF NOT EXISTS user_power_states (
        telegram_id TEXT PRIMARY KEY,
        current_state TEXT,
        pending_state TEXT,
        pending_state_time TEXT,
        last_stable_state TEXT,
        last_stable_at TEXT,
        instability_start TEXT,
        switch_count INTEGER DEFAULT 0,
        last_notification_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_power_states_telegram_id ON user_power_states(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_power_states_updated_at ON user_power_states(updated_at);

      CREATE TABLE IF NOT EXISTS user_states (
        id SERIAL PRIMARY KEY,
        telegram_id TEXT NOT NULL,
        state_type TEXT NOT NULL,
        state_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(telegram_id, state_type)
      );

      CREATE INDEX IF NOT EXISTS idx_user_states_telegram_id ON user_states(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_user_states_type ON user_states(state_type);
      CREATE INDEX IF NOT EXISTS idx_user_states_updated_at ON user_states(updated_at);

      CREATE TABLE IF NOT EXISTS pending_channels (
        id SERIAL PRIMARY KEY,
        channel_id TEXT NOT NULL UNIQUE,
        channel_username TEXT,
        channel_title TEXT,
        telegram_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_pending_channels_id ON pending_channels(channel_id);
      CREATE INDEX IF NOT EXISTS idx_pending_channels_telegram_id ON pending_channels(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_pending_channels_created_at ON pending_channels(created_at);
      
      CREATE TABLE IF NOT EXISTS pause_log (
        id SERIAL PRIMARY KEY,
        admin_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        pause_type TEXT,
        message TEXT,
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_pause_log_created_at ON pause_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_pause_log_admin_id ON pause_log(admin_id);
      
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        telegram_id TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'feedback',
        status TEXT NOT NULL DEFAULT 'open',
        subject TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        closed_at TIMESTAMP,
        closed_by TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_tickets_telegram_id ON tickets(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
      CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(type);
      CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
      
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        sender_type TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'text',
        content TEXT,
        file_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
      
      CREATE TABLE IF NOT EXISTS admin_routers (
        id SERIAL PRIMARY KEY,
        admin_telegram_id VARCHAR(255) NOT NULL UNIQUE,
        router_ip VARCHAR(255) DEFAULT NULL,
        router_port INTEGER DEFAULT 80,
        notifications_on BOOLEAN DEFAULT true,
        last_state VARCHAR(20) DEFAULT NULL,
        last_change_at TIMESTAMP DEFAULT NULL,
        last_check_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_admin_routers_telegram_id ON admin_routers(admin_telegram_id);
      
      CREATE TABLE IF NOT EXISTS admin_router_history (
        id SERIAL PRIMARY KEY,
        admin_telegram_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(20) NOT NULL,
        event_at TIMESTAMP DEFAULT NOW(),
        duration_minutes INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_admin_router_history_telegram_id ON admin_router_history(admin_telegram_id);
      CREATE INDEX IF NOT EXISTS idx_admin_router_history_event_at ON admin_router_history(event_at);
    `);

    console.log('✅ База даних ініціалізована');
  } catch (error) {
    console.error('❌ Помилка ініціалізації бази даних:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Міграція: додавання нових полів для існуючих БД
async function runMigrations() {
  console.log('🔄 Запуск міграції бази даних...');
  const client = await pool.connect();
  
  try {
    const newColumns = [
      { name: 'power_state', type: 'TEXT' },
      { name: 'power_changed_at', type: 'TIMESTAMPTZ' },
      { name: 'pending_power_state', type: 'TEXT' },
      { name: 'pending_power_change_at', type: 'TIMESTAMPTZ' },
      { name: 'last_power_state', type: 'TEXT' },
      { name: 'last_power_change', type: 'INTEGER' },
      { name: 'power_on_duration', type: 'INTEGER' },
      { name: 'last_alert_off_period', type: 'TEXT' },
      { name: 'last_alert_on_period', type: 'TEXT' },
      { name: 'alert_off_message_id', type: 'INTEGER' },
      { name: 'alert_on_message_id', type: 'INTEGER' },
      { name: 'router_ip', type: 'TEXT' },
      { name: 'migration_notified', type: 'INTEGER DEFAULT 0' },
      { name: 'notify_before_off', type: 'INTEGER DEFAULT 15' },
      { name: 'notify_before_on', type: 'INTEGER DEFAULT 15' },
      { name: 'alerts_off_enabled', type: 'BOOLEAN DEFAULT TRUE' },
      { name: 'alerts_on_enabled', type: 'BOOLEAN DEFAULT TRUE' },
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
      { name: 'delete_old_message', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'picture_only', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'last_schedule_message_id', type: 'INTEGER DEFAULT NULL' },
      { name: 'channel_paused', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'power_notify_target', type: "TEXT DEFAULT 'both'" },
      { name: 'schedule_alert_enabled', type: 'BOOLEAN DEFAULT TRUE' },
      { name: 'schedule_alert_minutes', type: 'INTEGER DEFAULT 15' },
      { name: 'schedule_alert_target', type: "TEXT DEFAULT 'both'" },
      { name: 'last_start_message_id', type: 'INTEGER' },
      { name: 'last_settings_message_id', type: 'INTEGER' },
      { name: 'last_timer_message_id', type: 'INTEGER' },
      { name: 'channel_branding_updated_at', type: 'TIMESTAMP' },
      { name: 'last_menu_message_id', type: 'INTEGER' }
    ];
    
    let addedCount = 0;
    for (const col of newColumns) {
      try {
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        console.log(`✅ Перевірено колонку: ${col.name}`);
        addedCount++;
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.error(`⚠️ Помилка при додаванні колонки ${col.name}:`, error.message);
        }
      }
    }
    
    // Add last_notification_at column to user_power_states table
    try {
      await client.query(`
        ALTER TABLE user_power_states 
        ADD COLUMN IF NOT EXISTS last_notification_at TIMESTAMP
      `);
      console.log(`✅ Перевірено колонку user_power_states.last_notification_at`);
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error(`⚠️ Помилка при додаванні колонки last_notification_at:`, error.message);
      }
    }

    // Migrate power_changed_at to TIMESTAMPTZ if it is still stored as TEXT or TIMESTAMP
    try {
      await client.query(`
        ALTER TABLE users 
        ALTER COLUMN power_changed_at TYPE TIMESTAMPTZ 
        USING power_changed_at::TIMESTAMPTZ
      `);
      console.log('✅ Мігровано power_changed_at -> TIMESTAMPTZ');
    } catch (error) {
      // Column may already be TIMESTAMPTZ — that is fine
      if (!error.message.toLowerCase().includes('already')) {
        console.error('⚠️ Помилка міграції power_changed_at:', error.message);
      }
    }
    
    console.log(`✅ Міграція завершена: перевірено ${addedCount} колонок`);
  } catch (error) {
    console.error('❌ Помилка міграції:', error);
  } finally {
    client.release();
  }
}

// Helper functions for settings table
async function getSetting(key, defaultValue = null) {
  try {
    const result = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    return result.rows.length > 0 ? result.rows[0].value : defaultValue;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return defaultValue;
  }
}

async function setSetting(key, value) {
  try {
    await pool.query(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT(key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
    `, [key, String(value)]);
    return true;
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
    return false;
  }
}

/**
 * Коректно закриває з'єднання з БД
 */
async function closeDatabase() {
  try {
    await pool.end();
    console.log('✅ БД закрита коректно');
  } catch (error) {
    console.error('❌ Помилка закриття БД:', error);
  }
}

// ===============================
// User States Management Functions
// ===============================

/**
 * Зберегти стан користувача
 */
async function saveUserState(telegramId, stateType, stateData) {
  try {
    await pool.query(`
      INSERT INTO user_states (telegram_id, state_type, state_data, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT(telegram_id, state_type) DO UPDATE SET
        state_data = EXCLUDED.state_data,
        updated_at = NOW()
    `, [telegramId, stateType, JSON.stringify(stateData)]);
    return true;
  } catch (error) {
    console.error(`Error saving user state ${stateType} for ${telegramId}:`, error);
    return false;
  }
}

/**
 * Отримати стан користувача
 */
async function getUserState(telegramId, stateType) {
  try {
    const result = await pool.query(`
      SELECT state_data FROM user_states 
      WHERE telegram_id = $1 AND state_type = $2
    `, [telegramId, stateType]);
    return result.rows.length > 0 ? JSON.parse(result.rows[0].state_data) : null;
  } catch (error) {
    console.error(`Error getting user state ${stateType} for ${telegramId}:`, error);
    return null;
  }
}

/**
 * Видалити стан користувача
 */
async function deleteUserState(telegramId, stateType) {
  try {
    await pool.query(`
      DELETE FROM user_states WHERE telegram_id = $1 AND state_type = $2
    `, [telegramId, stateType]);
    return true;
  } catch (error) {
    console.error(`Error deleting user state ${stateType} for ${telegramId}:`, error);
    return false;
  }
}

/**
 * Отримати всі стани певного типу (для відновлення при запуску)
 */
async function getAllUserStates(stateType) {
  try {
    const result = await pool.query(`
      SELECT telegram_id, state_data FROM user_states WHERE state_type = $1
    `, [stateType]);
    return result.rows;
  } catch (error) {
    console.error(`Error getting all user states of type ${stateType}:`, error);
    return [];
  }
}

// ===============================
// Pending Channels Management Functions
// ===============================

/**
 * Зберегти pending channel
 */
async function savePendingChannel(channelId, channelUsername, channelTitle, telegramId) {
  try {
    await pool.query(`
      INSERT INTO pending_channels (channel_id, channel_username, channel_title, telegram_id, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT(channel_id) DO UPDATE SET
        channel_username = EXCLUDED.channel_username,
        channel_title = EXCLUDED.channel_title,
        telegram_id = EXCLUDED.telegram_id,
        created_at = NOW()
    `, [channelId, channelUsername, channelTitle, telegramId]);
    return true;
  } catch (error) {
    console.error(`Error saving pending channel ${channelId}:`, error);
    return false;
  }
}

/**
 * Отримати pending channel
 */
async function getPendingChannel(channelId) {
  try {
    const result = await pool.query(`SELECT * FROM pending_channels WHERE channel_id = $1`, [channelId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error(`Error getting pending channel ${channelId}:`, error);
    return null;
  }
}

/**
 * Видалити pending channel
 */
async function deletePendingChannel(channelId) {
  try {
    await pool.query(`DELETE FROM pending_channels WHERE channel_id = $1`, [channelId]);
    return true;
  } catch (error) {
    console.error(`Error deleting pending channel ${channelId}:`, error);
    return false;
  }
}

/**
 * Отримати всі pending channels
 */
async function getAllPendingChannels() {
  try {
    const result = await pool.query(`SELECT * FROM pending_channels`);
    return result.rows;
  } catch (error) {
    console.error('Error getting all pending channels:', error);
    return [];
  }
}

/**
 * Очистка старих станів (старше 24 годин)
 */
async function cleanupOldStates() {
  try {
    const statesResult = await pool.query(`DELETE FROM user_states WHERE updated_at < NOW() - INTERVAL '24 hours'`);
    const channelsResult = await pool.query(`DELETE FROM pending_channels WHERE created_at < NOW() - INTERVAL '24 hours'`);
    
    const statesDeleted = statesResult.rowCount || 0;
    const channelsDeleted = channelsResult.rowCount || 0;
    
    if (statesDeleted > 0 || channelsDeleted > 0) {
      console.log(`🧹 Очищено старих станів: ${statesDeleted} user_states, ${channelsDeleted} pending_channels`);
    }
    
    return true;
  } catch (error) {
    console.error('Error cleaning up old states:', error);
    return false;
  }
}

/**
 * Перевірка здоров'я пулу підключень
 */
async function checkPoolHealth() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('✅ Database connection verified');
  } finally {
    client.release();
  }
}

/**
 * Логування метрик пулу
 */
let poolMetricsInterval = null;

function startPoolMetricsLogging() {
  const { POOL_STATS_LOG_INTERVAL_MS } = require('../constants/timeouts');
  
  if (poolMetricsInterval) {
    return; // Already running
  }
  
  poolMetricsInterval = setInterval(() => {
    console.log(`[DB] Pool: total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`);
  }, POOL_STATS_LOG_INTERVAL_MS);
}

function stopPoolMetricsLogging() {
  if (poolMetricsInterval) {
    clearInterval(poolMetricsInterval);
    poolMetricsInterval = null;
  }
}

module.exports = pool;
module.exports.pool = pool;
module.exports.initializeDatabase = initializeDatabase;
module.exports.runMigrations = runMigrations;
module.exports.getSetting = getSetting;
module.exports.setSetting = setSetting;
module.exports.closeDatabase = closeDatabase;
module.exports.saveUserState = saveUserState;
module.exports.getUserState = getUserState;
module.exports.deleteUserState = deleteUserState;
module.exports.getAllUserStates = getAllUserStates;
module.exports.savePendingChannel = savePendingChannel;
module.exports.getPendingChannel = getPendingChannel;
module.exports.deletePendingChannel = deletePendingChannel;
module.exports.getAllPendingChannels = getAllPendingChannels;
module.exports.cleanupOldStates = cleanupOldStates;
module.exports.checkPoolHealth = checkPoolHealth;
module.exports.startPoolMetricsLogging = startPoolMetricsLogging;
module.exports.stopPoolMetricsLogging = stopPoolMetricsLogging;
