/**
 * Migration script for v2 snapshot tracking
 * Adds fields to track today and tomorrow schedule snapshots separately
 * This is now handled by runMigrations() in db.js
 */

const { pool, runMigrations } = require('./db');
const logger = require('../logger').child({ module: 'migrate-v2-snapshots' });

logger.info('🔄 Starting v2 snapshot migration...');

async function main() {
  try {
    // The columns are already in the initializeDatabase() and runMigrations() in db.js
    // So this just runs the migrations
    await runMigrations();
    logger.info('\n✅ v2 snapshot migration completed!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, '❌ Migration failed');
    await pool.end();
    process.exit(1);
  }
}

main();
