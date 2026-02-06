# Quick Migration Guide - V1 to V2

## 🎯 What Changed

The bot has been **completely rewritten** from scratch. The new V2 bot:
- ✅ Fixes "unknown command" errors for Reply keyboard buttons
- ✅ Implements clean state machine with proper lifecycle
- ✅ Separates Reply (navigation) and Inline (actions) keyboards
- ✅ **Preserves all existing user data** (region, queue, channel, IP, settings)
- ✅ Works with existing infrastructure (database, scheduler, monitoring)

## 🚀 How to Deploy V2

### Option 1: Simple (Recommended)
The V2 bot is **already activated**. Just run:

```bash
npm install  # If not already installed
npm start
```

The main `src/index.js` now points to `src/v2/index.js` automatically.

### Option 2: Test First
To test the V2 bot before deploying:

```bash
# Run validation tests (no bot token needed)
node src/v2/validate.js

# If validation passes, start the bot
npm start
```

## 📊 Verification Steps

After starting the bot:

1. **Test as New User:**
   - Start conversation: `/start`
   - Should see: Onboarding wizard with region selection
   - Complete wizard: region → queue → notification target → confirm
   - Should see: Main menu with Reply keyboard

2. **Test as Existing User:**
   - Start conversation: `/start` (with existing user account)
   - Should see: Main menu immediately (no re-onboarding)
   - Verify: Your region, queue, channel, and IP settings are shown
   - Should see: Reply keyboard at bottom

3. **Test Reply Buttons:**
   - Press "📊 Графік" → Should show schedule (NO "unknown command" error)
   - Press "⚙️ Налаштування" → Should show settings
   - Press "📈 Статистика" → Should show statistics
   - Press "❓ Допомога" → Should show help
   - Press "🏠 Меню" → Should show main menu

4. **Test Navigation:**
   - Open any screen
   - Check for: ← Назад or ⤴ Меню button
   - Press button → Should navigate correctly
   - No dead-end screens

5. **Test Commands:**
   - `/start` → Main menu (or onboarding for new users)
   - `/menu` → Main menu
   - `/schedule` → Schedule display
   - `/settings` → Settings menu
   - `/help` → Help menu
   - `/unknown` → "Unknown command" message (expected)

## ⚠️ Troubleshooting

### "Module not found" error
```bash
# Install dependencies
npm install
```

### "Bot token not found"
```bash
# Create .env file with:
BOT_TOKEN=your_telegram_bot_token_here
```

### "Unknown command" for Reply buttons
This means V1 is running, not V2. Check that:
- `src/index.js` contains: `require('./v2/index');`
- If not, restore from git or manually update

### Old bot behavior
If you see the old bot:
- Check `src/index.js` is pointing to V2
- Restart the bot process
- Clear any cached processes

### Users losing data
**This should NOT happen.** If it does:
1. Stop the bot immediately
2. Check database file is intact
3. Rollback to V1 (see below)
4. Report the issue

## 🔄 Rollback to V1 (if needed)

If you need to go back to the old bot:

```bash
# Restore old bot files
cp src/v1_backup/index.js src/index.js
cp src/v1_backup/bot.js src/bot.js

# Restart
npm start
```

All user data is preserved - you can switch back and forth safely.

## 📁 File Structure

```
src/
├── index.js              ← Points to V2 (you can modify this)
├── v1_backup/            ← Old bot backup
│   ├── bot.js
│   └── index.js
└── v2/                   ← New bot (complete rewrite)
    ├── bot.js            ← Main bot instance
    ├── index.js          ← V2 entry point
    ├── validate.js       ← Test script
    ├── README.md         ← V2 documentation
    ├── state/            ← State machine
    ├── keyboards/        ← Keyboard definitions
    ├── handlers/         ← Message handlers
    ├── migration/        ← Data preservation
    ├── ui/               ← UI components
    └── flows/            ← User flows
```

## ✅ Safety Guarantees

1. **Database**: Unchanged schema, all data preserved
2. **Infrastructure**: Scheduler, monitoring, power tracking still work
3. **Users**: Existing users keep all settings and configurations
4. **Rollback**: V1 backup available if needed
5. **Testing**: 7 automated tests pass before deployment

## 🔍 Monitoring

Watch for these in logs:

✅ **Good Signs:**
```
✨ Вольтик V2 успішно запущено та готовий до роботи!
✅ Polling started
✅ All modules load successfully
```

❌ **Bad Signs:**
```
❌ Module loading failed
❌ Помилка при запуску бота
Error: Cannot find module
```

## 📞 Support

If you encounter issues:

1. **Check validation:** `node src/v2/validate.js`
2. **Check logs:** Look for error messages
3. **Verify environment:** `.env` file exists with BOT_TOKEN
4. **Test database:** Check `voltyk.db` file exists
5. **Rollback if needed:** Use V1 backup

## 📈 Performance

V2 bot is designed to be:
- **Efficient**: Same or better performance than V1
- **Stable**: Clean state machine prevents crashes
- **Predictable**: Consistent behavior
- **Maintainable**: Modular, documented code

## 🎉 Benefits of V2

1. **No "Unknown Command" Errors**
   - Reply buttons work correctly
   - Users have smooth experience

2. **Better Navigation**
   - Every screen has back/menu buttons
   - No dead-end screens
   - Predictable flow

3. **Clean Code**
   - Easy to understand
   - Easy to modify
   - Well documented
   - Automated tests

4. **Future-Proof**
   - Modular architecture
   - Easy to add features
   - Maintainable long-term

## 📝 Next Steps

1. Deploy V2 bot
2. Monitor logs for first few hours
3. Test with real users
4. Verify no "unknown command" errors
5. Keep V1 backup for safety
6. After 1 week of stable operation, can remove V1 backup

---

**V2 is ready for production. All tests pass. Existing users are protected.**
