# Operations Runbook - Вольтик Bot v2.0

## 📋 Overview

This runbook provides step-by-step procedures for common operational tasks, troubleshooting, and emergency response.

## 🚨 Emergency Contacts

- **Owner/Admin**: @owner_admin
- **Technical Support**: [Telegram Discussion](https://t.me/c/3857764385/2)
- **Repository**: https://github.com/Ivan200424/eSvitlo-monitor-bot

## 🔧 Common Operations

### Starting the Bot

```bash
# Production
pm2 start src/index.js --name voltik-bot

# Development
npm run dev

# Check status
pm2 status voltik-bot
pm2 logs voltik-bot --lines 100
```

### Stopping the Bot

```bash
# Graceful shutdown (saves all states)
pm2 stop voltik-bot

# Force stop (use only if graceful fails)
pm2 kill
```

### Restarting the Bot

```bash
# Graceful restart
pm2 restart voltik-bot

# Restart with new code
pm2 restart voltik-bot --update-env

# Reload (zero-downtime)
pm2 reload voltik-bot
```

### Checking Logs

```bash
# Real-time logs
pm2 logs voltik-bot

# Last 200 lines
pm2 logs voltik-bot --lines 200

# Error logs only
pm2 logs voltik-bot --err

# Save logs to file
pm2 logs voltik-bot --lines 1000 > /tmp/voltik-logs.txt
```

## 🗄️ Database Operations

### Backup Database

```bash
# SQLite backup
cp data/bot.db backups/bot_backup_$(date +%Y%m%d_%H%M%S).db

# PostgreSQL backup
pg_dump -U voltik -d voltik > backups/voltik_backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
pg_dump -U voltik -d voltik | gzip > backups/voltik_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore Database

```bash
# SQLite restore
cp backups/bot_backup_TIMESTAMP.db data/bot.db
pm2 restart voltik-bot

# PostgreSQL restore
psql -U voltik -d voltik < backups/voltik_backup_TIMESTAMP.sql
pm2 restart voltik-bot

# Restore from compressed
gunzip < backups/voltik_backup_TIMESTAMP.sql.gz | psql -U voltik -d voltik
```

### Database Cleanup

```bash
# Connect to database
psql -U voltik -d voltik

# Run cleanup
SELECT cleanup_old_data();

# Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 🔍 Monitoring

### Check Bot Health

```bash
# Process status
pm2 status voltik-bot

# Memory usage
pm2 show voltik-bot | grep memory

# CPU usage
top -p $(pgrep -f "voltik-bot")

# Check if bot responds
curl -X POST https://api.telegram.org/bot${BOT_TOKEN}/getMe
```

### Check User Statistics

```bash
# Total users
psql -U voltik -d voltik -c "SELECT COUNT(*) FROM users WHERE is_active = TRUE;"

# Users by region
psql -U voltik -d voltik -c "SELECT region, COUNT(*) FROM users WHERE is_active = TRUE GROUP BY region;"

# Users with IP monitoring
psql -U voltik -d voltik -c "SELECT COUNT(*) FROM users WHERE router_ip IS NOT NULL AND is_active = TRUE;"

# Users with channels
psql -U voltik -d voltik -c "SELECT COUNT(*) FROM users WHERE channel_id IS NOT NULL AND is_active = TRUE;"
```

### Check Publication Statistics

```bash
# Recent publications
psql -U voltik -d voltik -c "SELECT publication_type, COUNT(*), MAX(published_at) FROM publication_signatures WHERE published_at > NOW() - INTERVAL '24 hours' GROUP BY publication_type;"

# Duplicate prevention (should show 0 or low numbers)
psql -U voltik -d voltik -c "SELECT COUNT(*) FROM publication_signatures WHERE published_at > NOW() - INTERVAL '1 hour';"
```

## 🚨 Troubleshooting

### Bot Not Responding

**Symptoms**: Bot doesn't respond to messages, appears offline

**Steps**:
1. Check if process is running:
   ```bash
   pm2 status voltik-bot
   ```

2. Check logs for errors:
   ```bash
   pm2 logs voltik-bot --err --lines 50
   ```

3. Check Telegram API:
   ```bash
   curl https://api.telegram.org/bot${BOT_TOKEN}/getMe
   ```

4. Restart if needed:
   ```bash
   pm2 restart voltik-bot
   ```

### Database Connection Error

**Symptoms**: Errors like "ECONNREFUSED", "database not available"

**Steps**:
1. Check if PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   # or
   pg_isready
   ```

2. Check connection:
   ```bash
   psql -U voltik -d voltik -c "SELECT 1;"
   ```

3. Verify credentials in `.env`:
   ```bash
   cat .env | grep POSTGRES
   ```

4. Restart PostgreSQL if needed:
   ```bash
   sudo systemctl restart postgresql
   ```

### High Memory Usage

**Symptoms**: Bot using >500MB RAM, system slow

**Steps**:
1. Check current usage:
   ```bash
   pm2 show voltik-bot | grep memory
   ```

2. Check for memory leaks in logs:
   ```bash
   pm2 logs voltik-bot | grep -i "memory\|heap"
   ```

3. Restart to clear memory:
   ```bash
   pm2 restart voltik-bot
   ```

4. If persists, check for large data structures:
   ```bash
   # Check publication cache
   # Check state manager
   # Check user monitoring states
   ```

### Duplicate Messages

**Symptoms**: Users reporting duplicate notifications

**Steps**:
1. Check if idempotency is working:
   ```bash
   node test-idempotency.js
   ```

2. Check publication signatures in database:
   ```bash
   psql -U voltik -d voltik -c "SELECT COUNT(*), publication_type FROM publication_signatures WHERE published_at > NOW() - INTERVAL '1 hour' GROUP BY publication_type;"
   ```

3. Check for multiple bot instances:
   ```bash
   ps aux | grep "voltik\|node.*index.js"
   ```

4. Verify no restart loops:
   ```bash
   pm2 logs voltik-bot | grep "Запуск\|Starting"
   ```

### IP Monitoring Not Working

**Symptoms**: No power state notifications

**Steps**:
1. Check if monitoring is active:
   ```bash
   pm2 logs voltik-bot | grep "IP Monitor"
   ```

2. Check user has IP configured:
   ```bash
   psql -U voltik -d voltik -c "SELECT telegram_id, router_ip FROM users WHERE telegram_id = 'USER_ID';"
   ```

3. Test ping manually:
   ```bash
   ping -c 5 <router_ip>
   ```

4. Check debounce settings:
   ```bash
   cat .env | grep DEBOUNCE
   ```

### Rate Limit Errors

**Symptoms**: "429 Too Many Requests" from Telegram

**Steps**:
1. Check publication rate:
   ```bash
   pm2 logs voltik-bot | grep -c "Published" | tail -100
   ```

2. Slow down publications (if needed):
   ```bash
   # Edit publisher delay
   # Increase CHECK_INTERVAL_SECONDS
   ```

3. Wait for rate limit to clear (usually 1 minute)

4. Implement backoff in publisher if not present

## 🔄 Deployment

### Deploy New Version

```bash
# 1. Backup current version
cp -r /path/to/voltik-bot /path/to/voltik-bot.backup

# 2. Pull new code
cd /path/to/voltik-bot
git pull origin main

# 3. Install dependencies
npm install

# 4. Run tests
npm test

# 5. Restart bot
pm2 restart voltik-bot

# 6. Monitor logs
pm2 logs voltik-bot --lines 50
```

### Rollback Deployment

```bash
# 1. Stop current version
pm2 stop voltik-bot

# 2. Restore backup
rm -rf /path/to/voltik-bot
cp -r /path/to/voltik-bot.backup /path/to/voltik-bot

# 3. Restart
pm2 start voltik-bot

# 4. Verify
pm2 logs voltik-bot
```

## 🔐 Security

### Rotate Bot Token

```bash
# 1. Get new token from @BotFather
# 2. Update .env
nano .env
# BOT_TOKEN=new_token_here

# 3. Restart bot
pm2 restart voltik-bot --update-env
```

### Rotate Database Password

```bash
# 1. Change PostgreSQL password
psql -U voltik -d voltik
ALTER USER voltik WITH PASSWORD 'new_password';
\q

# 2. Update .env
nano .env
# POSTGRES_PASSWORD=new_password

# 3. Restart bot
pm2 restart voltik-bot --update-env
```

### Review Security Logs

```bash
# Check for unauthorized access attempts
pm2 logs voltik-bot | grep -i "unauthorized\|forbidden\|access denied"

# Check admin command usage
pm2 logs voltik-bot | grep "/admin\|/stats\|/system"
```

## 📊 Performance Optimization

### Optimize Database

```bash
# Vacuum database
psql -U voltik -d voltik -c "VACUUM ANALYZE;"

# Reindex
psql -U voltik -d voltik -c "REINDEX DATABASE voltik;"

# Update statistics
psql -U voltik -d voltik -c "ANALYZE;"
```

### Clear Caches

```bash
# Restart to clear in-memory caches
pm2 restart voltik-bot

# Clear publication signatures older than 7 days
psql -U voltik -d voltik -c "DELETE FROM publication_signatures WHERE expires_at < NOW();"
```

## 🧪 Testing

### Smoke Test After Deployment

```bash
# 1. Check bot responds
# Send /start to bot

# 2. Check schedule works
# Send /schedule to bot

# 3. Check IP monitoring (if configured)
# Check power state notifications

# 4. Check channel publications (if configured)
# Verify message appears in channel

# 5. Check logs for errors
pm2 logs voltik-bot --lines 100 --err
```

### Load Testing

```bash
# Simulate multiple users
# Use test script or manual testing with multiple accounts

# Monitor during test
pm2 monit voltik-bot
```

## 📝 Maintenance Schedule

- **Daily**: Check logs for errors, verify bot responds
- **Weekly**: Backup database, check disk space, review statistics
- **Monthly**: Update dependencies, security audit, performance review
- **Quarterly**: Full system backup, disaster recovery test

## 🆘 Emergency Procedures

### Complete System Failure

1. Stop everything: `pm2 kill`
2. Check logs: `pm2 logs voltik-bot --lines 500 > /tmp/emergency.log`
3. Restore from last backup
4. Start in safe mode (disable IP monitoring, channels)
5. Gradually enable features
6. Contact admin if issues persist

### Data Loss

1. Stop bot immediately: `pm2 stop voltik-bot`
2. Do NOT modify database
3. Check if backup exists: `ls -lh backups/`
4. Restore from most recent backup
5. Verify data integrity
6. Notify users if necessary

### Security Breach

1. Immediately rotate all credentials (bot token, DB password)
2. Stop bot: `pm2 stop voltik-bot`
3. Review logs for suspicious activity
4. Check database for unauthorized changes
5. Restore from clean backup if compromised
6. Enable additional monitoring
7. Notify users if data exposed

## 📞 Support

For issues not covered in this runbook:

1. Check GitHub Issues: https://github.com/Ivan200424/eSvitlo-monitor-bot/issues
2. Contact in Telegram: https://t.me/c/3857764385/2
3. Review documentation in `/docs` directory

---

**Last Updated**: 2026-02-06  
**Version**: 2.0  
**Maintained By**: @Ivan200424
