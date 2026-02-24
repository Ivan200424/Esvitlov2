/**
 * Migration script to add new fields to existing users table
 * This is now handled by runMigrations() in db.js
 */

const { pool, runMigrations } = require('./db');
const logger = require('../logger').child({ module: 'migrate' });

logger.info('🔄 Starting database migration...');

async function main() {
  try {
    await runMigrations();
    logger.info('\n✅ Migration completed!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, '❌ Migration failed');
    await pool.end();
    process.exit(1);
  }
}

main();
