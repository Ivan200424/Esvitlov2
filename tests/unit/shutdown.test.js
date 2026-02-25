jest.mock('../../src/logger', () => ({
  child: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const { createShutdownHandler } = require('../../src/lifecycle/shutdown');

function makeDeps(overrides = {}) {
  return {
    getRunner: jest.fn().mockReturnValue(null),
    config: { USE_WEBHOOK: false },
    messageQueue: { drain: jest.fn().mockResolvedValue(undefined) },
    schedulerManager: { stop: jest.fn() },
    stopCleanup: jest.fn(),
    stopCacheCleanup: jest.fn(),
    stopBotCleanup: jest.fn(),
    monitoringManager: { stop: jest.fn() },
    stopPowerMonitoring: jest.fn(),
    stopAdminRouterMonitoring: jest.fn(),
    saveAllUserStates: jest.fn().mockResolvedValue(undefined),
    stopHealthCheck: jest.fn(),
    stopPoolMetricsLogging: jest.fn(),
    closeDatabase: jest.fn().mockResolvedValue(undefined),
    stopRateLimit: jest.fn(),
    ...overrides,
  };
}

describe('createShutdownHandler', () => {
  let exitSpy;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    jest.useFakeTimers();
  });

  afterEach(() => {
    exitSpy.mockRestore();
    jest.useRealTimers();
  });

  test('executes all shutdown steps and calls process.exit(0)', async () => {
    const bot = { stop: jest.fn().mockResolvedValue(undefined) };
    const deps = makeDeps();
    const shutdown = createShutdownHandler(bot, deps);

    await shutdown('SIGTERM');

    expect(bot.stop).toHaveBeenCalled();
    expect(deps.messageQueue.drain).toHaveBeenCalled();
    expect(deps.schedulerManager.stop).toHaveBeenCalled();
    expect(deps.stopCleanup).toHaveBeenCalled();
    expect(deps.stopCacheCleanup).toHaveBeenCalled();
    expect(deps.stopRateLimit).toHaveBeenCalled();
    expect(deps.stopBotCleanup).toHaveBeenCalled();
    expect(deps.monitoringManager.stop).toHaveBeenCalled();
    expect(deps.stopPowerMonitoring).toHaveBeenCalled();
    expect(deps.stopAdminRouterMonitoring).toHaveBeenCalled();
    expect(deps.saveAllUserStates).toHaveBeenCalled();
    expect(deps.stopHealthCheck).toHaveBeenCalled();
    expect(deps.stopPoolMetricsLogging).toHaveBeenCalled();
    expect(deps.closeDatabase).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test('uses runner.stop() when runner is available', async () => {
    const runner = { stop: jest.fn().mockResolvedValue(undefined) };
    const bot = { stop: jest.fn().mockResolvedValue(undefined) };
    const deps = makeDeps({ getRunner: jest.fn().mockReturnValue(runner) });
    const shutdown = createShutdownHandler(bot, deps);

    await shutdown('SIGTERM');

    expect(runner.stop).toHaveBeenCalled();
    expect(bot.stop).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test('ignores duplicate shutdown calls', async () => {
    const bot = { stop: jest.fn().mockResolvedValue(undefined) };
    const deps = makeDeps();
    const shutdown = createShutdownHandler(bot, deps);

    await shutdown('SIGTERM');
    await shutdown('SIGTERM');

    expect(deps.messageQueue.drain).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledTimes(1);
  });

  test('calls process.exit(1) when a shutdown step throws', async () => {
    const bot = { stop: jest.fn().mockResolvedValue(undefined) };
    const deps = makeDeps({
      messageQueue: { drain: jest.fn().mockRejectedValue(new Error('drain failed')) },
    });
    const shutdown = createShutdownHandler(bot, deps);

    await shutdown('SIGTERM');

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
