/**
 * Scheduler Manager for Centralized Scheduler Lifecycle Management
 * 
 * Provides unified control over all scheduled tasks with explicit lifecycle
 * Ensures idempotent execution and proper cleanup
 * Designed for horizontal scaling with coordination support
 */

const cron = require('node-cron');
const { logger } = require('./Logger');
const { eventBus, Events } = require('./EventEmitter');

class SchedulerManager {
  constructor() {
    this.schedulers = new Map();
    this.log = logger.child({ component: 'SchedulerManager' });
    this.isInitialized = false;
    this.instanceId = this._generateInstanceId();
  }

  /**
   * Generate unique instance ID for distributed coordination
   * @private
   */
  _generateInstanceId() {
    return `instance_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Initialize scheduler manager
   */
  init() {
    if (this.isInitialized) {
      this.log.warn('SchedulerManager already initialized');
      return;
    }

    this.log.info('Initializing SchedulerManager', {
      instanceId: this.instanceId
    });

    this.isInitialized = true;
    eventBus.emitSync(Events.SCHEDULER_STARTED, { instanceId: this.instanceId });
  }

  /**
   * Register a scheduler
   * @param {string} name - Unique scheduler name
   * @param {Function} task - Task function to execute
   * @param {Object} options - Options {interval, cron, runImmediately, idempotent}
   * @returns {boolean}
   */
  register(name, task, options = {}) {
    // Prevent duplicate registration
    if (this.schedulers.has(name)) {
      this.log.warn('Scheduler already registered, stopping old one first', {
        scheduler: name
      });
      this.stop(name);
    }

    const scheduler = {
      name,
      task,
      options: {
        interval: options.interval || null, // seconds
        cron: options.cron || null,
        runImmediately: options.runImmediately || false,
        idempotent: options.idempotent !== false // Default to true
      },
      job: null,
      state: 'stopped',
      lastRun: null,
      nextRun: null,
      runCount: 0,
      errorCount: 0,
      isRunning: false
    };

    this.schedulers.set(name, scheduler);

    this.log.info('Scheduler registered', {
      scheduler: name,
      interval: scheduler.options.interval,
      cron: scheduler.options.cron
    });

    return true;
  }

  /**
   * Start a scheduler
   * @param {string} name - Scheduler name
   * @returns {boolean}
   */
  start(name) {
    const scheduler = this.schedulers.get(name);

    if (!scheduler) {
      this.log.error('Scheduler not found', null, { scheduler: name });
      return false;
    }

    if (scheduler.state === 'running') {
      this.log.warn('Scheduler already running', { scheduler: name });
      return true;
    }

    // Create the job based on configuration
    if (scheduler.options.cron) {
      scheduler.job = cron.schedule(scheduler.options.cron, async () => {
        await this._executeTask(name);
      });
    } else if (scheduler.options.interval) {
      const intervalMs = scheduler.options.interval * 1000;
      scheduler.job = setInterval(async () => {
        await this._executeTask(name);
      }, intervalMs);
      
      // Calculate next run
      scheduler.nextRun = Date.now() + intervalMs;
    } else {
      this.log.error('Scheduler has no interval or cron configuration', null, {
        scheduler: name
      });
      return false;
    }

    scheduler.state = 'running';

    this.log.info('Scheduler started', {
      scheduler: name,
      interval: scheduler.options.interval,
      cron: scheduler.options.cron
    });

    // Run immediately if requested
    if (scheduler.options.runImmediately) {
      setImmediate(() => this._executeTask(name));
    }

    return true;
  }

  /**
   * Stop a scheduler
   * @param {string} name - Scheduler name
   * @returns {boolean}
   */
  stop(name) {
    const scheduler = this.schedulers.get(name);

    if (!scheduler) {
      this.log.error('Scheduler not found', null, { scheduler: name });
      return false;
    }

    if (scheduler.state === 'stopped') {
      this.log.debug('Scheduler already stopped', { scheduler: name });
      return true;
    }

    // Stop the job
    if (scheduler.job) {
      if (typeof scheduler.job.stop === 'function') {
        scheduler.job.stop(); // cron job
      } else if (typeof scheduler.job === 'number') {
        clearInterval(scheduler.job); // setInterval
      }
      scheduler.job = null;
    }

    scheduler.state = 'stopped';
    scheduler.nextRun = null;

    this.log.info('Scheduler stopped', {
      scheduler: name,
      runCount: scheduler.runCount,
      errorCount: scheduler.errorCount
    });

    return true;
  }

  /**
   * Change scheduler interval (stops old, starts new)
   * @param {string} name - Scheduler name
   * @param {number} newInterval - New interval in seconds
   * @returns {boolean}
   */
  changeInterval(name, newInterval) {
    const scheduler = this.schedulers.get(name);

    if (!scheduler) {
      this.log.error('Scheduler not found', null, { scheduler: name });
      return false;
    }

    const wasRunning = scheduler.state === 'running';
    const oldInterval = scheduler.options.interval;

    // Stop the scheduler
    this.stop(name);

    // Update interval
    scheduler.options.interval = newInterval;
    scheduler.options.cron = null; // Clear cron if set

    this.log.info('Scheduler interval changed', {
      scheduler: name,
      oldInterval,
      newInterval
    });

    eventBus.emitSync(Events.SCHEDULER_INTERVAL_CHANGED, {
      scheduler: name,
      oldInterval,
      newInterval
    });

    // Restart if it was running
    if (wasRunning) {
      return this.start(name);
    }

    return true;
  }

  /**
   * Execute a scheduler task (with idempotency check)
   * @private
   */
  async _executeTask(name) {
    const scheduler = this.schedulers.get(name);

    if (!scheduler) {
      return;
    }

    // Idempotency check - prevent concurrent execution
    if (scheduler.options.idempotent && scheduler.isRunning) {
      this.log.debug('Scheduler task already running, skipping', {
        scheduler: name
      });
      return;
    }

    scheduler.isRunning = true;
    scheduler.lastRun = Date.now();

    try {
      await scheduler.task();
      scheduler.runCount++;

      if (scheduler.options.interval) {
        scheduler.nextRun = Date.now() + (scheduler.options.interval * 1000);
      }
    } catch (error) {
      scheduler.errorCount++;
      this.log.error('Scheduler task error', error, {
        scheduler: name,
        runCount: scheduler.runCount,
        errorCount: scheduler.errorCount
      });

      eventBus.emitSync(Events.BOT_ERROR, {
        component: 'scheduler',
        scheduler: name,
        error: error.message
      });
    } finally {
      scheduler.isRunning = false;
    }
  }

  /**
   * Get scheduler status
   * @param {string} name - Scheduler name
   * @returns {Object|null}
   */
  getStatus(name) {
    const scheduler = this.schedulers.get(name);

    if (!scheduler) {
      return null;
    }

    return {
      name: scheduler.name,
      state: scheduler.state,
      interval: scheduler.options.interval,
      cron: scheduler.options.cron,
      lastRun: scheduler.lastRun,
      nextRun: scheduler.nextRun,
      runCount: scheduler.runCount,
      errorCount: scheduler.errorCount,
      isRunning: scheduler.isRunning
    };
  }

  /**
   * Get all schedulers status
   * @returns {Array}
   */
  getAllStatus() {
    const statuses = [];

    for (const name of this.schedulers.keys()) {
      statuses.push(this.getStatus(name));
    }

    return statuses;
  }

  /**
   * Stop all schedulers
   */
  stopAll() {
    this.log.info('Stopping all schedulers');

    for (const name of this.schedulers.keys()) {
      this.stop(name);
    }

    eventBus.emitSync(Events.SCHEDULER_STOPPED, {
      instanceId: this.instanceId
    });
  }

  /**
   * Unregister a scheduler (stops and removes)
   * @param {string} name - Scheduler name
   * @returns {boolean}
   */
  unregister(name) {
    this.stop(name);
    const removed = this.schedulers.delete(name);

    if (removed) {
      this.log.info('Scheduler unregistered', { scheduler: name });
    }

    return removed;
  }

  /**
   * Unregister all schedulers
   */
  unregisterAll() {
    this.stopAll();
    this.schedulers.clear();
    this.log.info('All schedulers unregistered');
  }

  /**
   * Get scheduler statistics
   * @returns {Object}
   */
  getStats() {
    const stats = {
      total: this.schedulers.size,
      running: 0,
      stopped: 0,
      totalRuns: 0,
      totalErrors: 0
    };

    for (const scheduler of this.schedulers.values()) {
      if (scheduler.state === 'running') {
        stats.running++;
      } else {
        stats.stopped++;
      }
      stats.totalRuns += scheduler.runCount;
      stats.totalErrors += scheduler.errorCount;
    }

    return stats;
  }
}

// Global scheduler manager instance
const schedulerManager = new SchedulerManager();

module.exports = {
  SchedulerManager,
  schedulerManager
};
