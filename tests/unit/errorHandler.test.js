jest.mock('grammy', () => ({
  InputFile: class InputFile {
    constructor(data, filename) {
      this.data = data;
      this.filename = filename;
    }
  },
}));

const {
  isTelegramUserInactiveError,
  safeAnswerCallbackQuery,
  safeEditMessageText,
  safeSendMessage,
  safeDeleteMessage,
} = require('../../src/utils/errorHandler');

describe('isTelegramUserInactiveError', () => {
  test('returns true for "bot was blocked by the user"', () => {
    expect(isTelegramUserInactiveError({ message: 'bot was blocked by the user' })).toBe(true);
  });

  test('returns true for "user is deactivated"', () => {
    expect(isTelegramUserInactiveError({ message: 'user is deactivated' })).toBe(true);
  });

  test('returns true for "chat not found"', () => {
    expect(isTelegramUserInactiveError({ message: 'chat not found' })).toBe(true);
  });

  test('returns false for other errors', () => {
    expect(isTelegramUserInactiveError({ message: 'some other error' })).toBe(false);
    expect(isTelegramUserInactiveError({ message: 'network timeout' })).toBe(false);
  });

  test('checks description field', () => {
    expect(
      isTelegramUserInactiveError({ message: '', description: 'bot was blocked by the user' })
    ).toBe(true);
  });

  test('checks nested response body description', () => {
    expect(
      isTelegramUserInactiveError({ message: '', response: { body: { description: 'chat not found' } } })
    ).toBe(true);
  });
});

describe('safeSendMessage', () => {
  test('returns message object on success', async () => {
    const mockMsg = { message_id: 1 };
    const bot = { api: { sendMessage: jest.fn().mockResolvedValue(mockMsg) } };
    const result = await safeSendMessage(bot, 123, 'hello');
    expect(result).toBe(mockMsg);
    expect(bot.api.sendMessage).toHaveBeenCalledWith(123, 'hello', {});
  });

  test('returns null when user is inactive', async () => {
    const bot = {
      api: { sendMessage: jest.fn().mockRejectedValue(new Error('bot was blocked by the user')) },
    };
    const result = await safeSendMessage(bot, 123, 'hello');
    expect(result).toBeNull();
  });

  test('returns null on other errors', async () => {
    const bot = { api: { sendMessage: jest.fn().mockRejectedValue(new Error('network error')) } };
    const result = await safeSendMessage(bot, 123, 'hello');
    expect(result).toBeNull();
  });

  test('passes options to sendMessage', async () => {
    const bot = { api: { sendMessage: jest.fn().mockResolvedValue({}) } };
    await safeSendMessage(bot, 456, 'text', { parse_mode: 'HTML' });
    expect(bot.api.sendMessage).toHaveBeenCalledWith(456, 'text', { parse_mode: 'HTML' });
  });
});

describe('safeDeleteMessage', () => {
  test('returns true on success', async () => {
    const bot = { api: { deleteMessage: jest.fn().mockResolvedValue(true) } };
    const result = await safeDeleteMessage(bot, 123, 456);
    expect(result).toBe(true);
    expect(bot.api.deleteMessage).toHaveBeenCalledWith(123, 456);
  });

  test('returns false when delete fails', async () => {
    const bot = {
      api: { deleteMessage: jest.fn().mockRejectedValue(new Error('message not found')) },
    };
    const result = await safeDeleteMessage(bot, 123, 456);
    expect(result).toBe(false);
  });
});

describe('safeEditMessageText', () => {
  test('returns edited message on success', async () => {
    const mockMsg = { message_id: 456 };
    const bot = { api: { editMessageText: jest.fn().mockResolvedValue(mockMsg) } };
    const result = await safeEditMessageText(bot, 'new text', { chat_id: 123, message_id: 456 });
    expect(result).toBe(mockMsg);
    expect(bot.api.editMessageText).toHaveBeenCalledWith(123, 456, 'new text', {});
  });

  test('passes extra options to editMessageText', async () => {
    const bot = { api: { editMessageText: jest.fn().mockResolvedValue({}) } };
    await safeEditMessageText(bot, 'text', { chat_id: 1, message_id: 2, parse_mode: 'HTML' });
    expect(bot.api.editMessageText).toHaveBeenCalledWith(1, 2, 'text', { parse_mode: 'HTML' });
  });

  test('returns null for "message is not modified" error', async () => {
    const error = new Error('message is not modified');
    const bot = { api: { editMessageText: jest.fn().mockRejectedValue(error) } };
    const result = await safeEditMessageText(bot, 'text', { chat_id: 123, message_id: 456 });
    expect(result).toBeNull();
  });

  test('throws for "there is no text in the message to edit" error', async () => {
    const error = new Error('there is no text in the message to edit');
    const bot = { api: { editMessageText: jest.fn().mockRejectedValue(error) } };
    await expect(
      safeEditMessageText(bot, 'text', { chat_id: 123, message_id: 456 })
    ).rejects.toThrow('there is no text in the message to edit');
  });

  test('throws for other errors', async () => {
    const error = new Error('some api error');
    const bot = { api: { editMessageText: jest.fn().mockRejectedValue(error) } };
    await expect(
      safeEditMessageText(bot, 'text', { chat_id: 123, message_id: 456 })
    ).rejects.toThrow('some api error');
  });
});

describe('safeAnswerCallbackQuery', () => {
  test('returns true when call succeeds', async () => {
    const bot = { api: { answerCallbackQuery: jest.fn().mockResolvedValue(true) } };
    const result = await safeAnswerCallbackQuery(bot, 'query_id', {});
    expect(result).toBe(true);
    expect(bot.api.answerCallbackQuery).toHaveBeenCalledWith('query_id', {});
  });

  test('returns false when call fails', async () => {
    const bot = {
      api: { answerCallbackQuery: jest.fn().mockRejectedValue(new Error('API error')) },
    };
    const result = await safeAnswerCallbackQuery(bot, 'query_id');
    expect(result).toBe(false);
  });

  test('passes options to answerCallbackQuery', async () => {
    const bot = { api: { answerCallbackQuery: jest.fn().mockResolvedValue(true) } };
    await safeAnswerCallbackQuery(bot, 'qid', { text: 'ok', show_alert: true });
    expect(bot.api.answerCallbackQuery).toHaveBeenCalledWith('qid', { text: 'ok', show_alert: true });
  });
});
