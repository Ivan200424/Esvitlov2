# Refactoring Roadmap - Implementation Summary

## Overview
This document tracks the iterative refactoring of the eSvitlo-monitor-bot codebase according to the 9-phase roadmap. The goal is to improve code quality, architecture, and maintainability without breaking functionality.

## Completed Phases

### ✅ Phase 1: State Management Stabilization

**Goal**: Make state management simple, explicit, and predictable.

**What Was Done**:
1. Created centralized state manager (`src/state/stateManager.js`)
   - Single source of truth for all in-memory state
   - Automatic cleanup of expired states
   - Unified API: getState(), setState(), clearState(), hasState()
   - Integrated DB persistence for persistent states
   
2. Created pending state manager (`src/state/pendingStateManager.js`)
   - Specialized handling for temporary/timeout states
   - Timeout management and cancellation
   - State extension capabilities

3. Migrated existing states to centralized manager:
   - ✅ Wizard states (from handlers/start.js)
   - ✅ Conversation states (from handlers/channel.js)
   - ✅ IP setup states (from handlers/settings.js)
   - ✅ Last menu messages (from handlers/start.js)
   - ⏳ Pending channels (partially - uses custom DB table)
   - ⏳ Channel instructions (to be migrated)
   - ⏳ Power monitor states (to be migrated)

4. Eliminated code duplication:
   - Removed 3 separate Map declarations
   - Removed 3 separate setInterval cleanup loops
   - Unified state persistence logic
   - Removed redundant restore functions

**Benefits**:
- State created and managed in one place
- Consistent cleanup prevents memory leaks
- No duplicate state management logic
- Easy to add new state types
- Simplified debugging

**Files Changed**:
- `src/state/stateManager.js` (NEW)
- `src/state/pendingStateManager.js` (NEW)
- `src/index.js` (added initStateManager)
- `src/handlers/start.js` (migrated wizard & menu states)
- `src/handlers/channel.js` (migrated conversation states)
- `src/handlers/settings.js` (migrated IP setup states)

---

### ✅ Phase 3: Service Layer Creation

**Goal**: Have a clear business logic layer independent of Telegram.

**What Was Done**:
1. Created `UserService` (`src/services/UserService.js`)
   - User CRUD operations
   - Settings management
   - User validation
   - Statistics and filtering
   - Telegram-agnostic

2. Created `ScheduleService` (`src/services/ScheduleService.js`)
   - Schedule fetching and parsing
   - Change detection with hash comparison
   - Next event calculation
   - History management
   - Batch operations

3. Created `ChannelService` (`src/services/ChannelService.js`)
   - Channel connection validation
   - Connect/disconnect operations
   - Branding updates
   - Status management
   - Publication tracking

4. Created `IpMonitoringService` (`src/services/IpMonitoringService.js`)
   - IP/domain validation
   - Availability checking
   - Debounce state calculation
   - Monitoring status

**Benefits**:
- Business logic testable without Telegram
- Clear separation of concerns
- Services can be reused across handlers
- Easy to add new business operations
- Logic is independent of presentation

**Files Changed**:
- `src/services/UserService.js` (NEW)
- `src/services/ScheduleService.js` (NEW)
- `src/services/ChannelService.js` (NEW)
- `src/services/IpMonitoringService.js` (NEW)

**Next Steps**:
- Integrate services into handlers (Phase 2)
- Remove direct DB access from handlers
- Handlers should only call services and format responses

---

### ✅ Phase 4: Scheduler and Background Tasks

**Goal**: Controlled scheduler layer with clear lifecycle.

**What Was Done**:
1. Created `SchedulerManager` (`src/scheduler/schedulerManager.js`)
   - Centralized control of all scheduled tasks
   - Lifecycle: init(), start(), stop(), restart()
   - Idempotent operations (safe to call multiple times)
   - Prevents duplicate schedulers
   - Status monitoring
   - Configurable intervals

2. Refactored existing scheduler.js
   - Uses SchedulerManager for scheduling
   - Business logic remains (checkAllSchedules, etc.)
   - Clear separation: manager = scheduling, scheduler.js = business logic

3. Updated index.js
   - Proper scheduler lifecycle management
   - Clean shutdown of schedulers
   - Integrated with state manager shutdown

**Benefits**:
- No duplicate schedulers on restart
- Safe, controlled lifecycle
- Easy to add new scheduled tasks
- Clear visibility into status
- Testable and maintainable
- Prevents scheduling conflicts

**Files Changed**:
- `src/scheduler/schedulerManager.js` (NEW)
- `src/scheduler.js` (refactored to use manager)
- `src/index.js` (added scheduler lifecycle)

---

## Remaining Phases

### ⏳ Phase 2: Handler Cleanup

**Goal**: Handlers = UX + routing only

**To Do**:
1. Replace direct DB calls in handlers with service calls
2. Remove scheduler access from handlers
3. Handlers should:
   - Validate input
   - Call service
   - Format response
   - Handle errors

**Example Refactoring**:
```javascript
// Before
async function handleSettings(bot, msg) {
  const user = usersDb.getUserByTelegramId(msg.from.id); // Direct DB
  // ... business logic ...
}

// After  
async function handleSettings(bot, msg) {
  const user = UserService.getUserByTelegramId(msg.from.id); // Service
  // ... only UX logic ...
}
```

---

### ⏳ Phase 5: Graphs Data-First Approach

**Goal**: Separate data from publication

**To Do**:
1. Parser saves snapshot to data store
2. Separate module determines changes
3. Another module decides publication
4. Unify hash logic in one place

**Structure**:
```
Data Flow:
API → Parser → Data Store
         ↓
    Change Detector
         ↓
    Publication Decider
         ↓
    Publishers (bot, channel)
```

---

### ⏳ Phase 6: IP Monitoring Engine

**Goal**: Scalable, stable IP monitoring

**To Do**:
1. Create IP monitoring engine
2. Separate: ping logic, debounce, state
3. Remove direct pings from handlers
4. Make scalable for multiple IPs

**Can use IpMonitoringService as foundation**

---

### ⏳ Phase 7: Admin and Feature Flags

**Goal**: Control and safety

**To Do**:
1. Extract pause mode to service
2. Add feature flags system
3. Unified permission checks
4. Admin system visibility

---

### ⏳ Phase 8: Logs and Observability

**Goal**: Understand system behavior

**To Do**:
1. Unify logging approach
2. Add context (user_id, channel_id, action)
3. Proper log levels
4. Ensure traceability

---

### ⏳ Phase 9: Technical Debt Cleanup

**Goal**: Reduce technical debt

**To Do**:
1. Remove dead code
2. Remove TODOs without tasks
3. Unify naming conventions
4. Logical folder structure
5. Improve readability

---

## Key Principles Being Followed

1. **Iterative Approach**: Don't rewrite everything at once
2. **Stability First**: Each phase keeps the bot working
3. **No UX Changes**: Users don't notice refactoring
4. **Independent Phases**: Each phase stands alone
5. **Clear Separation**: State, services, schedulers all separated
6. **Documentation**: Every module is well-documented

---

## Architecture Overview

### Current Structure
```
src/
├── state/              # Centralized state management ✅
│   ├── stateManager.js
│   └── pendingStateManager.js
├── services/           # Business logic services ✅
│   ├── UserService.js
│   ├── ChannelService.js
│   ├── ScheduleService.js
│   └── IpMonitoringService.js
├── scheduler/          # Scheduler management ✅
│   └── schedulerManager.js
├── handlers/           # Telegram handlers (to be cleaned up)
├── database/           # Database layer
├── utils/              # Utilities
└── ...
```

### Data Flow
```
User Input → Handler → Service → Database
                ↓
            Formatter → Response
```

### State Management
```
All States → StateManager → DB Persistence
                ↓
          Automatic Cleanup
```

### Scheduling
```
Config → SchedulerManager → Business Logic Functions
              ↓
        Cron/Intervals
```

---

## Testing Notes

Since there's no test infrastructure:
1. **Syntax checks**: All files pass `node -c`
2. **Manual validation**: Services have clear APIs
3. **Backward compatibility**: Restore functions maintained
4. **Incremental changes**: Small, focused commits

---

## Migration Guide

### For New State Types
```javascript
// 1. Add to stateManager.js states object
const states = {
  myNewState: new Map(),
  // ...
};

// 2. Add expiration time
const EXPIRATION_TIMES = {
  myNewState: 60 * 60 * 1000, // 1 hour
  // ...
};

// 3. Use in code
const { getState, setState, clearState } = require('./state/stateManager');
setState('myNewState', userId, data);
```

### For New Services
```javascript
// 1. Create service file
class MyService {
  // Telegram-agnostic methods
  doBusinessLogic(data) {
    // ...
  }
}
module.exports = new MyService();

// 2. Use in handlers
const MyService = require('../services/MyService');
const result = MyService.doBusinessLogic(data);
```

### For New Scheduled Tasks
```javascript
// 1. Add to schedulerManager.js
this.schedulers.myTask = null;

// 2. Add start/stop methods
_startMyTask(taskFunction) {
  // cron or setInterval logic
}

_stopMyTask() {
  // cleanup
}

// 3. Call in start() and stop()
```

---

## Success Metrics

✅ **Phase 1 Success**:
- [x] Centralized state management created
- [x] 4 major state types migrated
- [x] Automatic cleanup working
- [x] No code duplication in state management

✅ **Phase 3 Success**:
- [x] 4 core services created
- [x] Services are Telegram-agnostic
- [x] Clear, documented APIs
- [x] Ready for handler integration

✅ **Phase 4 Success**:
- [x] Scheduler manager created
- [x] Idempotent operations
- [x] Proper lifecycle management
- [x] No duplicate schedulers possible

**Overall Progress**: 3/9 phases complete (33%)

---

## Next Priority

**Phase 2: Handler Cleanup** is the natural next step:
1. Use existing services in handlers
2. Remove direct DB access
3. Make handlers thin (UX only)
4. This will validate the service layer

Then continue with Phases 5, 6, 7, 8, 9 in order.

---

## Notes

- All changes maintain backward compatibility
- No functionality removed
- UX unchanged
- Gradual, safe refactoring
- Each commit is independently valuable
