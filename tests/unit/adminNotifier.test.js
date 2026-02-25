jest.mock('../../src/config', () => ({
  ownerId: '111',
  adminIds: ['222', '333'],
}));

const { notifyAdminsAboutError, stopCleanup } = require('../../src/utils/adminNotifier');

describe('notifyAdminsAboutError', () => {
  let bot;

  beforeEach(() => {
    stopCleanup();
    bot = { api: { sendMessage: jest.fn().mockResolvedValue({}) } };
  });

  test('sends message to ownerId and all adminIds', async () => {
    await notifyAdminsAboutError(bot, new Error('test error'), 'test context');
    expect(bot.api.sendMessage).toHaveBeenCalledTimes(3);
    expect(bot.api.sendMessage).toHaveBeenCalledWith('111', expect.any(String), { parse_mode: 'HTML' });
    expect(bot.api.sendMessage).toHaveBeenCalledWith('222', expect.any(String), { parse_mode: 'HTML' });
    expect(bot.api.sendMessage).toHaveBeenCalledWith('333', expect.any(String), { parse_mode: 'HTML' });
  });

  test('does not send same error twice within the rate limit window', async () => {
    const error = new Error('repeated error');
    await notifyAdminsAboutError(bot, error, 'context');
    await notifyAdminsAboutError(bot, error, 'context');
    // Only 3 calls (one per admin on the first invocation, second is rate-limited)
    expect(bot.api.sendMessage).toHaveBeenCalledTimes(3);
  });

  test('does nothing when bot is null', async () => {
    await expect(notifyAdminsAboutError(null, new Error('test'), 'ctx')).resolves.toBeUndefined();
  });

  test('skips notification for "bot was blocked by the user" errors', async () => {
    await notifyAdminsAboutError(bot, new Error('bot was blocked by the user'), 'ctx');
    expect(bot.api.sendMessage).not.toHaveBeenCalled();
  });

  test('skips notification for "chat not found" errors', async () => {
    await notifyAdminsAboutError(bot, new Error('chat not found'), 'ctx');
    expect(bot.api.sendMessage).not.toHaveBeenCalled();
  });

  test('escapes HTML in error messages', async () => {
    await notifyAdminsAboutError(bot, new Error('<script>xss</script>'), 'ctx');
    const sentText = bot.api.sendMessage.mock.calls[0][1];
    expect(sentText).toContain('&lt;script&gt;xss&lt;/script&gt;');
    expect(sentText).not.toContain('<script>');
  });

  test('escapes HTML in context string', async () => {
    await notifyAdminsAboutError(bot, new Error('err'), '<bad>context</bad>');
    const sentText = bot.api.sendMessage.mock.calls[0][1];
    expect(sentText).toContain('&lt;bad&gt;context&lt;/bad&gt;');
  });

  test('accepts string error instead of Error object', async () => {
    await notifyAdminsAboutError(bot, 'plain string error', 'ctx');
    expect(bot.api.sendMessage).toHaveBeenCalledTimes(3);
  });

  test('swallows errors from individual admin sendMessage failures', async () => {
    bot.api.sendMessage.mockRejectedValue(new Error('send failed'));
    await expect(
      notifyAdminsAboutError(bot, new Error('test'), 'ctx')
    ).resolves.toBeUndefined();
  });
});

describe('stopCleanup', () => {
  test('stops cleanup without throwing', () => {
    expect(() => stopCleanup()).not.toThrow();
  });

  test('can be called multiple times without error', () => {
    expect(() => {
      stopCleanup();
      stopCleanup();
    }).not.toThrow();
  });
});
