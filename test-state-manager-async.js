#!/usr/bin/env node

/**
 * Test async/await fixes in stateManager
 */

require('dotenv').config();

async function testStateManager() {
  console.log('🧪 Testing stateManager async/await fixes...\n');
  
  try {
    // Initialize database
    console.log('1. Initializing database...');
    const { initializeDatabase, runMigrations } = require('./src/database/db');
    await initializeDatabase();
    await runMigrations();
    console.log('✓ Database initialized\n');
    
    // Test stateManager initialization
    console.log('2. Testing initStateManager()...');
    const { initStateManager, getState, setState, clearState } = require('./src/state/stateManager');
    await initStateManager();
    console.log('✓ initStateManager() completed without errors\n');
    
    // Test setState
    console.log('3. Testing setState()...');
    await setState('wizard', 'test123', { step: 'region', mode: 'new' });
    console.log('✓ setState() completed\n');
    
    // Test getState
    console.log('4. Testing getState()...');
    const state = getState('wizard', 'test123');
    if (state && state.step === 'region') {
      console.log('✓ getState() returned correct state\n');
    } else {
      console.error('✗ getState() failed to retrieve state\n');
      process.exit(1);
    }
    
    // Test clearState
    console.log('5. Testing clearState()...');
    await clearState('wizard', 'test123');
    const clearedState = getState('wizard', 'test123');
    if (!clearedState) {
      console.log('✓ clearState() successfully cleared state\n');
    } else {
      console.error('✗ clearState() failed to clear state\n');
      process.exit(1);
    }
    
    console.log('✅ All stateManager async/await tests passed!');
    
    // Close database
    const { closeDatabase } = require('./src/database/db');
    await closeDatabase();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

testStateManager();
