# Stable Schedule Publication Logic - Implementation Summary

## Overview

This implementation addresses the requirements for a **stable, predictable, and non-spam** logic for publishing power outage schedules in the eSvitlo Telegram bot.

## Key Principles

### 1. Notify Only on Real Changes (CRITICAL)
The bot only notifies users when:
- A schedule appears for the first time (hash is null)
- A schedule actually changes (hash differs from stored)
- **NEVER** publishes when hashes match (prevents spam)

### 2. Separate State Tracking
For each user/channel, the system tracks:
- `schedule_hash_today` - Hash of today's schedule
- `schedule_hash_tomorrow` - Hash of tomorrow's schedule  
- `last_published_date_today` - Date when today's schedule was published
- `last_published_date_tomorrow` - Date when tomorrow's schedule was published

## Implementation Details

### Hash Calculation
**Function:** `calculateSchedulePeriodsHash(events)`
- **Input:** Array of schedule events
- **Hashes only:** Start and end times (ISO format)
- **Excludes:** Parse dates, metadata, service fields
- **Algorithm:** SHA-256 (cryptographically strong)
- **Sorting:** Events sorted by start time for consistency
- **Output:** 64-character hex string or null if no events

**Example:**
```javascript
const events = [
  { start: new Date('2024-02-05T10:00:00Z'), end: new Date('2024-02-05T12:00:00Z') },
  { start: new Date('2024-02-05T14:00:00Z'), end: new Date('2024-02-05T16:00:00Z') }
];
const hash = calculateSchedulePeriodsHash(events);
// Result: "5a1d5479b6bf84dd..." (consistent for identical events)
```

### Day Transition Logic (Midnight 00:00)
**Function:** `handleDayTransition(user)`

When the calendar day changes:
1. Check if `last_published_date_today` is not today's date
2. If true, shift data:
   - `schedule_hash_tomorrow` → `schedule_hash_today`
   - `last_published_date_tomorrow` → `last_published_date_today`
   - Clear tomorrow fields (set to null)
3. **Result:** Schedule published yesterday as "tomorrow" is NOT re-published as "today"

### Publication Scenarios

#### Scenario 1: First Publication of Today's Schedule
**Condition:** `schedule_hash_today === null`

**Message:**
```
📊 Графік відключень на сьогодні, 05.02.2024 (Понеділок), для черги 1.1:

🪫 10:00 - 12:00 (~2 год)
🪫 14:00 - 16:00 (~2 год)

Загалом без світла: ~4 год
```

#### Scenario 2: Today's Schedule Updated
**Condition:** `schedule_hash_today` changed, `schedule_hash_tomorrow` unchanged/missing

**Message:**
```
💡 Оновлено графік відключень на сьогодні, 05.02.2024 (Понеділок), для черги 1.1:

🪫 10:00 - 13:00 (~3 год)
🪫 14:00 - 16:00 (~2 год)

Загалом без світла: ~5 год
```

#### Scenario 3: Tomorrow's Schedule Appeared (First Time)
**Condition:** `schedule_hash_tomorrow === null` AND new tomorrow data exists, today unchanged

**Message:**
```
💡 Зʼявився графік відключень на завтра, 06.02.2024 (Вівторок), для черги 1.1:

🪫 09:00 - 11:00 (~2 год)

Загалом без світла: ~2 год

─────────────────

💡 Графік на сьогодні — без змін
```

#### Scenario 4: Tomorrow's Schedule Updated, Today Unchanged
**Condition:** `schedule_hash_tomorrow` changed, `schedule_hash_today` unchanged

**Message:**
```
💡 Оновлено графік відключень на завтра, 06.02.2024 (Вівторок), для черги 1.1:

🪫 09:00 - 12:00 (~3 год)

Загалом без світла: ~3 год

─────────────────

💡 Графік на сьогодні — без змін
```

#### Scenario 5: Both Schedules Changed
**Condition:** Both `schedule_hash_today` and `schedule_hash_tomorrow` changed

**Message:**
```
💡 Оновлено графік відключень на завтра, 06.02.2024 (Вівторок), для черги 1.1:

🪫 09:00 - 12:00 (~3 год)

Загалом без світла: ~3 год

─────────────────

💡 Оновлено графік відключень на сьогодні, 05.02.2024 (Понеділок), для черги 1.1:

🪫 10:00 - 13:00 (~3 год)

Загалом без світла: ~3 год
```

## Spam Prevention Mechanisms

### 1. Hash-Based Deduplication
- Only publish if hash is null (new) or changed
- Identical schedules = identical hashes = no publication

### 2. Day Transition Protection
- Tomorrow's schedule automatically becomes today's
- No re-publication on calendar day change

### 3. Double-Check Guard
```javascript
if (todayUnchanged && (tomorrowUnchanged || !tomorrowHash)) {
  return { shouldPublish: false, reason: 'Графіки не змінилися' };
}
```

## Database Schema

### New Columns in `users` Table
```sql
schedule_hash_today TEXT         -- Hash of today's schedule
schedule_hash_tomorrow TEXT      -- Hash of tomorrow's schedule  
last_published_date_today TEXT   -- Date (YYYY-MM-DD) of today's last publication
last_published_date_tomorrow TEXT -- Date (YYYY-MM-DD) of tomorrow's last publication
```

### New Database Functions
- `updateUserScheduleHashes(userId, hashToday, hashTomorrow, dateToday, dateTomorrow)`
- `shiftScheduleToToday(userId)` - Handles day transitions

## Testing

### Test Coverage
✅ Hash calculation for identical events
✅ Hash calculation for different events
✅ Hash for empty events
✅ Hash order independence
✅ Scenario determination logic
✅ Date string formatting
✅ SHA-256 usage verification
✅ Hash stability over time

### Test Results
```
📊 Підсумок тестування:
- Хешування періодів: ✅
- Порівняння графіків: ✅
- Визначення сценаріїв: ✅
- Безпека (SHA-256): ✅
- Стабільність хешів: ✅
```

## Security

### CodeQL Analysis
- **Alerts Found:** 0
- **Status:** ✅ All security checks passed

### Hash Algorithm
- **Algorithm:** SHA-256 (cryptographically strong)
- **Reason:** Better than MD5 for data integrity
- **Length:** 64 hex characters (256 bits)

## Benefits

### For Users
✅ No spam - only real changes trigger notifications
✅ Clear messages - always know what changed
✅ No confusion - consistent date formats and wording
✅ Predictable - same behavior every time

### For System
✅ Efficient - hash comparison is fast
✅ Reliable - SHA-256 ensures accuracy
✅ Maintainable - clear logic and separation
✅ Testable - comprehensive test coverage

## Code Quality

### Code Review
- All review comments addressed
- Best practices followed
- Security considerations met

### Maintainability
- Clear function names and comments
- Separated concerns (hash, comparison, formatting)
- Well-documented scenarios
- Comprehensive tests

## Conclusion

This implementation successfully achieves:
1. ✅ Correct data handling
2. ✅ No duplicates
3. ✅ Clear UX for users
4. ✅ Minimal message count
5. ✅ All requirements from problem statement

The bot now provides a **stable, predictable, and non-spam** experience for monitoring power outage schedules.
