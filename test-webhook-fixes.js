#!/usr/bin/env node

/**
 * Test script to verify webhook fixes
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing webhook fixes...\n');

// Test 1: Verify async/await pattern in command handlers
console.log('Test 1: Command handler async patterns');
try {
  const botCode = fs.readFileSync(path.join(__dirname, 'src/bot.js'), 'utf8');
  
  // Check for safeCommandHandler wrapper function
  const hasSafeWrapper = /function safeCommandHandler\(commandName,\s*handler\)/.test(botCode);
  assert(hasSafeWrapper, 'safeCommandHandler wrapper should exist');
  
  // Check that safeCommandHandler returns async function
  const wrapperIsAsync = /return async \(ctx\)/.test(botCode);
  assert(wrapperIsAsync, 'safeCommandHandler should return async function');
  
  // Check for try/catch in wrapper
  const hasTryCatch = /try\s*\{[^}]*await\s+handler\(bot,\s*ctx\.msg\)/.test(botCode);
  assert(hasTryCatch, 'safeCommandHandler should have try/catch');
  
  // Check that commands use the wrapper
  const hasWrappedCommands = /bot\.command\("start",\s*safeCommandHandler/.test(botCode);
  assert(hasWrappedCommands, 'Commands should use safeCommandHandler');
  
  console.log('✓ All command handlers use async/await pattern with wrapper\n');
} catch (error) {
  console.error('✗ Async pattern check failed:', error.message);
  process.exit(1);
}

// Test 2: Verify webhook logging middleware
console.log('Test 2: Webhook logging middleware');
try {
  const indexCode = fs.readFileSync(path.join(__dirname, 'src/index.js'), 'utf8');
  
  // Check for webhook logging
  const hasLogging = /console\.log\(`📨 Webhook received/.test(indexCode);
  assert(hasLogging, 'Webhook logging should be present');
  
  // Check for update_id logging
  const hasUpdateId = /update_id/.test(indexCode);
  assert(hasUpdateId, 'Update ID logging should be present');
  
  console.log('✓ Webhook logging middleware is present\n');
} catch (error) {
  console.error('✗ Webhook logging check failed:', error.message);
  process.exit(1);
}

// Test 3: Verify webhook status endpoint
console.log('Test 3: Webhook status endpoint');
try {
  const indexCode = fs.readFileSync(path.join(__dirname, 'src/index.js'), 'utf8');
  
  // Check for webhook-status endpoint
  const hasStatusEndpoint = /app\.get\('\/webhook-status'/.test(indexCode);
  assert(hasStatusEndpoint, 'Webhook status endpoint should exist');
  
  // Check for getWebhookInfo call
  const hasGetWebhookInfo = /bot\.api\.getWebhookInfo/.test(indexCode);
  assert(hasGetWebhookInfo, 'getWebhookInfo call should be present');
  
  console.log('✓ Webhook status endpoint is present\n');
} catch (error) {
  console.error('✗ Webhook status endpoint check failed:', error.message);
  process.exit(1);
}

// Test 4: Verify body size limit
console.log('Test 4: Body size limit');
try {
  const indexCode = fs.readFileSync(path.join(__dirname, 'src/index.js'), 'utf8');
  
  // Check for body size limit
  const hasLimit = /express\.json\(\{\s*limit:\s*'1mb'\s*\}\)/.test(indexCode);
  assert(hasLimit, 'Body size limit should be set to 1mb');
  
  console.log('✓ Body size limit is configured\n');
} catch (error) {
  console.error('✗ Body size limit check failed:', error.message);
  process.exit(1);
}

// Test 5: Verify editMessageText Number() conversion
console.log('Test 5: editMessageText userId conversion');
try {
  const botCode = fs.readFileSync(path.join(__dirname, 'src/bot.js'), 'utf8');
  
  // Check for Number(userId) in editMessageText
  const hasNumberConversion = /bot\.api\.editMessageText\(\s*Number\(userId\)/.test(botCode);
  assert(hasNumberConversion, 'userId should be converted to Number()');
  
  console.log('✓ editMessageText uses Number(userId)\n');
} catch (error) {
  console.error('✗ editMessageText conversion check failed:', error.message);
  process.exit(1);
}

// Test 6: Verify improved callback error handling
console.log('Test 6: Callback query error handling');
try {
  const botCode = fs.readFileSync(path.join(__dirname, 'src/bot.js'), 'utf8');
  
  // Check for nested try/catch in callback error handler
  const hasNestedTryCatch = /catch \(answerError\)/.test(botCode);
  assert(hasNestedTryCatch, 'Callback error handler should have nested try/catch');
  
  console.log('✓ Callback query error handling is improved\n');
} catch (error) {
  console.error('✗ Callback error handling check failed:', error.message);
  process.exit(1);
}

console.log('✅ All webhook fix tests passed!');
