// Storage wrapper for database operations
// Reuses existing better-sqlite3 database from src/database/
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Import existing CommonJS database modules
let db, usersDb;

export async function initStorage() {
  // Import existing database modules (CommonJS)
  db = require('../../src/database/db.js');
  usersDb = require('../../src/database/users.js');
  
  console.log('✅ База даних підключена');
}

// User operations
export function getUserByTelegramId(telegramId) {
  return usersDb.getUserByTelegramId(telegramId);
}

export function createUser(telegramId, username, region, queue) {
  return usersDb.createUser(telegramId, username, region, queue);
}

export function updateUser(telegramId, data) {
  return usersDb.updateUser(telegramId, data);
}

export function updateUserRegionQueue(telegramId, region, queue) {
  return usersDb.updateUserRegionAndQueue(telegramId, region, queue);
}

export function getAllUsers() {
  return usersDb.getAllUsers();
}

export function getActiveUsers() {
  return usersDb.getActiveUsers();
}

export function getUserByChannelId(channelId) {
  return usersDb.getUserByChannelId(channelId);
}

// Settings operations
export function getSetting(key) {
  return db.getSetting(key);
}

export function setSetting(key, value) {
  return db.setSetting(key, value);
}

// State operations
export function saveState(type, telegramId, data) {
  return db.saveState(type, telegramId, data);
}

export function getState(type, telegramId) {
  return db.getState(type, telegramId);
}

export function deleteState(type, telegramId) {
  return db.deleteState(type, telegramId);
}

export function getAllStates(type) {
  return db.getAllStates(type);
}

// Pending channels
export function savePendingChannel(channelId, channelUsername, channelTitle, telegramId) {
  return db.savePendingChannel(channelId, channelUsername, channelTitle, telegramId);
}

export function getPendingChannel(channelId) {
  return db.getPendingChannel(channelId);
}

export function deletePendingChannel(channelId) {
  return db.deletePendingChannel(channelId);
}

export function getAllPendingChannels() {
  return db.getAllPendingChannels();
}

// Close database
export function closeDatabase() {
  if (db && db.closeDatabase) {
    db.closeDatabase();
  }
}
