/**
 * Structured Logger for Scalable Architecture
 * 
 * Provides structured logging with different levels and context
 * Designed for log aggregation and observability at scale
 */

class Logger {
  constructor(context = {}) {
    this.context = context;
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    this.currentLevel = process.env.LOG_LEVEL || 'info';
  }

  /**
   * Format log message with context
   * @private
   */
  _formatMessage(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      context: this.context,
      ...metadata
    };

    // In production, this would send to log aggregation service
    // For now, output as JSON for easy parsing
    if (process.env.NODE_ENV === 'production') {
      return JSON.stringify(logEntry);
    }

    // Human-readable format for development
    const contextStr = Object.keys(this.context).length > 0 
      ? ` [${Object.entries(this.context).map(([k, v]) => `${k}=${v}`).join(', ')}]`
      : '';
    
    const metadataStr = Object.keys(metadata).length > 0
      ? ` ${JSON.stringify(metadata)}`
      : '';

    return `[${timestamp}] ${level.toUpperCase()}${contextStr}: ${message}${metadataStr}`;
  }

  /**
   * Check if a log level should be output
   * @private
   */
  _shouldLog(level) {
    return this.levels[level] <= this.levels[this.currentLevel];
  }

  /**
   * Log error message
   */
  error(message, error = null, metadata = {}) {
    if (!this._shouldLog('error')) return;

    const logData = { ...metadata };
    if (error) {
      logData.error = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    }

    console.error(this._formatMessage('error', message, logData));
  }

  /**
   * Log warning message
   */
  warn(message, metadata = {}) {
    if (!this._shouldLog('warn')) return;
    console.warn(this._formatMessage('warn', message, metadata));
  }

  /**
   * Log info message
   */
  info(message, metadata = {}) {
    if (!this._shouldLog('info')) return;
    console.log(this._formatMessage('info', message, metadata));
  }

  /**
   * Log debug message
   */
  debug(message, metadata = {}) {
    if (!this._shouldLog('debug')) return;
    console.log(this._formatMessage('debug', message, metadata));
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext = {}) {
    return new Logger({
      ...this.context,
      ...additionalContext
    });
  }

  /**
   * Log with custom level
   */
  log(level, message, metadata = {}) {
    if (!this.levels.hasOwnProperty(level)) {
      level = 'info';
    }

    if (!this._shouldLog(level)) return;

    const logMethod = console[level] || console.log;
    logMethod(this._formatMessage(level, message, metadata));
  }
}

// Default logger instance
const defaultLogger = new Logger({ service: 'eSvitlo-bot' });

module.exports = {
  Logger,
  logger: defaultLogger
};
