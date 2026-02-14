# Database Migration Guide

## For Existing Installations

If you already have a database from a previous version, you need to run the migration script to add the new fields required for the power monitoring system.

### Run Migration

```bash
node src/database/migrate.js
```

### What Gets Added

The migration adds the following fields to the `users` table:

- `power_state` (TEXT) - Current power state: 'on', 'off', or NULL
- `power_changed_at` (DATETIME) - Timestamp of last power state change
- `last_alert_off_period` (TEXT) - Last period for which an "off" alert was sent
- `last_alert_on_period` (TEXT) - Last period for which an "on" alert was sent
- `alert_off_message_id` (INTEGER) - Message ID of last "off" alert
- `alert_on_message_id` (INTEGER) - Message ID of last "on" alert

### For New Installations

No migration needed - the database will be created with all fields automatically.

## Power Monitoring System

### Configuration

The power monitoring system uses the following settings:

- **POWER_CHECK_INTERVAL**: 10 seconds (default) - How often to check router availability
- **DEBOUNCE_COUNT**: 5 checks (50 seconds total) - How many consecutive checks needed to confirm state change

### How It Works

1. Every 10 seconds, the system checks the router IP of all users who have configured it
2. When a state change is detected (power on/off), it waits for 5 consecutive confirmations (debounce)
3. Once confirmed, it sends a notification to the user's channel
4. The system tracks outage history for statistics

### Alert System

- Checks every minute for upcoming power events
- Sends alerts before power off (configurable time, default 15 min)
- Sends alerts before power on (configurable time, default 15 min)
- Alerts are sent to user channels only (not private messages)
- Uses database fields to prevent duplicate alerts

## Changes from Previous Version

### Power Monitoring (`powerMonitor.js`)
- **Completely rewritten** to support multi-user monitoring
- Monitors ALL users with configured router_ip every 10 seconds
- Sends status changes to user channels with detailed messages
- Includes next scheduled event in notifications
- Tracks outage history

### Alert System (`alerts.js`)
- **Completely rewritten** to check all users
- Alerts sent to channels only (not private chat)
- Uses DB fields to track sent alerts and prevent duplicates
- Better time matching with ±1 minute tolerance

### Scheduler (`scheduler.js`)
- **Removed** private chat notifications (lines 85-105)
- Only sends to channels now

### Statistics (`statistics.js`)
- No changes - already working correctly

### Database (`db.js`, `users.js`)
- Added 6 new fields for power monitoring and alerts
- Added helper functions for the new features

### Configuration (`config.js`)
- Changed POWER_CHECK_INTERVAL default from 30 to 10 seconds

### Formatter (`formatter.js`)
- Added `formatScheduleForChannel()` for new channel message format
- Added `formatStatsForChannelPopup()` for statistics popup

### Bot Integration (`index.js`)
- Added `startPowerMonitoring()` on startup
- Added graceful shutdown for power monitoring
