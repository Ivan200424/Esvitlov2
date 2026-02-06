/**
 * PostgreSQL Database Adapter
 * 
 * Implements database operations for PostgreSQL
 * Compatible with the database abstraction layer
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let pool = null;

/**
 * Connect to PostgreSQL database
 */
async function connect(config) {
  if (pool) {
    return pool;
  }
  
  pool = new Pool(config);
  
  // Test connection
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connection established');
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL:', error);
    throw error;
  }
  
  return pool;
}

/**
 * Initialize database tables
 */
async function initializeDatabase() {
  if (!pool) {
    throw new Error('Database not connected');
  }
  
  // Read and execute schema
  const schemaPath = path.join(__dirname, '../schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('✅ Database schema initialized');
  }
}

/**
 * Close database connection
 */
async function close() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ PostgreSQL connection closed');
  }
}

/**
 * User operations
 */
async function createUser(telegramId, region, queue) {
  const result = await pool.query(
    `INSERT INTO users (telegram_id, region, queue)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id) DO UPDATE SET
       region = EXCLUDED.region,
       queue = EXCLUDED.queue,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [telegramId, region, queue]
  );
  return result.rows[0];
}

async function getUser(telegramId) {
  const result = await pool.query(
    'SELECT * FROM users WHERE telegram_id = $1',
    [telegramId]
  );
  return result.rows[0] || null;
}

async function updateUser(telegramId, updates) {
  const fields = [];
  const values = [telegramId];
  let paramIndex = 2;
  
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }
  
  fields.push('updated_at = CURRENT_TIMESTAMP');
  
  const query = `UPDATE users SET ${fields.join(', ')} WHERE telegram_id = $1 RETURNING *`;
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function deleteUser(telegramId) {
  await pool.query('DELETE FROM users WHERE telegram_id = $1', [telegramId]);
}

async function getAllUsers() {
  const result = await pool.query('SELECT * FROM users WHERE is_active = TRUE');
  return result.rows;
}

async function getUsersByRegionQueue(region, queue) {
  const result = await pool.query(
    'SELECT * FROM users WHERE region = $1 AND queue = $2 AND is_active = TRUE',
    [region, queue]
  );
  return result.rows;
}

async function countUsers() {
  const result = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_active = TRUE');
  return parseInt(result.rows[0].count);
}

/**
 * Settings operations
 */
async function getSetting(key) {
  const result = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
  return result.rows[0]?.value || null;
}

async function setSetting(key, value) {
  await pool.query(
    `INSERT INTO settings (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = CURRENT_TIMESTAMP`,
    [key, value]
  );
}

async function deleteSetting(key) {
  await pool.query('DELETE FROM settings WHERE key = $1', [key]);
}

/**
 * User states operations
 */
async function saveUserState(telegramId, stateType, stateData) {
  await pool.query(
    `INSERT INTO user_states (telegram_id, state_type, state_data)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id, state_type) DO UPDATE SET
       state_data = EXCLUDED.state_data,
       updated_at = CURRENT_TIMESTAMP`,
    [telegramId, stateType, JSON.stringify(stateData)]
  );
}

async function getUserState(telegramId, stateType) {
  const result = await pool.query(
    'SELECT state_data FROM user_states WHERE telegram_id = $1 AND state_type = $2',
    [telegramId, stateType]
  );
  return result.rows[0]?.state_data || null;
}

async function deleteUserState(telegramId, stateType) {
  await pool.query(
    'DELETE FROM user_states WHERE telegram_id = $1 AND state_type = $2',
    [telegramId, stateType]
  );
}

async function cleanupOldStates() {
  await pool.query("DELETE FROM user_states WHERE updated_at < NOW() - INTERVAL '24 hours'");
}

/**
 * Power states operations
 */
async function savePowerState(telegramId, stateData) {
  await pool.query(
    `INSERT INTO user_power_states (
       telegram_id, current_state, pending_state, pending_state_time,
       last_stable_state, last_stable_at, instability_start, switch_count
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (telegram_id) DO UPDATE SET
       current_state = EXCLUDED.current_state,
       pending_state = EXCLUDED.pending_state,
       pending_state_time = EXCLUDED.pending_state_time,
       last_stable_state = EXCLUDED.last_stable_state,
       last_stable_at = EXCLUDED.last_stable_at,
       instability_start = EXCLUDED.instability_start,
       switch_count = EXCLUDED.switch_count,
       updated_at = CURRENT_TIMESTAMP`,
    [
      telegramId,
      stateData.currentState,
      stateData.pendingState,
      stateData.pendingStateTime,
      stateData.lastStableState,
      stateData.lastStableAt,
      stateData.instabilityStart,
      stateData.switchCount
    ]
  );
}

async function getPowerState(telegramId) {
  const result = await pool.query(
    'SELECT * FROM user_power_states WHERE telegram_id = $1',
    [telegramId]
  );
  
  if (!result.rows[0]) return null;
  
  const row = result.rows[0];
  return {
    currentState: row.current_state,
    pendingState: row.pending_state,
    pendingStateTime: row.pending_state_time,
    lastStableState: row.last_stable_state,
    lastStableAt: row.last_stable_at,
    instabilityStart: row.instability_start,
    switchCount: row.switch_count
  };
}

async function deletePowerState(telegramId) {
  await pool.query('DELETE FROM user_power_states WHERE telegram_id = $1', [telegramId]);
}

/**
 * Schedule history operations
 */
async function saveScheduleHistory(userId, region, queue, scheduleData, hash, imageUrl) {
  // Get user's internal ID
  const userResult = await pool.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
  if (userResult.rows.length === 0) {
    throw new Error(`User ${userId} not found`);
  }
  const pgUserId = userResult.rows[0].id;
  
  await pool.query(
    `INSERT INTO schedule_history (user_id, region, queue, schedule_data, hash, image_url)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [pgUserId, region, queue, JSON.stringify(scheduleData), hash, imageUrl]
  );
}

async function getLatestScheduleHistory(region, queue) {
  const result = await pool.query(
    `SELECT * FROM schedule_history
     WHERE region = $1 AND queue = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [region, queue]
  );
  return result.rows[0] || null;
}

/**
 * Publication signatures for idempotency
 */
async function createPublicationSignature(signature, publicationType, region, queue, userId, channelId, dataHash) {
  // Get user's internal ID if userId is provided
  let pgUserId = null;
  if (userId) {
    const userResult = await pool.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
    if (userResult.rows.length > 0) {
      pgUserId = userResult.rows[0].id;
    }
  }
  
  // Set expiration to 7 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  
  await pool.query(
    `INSERT INTO publication_signatures (
       signature, publication_type, region, queue, user_id, channel_id, data_hash, expires_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (signature) DO NOTHING`,
    [signature, publicationType, region, queue, pgUserId, channelId, dataHash, expiresAt]
  );
}

async function publicationSignatureExists(signature) {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM publication_signatures WHERE signature = $1 AND expires_at > NOW()',
    [signature]
  );
  return parseInt(result.rows[0].count) > 0;
}

async function cleanupExpiredSignatures() {
  await pool.query('DELETE FROM publication_signatures WHERE expires_at < NOW()');
}

/**
 * Channel operations
 */
async function savePendingChannel(channelId, channelUsername, channelTitle, telegramId) {
  await pool.query(
    `INSERT INTO pending_channels (channel_id, channel_username, channel_title, telegram_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (channel_id) DO UPDATE SET
       channel_username = EXCLUDED.channel_username,
       channel_title = EXCLUDED.channel_title,
       telegram_id = EXCLUDED.telegram_id`,
    [channelId, channelUsername, channelTitle, telegramId]
  );
}

async function getPendingChannel(channelId) {
  const result = await pool.query(
    'SELECT * FROM pending_channels WHERE channel_id = $1',
    [channelId]
  );
  return result.rows[0] || null;
}

async function deletePendingChannel(channelId) {
  await pool.query('DELETE FROM pending_channels WHERE channel_id = $1', [channelId]);
}

async function getAllPendingChannels() {
  const result = await pool.query('SELECT * FROM pending_channels');
  return result.rows;
}

/**
 * Power history operations
 */
async function savePowerHistory(userId, eventType, timestamp, durationSeconds) {
  // Get user's internal ID
  const userResult = await pool.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
  if (userResult.rows.length === 0) {
    throw new Error(`User ${userId} not found`);
  }
  const pgUserId = userResult.rows[0].id;
  
  await pool.query(
    'INSERT INTO power_history (user_id, event_type, timestamp, duration_seconds) VALUES ($1, $2, $3, $4)',
    [pgUserId, eventType, timestamp, durationSeconds]
  );
}

async function getPowerHistoryForUser(userId, limit = 100) {
  // Get user's internal ID
  const userResult = await pool.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
  if (userResult.rows.length === 0) {
    return [];
  }
  const pgUserId = userResult.rows[0].id;
  
  const result = await pool.query(
    'SELECT * FROM power_history WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2',
    [pgUserId, limit]
  );
  return result.rows;
}

module.exports = {
  connect,
  initializeDatabase,
  close,
  
  // User operations
  createUser,
  getUser,
  updateUser,
  deleteUser,
  getAllUsers,
  getUsersByRegionQueue,
  countUsers,
  
  // Settings
  getSetting,
  setSetting,
  deleteSetting,
  
  // User states
  saveUserState,
  getUserState,
  deleteUserState,
  cleanupOldStates,
  
  // Power states
  savePowerState,
  getPowerState,
  deletePowerState,
  
  // Schedule history
  saveScheduleHistory,
  getLatestScheduleHistory,
  
  // Publication signatures
  createPublicationSignature,
  publicationSignatureExists,
  cleanupExpiredSignatures,
  
  // Channels
  savePendingChannel,
  getPendingChannel,
  deletePendingChannel,
  getAllPendingChannels,
  
  // Power history
  savePowerHistory,
  getPowerHistoryForUser
};
