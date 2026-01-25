/**
 * Migration script to add new fields to existing users table
 * Run this if you have an existing database
 */

const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

console.log('🔄 Starting database migration...');

const db = new Database(config.databasePath);

// Check if migration is needed
const tableInfo = db.pragma('table_info(users)');
const existingColumns = tableInfo.map(col => col.name);

console.log('Existing columns:', existingColumns);

const columnsToAdd = [
  { name: 'power_state', type: 'TEXT' },
  { name: 'power_changed_at', type: 'DATETIME' },
  { name: 'last_alert_off_period', type: 'TEXT' },
  { name: 'last_alert_on_period', type: 'TEXT' },
  { name: 'alert_off_message_id', type: 'INTEGER' },
  { name: 'alert_on_message_id', type: 'INTEGER' },
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

console.log(`\n✅ Migration completed! Added ${addedCount} new columns.`);
