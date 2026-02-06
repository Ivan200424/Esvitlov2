/**
 * Migration script for v2 snapshot tracking
 * Adds fields to track today and tomorrow schedule snapshots separately
 */

const Database = require('better-sqlite3');

console.log('🔄 Starting v2 snapshot migration...');

// Get database path from environment
const databasePath = process.env.DATABASE_PATH || './data/bot.db';
const db = new Database(databasePath);

// Check if migration is needed
const tableInfo = db.pragma('table_info(users)');
const existingColumns = tableInfo.map(col => col.name);

console.log('Checking for snapshot columns...');

const columnsToAdd = [
  { name: 'today_snapshot_hash', type: 'TEXT' },
  { name: 'tomorrow_snapshot_hash', type: 'TEXT' },
  { name: 'tomorrow_published_date', type: 'TEXT' }, // Store date when tomorrow was published
];

let addedCount = 0;

for (const column of columnsToAdd) {
  if (!existingColumns.includes(column.name)) {
    console.log(`Adding column: ${column.name} (${column.type})`);
    try {
      db.exec(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`);
      addedCount++;
      console.log(`✓ Added ${column.name}`);
    } catch (error) {
      console.error(`Error adding ${column.name}:`, error.message);
    }
  } else {
    console.log(`✓ Column ${column.name} already exists`);
  }
}

db.close();

console.log(`\n✅ v2 snapshot migration completed! Added ${addedCount} new columns.`);
