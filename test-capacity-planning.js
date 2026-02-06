#!/usr/bin/env node

/**
 * Test for Capacity Planning System
 * Tests capacity limits, tracking, and alerts
 */

const assert = require('assert');

console.log('🧪 Запуск тестів системи контролю навантаження...\n');

// Test 1: Capacity Limits Configuration
console.log('Test 1: Перевірка конфігурації лімітів');
const { capacityLimits, getLimit, getCapacityPercentage, getAlertLevel, isCapacityExceeded, shouldThrottle } = require('./src/config/capacityLimits');

// Check that limits are loaded
assert(capacityLimits.users, 'Users limits must exist');
assert(capacityLimits.channels, 'Channels limits must exist');
assert(capacityLimits.ip, 'IP limits must exist');
assert(capacityLimits.schedulers, 'Scheduler limits must exist');
assert(capacityLimits.messages, 'Message limits must exist');

// Check specific limits
assert(capacityLimits.users.maxTotal > 0, 'Max total users must be positive');
assert(capacityLimits.channels.maxTotal > 0, 'Max total channels must be positive');
assert(capacityLimits.ip.maxTotal > 0, 'Max total IPs must be positive');

// Check alert thresholds
assert(capacityLimits.alerts.warningThreshold === 0.8, 'Warning threshold should be 80%');
assert(capacityLimits.alerts.criticalThreshold === 0.9, 'Critical threshold should be 90%');
assert(capacityLimits.alerts.emergencyThreshold === 1.0, 'Emergency threshold should be 100%');

console.log('✓ Конфігурація лімітів коректна\n');

// Test 2: getLimit function
console.log('Test 2: Перевірка функції getLimit');
const maxUsers = getLimit('users', 'maxTotal');
assert(typeof maxUsers === 'number', 'getLimit should return a number');
assert(maxUsers > 0, 'Max users should be positive');

try {
  getLimit('invalid', 'maxTotal');
  assert(false, 'Should throw error for invalid category');
} catch (error) {
  assert(error.message.includes('Unknown capacity category'), 'Should throw correct error');
}

console.log('✓ Функція getLimit працює коректно\n');

// Test 3: Capacity Percentage Calculation
console.log('Test 3: Перевірка розрахунку відсотків використання');
assert(getCapacityPercentage(50, 100) === 0.5, 'Should calculate 50%');
assert(getCapacityPercentage(80, 100) === 0.8, 'Should calculate 80%');
assert(getCapacityPercentage(100, 100) === 1.0, 'Should calculate 100%');
assert(getCapacityPercentage(0, 100) === 0, 'Should calculate 0%');
assert(getCapacityPercentage(0, 0) === 0, 'Should handle division by zero');
console.log('✓ Розрахунок відсотків коректний\n');

// Test 4: Alert Levels
console.log('Test 4: Перевірка рівнів алертів');
assert(getAlertLevel(0.5) === null, '50% should not trigger alert');
assert(getAlertLevel(0.79) === null, '79% should not trigger alert');
assert(getAlertLevel(0.8) === 'warning', '80% should trigger warning');
assert(getAlertLevel(0.85) === 'warning', '85% should trigger warning');
assert(getAlertLevel(0.9) === 'critical', '90% should trigger critical');
assert(getAlertLevel(0.95) === 'critical', '95% should trigger critical');
assert(getAlertLevel(1.0) === 'emergency', '100% should trigger emergency');
assert(getAlertLevel(1.1) === 'emergency', '110% should trigger emergency');
console.log('✓ Рівні алертів коректні\n');

// Test 5: Capacity Exceeded Check
console.log('Test 5: Перевірка перевищення ліміту');
assert(!isCapacityExceeded(50, 100), '50/100 should not be exceeded');
assert(!isCapacityExceeded(99, 100), '99/100 should not be exceeded');
assert(isCapacityExceeded(100, 100), '100/100 should be exceeded');
assert(isCapacityExceeded(101, 100), '101/100 should be exceeded');
console.log('✓ Перевірка перевищення працює коректно\n');

// Test 6: Throttling Decision
console.log('Test 6: Перевірка рішення про throttling');
assert(!shouldThrottle(50, 100), 'Should not throttle at 50%');
assert(!shouldThrottle(80, 100), 'Should not throttle at 80%');
assert(!shouldThrottle(89, 100), 'Should not throttle at 89%');
assert(shouldThrottle(90, 100), 'Should throttle at 90%');
assert(shouldThrottle(95, 100), 'Should throttle at 95%');
assert(shouldThrottle(100, 100), 'Should throttle at 100%');
console.log('✓ Рішення про throttling коректне\n');

// Test 7: Capacity Tracker
console.log('Test 7: Перевірка Capacity Tracker');
const capacityTracker = require('./src/monitoring/capacityTracker');

// Test user tracking
capacityTracker.updateUserCounts(100, 10);
assert(capacityTracker.usage.users.total === 100, 'Should track total users');
assert(capacityTracker.usage.users.concurrent === 10, 'Should track concurrent users');

// Test wizard tracking
capacityTracker.trackWizardStart();
capacityTracker.trackWizardStart();
assert(capacityTracker.usage.users.wizardPerMinute === 2, 'Should track wizard starts');

// Test channel tracking
capacityTracker.updateChannelCount(50);
assert(capacityTracker.usage.channels.total === 50, 'Should track channel count');

capacityTracker.trackChannelPublish('channel1');
capacityTracker.trackChannelPublish('channel1');
assert(capacityTracker.usage.channels.publishPerMinute === 2, 'Should track channel publishes');

// Test IP tracking
capacityTracker.updateIPCount(25);
assert(capacityTracker.usage.ip.total === 25, 'Should track IP count');

capacityTracker.trackIPPing(true);
assert(capacityTracker.usage.ip.concurrentPings === 1, 'Should track concurrent pings');
capacityTracker.trackIPPing(false);
assert(capacityTracker.usage.ip.concurrentPings === 0, 'Should decrease concurrent pings');

// Test user action tracking
capacityTracker.trackUserAction('user1');
capacityTracker.trackUserAction('user1');
capacityTracker.trackUserAction('user1');
assert(capacityTracker.usage.users.actionsPerUser.get('user1') === 3, 'Should track user actions');

console.log('✓ Capacity Tracker працює коректно\n');

// Test 8: Capacity Status
console.log('Test 8: Перевірка статусу використання');
capacityTracker.updateUserCounts(8000, 400); // 80% of 10000, 80% of 500
const userStatus = capacityTracker.getCapacityStatus('users', 'total');

assert(userStatus.current === 8000, 'Should report current usage');
assert(userStatus.max === capacityLimits.users.maxTotal, 'Should report max limit');
assert(userStatus.percentage === 0.8, 'Should calculate percentage');
assert(userStatus.alertLevel === 'warning', 'Should detect warning level');
assert(!userStatus.exceeded, 'Should not be exceeded at 80%');

// Test critical level
capacityTracker.updateUserCounts(9500, 400); // 95% of 10000
const criticalStatus = capacityTracker.getCapacityStatus('users', 'total');
assert(criticalStatus.alertLevel === 'critical', 'Should detect critical level at 95%');

console.log('✓ Статус використання коректний\n');

// Test 9: User Action Limits
console.log('Test 9: Перевірка лімітів дій користувача');
capacityTracker.resetMinuteCounters();

// Simulate user actions up to limit
const maxActions = capacityLimits.users.maxActionsPerUserPerMinute;
for (let i = 0; i < maxActions; i++) {
  capacityTracker.trackUserAction('testUser');
}

let canAct = capacityTracker.canUserAct('testUser');
assert(!canAct.allowed, 'Should not allow action after reaching limit');
assert(canAct.reason === 'rate_limit_exceeded', 'Should provide reason');
assert(canAct.message, 'Should provide user message');

// New user should still be able to act
let newUserCanAct = capacityTracker.canUserAct('newUser');
assert(newUserCanAct.allowed, 'New user should be able to act');

console.log('✓ Ліміти дій користувача працюють\n');

// Test 10: Emergency Mode
console.log('Test 10: Перевірка аварійного режиму');
assert(!capacityTracker.isEmergencyMode(), 'Should not be in emergency mode initially');

capacityTracker.enableEmergencyMode();
assert(capacityTracker.isEmergencyMode(), 'Should be in emergency mode after enable');

capacityTracker.disableEmergencyMode();
assert(!capacityTracker.isEmergencyMode(), 'Should not be in emergency mode after disable');

console.log('✓ Аварійний режим працює коректно\n');

// Test 11: All Capacity Statuses
console.log('Test 11: Перевірка всіх статусів');
const allStatuses = capacityTracker.getAllCapacityStatuses();

assert(allStatuses.users, 'Should have users statuses');
assert(allStatuses.channels, 'Should have channels statuses');
assert(allStatuses.ip, 'Should have IP statuses');
assert(allStatuses.schedulers, 'Should have scheduler statuses');
assert(allStatuses.messages, 'Should have message statuses');

assert(allStatuses.users.total, 'Should have users total status');
assert(allStatuses.users.concurrent, 'Should have users concurrent status');
assert(allStatuses.channels.total, 'Should have channels total status');

console.log('✓ Всі статуси доступні\n');

// Test 12: Usage Summary
console.log('Test 12: Перевірка підсумку використання');
const summary = capacityTracker.getUsageSummary();

assert(typeof summary.users.total === 'number', 'Summary should include user totals');
assert(typeof summary.channels.total === 'number', 'Summary should include channel totals');
assert(typeof summary.ip.total === 'number', 'Summary should include IP totals');
assert(typeof summary.emergencyMode === 'boolean', 'Summary should include emergency mode flag');

console.log('✓ Підсумок використання коректний\n');

// Cleanup
capacityTracker.stop();

console.log('✅ Всі тести пройдені успішно!');
console.log('\n📊 Система контролю навантаження працює коректно');
console.log(`   - Ліміти визначені та валідні`);
console.log(`   - Трекінг використання працює`);
console.log(`   - Алерти налаштовані (80%, 90%, 100%)`);
console.log(`   - Захист від перевантаження активний`);
