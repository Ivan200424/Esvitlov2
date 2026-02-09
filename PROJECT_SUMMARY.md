# 📊 Project Summary - eSvitlo Monitor Bot

## 🎯 Project Overview

A complete multi-tenant Telegram bot for monitoring electricity outages in Ukraine. Built with Node.js and ready for deployment on Railway.

## 📁 Project Structure

```
eSvitlo-monitor-bot/
├── src/
│   ├── index.js              # Main entry point
│   ├── bot.js                # Telegram bot initialization
│   ├── config.js             # Configuration management
│   ├── api.js                # API client for outage data
│   ├── parser.js             # Data parsing logic
│   ├── formatter.js          # Message formatting
│   ├── scheduler.js          # Schedule checking (every 3 min)
│   ├── alerts.js             # Alert system (every 1 min)
│   ├── utils.js              # Utility functions
│   │
│   ├── database/
│   │   ├── db.js             # SQLite connection
│   │   └── users.js          # User CRUD operations
│   │
│   ├── handlers/
│   │   ├── start.js          # /start and setup wizard
│   │   ├── schedule.js       # Schedule viewing
│   │   ├── settings.js       # User settings
│   │   ├── channel.js        # Channel integration
│   │   └── admin.js          # Admin commands
│   │
│   ├── keyboards/
│   │   └── inline.js         # Inline keyboard layouts
│   │
│   └── constants/
│       └── regions.js        # Region and queue definitions
│
├── data/                      # SQLite database storage (gitignored)
│   └── bot.db                # User data and settings
│
├── package.json              # Dependencies and scripts
├── package-lock.json         # Locked dependencies
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
├── .dockerignore             # Docker ignore rules
│
├── Dockerfile                # Docker image configuration
├── docker-compose.yml        # Docker Compose setup
├── railway.json              # Railway deployment config
│
├── test.js                   # Automated tests
├── README.md                 # Main documentation
├── DEPLOYMENT.md             # Railway deployment guide
├── QUICKSTART.md             # Quick start guide
├── CONTRIBUTING.md           # Contribution guidelines
└── LICENSE                   # MIT License

```

## 🔑 Key Features Implemented

### User Features
✅ Region selection (Kyiv, Kyiv-region, Dnipro, Odesa)
✅ Queue configuration (GPV1.1 - GPV3.2)
✅ Schedule viewing with charts
✅ Next event prediction
✅ Countdown timer
✅ Custom alert timing
✅ Channel posting support
✅ Multi-language support (Ukrainian)

### Admin Features
✅ User statistics
✅ User management
✅ Broadcast messaging
✅ System monitoring
✅ Access control

### Technical Features
✅ SQLite database with indexes
✅ Scheduled tasks (cron)
✅ Alert system
✅ Error handling
✅ Graceful shutdown
✅ Docker support
✅ Railway ready
✅ Cache management
✅ Rate limiting

## 📊 Database Schema

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT UNIQUE NOT NULL,
  username TEXT,
  region TEXT NOT NULL,
  queue TEXT NOT NULL,
  channel_id TEXT,
  is_active BOOLEAN DEFAULT 1,
  notify_before_off INTEGER DEFAULT 15,
  notify_before_on INTEGER DEFAULT 15,
  alerts_off_enabled BOOLEAN DEFAULT 1,
  alerts_on_enabled BOOLEAN DEFAULT 1,
  last_hash TEXT,
  last_post_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_region_queue ON users(region, queue);
CREATE INDEX idx_telegram_id ON users(telegram_id);
CREATE INDEX idx_channel_id ON users(channel_id);
```

## 🛠 Technology Stack

- **Runtime**: Node.js 20+
- **Bot Framework**: node-telegram-bot-api
- **Database**: better-sqlite3
- **Scheduler**: node-cron
- **HTTP Client**: axios
- **Environment**: dotenv
- **Container**: Docker
- **Deployment**: Railway

## 📋 Available Commands

### User Commands
| Command | Description |
|---------|-------------|
| `/start` | Initialize bot and setup wizard |
| `/schedule` | View current outage schedule |
| `/next` | Show next power event |
| `/timer` | Countdown to next event |
| `/settings` | Configure preferences |
| `/channel` | Connect Telegram channel |
| `/help` | Command reference |

### Keyboard Shortcuts
| Button | Action |
|--------|--------|
| 📋 Графік | Same as `/schedule` |
| ⏭ Наступне | Same as `/next` |
| ⏰ Таймер | Same as `/timer` |
| ⚙️ Налаштування | Same as `/settings` |
| 📺 Канал | Same as `/channel` |
| ❓ Допомога | Same as `/help` |

### Admin Commands
| Command | Description |
|---------|-------------|
| `/admin` | Admin dashboard |
| `/stats` | User statistics |
| `/users` | User list |
| `/broadcast` | Send message to all users |
| `/system` | System information |

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────┐
│  GitHub Repository (outage-data-ua)             │
│  https://github.com/Baskerville42/outage-data-ua│
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Scheduler (every 3 minutes)                    │
│  - Fetch JSON data for each region              │
│  - Calculate hash of schedule                   │
│  - Compare with stored hash                     │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Database Check                                 │
│  - If hash changed → Schedule updated           │
│  - Send notification to user                    │
│  - Send to channel if connected                 │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Alert System (every 1 minute)                  │
│  - Check upcoming events                        │
│  - Send alerts N minutes before event           │
│  - Cache sent alerts                            │
└─────────────────────────────────────────────────┘
```

## 🧪 Testing

Run automated tests:
```bash
npm test
```

Test coverage:
- ✅ Constants and regions
- ✅ Utility functions
- ✅ Message formatting
- ✅ Data parsing
- ✅ Keyboard layouts
- ✅ API configuration
- ✅ Database schema

## 🚀 Deployment Options

### Railway (Recommended)
- Free tier available
- Auto-deploy from GitHub
- Environment variables
- Volume for database
- See DEPLOYMENT.md

### Docker
```bash
docker-compose up -d
```

### Local Development
```bash
npm install
cp .env.example .env
# Edit .env with your BOT_TOKEN
npm run dev
```

## 📈 Performance Considerations

- **Schedule Check**: 3 minutes (configurable)
- **Alert Check**: 1 minute
- **Cache TTL**: 2 minutes for API responses
- **Rate Limiting**: 50ms delay between broadcasts
- **Database**: WAL mode for better concurrency

## 🔒 Security

- Admin-only commands protected by ADMIN_IDS
- SQL injection prevented by prepared statements
- HTML escaping for user input
- Environment variables for secrets
- No sensitive data in logs

## 📊 Statistics Tracking

The bot tracks:
- Total users
- Active users
- Users with channels
- Users per region
- Last update times

## 🎨 Customization Options

Users can customize:
- Region and queue
- Alert timing (5, 10, 15, 30, 60 minutes)
- Alert types (on/off separately)
- Channel integration

## 📝 Code Quality

- ✅ Modular architecture
- ✅ Separation of concerns
- ✅ Error handling everywhere
- ✅ Ukrainian comments and messages
- ✅ English variable names
- ✅ Consistent code style
- ✅ No hardcoded values

## 🔮 Future Enhancements

Potential improvements:
- [ ] Web dashboard
- [ ] Backup/restore functionality
- [ ] Multiple regions per user
- [ ] Historical data tracking
- [ ] Push notifications
- [ ] Analytics dashboard
- [ ] Multi-language support

## 📞 Support

- Issues: GitHub Issues
- Documentation: README.md
- Quick Start: QUICKSTART.md
- Deployment: DEPLOYMENT.md
- Contributing: CONTRIBUTING.md

## ✅ Project Status

**Status**: ✅ Complete and Ready for Production

All requirements from the problem statement have been implemented:
- ✅ Multi-tenant architecture
- ✅ SQLite database
- ✅ All user commands
- ✅ All admin commands
- ✅ Schedule monitoring
- ✅ Alert system
- ✅ Channel integration
- ✅ Docker support
- ✅ Railway deployment
- ✅ Comprehensive documentation

---

Created with ❤️ for Ukraine 🇺🇦
