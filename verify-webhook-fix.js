#!/usr/bin/env node

/**
 * Verification script for webhook freeze fixes
 * 
 * This script verifies all the fixes implemented:
 * 1. safeEditMessageText never throws
 * 2. back_to_main handler uses proper error handling
 * 3. drop_pending_updates is set in webhook configuration
 * 4. Wizard state cleanup function exists and works
 * 5. All safeAnswerCallbackQuery calls are awaited
 * 6. Global error boundary wraps webhookCallback
 * 7. Services initialized after webhook is set
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Verifying webhook freeze fixes...\n');

let testsPassed = 0;
let testsFailed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✅ ${description}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${description}`);
    console.error(`   Error: ${error.message}`);
    testsFailed++;
  }
}

// Fix 1: Verify safeEditMessageText never throws
test('Fix 1: safeEditMessageText never throws', () => {
  const errorHandlerPath = path.join(__dirname, 'src/utils/errorHandler.js');
  const content = fs.readFileSync(errorHandlerPath, 'utf8');
  
  const funcMatch = content.match(/async function safeEditMessageText\([\s\S]*?\n\}/);
  if (!funcMatch) {
    throw new Error('safeEditMessageText function not found');
  }
  
  const funcBody = funcMatch[0];
  
  // Should not throw in catch block
  if (funcBody.includes('catch') && funcBody.match(/catch[\s\S]*?throw/)) {
    throw new Error('safeEditMessageText still throws in catch block');
  }
  
  // Should return null on error
  if (!funcBody.includes('return null')) {
    throw new Error('safeEditMessageText does not return null');
  }
});

// Fix 2: Verify back_to_main uses return value check
test('Fix 2: back_to_main handler checks return value', () => {
  const botPath = path.join(__dirname, 'src/bot.js');
  const content = fs.readFileSync(botPath, 'utf8');
  
  // Find back_to_main handler with the result check pattern
  const backToMainMatch = content.match(/if \(data === 'back_to_main'\)[\s\S]{0,2000}const result = await safeEditMessageText[\s\S]{0,500}if \(result === null\)/);
  if (!backToMainMatch) {
    throw new Error('back_to_main does not check safeEditMessageText return value');
  }
});

// Fix 3: Verify drop_pending_updates is set
test('Fix 3: drop_pending_updates is set when setting webhook', () => {
  const indexPath = path.join(__dirname, 'src/index.js');
  const content = fs.readFileSync(indexPath, 'utf8');
  
  if (!content.includes('drop_pending_updates: true')) {
    throw new Error('drop_pending_updates not set in webhook configuration');
  }
});

// Fix 4: Verify wizard state cleanup exists
test('Fix 4: Wizard state cleanup function exists', () => {
  const stateManagerPath = path.join(__dirname, 'src/state/stateManager.js');
  const content = fs.readFileSync(stateManagerPath, 'utf8');
  
  if (!content.includes('cleanupStaleWizardStates')) {
    throw new Error('cleanupStaleWizardStates function not found');
  }
  
  // Verify it's called in initStateManager
  if (!content.match(/initStateManager[\s\S]*cleanupStaleWizardStates/)) {
    throw new Error('cleanupStaleWizardStates not called in initStateManager');
  }
  
  // Verify it checks for 30 minute expiration
  if (!content.includes('30 * 60 * 1000')) {
    throw new Error('30 minute expiration not set');
  }
});

// Fix 4b: Verify the function works
test('Fix 4b: Wizard state cleanup function is functional', () => {
  const { cleanupStaleWizardStates } = require('./src/state/stateManager');
  cleanupStaleWizardStates(); // Should not throw
});

// Fix 5: Verify all safeAnswerCallbackQuery calls are awaited (already done)
test('Fix 5: All safeAnswerCallbackQuery calls are awaited', () => {
  const handlers = ['start.js', 'settings.js', 'channel.js', 'admin.js'];
  
  for (const handler of handlers) {
    const handlerPath = path.join(__dirname, 'src/handlers', handler);
    const content = fs.readFileSync(handlerPath, 'utf8');
    
    // Check if there are any safeAnswerCallbackQuery calls without await
    const matches = content.match(/[^await ]\s+safeAnswerCallbackQuery\(/g);
    if (matches && matches.length > 0) {
      throw new Error(`${handler} has safeAnswerCallbackQuery without await`);
    }
  }
});

// Fix 6: Verify global error boundary wraps webhookCallback
test('Fix 6: Global error boundary wraps webhookCallback', () => {
  const indexPath = path.join(__dirname, 'src/index.js');
  const content = fs.readFileSync(indexPath, 'utf8');
  
  // Check for try-catch around webhookCallback with the error message
  if (!content.match(/try[\s\S]*await webhookCallback[\s\S]*catch \(error\)[\s\S]*Fatal webhook processing error/)) {
    throw new Error('Global error boundary not found around webhookCallback');
  }
  
  // Check that it tracks errors and returns 200
  if (!content.includes('metricsCollector.trackError(error, { context: \'webhookCallback\' })')) {
    throw new Error('Error boundary does not track errors');
  }
  
  if (!content.includes('res.status(200).json({ ok: true })')) {
    throw new Error('Error boundary does not return 200');
  }
});

// Fix 7: Verify services initialized after webhook is set
test('Fix 7: Services initialized after webhook is set', () => {
  const indexPath = path.join(__dirname, 'src/index.js');
  const content = fs.readFileSync(indexPath, 'utf8');
  
  // Find webhook setup and service initialization order
  const webhookMatch = content.match(/setWebhook[\s\S]{0,500}initializeServices/);
  if (!webhookMatch) {
    throw new Error('Services not initialized after webhook');
  }
  
  // Verify it's in the app.listen callback
  if (!content.match(/app\.listen[\s\S]*setWebhook[\s\S]*initializeServices/)) {
    throw new Error('Services not in correct initialization order');
  }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);

if (testsFailed === 0) {
  console.log('\n✅ All webhook freeze fixes verified successfully!');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. Please review the implementation.');
  process.exit(1);
}
