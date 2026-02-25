jest.mock('../../src/database/db', () => ({
  getSetting: jest.fn(),
}));

jest.mock('../../src/logger', () => ({
  child: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const { getSetting } = require('../../src/database/db');
const {
  isBotPaused,
  getPauseMessage,
  checkPauseForChannelActions,
} = require('../../src/utils/guards');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isBotPaused', () => {
  test('returns true when bot_paused setting is "1"', async () => {
    getSetting.mockResolvedValue('1');
    expect(await isBotPaused()).toBe(true);
    expect(getSetting).toHaveBeenCalledWith('bot_paused', '0');
  });

  test('returns false when bot_paused setting is "0"', async () => {
    getSetting.mockResolvedValue('0');
    expect(await isBotPaused()).toBe(false);
  });

  test('returns false when bot_paused setting is missing (default "0")', async () => {
    getSetting.mockResolvedValue('0');
    expect(await isBotPaused()).toBe(false);
  });
});

describe('getPauseMessage', () => {
  test('returns the pause message from settings', async () => {
    getSetting.mockResolvedValue('Технічне обслуговування');
    const msg = await getPauseMessage();
    expect(msg).toBe('Технічне обслуговування');
    expect(getSetting).toHaveBeenCalledWith(
      'pause_message',
      '🔧 Бот тимчасово недоступний. Спробуйте пізніше.'
    );
  });

  test('returns default message when setting is not set', async () => {
    getSetting.mockResolvedValue('🔧 Бот тимчасово недоступний. Спробуйте пізніше.');
    const msg = await getPauseMessage();
    expect(msg).toBe('🔧 Бот тимчасово недоступний. Спробуйте пізніше.');
  });
});

describe('checkPauseForChannelActions', () => {
  test('returns { blocked: false } when bot is not paused', async () => {
    getSetting.mockResolvedValue('0');
    const result = await checkPauseForChannelActions();
    expect(result).toEqual({ blocked: false });
  });

  test('returns { blocked: true, message, showSupport } when bot is paused', async () => {
    getSetting.mockImplementation((key, defaultValue) => {
      if (key === 'bot_paused') return Promise.resolve('1');
      if (key === 'pause_message') return Promise.resolve('На паузі');
      if (key === 'pause_show_support') return Promise.resolve('1');
      return Promise.resolve(defaultValue);
    });

    const result = await checkPauseForChannelActions();
    expect(result.blocked).toBe(true);
    expect(result.message).toBe('На паузі');
    expect(result.showSupport).toBe(true);
  });

  test('showSupport is false when pause_show_support is "0"', async () => {
    getSetting.mockImplementation((key, defaultValue) => {
      if (key === 'bot_paused') return Promise.resolve('1');
      if (key === 'pause_message') return Promise.resolve('На паузі');
      if (key === 'pause_show_support') return Promise.resolve('0');
      return Promise.resolve(defaultValue);
    });

    const result = await checkPauseForChannelActions();
    expect(result.blocked).toBe(true);
    expect(result.showSupport).toBe(false);
  });
});
