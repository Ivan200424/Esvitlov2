# Critical Database Save Bugs - Fix Summary

## Overview
Fixed 5 critical bugs that were causing database save failures, TypeError crashes, and incorrect data storage.

## Bugs Fixed

### 🔴 BUG #1: ScheduleService.js imports non-existent functions
**File:** `src/services/ScheduleService.js`

**Problem:**
- Imported `getScheduleHistory` and `addScheduleHistory` which don't exist
- These functions were undefined, causing TypeError crashes

**Fix:**
- Updated imports to use actual exported functions: `getLastSchedule` and `addScheduleToHistory`
- Fixed `getScheduleHistory()` method to call `getLastSchedule(userId)`
- Fixed `recordScheduleChange()` to use correct parameter order: `(userId, region, queue, data, hash)` instead of `(userId, region, queue, hash, data)`

**Impact:**
- ✅ No more TypeError crashes when recording schedule changes
- ✅ Schedule history now saves correctly

---

### 🔴 BUG #2: publisher.js missing await on async database functions
**File:** `src/publisher.js`

**Problem:**
- `updateSnapshotHashes()` was missing `await` → snapshot hashes didn't save before next check, causing duplicate publications
- `addScheduleToHistory()` was missing `await` → schedule history silently failed to save
- `getPreviousSchedule()` was missing `await` → returned Promise object instead of data, breaking schedule comparison

**Fix:**
- Added `await` to all three calls:
  - `await updateSnapshotHashes(...)`
  - `await addScheduleToHistory(...)`
  - `const previousSchedule = await getPreviousSchedule(...)`

**Impact:**
- ✅ Snapshot hashes save correctly, preventing duplicate publications
- ✅ Schedule history saves reliably
- ✅ Schedule comparison works correctly (no longer comparing Promise objects)

---

### 🟡 BUG #3: Type mismatch in database schema
**File:** `src/database/db.js`

**Problem:**
- `user_power_states.telegram_id` was `INTEGER` but `users.telegram_id` is `TEXT`
- Type inconsistency could cause JOIN issues and data integrity problems

**Fix:**
- Changed `user_power_states.telegram_id` from `INTEGER` to `TEXT`

**Impact:**
- ✅ Database type consistency
- ✅ Proper JOINs between tables
- ✅ No data type conversion issues

---

### 🟡 BUG #4: Deprecated SQLite test file
**File:** `test-state-persistence.js`

**Problem:**
- Test file used SQLite syntax (`db.prepare`, `sqlite_master`)
- Project migrated to PostgreSQL, so test always failed
- Already covered by `test-database-save-bugs.js`

**Fix:**
- Deleted `test-state-persistence.js`

**Impact:**
- ✅ Removed failing test
- ✅ Cleaner test suite

---

### 🟡 BUG #5: powerMonitor.js uses wrong ID for Map keys
**File:** `src/powerMonitor.js`

**Problem:**
- Map key used `user.id` (internal database ID)
- But `saveUserStateToDb` writes to `telegram_id` column
- Semantically wrong: column is `telegram_id` but stored internal DB ID

**Fix:**
- Changed Map key to use `user.telegram_id` instead of `user.id` at line 292
- Verified `saveUserStateToDb` correctly receives telegram_id
- Preserved `addOutageRecord(user.id, ...)` which correctly uses database ID for foreign key

**Impact:**
- ✅ Power states correctly keyed by telegram_id
- ✅ Correct data stored in `user_power_states` table
- ✅ Foreign key references still work correctly

---

## Testing

Created comprehensive test file `test-critical-database-bugs-fix.js` that validates:
1. ✅ ScheduleService.js imports correct functions
2. ✅ publisher.js awaits all async database functions
3. ✅ user_power_states.telegram_id is TEXT type
4. ✅ test-state-persistence.js is deleted
5. ✅ powerMonitor.js uses telegram_id for Map keys

All tests pass successfully.

## Code Review

✅ Code review completed
✅ Addressed all feedback
✅ Test assertions improved

## Security Scan

✅ CodeQL analysis: **0 security alerts**

## Files Changed

1. `src/services/ScheduleService.js` - Fixed imports and method calls
2. `src/publisher.js` - Added missing await statements
3. `src/database/db.js` - Fixed telegram_id type
4. `src/powerMonitor.js` - Fixed Map key to use telegram_id
5. `test-state-persistence.js` - Deleted (deprecated)
6. `test-critical-database-bugs-fix.js` - Added (new test)

## Expected Results

✅ No TypeError crashes from undefined imports
✅ Schedule history and snapshots save correctly
✅ Schedule comparison works (no longer returns Promise object)
✅ Database type consistency prevents JOIN issues
✅ Power states correctly keyed by telegram_id
✅ All data saves to database reliably
✅ No duplicate publications
