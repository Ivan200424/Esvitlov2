# Architecture Documentation

## Overview

The eSvitlo-monitor-bot has been refactored to support horizontal scaling and maintain stability at scale. This document describes the architectural patterns and components.

## Core Principles

### 1. State Management
All critical state is **persisted to database** (SQLite), not just in-memory. This ensures:
- State survives restarts
- State is recoverable after crashes
- State can be shared across multiple instances (with coordination)

### 2. Separation of Concerns
The architecture is layered:

```
┌─────────────────────────────────────┐
│         Telegram Handlers           │  ← Only routing and UX
├─────────────────────────────────────┤
│       Business Services Layer       │  ← Business logic
│  ┌────────────┬────────────────┐   │
│  │ Schedule   │ Notification   │   │
│  │ Service    │ Service        │   │
│  └────────────┴────────────────┘   │
├─────────────────────────────────────┤
│          Core Components            │  ← Infrastructure
│  ┌────────────┬────────────────┐   │
│  │ Scheduler  │ Event Emitter  │   │
│  │ Manager    │ State Manager  │   │
│  │ Logger     │                │   │
│  └────────────┴────────────────┘   │
├─────────────────────────────────────┤
│          Data Layer                 │  ← Persistence
│         (Database)                  │
└─────────────────────────────────────┘
```

### 3. Event-Driven Architecture
Components communicate through events, reducing coupling:

```javascript
// Emit events
eventBus.emit(Events.SCHEDULE_CHANGED, { userId, region });

// Listen to events
eventBus.on(Events.SCHEDULE_CHANGED, async (data) => {
  // Handle event
});
```

Standard events:
- `SCHEDULE_CHANGED` - Schedule was updated
- `SCHEDULE_PUBLISHED` - Schedule was published
- `POWER_ON` / `POWER_OFF` - Power state changed
- `CHANNEL_BLOCKED` - Channel access lost
- `SCHEDULER_STARTED` / `SCHEDULER_STOPPED` - Scheduler lifecycle

### 4. Structured Logging
All components use structured logging:

```javascript
const { logger } = require('./core/Logger');
const log = logger.child({ component: 'MyComponent' });

log.info('User registered', { 
  userId: 12345, 
  region: 'kyiv' 
});

log.error('Failed to send message', error, { 
  userId: 12345, 
  channelId: '@mychannel' 
});
```

Log levels: `error`, `warn`, `info`, `debug`

## Core Components

### EventEmitter (`src/core/EventEmitter.js`)

Provides pub-sub pattern for event-driven communication.

**Key features:**
- Subscribe/unsubscribe to events
- One-time subscriptions
- Event history for debugging
- Async and sync emission

**Usage:**
```javascript
const { eventBus, Events } = require('./core/EventEmitter');

// Subscribe
const unsubscribe = eventBus.on(Events.SCHEDULE_CHANGED, async (data) => {
  console.log('Schedule changed:', data);
});

// Emit
await eventBus.emit(Events.SCHEDULE_CHANGED, { userId: 123 });

// Unsubscribe
unsubscribe();
```

### Logger (`src/core/Logger.js`)

Structured logging with context.

**Key features:**
- Multiple log levels
- Context propagation
- JSON output in production
- Child loggers with additional context

**Usage:**
```javascript
const { logger } = require('./core/Logger');

// Create child logger with context
const log = logger.child({ service: 'ScheduleService' });

// Log with metadata
log.info('Processing schedule', { region: 'kyiv', queue: '1.1' });
log.error('Failed to fetch data', error, { region: 'kyiv' });
```

### StateManager (`src/core/StateManager.js`)

Centralized state management with persistence.

**Key features:**
- Namespaced state storage
- TTL support
- Automatic persistence to database
- State restoration on startup
- Automatic cleanup of expired states

**Usage:**
```javascript
const { stateManager } = require('./core/StateManager');

// Set state
stateManager.set('wizard', userId, { step: 1, region: 'kyiv' });

// Get state
const state = stateManager.get('wizard', userId);

// Delete state
stateManager.delete('wizard', userId);

// Get all states in namespace
const allWizards = stateManager.getAll('wizard');
```

### SchedulerManager (`src/core/SchedulerManager.js`)

Unified scheduler lifecycle management.

**Key features:**
- Explicit lifecycle (init, start, stop)
- Idempotent task execution (prevents concurrent runs)
- Interval change handling
- Per-scheduler statistics
- Instance ID for distributed coordination

**Usage:**
```javascript
const { schedulerManager } = require('./core/SchedulerManager');

// Initialize
schedulerManager.init();

// Register a scheduler
schedulerManager.register('my_task', async () => {
  // Task logic
}, {
  interval: 60, // seconds
  runImmediately: false,
  idempotent: true
});

// Start scheduler
schedulerManager.start('my_task');

// Change interval (stops old, starts new)
schedulerManager.changeInterval('my_task', 120);

// Stop scheduler
schedulerManager.stop('my_task');

// Get status
const status = schedulerManager.getStatus('my_task');
```

## Business Services

### ScheduleService (`src/services/ScheduleService.js`)

Handles schedule business logic - parsing, change detection, message formatting.

**Key responsibilities:**
- Fetch and parse schedule data
- Detect schedule changes
- Determine publication scenarios
- Format notification messages
- Emit schedule events

**Usage:**
```javascript
const { scheduleService } = require('./services/ScheduleService');

// Check schedule for user
const publicationData = await scheduleService.checkUserSchedule(user);

if (publicationData) {
  // Use NotificationService to send
  await notificationService.sendScheduleNotification(bot, publicationData);
}
```

### NotificationService (`src/services/NotificationService.js`)

Handles all notification delivery with retry logic and error handling.

**Key responsibilities:**
- Send notifications to users and channels
- Retry logic with exponential backoff
- Handle channel access errors
- Isolate notification failures

**Usage:**
```javascript
const { notificationService } = require('./services/NotificationService');

// Send schedule notification
const result = await notificationService.sendScheduleNotification(
  bot, 
  publicationData
);

// Send to user only
await notificationService.sendToUser(bot, user, message);

// Send to channel only
await notificationService.sendToChannel(bot, user, message);
```

## Scalability Features

### 1. Stateless Design
All state is in the database, not in-memory. Multiple bot instances can run simultaneously (with coordination).

### 2. Fault Isolation
Errors in one region/channel don't affect others:
- Per-user error handling
- Per-region error handling
- Retry logic prevents cascading failures

### 3. Idempotent Scheduler
Scheduler prevents concurrent execution of the same task:
```javascript
schedulerManager.register('task', handler, { 
  idempotent: true  // Prevents overlapping executions
});
```

### 4. Graceful Degradation
- If image fetch fails, send text
- If channel send fails, user still gets notification
- Errors are logged but don't crash the bot

### 5. Observability
- Structured logs for aggregation
- Event history for debugging
- Scheduler statistics
- State statistics

## Migration from Old Architecture

### Old Pattern
```javascript
// Direct handler logic
bot.on('message', (msg) => {
  // Business logic mixed with handler
  const user = getUser(msg.from.id);
  const schedule = fetchSchedule(user.region);
  bot.sendMessage(msg.from.id, formatSchedule(schedule));
});
```

### New Pattern
```javascript
// Handler only routes
bot.on('message', (msg) => {
  handleMessage(bot, msg);
});

// Handler function
async function handleMessage(bot, msg) {
  const user = getUser(msg.from.id);
  
  // Use service for business logic
  const publicationData = await scheduleService.checkUserSchedule(user);
  
  if (publicationData) {
    // Use service for notification
    await notificationService.sendScheduleNotification(bot, publicationData);
  }
}
```

## Best Practices

### 1. Use Services for Business Logic
Don't put business logic in handlers. Handlers should only:
- Parse Telegram message
- Call appropriate service
- Handle UI updates

### 2. Use EventEmitter for Communication
Don't directly call other components. Emit events:
```javascript
// ❌ Bad
powerMonitor.onPowerChange((state) => {
  notificationService.send(...);
});

// ✅ Good
eventBus.emit(Events.POWER_STATE_CHANGED, { state });
// NotificationService listens to this event
```

### 3. Use Structured Logging
Always use the logger with context:
```javascript
// ❌ Bad
console.log('User registered');

// ✅ Good
log.info('User registered', { 
  userId: user.id, 
  region: user.region 
});
```

### 4. Handle Errors Gracefully
Isolate errors, don't let them propagate:
```javascript
// ✅ Good
for (const user of users) {
  try {
    await processUser(user);
  } catch (error) {
    log.error('Failed to process user', error, { userId: user.id });
    // Continue with next user
  }
}
```

### 5. Use SchedulerManager
Don't create raw cron jobs or setInterval:
```javascript
// ❌ Bad
setInterval(async () => {
  await checkSchedules();
}, 60000);

// ✅ Good
schedulerManager.register('schedule_check', checkSchedules, {
  interval: 60,
  idempotent: true
});
schedulerManager.start('schedule_check');
```

## Testing

The architecture supports testing at multiple levels:

### Unit Tests
Test individual components:
```javascript
const { scheduleService } = require('./services/ScheduleService');

test('detects schedule change', () => {
  const decision = scheduleService.determinePublicationScenario(
    user, todayHash, tomorrowHash, todayDate, tomorrowDate
  );
  
  expect(decision.shouldPublish).toBe(true);
  expect(decision.scenario).toBe('today_updated');
});
```

### Integration Tests
Test service interactions:
```javascript
test('schedule check publishes notification', async () => {
  const publicationData = await scheduleService.checkUserSchedule(user);
  const result = await notificationService.sendScheduleNotification(
    bot, 
    publicationData
  );
  
  expect(result.anySuccess).toBe(true);
});
```

### Event Tests
Test event flow:
```javascript
test('schedule change emits event', async () => {
  const events = [];
  eventBus.on(Events.SCHEDULE_CHANGED, (data) => {
    events.push(data);
  });
  
  await scheduleService.checkUserSchedule(user);
  
  expect(events).toHaveLength(1);
  expect(events[0].userId).toBe(user.telegram_id);
});
```

## Performance Considerations

### 1. Database Queries
- Use indexes on frequently queried columns
- Batch operations when possible
- Use transactions for multi-step updates

### 2. Memory Usage
- State cleanup runs hourly
- Event history limited to 100 entries
- Wizard states expire after 24 hours

### 3. Concurrency
- Scheduler is idempotent (prevents overlapping runs)
- Error isolation prevents cascade failures
- Retry logic has backoff to prevent thundering herd

## Future Enhancements

### 1. Horizontal Scaling
To run multiple instances:
- Add Redis for shared state
- Implement distributed locks for schedulers
- Add instance coordination

### 2. Circuit Breaker
Add circuit breaker for external APIs:
- Track failure rate
- Open circuit after threshold
- Auto-recovery with exponential backoff

### 3. Metrics
Add metrics collection:
- Scheduler execution time
- Notification success rate
- Event emission rate
- Error rate by component

### 4. Health Checks
Add HTTP health check endpoint:
- Database connectivity
- Scheduler status
- Last successful schedule check
- Error rate

## Troubleshooting

### Check Scheduler Status
```javascript
const status = schedulerManager.getAllStatus();
console.log(status);
```

### Check Event History
```javascript
const history = eventBus.getHistory(20);
console.log(history);
```

### Check State Statistics
```javascript
const stats = stateManager.getStats();
console.log(stats);
```

### Enable Debug Logging
```bash
export LOG_LEVEL=debug
node src/index.js
```

## Conclusion

This architecture provides:
- ✅ Separation of concerns
- ✅ Event-driven communication
- ✅ Structured logging
- ✅ Centralized state management
- ✅ Explicit scheduler lifecycle
- ✅ Fault tolerance
- ✅ Horizontal scaling readiness

The bot is now prepared for scaling without chaos.
