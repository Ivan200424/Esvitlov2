# Implementation Summary - Power Monitoring Refactor

## Overview

This implementation completely refactors the power monitoring system to support multiple users monitoring their individual routers simultaneously, following the architecture from monitor-light-bot.

## ✅ Requirements Implementation

### 1. powerMonitor.js - Completely Rewritten ✅

**Implemented:**
- ✅ `startPowerMonitoring()` - Starts interval checking all users every 10 seconds
- ✅ `handlePowerStateChange()` - Sends notifications to user channels with state changes
- ✅ `getNextScheduledTime()` - Shows next scheduled power event from user's schedule
- ✅ Check interval: **10 seconds** (configurable)
- ✅ DEBOUNCE_COUNT: **5 checks** (50 seconds total)

**Message Format (as specified):**
```
🟢 12:45 Світло з'явилося
🕓 Його не було 2 год 15 хв
🗓 Наступне планове: 18:00 - 21:00
```
```
🔴 12:45 Світло зникло
🕓 Воно було 2 год 15 хв
🗓 Очікуємо за графіком о 15:00
```

### 2. statistics.js - Verified Working ✅

**Already implemented correctly:**
- ✅ `addOutageRecord(userId, startTime, endTime)` - Stores outage records
- ✅ `getWeeklyStats(userId)` - Gets weekly statistics per user
- ✅ `formatStatsMessage(stats)` - Formats stats for display
- ✅ Uses `outage_history` table

### 3. alerts.js - Completely Rewritten ✅

**Implemented:**
- ✅ `startAlertSystem()` - Starts cron job running every minute
- ✅ `checkAndSendAlertOff()` - Sends warning before power off
- ✅ `checkAndSendAlertOn()` - Sends warning before power on
- ✅ Checks ALL users with enabled alerts
- ✅ Sends alerts ONLY to user channels
- ✅ Uses DB fields: `notify_before_off`, `notify_before_on`, `alerts_off_enabled`, `alerts_on_enabled`
- ✅ Stores `last_alert_off_period` and `last_alert_on_period` to prevent duplicates

### 4. scheduler.js - Updated ✅

**Changes:**
- ✅ Removed lines 85-105 (private chat messages to users)
- ✅ Keeps ONLY channel publishing

### 5. formatter.js - Updated ✅

**Added functions:**
- ✅ `formatScheduleForChannel()` - New format matching monitor-light-bot
- ✅ `formatStatsForChannelPopup()` - Stats formatting for popup
- ✅ Power state messages implemented in powerMonitor.js

**Channel format example:**
```
💡 Оновлено графік відключень на сьогодні, 25.01.2026 (Неділя), для черги 3.1:

🔴 Відключення:
🪫 08:00 - 11:00 (~3 год)
🪫 18:00 - 21:00 (~3 год)

🟡 Можливі:
🪫 14:00 - 16:00 (~2 год)
```

### 6. db.js - Database Schema Updated ✅

**Added fields to `users` table:**
- ✅ `power_state` (TEXT: 'on'/'off'/NULL)
- ✅ `power_changed_at` (DATETIME)
- ✅ `last_alert_off_period` (TEXT)
- ✅ `last_alert_on_period` (TEXT)
- ✅ `alert_off_message_id` (INTEGER)
- ✅ `alert_on_message_id` (INTEGER)

### 7. users.js - New Functions Added ✅

**Implemented:**
- ✅ `updateUserPowerState(telegramId, state, changedAt)`
- ✅ `updateUserAlertPeriod(telegramId, type, period, messageId)`
- ✅ `getUsersWithRouterIp()` - Get all users with configured router_ip
- ✅ `getUsersWithAlertsEnabled()` - Get users with alerts enabled

### 8. config.js - Default Updated ✅

**Changed:**
- ✅ `POWER_CHECK_INTERVAL`: 30 → **10 seconds**

### 9. index.js - Integration ✅

**Added:**
- ✅ Import and call `startPowerMonitoring(bot)`
- ✅ Import and call `stopPowerMonitoring()` in graceful shutdown

### 10. bot.js - Callback Handlers Updated ✅

**Updated:**
- ✅ Timer callback - Shows popup with format:
  ```
  ⏰ До відключення: 2 години 10 хвилин
  🪫 18:00 - 21:00
  ```
  or
  ```
  ⏰ До появи світла: 1 година 25 хвилин
  🔋 08:00 - 11:00
  ```

- ✅ Statistics callback - Shows popup with format:
  ```
  📊 Статистика за тиждень:
  
  ⚡ Відключень: 5
  🕓 Загальний час без світла: 12год 30хв
  📉 Середня тривалість: 2год 30хв
  🏆 Найдовше: 4год (23.01 08:00-12:00)
  🔋 Найкоротше: 1год (21.01 14:00-15:00)
  ```

## Architecture

### Multi-User Support

The system is designed for **multi-tenant** architecture:

1. **One monitoring loop** checks ALL users every 10 seconds
2. Each user has their own:
   - `router_ip` - Router to monitor
   - `channel_id` - Where to send notifications
   - `power_state` - Current power state
   - Alert settings and periods

3. **Debouncing per user** - Each user's state is tracked independently with 5-check debounce

### Data Flow

```
Every 10 seconds:
  └─> Get all users with router_ip
      └─> For each user:
          └─> Check router availability
              └─> Update state with debounce
                  └─> If state changed (after 5 checks):
                      ├─> Send notification to channel
                      ├─> Store outage record (if off→on)
                      └─> Update DB

Every minute:
  └─> Get all users with alerts enabled
      └─> For each user:
          └─> Get next scheduled event
              └─> Check if alert time matches
                  └─> Send alert to channel (if not duplicate)
```

## Migration for Existing Installations

Created `src/database/migrate.js` which:
- Adds 6 new fields to existing `users` table
- Can be run on existing databases without data loss
- See `MIGRATION_GUIDE.md` for instructions

## Testing

✅ All existing tests pass (7/7)
✅ Syntax validation successful  
✅ Database schema verified
✅ Code review completed

## Key Improvements

1. **Efficiency** - One monitoring loop for all users instead of per-user
2. **Reliability** - 5-check debounce prevents false positives from network hiccups
3. **Multi-tenant** - Each user has independent monitoring and alerts
4. **No spam** - Duplicate prevention using DB fields
5. **Rich notifications** - Includes next scheduled event and duration info
6. **Statistics tracking** - Automatic outage history recording
7. **Migration support** - Safe upgrade path for existing installations

## Configuration

Default settings (can be overridden via environment variables):

- `POWER_CHECK_INTERVAL=10` - Check interval in seconds
- Debounce: 5 checks × 10 seconds = 50 seconds
- Alert check: Every minute
- Default notify times: 15 minutes before event

## Files Created/Modified

### New Files
- `src/database/migrate.js` - Migration script
- `MIGRATION_GUIDE.md` - Migration documentation  
- `REFACTOR_SUMMARY.md` - This file

### Modified Files
- `src/powerMonitor.js` - Complete rewrite (280 lines)
- `src/alerts.js` - Complete rewrite (160 lines)
- `src/scheduler.js` - Removed private messages
- `src/formatter.js` - Added 2 functions
- `src/database/db.js` - Added 6 fields
- `src/database/users.js` - Added 4 functions
- `src/config.js` - Changed default interval
- `src/index.js` - Integrated power monitoring
- `src/bot.js` - Updated callback handler

## Ready for Deployment ✅

All requirements from the problem statement have been successfully implemented and tested.
