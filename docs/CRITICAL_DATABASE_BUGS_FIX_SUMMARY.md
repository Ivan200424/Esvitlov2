# Critical Database Save Bugs - Fix Summary

## Overview
Fixed 5 critical bugs in `src/database/users.js` that prevented data from being saved correctly to PostgreSQL.

## Bugs Fixed

### Bug 1: Missing `$` in SQL parameterized queries in `updateUserFormatSettings()`

**Problem:** All field assignments used `${values.length}` instead of `$${values.length}`, causing PostgreSQL to interpret values as literal numbers instead of parameterized placeholders.

**Before:**
```javascript
fields.push(`schedule_caption = ${values.length}`);  // Wrong!
WHERE telegram_id = ${values.length}  // Wrong!
```

**After:**
```javascript
fields.push(`schedule_caption = $${values.length}`);  // Correct!
WHERE telegram_id = $${values.length}  // Correct!
```

**Affected fields:** 
- schedule_caption
- period_format
- power_off_text
- power_on_text
- delete_old_message
- picture_only
- WHERE clause

---

### Bug 2: Missing `$` in SQL parameterized queries in `updateUserScheduleAlertSettings()`

**Problem:** Same issue as Bug 1.

**Before:**
```javascript
fields.push(`schedule_alert_enabled = ${values.length}`);  // Wrong!
WHERE telegram_id = ${values.length}  // Wrong!
```

**After:**
```javascript
fields.push(`schedule_alert_enabled = $${values.length}`);  // Correct!
WHERE telegram_id = $${values.length}  // Correct!
```

**Affected fields:**
- schedule_alert_enabled
- schedule_alert_minutes
- schedule_alert_target
- WHERE clause

---

### Bug 3: Using `1/0` instead of `true/false` for BOOLEAN in `updateUserScheduleAlertSettings()`

**Problem:** PostgreSQL BOOLEAN fields should use `true/false`, not `1/0`.

**Before:**
```javascript
values.push(settings.scheduleAlertEnabled ? 1 : 0);  // Wrong!
```

**After:**
```javascript
values.push(settings.scheduleAlertEnabled ? true : false);  // Correct!
```

---

### Bug 4: `updateUser()` function only supported 6 fields

**Problem:** The generic `updateUser()` function only handled 6 fields, but service layers called it with 18+ additional fields that were silently ignored.

**Before:**
Only supported:
- last_start_message_id
- last_settings_message_id
- last_schedule_message_id
- last_timer_message_id
- channel_id
- channel_title

**After:**
Now supports 24+ fields including all the above plus:
- is_active (UserService.deactivateUser/activateUser)
- channel_description (ChannelService.connectChannel)
- channel_photo_file_id (ChannelService.connectChannel)
- channel_user_title (ChannelService.updateChannelBranding)
- channel_user_description (ChannelService.updateChannelBranding)
- channel_status (ChannelService.markChannelBlocked/markChannelActive)
- last_published_hash (ChannelService.disconnectChannel)
- last_post_id (ChannelService.disconnectChannel)
- router_ip (UserService.updateUserSettings)
- notify_before_off (UserService.updateUserSettings)
- notify_before_on (UserService.updateUserSettings)
- alerts_off_enabled (UserService.updateUserSettings)
- alerts_on_enabled (UserService.updateUserSettings)
- last_menu_message_id
- last_hash
- channel_paused
- power_notify_target

---

### Bug 5: `UserService.saveUser()` called non-existent `usersDb.saveUser()`

**Problem:** UserService.saveUser() at line 64 called `usersDb.saveUser()`, but this function didn't exist in users.js.

**Solution:** Added new `saveUser()` function with upsert logic:

```javascript
async function saveUser(telegramId, username, region, queue) {
  try {
    const result = await pool.query(`
      INSERT INTO users (telegram_id, username, region, queue)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (telegram_id) 
      DO UPDATE SET 
        username = EXCLUDED.username,
        region = EXCLUDED.region,
        queue = EXCLUDED.queue,
        updated_at = NOW()
      RETURNING id
    `, [telegramId, username, region, queue]);
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Помилка збереження користувача:', error.message);
    throw error;
  }
}
```

Also exported in `module.exports`.

---

## Testing

Created comprehensive test suite in `test-database-save-bugs.js`:

### Test Results
```
✅ Test 1: updateUserFormatSettings() uses $N in SQL queries
✅ Test 2: updateUserScheduleAlertSettings() uses $N in SQL queries
✅ Test 3: updateUserScheduleAlertSettings() uses true/false for BOOLEAN
✅ Test 4: updateUser() function supports all required fields
✅ Test 5: saveUser() function exists and is exported
✅ Test 6: UserService.saveUser() can call usersDb.saveUser()
✅ Test 7: ChannelService uses updateUser() with extended fields
✅ Test 8: All BOOLEAN fields use true/false consistently
```

All tests passing! ✅

---

## Security Check

CodeQL security scan: **0 alerts** ✅

---

## Impact

### Before Fix:
- ❌ SQL queries generated invalid syntax like `SET field = 1` instead of `SET field = $1`
- ❌ Data was NOT saved to database correctly
- ❌ Service layer calls to updateUser() silently ignored most fields
- ❌ UserService.saveUser() would crash with "function not found" error
- ❌ Boolean fields stored as numbers instead of proper booleans

### After Fix:
- ✅ SQL queries use proper parameterized placeholders ($1, $2, etc.)
- ✅ PostgreSQL correctly interprets parameters
- ✅ Data is saved correctly to the database
- ✅ All service layer fields are properly handled
- ✅ UserService.saveUser() works with upsert logic
- ✅ Boolean fields stored as proper PostgreSQL BOOLEAN type

---

## Files Modified
- `src/database/users.js` - Fixed all 5 bugs
- `test-database-save-bugs.js` - New comprehensive test suite

## Statistics
- **Lines added:** 408
- **Lines deleted:** 12
- **Net change:** +396 lines
- **Functions modified:** 3 (updateUserFormatSettings, updateUserScheduleAlertSettings, updateUser)
- **Functions added:** 1 (saveUser)
