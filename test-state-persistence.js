// Test database migration and state persistence functions
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Create a temporary test database
const testDbPath = '/tmp/test-bot.db';
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

// Set environment variable for test DB
process.env.DATABASE_PATH = testDbPath;

// Import the database module to initialize tables
const db = require('./src/database/db');

console.log('Testing database migrations...');

// Check if user_states table exists
try {
  const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_states'").get();
  if (tableInfo) {
    console.log('✅ user_states table created');
  } else {
    console.error('❌ user_states table NOT created');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error checking user_states table:', error.message);
  process.exit(1);
}

// Check if pending_channels table exists
try {
  const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pending_channels'").get();
  if (tableInfo) {
    console.log('✅ pending_channels table created');
  } else {
    console.error('❌ pending_channels table NOT created');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error checking pending_channels table:', error.message);
  process.exit(1);
}

// Test saveUserState and getUserState
console.log('\nTesting state persistence functions...');
const { saveUserState, getUserState, deleteUserState, getAllUserStates } = require('./src/database/db');

// Test wizard state
const testState = { step: 'region', mode: 'new' };
saveUserState('12345', 'wizard', testState);
const retrieved = getUserState('12345', 'wizard');
if (retrieved && retrieved.step === 'region' && retrieved.mode === 'new') {
  console.log('✅ saveUserState and getUserState work correctly');
} else {
  console.error('❌ State persistence failed:', retrieved);
  process.exit(1);
}

// Test getAllUserStates
const allStates = getAllUserStates('wizard');
if (allStates.length === 1 && allStates[0].telegram_id === '12345') {
  console.log('✅ getAllUserStates works correctly');
} else {
  console.error('❌ getAllUserStates failed:', allStates);
  process.exit(1);
}

// Test deleteUserState
deleteUserState('12345', 'wizard');
const afterDelete = getUserState('12345', 'wizard');
if (afterDelete === null) {
  console.log('✅ deleteUserState works correctly');
} else {
  console.error('❌ deleteUserState failed:', afterDelete);
  process.exit(1);
}

// Test pending channels
const { savePendingChannel, getPendingChannel, deletePendingChannel, getAllPendingChannels } = require('./src/database/db');

savePendingChannel('-100123', '@test_channel', 'Test Channel', '12345');
const channel = getPendingChannel('-100123');
if (channel && channel.channel_username === '@test_channel') {
  console.log('✅ savePendingChannel and getPendingChannel work correctly');
} else {
  console.error('❌ Pending channel persistence failed:', channel);
  process.exit(1);
}

const allChannels = getAllPendingChannels();
if (allChannels.length === 1 && allChannels[0].channel_id === '-100123') {
  console.log('✅ getAllPendingChannels works correctly');
} else {
  console.error('❌ getAllPendingChannels failed:', allChannels);
  process.exit(1);
}

deletePendingChannel('-100123');
const afterChannelDelete = getPendingChannel('-100123');
if (afterChannelDelete === null || afterChannelDelete === undefined) {
  console.log('✅ deletePendingChannel works correctly');
} else {
  console.error('❌ deletePendingChannel failed:', afterChannelDelete);
  process.exit(1);
}

// Test cleanup old states
console.log('\nTesting cleanup function...');
const { cleanupOldStates } = require('./src/database/db');

// Add an old state (simulate by inserting directly)
db.prepare("INSERT INTO user_states (telegram_id, state_type, state_data, updated_at) VALUES (?, ?, ?, datetime('now', '-25 hours'))").run('99999', 'test', '{}');

cleanupOldStates();

const oldState = getUserState('99999', 'test');
if (oldState === null) {
  console.log('✅ cleanupOldStates works correctly');
} else {
  console.error('❌ cleanupOldStates failed - old state still exists');
  process.exit(1);
}

console.log('\n✅ All database tests passed!');

// Cleanup
db.closeDatabase();
fs.unlinkSync(testDbPath);
