/**
 * Minimal test to verify the conversationStates fix
 * This directly checks the syntax without needing all dependencies
 */

const fs = require('fs');
const path = require('path');

console.log('Testing channel.js for conversationStates fix...\n');

// Read the file
const channelFile = fs.readFileSync(
  path.join(__dirname, 'src/handlers/channel.js'),
  'utf8'
);

// Check for the error pattern: module.exports with conversationStates
const hasConversationStatesExport = channelFile.includes('conversationStates,');
const hasSetConversationStateExport = channelFile.includes('setConversationState,');

// Check for direct Map usage patterns
const hasConversationStatesGet = channelFile.match(/conversationStates\.get/);
const hasConversationStatesHas = channelFile.match(/conversationStates\.has/);
const hasConversationStatesSet = channelFile.match(/conversationStates\.set/);

console.log('Check 1: module.exports has conversationStates?', hasConversationStatesExport ? '❌ YES (bad)' : '✅ NO (good)');
console.log('Check 2: module.exports has setConversationState?', hasSetConversationStateExport ? '✅ YES (good)' : '❌ NO (bad)');
console.log('Check 3: Code uses conversationStates.get()?', hasConversationStatesGet ? '❌ YES (bad)' : '✅ NO (good)');
console.log('Check 4: Code uses conversationStates.has()?', hasConversationStatesHas ? '❌ YES (bad)' : '✅ NO (good)');
console.log('Check 5: Code uses conversationStates.set()?', hasConversationStatesSet ? '⚠️  YES (check admin.js)' : '✅ NO (good)');

// Check admin.js
const adminFile = fs.readFileSync(
  path.join(__dirname, 'src/handlers/admin.js'),
  'utf8'
);

const adminHasConversationStatesImport = adminFile.includes("{ conversationStates }");
const adminHasSetConversationStateImport = adminFile.includes("{ setConversationState }");
const adminUsesConversationStatesSet = adminFile.match(/conversationStates\.set/);

console.log('\nAdmin.js checks:');
console.log('Check 6: admin.js imports conversationStates?', adminHasConversationStatesImport ? '❌ YES (bad)' : '✅ NO (good)');
console.log('Check 7: admin.js imports setConversationState?', adminHasSetConversationStateImport ? '✅ YES (good)' : '❌ NO (bad)');
console.log('Check 8: admin.js uses conversationStates.set()?', adminUsesConversationStatesSet ? '❌ YES (bad)' : '✅ NO (good)');

// Check for helper functions
const hasGetConversationState = channelFile.includes('function getConversationState(');
const hasSetConversationStateFunc = channelFile.includes('function setConversationState(');
const hasHasConversationState = channelFile.includes('function hasConversationState(');

console.log('\nHelper function checks:');
console.log('Check 9: Has getConversationState() helper?', hasGetConversationState ? '✅ YES' : '❌ NO');
console.log('Check 10: Has setConversationState() helper?', hasSetConversationStateFunc ? '✅ YES' : '❌ NO');
console.log('Check 11: Has hasConversationState() helper?', hasHasConversationState ? '✅ YES' : '❌ NO');

const allPassed = 
  !hasConversationStatesExport &&
  hasSetConversationStateExport &&
  !hasConversationStatesGet &&
  !hasConversationStatesHas &&
  !adminHasConversationStatesImport &&
  adminHasSetConversationStateImport &&
  !adminUsesConversationStatesSet &&
  hasGetConversationState &&
  hasSetConversationStateFunc &&
  hasHasConversationState;

if (allPassed) {
  console.log('\n✅ SUCCESS: All checks passed! The "conversationStates is not defined" error should be fixed.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some checks failed. Review the output above.');
  process.exit(1);
}
