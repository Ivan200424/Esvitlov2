# Changelog

All notable changes to СвітлоБот are documented here.

## [Unreleased]

### Changed
- Moved all inline `require()` calls in `src/bot.js` to top-level imports
- Cleaned up auto-generated files from `docs/`
- Added `bot: "running"` field to `/health` endpoint response

## [2.0.0]

### Added
- PostgreSQL database migration from SQLite
- Webhook support for Railway deployment
- Health check HTTP server (`/health` endpoint)
- Admin router monitoring
- Channel guard system
- Graceful shutdown handling
- Message queue with rate limiting
- State manager for persistent user states
- Ticketing / feedback system
- Growth metrics and analytics

### Changed
- Refactored scheduler to use batch processing
- Improved error handling and admin notifications
- Enhanced channel auto-connect wizard

## [1.0.0]

### Added
- Initial bot implementation
- Schedule parsing and notifications
- User registration and region selection
- Channel connection support
- Admin panel
