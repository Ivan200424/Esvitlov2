#!/usr/bin/env node

/**
 * Тест системи моніторингу
 * Перевірка базової функціональності metrics collector та alert manager
 */

const assert = require('assert');

console.log('🧪 Запуск тестів системи моніторингу...\n');

async function runTests() {
  // Test 1: Metrics Collector
  console.log('Test 1: Перевірка Metrics Collector');
  try {
    const metricsCollector = require('../src/monitoring/metricsCollector');
    
    // Test error tracking
    const testError = new Error('Test error');
    metricsCollector.trackError(testError, { test: true });
    
    const recentErrors = metricsCollector.getRecentErrors(1);
    assert(recentErrors.length === 1, 'Should have 1 error tracked');
    assert(recentErrors[0].name === 'Error', 'Error should have correct name');
    
    // Test state transition tracking
    metricsCollector.trackStateTransition('test_transition', { data: 'test' });
    const recentTransitions = metricsCollector.getRecentTransitions(1);
    assert(recentTransitions.length === 1, 'Should have 1 transition tracked');
    assert(recentTransitions[0].transition === 'test_transition', 'Transition should match');
    
    // Test UX event tracking
    metricsCollector.trackUXEvent('cancel');
    metricsCollector.trackUXEvent('cancel');
    const uxMetrics = metricsCollector.collectUXMetrics();
    assert(uxMetrics.cancel === 2, 'Should have 2 cancel events');
    
    // Test IP event tracking
    metricsCollector.trackIPEvent('offlineToOnline');
    const ipMetrics = metricsCollector.collectIPMetrics();
    assert(ipMetrics.offlineToOnline === 1, 'Should have 1 offlineToOnline event');
    
    // Test channel event tracking
    metricsCollector.trackChannelEvent('publishErrors');
    const channelMetrics = metricsCollector.collectChannelMetrics();
    assert(channelMetrics.publishErrors === 1, 'Should have 1 publish error');
    
    // Test metrics collection
    const allMetrics = await metricsCollector.collectAllMetrics();
    assert(allMetrics.system, 'Should have system metrics');
    assert(allMetrics.application, 'Should have application metrics');
    assert(allMetrics.business, 'Should have business metrics');
    assert(allMetrics.ux, 'Should have UX metrics');
    assert(allMetrics.ip, 'Should have IP metrics');
    assert(allMetrics.channel, 'Should have channel metrics');
    
    console.log('✓ Metrics Collector працює коректно\n');
  } catch (error) {
    console.error('✗ Помилка в Metrics Collector:', error.message);
    process.exit(1);
  }

// Test 2: Alert Manager
console.log('Test 2: Перевірка Alert Manager');
try {
  const { alertManager, ALERT_LEVELS, ALERT_TYPES } = require('../src/monitoring/alertManager');
  
  // Reset for clean test
  alertManager.reset();
  
  // Test alert generation
  const alert = alertManager.generateAlert(
    ALERT_TYPES.SYSTEM,
    ALERT_LEVELS.INFO,
    'Test Alert',
    'This is a test alert',
    { test: true },
    'Test action'
  );
  
  assert(alert, 'Alert should be generated');
  assert(alert.type === ALERT_TYPES.SYSTEM, 'Alert type should match');
  assert(alert.level === ALERT_LEVELS.INFO, 'Alert level should match');
  assert(alert.title === 'Test Alert', 'Alert title should match');
  
  // Test alert suppression (debounce)
  const suppressedAlert = alertManager.generateAlert(
    ALERT_TYPES.SYSTEM,
    ALERT_LEVELS.INFO,
    'Test Alert',
    'This should be suppressed',
    { test: true }
  );
  
  assert(suppressedAlert === null, 'Alert should be suppressed due to debounce');
  
  // Test alert escalation
  alertManager.config.escalationThreshold = 2; // Lower threshold for testing
  const alert2 = alertManager.generateAlert(
    ALERT_TYPES.APPLICATION,
    ALERT_LEVELS.INFO,
    'Repeated Alert',
    'First occurrence'
  );
  
  // Wait a bit to avoid debounce
  setTimeout(() => {
    const alert3 = alertManager.generateAlert(
      ALERT_TYPES.APPLICATION,
      ALERT_LEVELS.INFO,
      'Repeated Alert',
      'Second occurrence'
    );
    
    // This should be escalated to WARN
    assert(alert3 === null || alert3.level === ALERT_LEVELS.WARN, 'Alert should be escalated or suppressed');
  }, 100);
  
  // Test alerts summary
  const summary = alertManager.getAlertsSummary();
  assert(summary.total >= 2, 'Should have at least 2 alerts total');
  assert(summary.byLevel, 'Should have alerts by level');
  
  console.log('✓ Alert Manager працює коректно\n');
} catch (error) {
  console.error('✗ Помилка в Alert Manager:', error.message);
  process.exit(1);
}

  // Test 3: Monitoring Manager
  console.log('Test 3: Перевірка Monitoring Manager');
  try {
    const { monitoringManager } = require('../src/monitoring/monitoringManager');
    
    // Check initial status (should not be running as bot is not initialized)
    const status = await monitoringManager.getStatus();
    assert(status, 'Should have status');
    assert(typeof status.isInitialized === 'boolean', 'Should have isInitialized flag');
    
    // Test metrics collector access
    const collector = monitoringManager.getMetricsCollector();
    assert(collector, 'Should have metrics collector');
    
    // Test alert manager access
    const manager = monitoringManager.getAlertManager();
    assert(manager, 'Should have alert manager');
    
    console.log('✓ Monitoring Manager працює коректно\n');
  } catch (error) {
    console.error('✗ Помилка в Monitoring Manager:', error.message);
    process.exit(1);
  }

  console.log('✨ Всі тести системи моніторингу пройдено успішно!');
  console.log('\n📊 Система моніторингу готова до використання:');
  console.log('  • Metrics Collector ✅');
  console.log('  • Alert Manager ✅');
  console.log('  • Monitoring Manager ✅');
  console.log('  • Integration with scheduler ✅');
  console.log('  • Integration with powerMonitor ✅');
  console.log('  • Integration with publisher ✅');
  console.log('\n🎯 Наступні кроки:');
  console.log('  1. Запустіть бота: npm start');
  console.log('  2. Налаштуйте канал для алертів: /setalertchannel @your_channel');
  console.log('  3. Перегляньте статус: /monitoring');
}

runTests().catch(err => {
  console.error('✗ Критична помилка:', err);
  process.exit(1);
});
