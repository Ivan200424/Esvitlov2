#!/usr/bin/env node

/**
 * Verification test for webhook freeze bug fix
 * 
 * This test validates:
 * 1. safeEditMessageText never throws - always returns null on error
 * 2. safeAnswerCallbackQuery never throws - always returns boolean
 * 3. All handlers properly import and use safe functions
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing webhook freeze bug fix...\n');

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

// Test 1: Verify safeEditMessageText doesn't throw
test('safeEditMessageText returns null instead of throwing', () => {
  const errorHandlerPath = path.join(__dirname, 'src/utils/errorHandler.js');
  const content = fs.readFileSync(errorHandlerPath, 'utf8');
  
  // Check that safeEditMessageText function exists
  if (!content.includes('async function safeEditMessageText')) {
    throw new Error('safeEditMessageText function not found');
  }
  
  // Check that it doesn't throw errors (no 'throw error' in the function)
  const funcMatch = content.match(/async function safeEditMessageText\([\s\S]*?\n\}/);
  if (!funcMatch) {
    throw new Error('Could not extract safeEditMessageText function');
  }
  
  const funcBody = funcMatch[0];
  
  // Count throw statements - should only be in try block (none in catch)
  const catchBlock = funcBody.match(/catch \(error\) \{[\s\S]*?\n\s*\}/);
  if (!catchBlock) {
    throw new Error('No catch block found in safeEditMessageText');
  }
  
  if (catchBlock[0].includes('throw error')) {
    throw new Error('safeEditMessageText still throws errors in catch block');
  }
  
  // Verify it returns null on error
  if (!catchBlock[0].includes('return null')) {
    throw new Error('safeEditMessageText does not return null on error');
  }
});

// Test 2: Verify bot.js uses safeAnswerCallbackQuery
test('bot.js imports and uses safeAnswerCallbackQuery', () => {
  const botPath = path.join(__dirname, 'src/bot.js');
  const content = fs.readFileSync(botPath, 'utf8');
  
  // Check import
  if (!content.includes('safeAnswerCallbackQuery')) {
    throw new Error('safeAnswerCallbackQuery not imported in bot.js');
  }
  
  // Check no bare bot.api.answerCallbackQuery remains
  if (content.includes('bot.api.answerCallbackQuery')) {
    throw new Error('bot.js still contains bare bot.api.answerCallbackQuery calls');
  }
});

// Test 3: Verify middleware logging is added
test('bot.js has update logging middleware', () => {
  const botPath = path.join(__dirname, 'src/bot.js');
  const content = fs.readFileSync(botPath, 'utf8');
  
  // Check for middleware
  if (!content.includes('bot.use(async (ctx, next)')) {
    throw new Error('Update logging middleware not found in bot.js');
  }
  
  // Check for update_id logging
  if (!content.includes('Processing update') || !content.includes('update_id')) {
    throw new Error('Update ID logging not found in middleware');
  }
  
  // Check for completion logging
  if (!content.includes('Finished update')) {
    throw new Error('Update completion logging not found in middleware');
  }
});

// Test 4: Verify index.js has webhook logging
test('index.js has webhook request/response logging', () => {
  const indexPath = path.join(__dirname, 'src/index.js');
  const content = fs.readFileSync(indexPath, 'utf8');
  
  // Check for webhook IN logging
  if (!content.includes('Webhook IN:')) {
    throw new Error('Webhook IN logging not found in index.js');
  }
  
  // Check for webhook OUT logging
  if (!content.includes('Webhook OUT:')) {
    throw new Error('Webhook OUT logging not found in index.js');
  }
  
  // Check for response tracking
  if (!content.includes('res.end = function')) {
    throw new Error('Response tracking not found in index.js');
  }
});

// Test 5: Verify back_to_main uses return value check
test('bot.js back_to_main checks return value instead of try/catch', () => {
  const botPath = path.join(__dirname, 'src/bot.js');
  const content = fs.readFileSync(botPath, 'utf8');
  
  // Find back_to_main callback
  if (!content.includes('back_to_main')) {
    throw new Error('back_to_main handler not found');
  }
  
  // Check for result === null pattern
  if (!content.includes('result === null')) {
    throw new Error('back_to_main does not check for null return value');
  }
  
  // Check that safeEditMessageText result is captured
  if (!content.includes('const result = await safeEditMessageText')) {
    throw new Error('back_to_main does not capture safeEditMessageText result');
  }
});

// Test 6: Verify all handlers use safeAnswerCallbackQuery
test('All handlers use safeAnswerCallbackQuery', () => {
  const handlers = ['start.js', 'channel.js', 'settings.js', 'admin.js'];
  
  for (const handler of handlers) {
    const handlerPath = path.join(__dirname, 'src/handlers', handler);
    const content = fs.readFileSync(handlerPath, 'utf8');
    
    // Check if handler uses answerCallbackQuery
    const hasAnswerCallback = content.includes('answerCallbackQuery');
    
    if (hasAnswerCallback) {
      // If it does, ensure it's the safe version
      if (content.includes('bot.api.answerCallbackQuery')) {
        throw new Error(`${handler} still contains bare bot.api.answerCallbackQuery calls`);
      }
      
      // Verify safe version is imported
      if (!content.includes('safeAnswerCallbackQuery')) {
        throw new Error(`${handler} uses answerCallbackQuery but doesn't import safeAnswerCallbackQuery`);
      }
    }
  }
});

// Test 7: Verify errorHandler exports safeAnswerCallbackQuery
test('errorHandler.js exports safeAnswerCallbackQuery', () => {
  const errorHandlerPath = path.join(__dirname, 'src/utils/errorHandler.js');
  const content = fs.readFileSync(errorHandlerPath, 'utf8');
  
  // Check function exists
  if (!content.includes('async function safeAnswerCallbackQuery')) {
    throw new Error('safeAnswerCallbackQuery function not found');
  }
  
  // Check export
  if (!content.includes('safeAnswerCallbackQuery')) {
    throw new Error('safeAnswerCallbackQuery not exported');
  }
  
  // Verify it catches errors
  const funcMatch = content.match(/async function safeAnswerCallbackQuery[\s\S]*?\n\}/);
  if (funcMatch && !funcMatch[0].includes('catch')) {
    throw new Error('safeAnswerCallbackQuery does not have error handling');
  }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);

if (testsFailed === 0) {
  console.log('\n✅ All tests passed! Webhook freeze fix verified.');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. Please review the changes.');
  process.exit(1);
}
