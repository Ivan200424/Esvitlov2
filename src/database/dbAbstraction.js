/**
 * Database Abstraction Layer
 * 
 * Supports both SQLite (legacy) and PostgreSQL (v2.0)
 * Provides unified interface for database operations
 */

const config = {
  type: process.env.DB_TYPE || 'sqlite', // 'sqlite' or 'postgres'
  sqlite: {
    path: process.env.DATABASE_PATH || './data/bot.db'
  },
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'voltik',
    user: process.env.POSTGRES_USER || 'voltik',
    password: process.env.POSTGRES_PASSWORD,
    max: 20, // connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }
};

// Initialize the appropriate database adapter
let dbAdapter;

if (config.type === 'postgres') {
  dbAdapter = require('./adapters/postgresAdapter');
  console.log('🐘 Using PostgreSQL database');
} else {
  dbAdapter = require('./db'); // Legacy SQLite adapter
  console.log('📦 Using SQLite database');
}

/**
 * Initialize database connection
 */
async function initializeDatabase() {
  if (config.type === 'postgres') {
    await dbAdapter.connect(config.postgres);
    await dbAdapter.initializeDatabase();
    console.log('✅ PostgreSQL database initialized');
  } else {
    dbAdapter.initializeDatabase();
    console.log('✅ SQLite database initialized');
  }
}

/**
 * Close database connection
 */
async function closeDatabase() {
  if (config.type === 'postgres') {
    await dbAdapter.close();
  } else {
    dbAdapter.closeDatabase();
  }
}

/**
 * Users operations
 */
const users = {
  async create(telegramId, region, queue) {
    return await dbAdapter.createUser(telegramId, region, queue);
  },
  
  async get(telegramId) {
    return await dbAdapter.getUser(telegramId);
  },
  
  async update(telegramId, updates) {
    return await dbAdapter.updateUser(telegramId, updates);
  },
  
  async delete(telegramId) {
    return await dbAdapter.deleteUser(telegramId);
  },
  
  async getAll() {
    return await dbAdapter.getAllUsers();
  },
  
  async getByRegionQueue(region, queue) {
    return await dbAdapter.getUsersByRegionQueue(region, queue);
  },
  
  async count() {
    return await dbAdapter.countUsers();
  }
};

/**
 * Settings operations
 */
const settings = {
  async get(key) {
    return await dbAdapter.getSetting(key);
  },
  
  async set(key, value) {
    return await dbAdapter.setSetting(key, value);
  },
  
  async delete(key) {
    return await dbAdapter.deleteSetting(key);
  }
};

/**
 * User states operations
 */
const userStates = {
  async save(telegramId, stateType, stateData) {
    return await dbAdapter.saveUserState(telegramId, stateType, stateData);
  },
  
  async get(telegramId, stateType) {
    return await dbAdapter.getUserState(telegramId, stateType);
  },
  
  async delete(telegramId, stateType) {
    return await dbAdapter.deleteUserState(telegramId, stateType);
  },
  
  async cleanup() {
    return await dbAdapter.cleanupOldStates();
  }
};

/**
 * Power states operations
 */
const powerStates = {
  async save(telegramId, stateData) {
    return await dbAdapter.savePowerState(telegramId, stateData);
  },
  
  async get(telegramId) {
    return await dbAdapter.getPowerState(telegramId);
  },
  
  async delete(telegramId) {
    return await dbAdapter.deletePowerState(telegramId);
  }
};

/**
 * Schedule history operations
 */
const scheduleHistory = {
  async save(userId, region, queue, scheduleData, hash, imageUrl) {
    return await dbAdapter.saveScheduleHistory(userId, region, queue, scheduleData, hash, imageUrl);
  },
  
  async getLatest(region, queue) {
    return await dbAdapter.getLatestScheduleHistory(region, queue);
  }
};

/**
 * Publication signatures for idempotency
 */
const publicationSignatures = {
  async create(signature, publicationType, region, queue, userId, channelId, dataHash) {
    return await dbAdapter.createPublicationSignature(
      signature, publicationType, region, queue, userId, channelId, dataHash
    );
  },
  
  async exists(signature) {
    return await dbAdapter.publicationSignatureExists(signature);
  },
  
  async cleanup() {
    return await dbAdapter.cleanupExpiredSignatures();
  }
};

/**
 * Channel operations
 */
const channels = {
  async savePending(channelId, channelUsername, channelTitle, telegramId) {
    return await dbAdapter.savePendingChannel(channelId, channelUsername, channelTitle, telegramId);
  },
  
  async getPending(channelId) {
    return await dbAdapter.getPendingChannel(channelId);
  },
  
  async deletePending(channelId) {
    return await dbAdapter.deletePendingChannel(channelId);
  },
  
  async getAllPending() {
    return await dbAdapter.getAllPendingChannels();
  }
};

/**
 * Power history operations
 */
const powerHistory = {
  async save(userId, eventType, timestamp, durationSeconds) {
    return await dbAdapter.savePowerHistory(userId, eventType, timestamp, durationSeconds);
  },
  
  async getForUser(userId, limit = 100) {
    return await dbAdapter.getPowerHistoryForUser(userId, limit);
  }
};

module.exports = {
  // Initialization
  initializeDatabase,
  closeDatabase,
  
  // Operations
  users,
  settings,
  userStates,
  powerStates,
  scheduleHistory,
  publicationSignatures,
  channels,
  powerHistory,
  
  // Configuration
  config,
  
  // Direct adapter access (for migration and advanced use)
  adapter: dbAdapter
};
