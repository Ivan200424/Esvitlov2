/**
 * JSDoc type definitions for database entities.
 * Derived from src/database/schema.js and src/database/migrations.js
 */

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} telegram_id
 * @property {string|null} username
 * @property {string} region
 * @property {string} queue
 * @property {string|null} channel_id
 * @property {string|null} channel_title
 * @property {string|null} channel_description
 * @property {string|null} channel_photo_file_id
 * @property {string|null} channel_user_title
 * @property {string|null} channel_user_description
 * @property {string} channel_status
 * @property {string|null} router_ip
 * @property {boolean} is_active
 * @property {number} migration_notified
 * @property {number} notify_before_off
 * @property {number} notify_before_on
 * @property {boolean} alerts_off_enabled
 * @property {boolean} alerts_on_enabled
 * @property {string|null} last_hash
 * @property {string|null} last_published_hash
 * @property {number|null} last_post_id
 * @property {string|null} power_state
 * @property {Date|null} power_changed_at
 * @property {string|null} pending_power_state
 * @property {Date|null} pending_power_change_at
 * @property {string|null} last_power_state
 * @property {number|null} last_power_change
 * @property {number|null} power_on_duration
 * @property {string|null} last_alert_off_period
 * @property {string|null} last_alert_on_period
 * @property {number|null} alert_off_message_id
 * @property {number|null} alert_on_message_id
 * @property {string|null} today_snapshot_hash
 * @property {string|null} tomorrow_snapshot_hash
 * @property {string|null} tomorrow_published_date
 * @property {string|null} schedule_caption
 * @property {string|null} period_format
 * @property {string|null} power_off_text
 * @property {string|null} power_on_text
 * @property {boolean} delete_old_message
 * @property {boolean} picture_only
 * @property {number|null} last_schedule_message_id
 * @property {boolean} channel_paused
 * @property {string} power_notify_target
 * @property {boolean} schedule_alert_enabled
 * @property {number} schedule_alert_minutes
 * @property {string} schedule_alert_target
 * @property {number|null} last_start_message_id
 * @property {number|null} last_settings_message_id
 * @property {number|null} last_timer_message_id
 * @property {Date|null} channel_branding_updated_at
 * @property {number|null} last_menu_message_id
 * @property {Date} created_at
 * @property {Date} updated_at
 */

/**
 * @typedef {Object} Ticket
 * @property {number} id
 * @property {string} telegram_id
 * @property {string} type
 * @property {string} status
 * @property {string|null} subject
 * @property {Date} created_at
 * @property {Date} updated_at
 * @property {Date|null} closed_at
 * @property {string|null} closed_by
 */

/**
 * @typedef {Object} TicketMessage
 * @property {number} id
 * @property {number} ticket_id
 * @property {string} sender_type
 * @property {string} sender_id
 * @property {string} message_type
 * @property {string|null} content
 * @property {string|null} file_id
 * @property {Date} created_at
 */

/**
 * @typedef {Object} PauseLogEntry
 * @property {number} id
 * @property {string} admin_id
 * @property {string} event_type
 * @property {string|null} pause_type
 * @property {string|null} message
 * @property {string|null} reason
 * @property {Date} created_at
 */

/**
 * @typedef {Object} PowerHistoryEntry
 * @property {number} id
 * @property {number} user_id
 * @property {string} event_type
 * @property {number} timestamp
 * @property {number|null} duration_seconds
 */

/**
 * @typedef {Object} ScheduleHistoryEntry
 * @property {number} id
 * @property {number} user_id
 * @property {string} region
 * @property {string} queue
 * @property {Object} schedule_data
 * @property {string} hash
 * @property {Date} created_at
 */

/**
 * @typedef {Object} AdminRouter
 * @property {number} id
 * @property {string} admin_telegram_id
 * @property {string|null} router_ip
 * @property {number} router_port
 * @property {boolean} notifications_on
 * @property {string|null} last_state
 * @property {Date|null} last_change_at
 * @property {Date|null} last_check_at
 * @property {Date} created_at
 * @property {Date} updated_at
 */

/**
 * @typedef {Object} Setting
 * @property {number} id
 * @property {string} key
 * @property {string} value
 * @property {Date} updated_at
 */

/**
 * @typedef {Object} UserState
 * @property {number} id
 * @property {string} telegram_id
 * @property {string} state_type
 * @property {string} state_data
 * @property {Date} created_at
 * @property {Date} updated_at
 */

/**
 * @typedef {Object} PendingChannel
 * @property {number} id
 * @property {string} channel_id
 * @property {string|null} channel_username
 * @property {string|null} channel_title
 * @property {string} telegram_id
 * @property {Date} created_at
 */

module.exports = {};
