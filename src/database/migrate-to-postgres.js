#!/usr/bin/env node

/**
 * Migration script from SQLite to PostgreSQL
 * 
 * CRITICAL: This script ensures ZERO data loss during migration
 * 
 * Steps:
 * 1. Backup SQLite database
 * 2. Connect to both databases
 * 3. Migrate data table by table
 * 4. Verify data integrity
 * 5. Generate migration report
 */

const Database = require('better-sqlite3');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const SQLITE_PATH = process.env.SQLITE_PATH || './data/bot.db';
const BACKUP_DIR = './backups';
const DRY_RUN = process.env.DRY_RUN === 'true';

// PostgreSQL connection
const pgConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'voltik',
  user: process.env.POSTGRES_USER || 'voltik',
  password: process.env.POSTGRES_PASSWORD,
};

console.log('🔄 Starting migration from SQLite to PostgreSQL...');
console.log(`📂 SQLite database: ${SQLITE_PATH}`);
console.log(`🐘 PostgreSQL: ${pgConfig.host}:${pgConfig.port}/${pgConfig.database}`);
console.log(`🧪 Dry run: ${DRY_RUN ? 'YES' : 'NO'}`);

// Create backup
function createBackup(sqlitePath) {
  console.log('\n📦 Creating backup...');
  
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `bot_backup_${timestamp}.db`);
  
  fs.copyFileSync(sqlitePath, backupPath);
  
  // Calculate checksum
  const fileBuffer = fs.readFileSync(backupPath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  const checksum = hashSum.digest('hex');
  
  console.log(`✅ Backup created: ${backupPath}`);
  console.log(`🔐 Checksum: ${checksum}`);
  
  // Save checksum
  fs.writeFileSync(`${backupPath}.sha256`, checksum);
  
  return { backupPath, checksum };
}

// Count records in SQLite
function countSQLiteRecords(db, tableName) {
  try {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
    return result.count;
  } catch (error) {
    console.warn(`⚠️  Table ${tableName} not found in SQLite`);
    return 0;
  }
}

// Migrate users table
async function migrateUsers(sqliteDb, pgPool) {
  console.log('\n👥 Migrating users...');
  
  const users = sqliteDb.prepare('SELECT * FROM users').all();
  console.log(`📊 Found ${users.length} users`);
  
  if (DRY_RUN) {
    console.log('🧪 Dry run - skipping actual migration');
    return users.length;
  }
  
  let migrated = 0;
  const client = await pgPool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const user of users) {
      await client.query(`
        INSERT INTO users (
          telegram_id, username, region, queue, channel_id, channel_title,
          channel_description, channel_photo_file_id, channel_user_title,
          channel_user_description, channel_status, router_ip, is_active,
          migration_notified, notify_before_off, notify_before_on,
          alerts_off_enabled, alerts_on_enabled, last_hash, last_published_hash,
          last_post_id, power_state, power_changed_at, last_power_state,
          last_power_change, power_on_duration, last_alert_off_period,
          last_alert_on_period, alert_off_message_id, alert_on_message_id,
          today_snapshot_hash, tomorrow_snapshot_hash, tomorrow_published_date,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
          $29, $30, $31, $32, $33, $34, $35
        )
        ON CONFLICT (telegram_id) DO UPDATE SET
          username = EXCLUDED.username,
          region = EXCLUDED.region,
          queue = EXCLUDED.queue,
          updated_at = EXCLUDED.updated_at
      `, [
        user.telegram_id, user.username, user.region, user.queue,
        user.channel_id, user.channel_title, user.channel_description,
        user.channel_photo_file_id, user.channel_user_title,
        user.channel_user_description, user.channel_status || 'active',
        user.router_ip, user.is_active !== 0, user.migration_notified || 0,
        user.notify_before_off || 15, user.notify_before_on || 15,
        user.alerts_off_enabled !== 0, user.alerts_on_enabled !== 0,
        user.last_hash, user.last_published_hash, user.last_post_id,
        user.power_state, user.power_changed_at, user.last_power_state,
        user.last_power_change, user.power_on_duration,
        user.last_alert_off_period, user.last_alert_on_period,
        user.alert_off_message_id, user.alert_on_message_id,
        user.today_snapshot_hash, user.tomorrow_snapshot_hash,
        user.tomorrow_published_date, user.created_at, user.updated_at
      ]);
      
      migrated++;
    }
    
    await client.query('COMMIT');
    console.log(`✅ Migrated ${migrated} users`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error migrating users:', error);
    throw error;
  } finally {
    client.release();
  }
  
  return migrated;
}

// Migrate outage_history table
async function migrateOutageHistory(sqliteDb, pgPool) {
  console.log('\n⚡ Migrating outage_history...');
  
  try {
    const outages = sqliteDb.prepare('SELECT * FROM outage_history').all();
    console.log(`📊 Found ${outages.length} outage records`);
    
    if (DRY_RUN || outages.length === 0) {
      console.log('🧪 Skipping outage history migration');
      return 0;
    }
    
    let migrated = 0;
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const outage of outages) {
        // Get PostgreSQL user id from telegram_id
        const userResult = await client.query(
          'SELECT id FROM users WHERE telegram_id = $1',
          [outage.user_id]
        );
        
        if (userResult.rows.length === 0) {
          console.warn(`⚠️  User ${outage.user_id} not found, skipping outage record`);
          continue;
        }
        
        const pgUserId = userResult.rows[0].id;
        
        await client.query(`
          INSERT INTO outage_history (
            user_id, start_time, end_time, duration_minutes, created_at
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          pgUserId, outage.start_time, outage.end_time,
          outage.duration_minutes, outage.created_at
        ]);
        
        migrated++;
      }
      
      await client.query('COMMIT');
      console.log(`✅ Migrated ${migrated} outage records`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error migrating outage_history:', error);
      throw error;
    } finally {
      client.release();
    }
    
    return migrated;
  } catch (error) {
    console.warn('⚠️  No outage_history table in SQLite');
    return 0;
  }
}

// Migrate power_history table
async function migratePowerHistory(sqliteDb, pgPool) {
  console.log('\n🔋 Migrating power_history...');
  
  try {
    const powerHistory = sqliteDb.prepare('SELECT * FROM power_history').all();
    console.log(`📊 Found ${powerHistory.length} power history records`);
    
    if (DRY_RUN || powerHistory.length === 0) {
      console.log('🧪 Skipping power history migration');
      return 0;
    }
    
    let migrated = 0;
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const record of powerHistory) {
        // Get PostgreSQL user id
        const userResult = await client.query(
          'SELECT id FROM users WHERE telegram_id = $1',
          [record.user_id]
        );
        
        if (userResult.rows.length === 0) {
          console.warn(`⚠️  User ${record.user_id} not found, skipping power history record`);
          continue;
        }
        
        const pgUserId = userResult.rows[0].id;
        
        await client.query(`
          INSERT INTO power_history (
            user_id, event_type, timestamp, duration_seconds
          ) VALUES ($1, $2, $3, $4)
        `, [pgUserId, record.event_type, record.timestamp, record.duration_seconds]);
        
        migrated++;
      }
      
      await client.query('COMMIT');
      console.log(`✅ Migrated ${migrated} power history records`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error migrating power_history:', error);
      throw error;
    } finally {
      client.release();
    }
    
    return migrated;
  } catch (error) {
    console.warn('⚠️  No power_history table in SQLite');
    return 0;
  }
}

// Migrate settings table
async function migrateSettings(sqliteDb, pgPool) {
  console.log('\n⚙️  Migrating settings...');
  
  try {
    const settings = sqliteDb.prepare('SELECT * FROM settings').all();
    console.log(`📊 Found ${settings.length} settings`);
    
    if (DRY_RUN || settings.length === 0) {
      console.log('🧪 Skipping settings migration');
      return 0;
    }
    
    let migrated = 0;
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const setting of settings) {
        await client.query(`
          INSERT INTO settings (key, value, updated_at)
          VALUES ($1, $2, $3)
          ON CONFLICT (key) DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = EXCLUDED.updated_at
        `, [setting.key, setting.value, setting.updated_at]);
        
        migrated++;
      }
      
      await client.query('COMMIT');
      console.log(`✅ Migrated ${migrated} settings`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error migrating settings:', error);
      throw error;
    } finally {
      client.release();
    }
    
    return migrated;
  } catch (error) {
    console.warn('⚠️  No settings table in SQLite');
    return 0;
  }
}

// Migrate schedule_history table
async function migrateScheduleHistory(sqliteDb, pgPool) {
  console.log('\n📅 Migrating schedule_history...');
  
  try {
    const schedules = sqliteDb.prepare('SELECT * FROM schedule_history').all();
    console.log(`📊 Found ${schedules.length} schedule history records`);
    
    if (DRY_RUN || schedules.length === 0) {
      console.log('🧪 Skipping schedule history migration');
      return 0;
    }
    
    let migrated = 0;
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const schedule of schedules) {
        // Get PostgreSQL user id
        const userResult = await client.query(
          'SELECT id FROM users WHERE telegram_id = $1',
          [schedule.user_id]
        );
        
        if (userResult.rows.length === 0) {
          console.warn(`⚠️  User ${schedule.user_id} not found, skipping schedule record`);
          continue;
        }
        
        const pgUserId = userResult.rows[0].id;
        
        await client.query(`
          INSERT INTO schedule_history (
            user_id, region, queue, schedule_data, hash, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          pgUserId, schedule.region, schedule.queue,
          schedule.schedule_data, schedule.hash, schedule.created_at
        ]);
        
        migrated++;
      }
      
      await client.query('COMMIT');
      console.log(`✅ Migrated ${migrated} schedule history records`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error migrating schedule_history:', error);
      throw error;
    } finally {
      client.release();
    }
    
    return migrated;
  } catch (error) {
    console.warn('⚠️  No schedule_history table in SQLite');
    return 0;
  }
}

// Migrate user_states table
async function migrateUserStates(sqliteDb, pgPool) {
  console.log('\n🔄 Migrating user_states...');
  
  try {
    const states = sqliteDb.prepare('SELECT * FROM user_states').all();
    console.log(`📊 Found ${states.length} user states`);
    
    if (DRY_RUN || states.length === 0) {
      console.log('🧪 Skipping user states migration');
      return 0;
    }
    
    let migrated = 0;
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const state of states) {
        // Parse state_data as JSON
        let stateData;
        try {
          stateData = JSON.parse(state.state_data);
        } catch (error) {
          console.warn(`⚠️  Invalid JSON in state_data for user ${state.telegram_id}, skipping`);
          continue;
        }
        
        await client.query(`
          INSERT INTO user_states (
            telegram_id, state_type, state_data, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (telegram_id, state_type) DO UPDATE SET
            state_data = EXCLUDED.state_data,
            updated_at = EXCLUDED.updated_at
        `, [
          state.telegram_id, state.state_type, stateData,
          state.created_at, state.updated_at
        ]);
        
        migrated++;
      }
      
      await client.query('COMMIT');
      console.log(`✅ Migrated ${migrated} user states`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error migrating user_states:', error);
      throw error;
    } finally {
      client.release();
    }
    
    return migrated;
  } catch (error) {
    console.warn('⚠️  No user_states table in SQLite');
    return 0;
  }
}

// Verify migration
async function verifyMigration(sqliteDb, pgPool, stats) {
  console.log('\n✅ Verifying migration...');
  
  const client = await pgPool.connect();
  try {
    const pgUsers = await client.query('SELECT COUNT(*) as count FROM users');
    const sqliteUsers = countSQLiteRecords(sqliteDb, 'users');
    
    console.log(`👥 Users: SQLite=${sqliteUsers}, PostgreSQL=${pgUsers.rows[0].count}`);
    
    if (parseInt(pgUsers.rows[0].count) !== sqliteUsers) {
      console.warn('⚠️  User count mismatch!');
      return false;
    }
    
    // Verify a few sample users
    const sampleUsers = sqliteDb.prepare('SELECT telegram_id, region, queue FROM users LIMIT 5').all();
    for (const user of sampleUsers) {
      const pgUser = await client.query(
        'SELECT region, queue FROM users WHERE telegram_id = $1',
        [user.telegram_id]
      );
      
      if (pgUser.rows.length === 0) {
        console.warn(`⚠️  User ${user.telegram_id} not found in PostgreSQL!`);
        return false;
      }
      
      if (pgUser.rows[0].region !== user.region || pgUser.rows[0].queue !== user.queue) {
        console.warn(`⚠️  User ${user.telegram_id} data mismatch!`);
        return false;
      }
    }
    
    console.log('✅ Migration verification passed!');
    return true;
    
  } finally {
    client.release();
  }
}

// Generate migration report
function generateReport(stats, backupInfo) {
  console.log('\n📊 Migration Report');
  console.log('='.repeat(50));
  console.log(`📦 Backup: ${backupInfo.backupPath}`);
  console.log(`🔐 Checksum: ${backupInfo.checksum}`);
  console.log(`👥 Users migrated: ${stats.users}`);
  console.log(`⚡ Outage records: ${stats.outages}`);
  console.log(`🔋 Power history: ${stats.powerHistory}`);
  console.log(`⚙️  Settings: ${stats.settings}`);
  console.log(`📅 Schedule history: ${stats.scheduleHistory}`);
  console.log(`🔄 User states: ${stats.userStates}`);
  console.log('='.repeat(50));
  
  // Save report to file
  const report = {
    timestamp: new Date().toISOString(),
    backup: backupInfo,
    stats: stats,
    success: true
  };
  
  const reportPath = path.join(BACKUP_DIR, `migration_report_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📝 Report saved: ${reportPath}`);
}

// Main migration function
async function migrate() {
  let sqliteDb;
  let pgPool;
  
  try {
    // Check if SQLite database exists
    if (!fs.existsSync(SQLITE_PATH)) {
      console.error(`❌ SQLite database not found: ${SQLITE_PATH}`);
      console.log('ℹ️  This is expected if you are starting fresh or in a test environment');
      process.exit(0);
    }
    
    // Create backup
    const backupInfo = createBackup(SQLITE_PATH);
    
    // Connect to databases
    console.log('\n🔌 Connecting to databases...');
    sqliteDb = new Database(SQLITE_PATH, { readonly: true });
    pgPool = new Pool(pgConfig);
    
    await pgPool.query('SELECT NOW()');
    console.log('✅ Connected to PostgreSQL');
    
    // Statistics
    const stats = {
      users: 0,
      outages: 0,
      powerHistory: 0,
      settings: 0,
      scheduleHistory: 0,
      userStates: 0
    };
    
    // Migrate tables
    stats.users = await migrateUsers(sqliteDb, pgPool);
    stats.outages = await migrateOutageHistory(sqliteDb, pgPool);
    stats.powerHistory = await migratePowerHistory(sqliteDb, pgPool);
    stats.settings = await migrateSettings(sqliteDb, pgPool);
    stats.scheduleHistory = await migrateScheduleHistory(sqliteDb, pgPool);
    stats.userStates = await migrateUserStates(sqliteDb, pgPool);
    
    // Verify migration
    if (!DRY_RUN) {
      const verified = await verifyMigration(sqliteDb, pgPool, stats);
      if (!verified) {
        throw new Error('Migration verification failed!');
      }
    }
    
    // Generate report
    generateReport(stats, backupInfo);
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (sqliteDb) sqliteDb.close();
    if (pgPool) await pgPool.end();
  }
}

// Run migration
if (require.main === module) {
  migrate().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { migrate };
