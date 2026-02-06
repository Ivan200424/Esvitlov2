-- PostgreSQL Schema for Вольтик Bot v2.0
-- Migration from SQLite to PostgreSQL with zero data loss

-- Enable UUID extension for better primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - main user data
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    region TEXT NOT NULL,
    queue TEXT NOT NULL,
    channel_id TEXT,
    channel_title TEXT,
    channel_description TEXT,
    channel_photo_file_id TEXT,
    channel_user_title TEXT,
    channel_user_description TEXT,
    channel_status TEXT DEFAULT 'active',
    router_ip TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    migration_notified INTEGER DEFAULT 0,
    notify_before_off INTEGER DEFAULT 15,
    notify_before_on INTEGER DEFAULT 15,
    alerts_off_enabled BOOLEAN DEFAULT TRUE,
    alerts_on_enabled BOOLEAN DEFAULT TRUE,
    last_hash TEXT,
    last_published_hash TEXT,
    last_post_id INTEGER,
    power_state TEXT,
    power_changed_at TIMESTAMP WITH TIME ZONE,
    last_power_state TEXT,
    last_power_change BIGINT,
    power_on_duration INTEGER,
    last_alert_off_period TEXT,
    last_alert_on_period TEXT,
    alert_off_message_id INTEGER,
    alert_on_message_id INTEGER,
    today_snapshot_hash TEXT,
    tomorrow_snapshot_hash TEXT,
    tomorrow_published_date TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_region_queue ON users(region, queue);
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_channel_id ON users(channel_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Outage history - power outage events
CREATE TABLE IF NOT EXISTS outage_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outage_user_id ON outage_history(user_id);
CREATE INDEX IF NOT EXISTS idx_outage_start_time ON outage_history(start_time);
CREATE INDEX IF NOT EXISTS idx_outage_end_time ON outage_history(end_time);

-- Power history - detailed power state changes
CREATE TABLE IF NOT EXISTS power_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_power_history_user_id ON power_history(user_id);
CREATE INDEX IF NOT EXISTS idx_power_history_timestamp ON power_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_power_history_event_type ON power_history(event_type);

-- Settings - global bot settings
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Schedule history - historical schedule data
CREATE TABLE IF NOT EXISTS schedule_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    region TEXT NOT NULL,
    queue TEXT NOT NULL,
    schedule_data TEXT NOT NULL,
    hash TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schedule_user_id ON schedule_history(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_region_queue ON schedule_history(region, queue);
CREATE INDEX IF NOT EXISTS idx_schedule_hash ON schedule_history(hash);
CREATE INDEX IF NOT EXISTS idx_schedule_created_at ON schedule_history(created_at);

-- User power states - debounce and state management
CREATE TABLE IF NOT EXISTS user_power_states (
    telegram_id BIGINT PRIMARY KEY,
    current_state TEXT,
    pending_state TEXT,
    pending_state_time TIMESTAMP WITH TIME ZONE,
    last_stable_state TEXT,
    last_stable_at TIMESTAMP WITH TIME ZONE,
    instability_start TIMESTAMP WITH TIME ZONE,
    switch_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_power_states_telegram_id ON user_power_states(telegram_id);
CREATE INDEX IF NOT EXISTS idx_power_states_updated_at ON user_power_states(updated_at);
CREATE INDEX IF NOT EXISTS idx_power_states_current_state ON user_power_states(current_state);

-- User states - wizard and conversation states
CREATE TABLE IF NOT EXISTS user_states (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    state_type TEXT NOT NULL,
    state_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(telegram_id, state_type)
);

CREATE INDEX IF NOT EXISTS idx_user_states_telegram_id ON user_states(telegram_id);
CREATE INDEX IF NOT EXISTS idx_user_states_type ON user_states(state_type);
CREATE INDEX IF NOT EXISTS idx_user_states_updated_at ON user_states(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_states_data ON user_states USING GIN (state_data);

-- Pending channels - channels awaiting connection
CREATE TABLE IF NOT EXISTS pending_channels (
    id SERIAL PRIMARY KEY,
    channel_id TEXT NOT NULL UNIQUE,
    channel_username TEXT,
    channel_title TEXT,
    telegram_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pending_channels_id ON pending_channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_pending_channels_telegram_id ON pending_channels(telegram_id);

-- Publication signatures - for idempotency
CREATE TABLE IF NOT EXISTS publication_signatures (
    id SERIAL PRIMARY KEY,
    signature TEXT UNIQUE NOT NULL,
    publication_type TEXT NOT NULL,
    region TEXT,
    queue TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    channel_id TEXT,
    data_hash TEXT NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_pub_sig_signature ON publication_signatures(signature);
CREATE INDEX IF NOT EXISTS idx_pub_sig_user_id ON publication_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_pub_sig_channel_id ON publication_signatures(channel_id);
CREATE INDEX IF NOT EXISTS idx_pub_sig_expires_at ON publication_signatures(expires_at);
CREATE INDEX IF NOT EXISTS idx_pub_sig_published_at ON publication_signatures(published_at);

-- Pause log - track when users pause notifications
CREATE TABLE IF NOT EXISTS pause_log (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    paused_at TIMESTAMP WITH TIME ZONE,
    resumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pause_log_telegram_id ON pause_log(telegram_id);
CREATE INDEX IF NOT EXISTS idx_pause_log_created_at ON pause_log(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_power_states_updated_at BEFORE UPDATE ON user_power_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_states_updated_at BEFORE UPDATE ON user_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_data() RETURNS void AS $$
BEGIN
    -- Delete old user states older than 24 hours
    DELETE FROM user_states WHERE updated_at < NOW() - INTERVAL '24 hours';
    
    -- Delete old power states older than 7 days
    DELETE FROM user_power_states WHERE updated_at < NOW() - INTERVAL '7 days';
    
    -- Delete old publication signatures older than 7 days
    DELETE FROM publication_signatures WHERE expires_at < NOW();
    
    -- Delete old schedule history older than 30 days
    DELETE FROM schedule_history WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete old pause logs older than 90 days
    DELETE FROM pause_log WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Cleanup old states (older than 24 hours)
COMMENT ON FUNCTION cleanup_old_data() IS 'Cleanup old data from various tables to maintain database performance';
