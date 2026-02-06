#!/usr/bin/env node

/**
 * Architecture Test Suite
 * Tests the new architectural components
 */

const assert = require('assert');

console.log('🧪 Running Architecture Tests...\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    testsFailed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    testsFailed++;
  }
}

// Test Logger
console.log('Testing Logger...');
const { Logger, logger } = require('./src/core/Logger');

test('Logger creates instance', () => {
  assert(logger instanceof Logger);
});

test('Logger has methods', () => {
  assert(typeof logger.info === 'function');
  assert(typeof logger.error === 'function');
  assert(typeof logger.warn === 'function');
  assert(typeof logger.debug === 'function');
});

test('Logger creates child with context', () => {
  const childLogger = logger.child({ component: 'test' });
  assert(childLogger instanceof Logger);
  assert.deepStrictEqual(childLogger.context, { 
    service: 'eSvitlo-bot', 
    component: 'test' 
  });
});

// Test EventEmitter
console.log('\nTesting EventEmitter...');
const { EventEmitter, eventBus, Events } = require('./src/core/EventEmitter');

test('EventEmitter creates instance', () => {
  assert(eventBus instanceof EventEmitter);
});

test('Events constants defined', () => {
  assert(typeof Events.SCHEDULE_CHANGED === 'string');
  assert(typeof Events.POWER_ON === 'string');
  assert(typeof Events.POWER_OFF === 'string');
});

asyncTest('EventEmitter emits and receives events', async () => {
  const testEmitter = new EventEmitter('test');
  let received = false;
  
  testEmitter.on('test_event', (data) => {
    received = true;
    assert.strictEqual(data.value, 123);
  });
  
  await testEmitter.emit('test_event', { value: 123 });
  assert(received, 'Event was not received');
});

asyncTest('EventEmitter one-time subscription', async () => {
  const testEmitter = new EventEmitter('test');
  let count = 0;
  
  testEmitter.once('test_once', () => {
    count++;
  });
  
  await testEmitter.emit('test_once');
  await testEmitter.emit('test_once');
  
  assert.strictEqual(count, 1, 'Event fired more than once');
});

test('EventEmitter unsubscribe', () => {
  const testEmitter = new EventEmitter('test');
  let received = false;
  
  const unsubscribe = testEmitter.on('test_unsub', () => {
    received = true;
  });
  
  unsubscribe();
  testEmitter.emitSync('test_unsub');
  
  assert(!received, 'Event was received after unsubscribe');
});

// Test StateManager
console.log('\nTesting StateManager...');
const { StateManager, stateManager } = require('./src/core/StateManager');

test('StateManager creates instance', () => {
  assert(stateManager instanceof StateManager);
});

test('StateManager set and get', () => {
  stateManager.set('test', 'key1', { value: 'test' });
  const value = stateManager.get('test', 'key1');
  assert.deepStrictEqual(value, { value: 'test' });
});

test('StateManager has method', () => {
  stateManager.set('test', 'key2', 'value2');
  assert(stateManager.has('test', 'key2'));
  assert(!stateManager.has('test', 'nonexistent'));
});

test('StateManager delete', () => {
  stateManager.set('test', 'key3', 'value3');
  assert(stateManager.has('test', 'key3'));
  
  stateManager.delete('test', 'key3');
  assert(!stateManager.has('test', 'key3'));
});

test('StateManager getAll', () => {
  stateManager.set('test_ns', 'k1', 'v1');
  stateManager.set('test_ns', 'k2', 'v2');
  
  const all = stateManager.getAll('test_ns');
  assert.strictEqual(all.size, 2);
  assert.strictEqual(all.get('k1'), 'v1');
  assert.strictEqual(all.get('k2'), 'v2');
});

test('StateManager clearNamespace', () => {
  stateManager.set('test_clear', 'k1', 'v1');
  stateManager.set('test_clear', 'k2', 'v2');
  
  stateManager.clearNamespace('test_clear');
  
  const all = stateManager.getAll('test_clear');
  assert.strictEqual(all.size, 0);
});

test('StateManager TTL', async () => {
  stateManager.set('test', 'ttl_key', 'value', { ttl: 100 });
  
  assert(stateManager.has('test', 'ttl_key'));
  
  await new Promise(resolve => setTimeout(resolve, 150));
  
  assert(!stateManager.has('test', 'ttl_key'), 'Key should have expired');
});

test('StateManager getStats', () => {
  const stats = stateManager.getStats();
  assert(typeof stats.total === 'number');
  assert(typeof stats.byNamespace === 'object');
});

// Test SchedulerManager
console.log('\nTesting SchedulerManager...');
const { SchedulerManager, schedulerManager } = require('./src/core/SchedulerManager');

test('SchedulerManager creates instance', () => {
  assert(schedulerManager instanceof SchedulerManager);
});

test('SchedulerManager init', () => {
  schedulerManager.init();
  assert(schedulerManager.isInitialized);
});

asyncTest('SchedulerManager register and start', async () => {
  let executed = false;
  
  schedulerManager.register('test_task', async () => {
    executed = true;
  }, {
    interval: 1,
    runImmediately: true
  });
  
  schedulerManager.start('test_task');
  
  // Wait for task to execute
  await new Promise(resolve => setTimeout(resolve, 100));
  
  assert(executed, 'Task was not executed');
  
  schedulerManager.stop('test_task');
  schedulerManager.unregister('test_task');
});

test('SchedulerManager getStatus', () => {
  schedulerManager.register('status_task', async () => {}, {
    interval: 60
  });
  
  const status = schedulerManager.getStatus('status_task');
  assert(status !== null);
  assert.strictEqual(status.name, 'status_task');
  assert.strictEqual(status.interval, 60);
  
  schedulerManager.unregister('status_task');
});

test('SchedulerManager getAllStatus', () => {
  schedulerManager.register('task1', async () => {}, { interval: 60 });
  schedulerManager.register('task2', async () => {}, { interval: 30 });
  
  const statuses = schedulerManager.getAllStatus();
  assert(Array.isArray(statuses));
  assert(statuses.length >= 2);
  
  schedulerManager.unregister('task1');
  schedulerManager.unregister('task2');
});

test('SchedulerManager getStats', () => {
  const stats = schedulerManager.getStats();
  assert(typeof stats.total === 'number');
  assert(typeof stats.running === 'number');
  assert(typeof stats.stopped === 'number');
});

// Test ScheduleService
console.log('\nTesting ScheduleService...');
const { ScheduleService, scheduleService } = require('./src/services/ScheduleService');

test('ScheduleService creates instance', () => {
  assert(scheduleService instanceof ScheduleService);
});

test('ScheduleService determines publication scenario', () => {
  const user = {
    schedule_hash_today: null,
    schedule_hash_tomorrow: null
  };
  
  const decision = scheduleService.determinePublicationScenario(
    user,
    'hash1',
    null,
    '2024-01-01',
    '2024-01-02'
  );
  
  assert(decision.shouldPublish);
  assert.strictEqual(decision.scenario, 'today_first');
});

test('ScheduleService handles no changes', () => {
  const user = {
    schedule_hash_today: 'hash1',
    schedule_hash_tomorrow: 'hash2'
  };
  
  const decision = scheduleService.determinePublicationScenario(
    user,
    'hash1',
    'hash2',
    '2024-01-01',
    '2024-01-02'
  );
  
  assert(!decision.shouldPublish);
});

// Test NotificationService
console.log('\nTesting NotificationService...');
const { NotificationService, notificationService } = require('./src/services/NotificationService');

test('NotificationService creates instance', () => {
  assert(notificationService instanceof NotificationService);
});

test('NotificationService has methods', () => {
  assert(typeof notificationService.sendToUser === 'function');
  assert(typeof notificationService.sendToChannel === 'function');
  assert(typeof notificationService.sendScheduleNotification === 'function');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log('Test Results:');
console.log(`✓ Passed: ${testsPassed}`);
console.log(`✗ Failed: ${testsFailed}`);
console.log(`Total: ${testsPassed + testsFailed}`);
console.log('='.repeat(50));

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('\n✨ All tests passed!');
  process.exit(0);
}
