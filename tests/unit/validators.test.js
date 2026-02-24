const {
  parseCallbackId,
  parsePageNumber,
  parseChannelId,
  parseIntInRange,
  sanitizeForLog,
} = require('../../src/utils/validators');

describe('parseCallbackId', () => {
  test('returns number for valid positive integer string', () => {
    expect(parseCallbackId('42')).toBe(42);
    expect(parseCallbackId('1')).toBe(1);
    expect(parseCallbackId('999999')).toBe(999999);
  });

  test('returns null for negative number strings', () => {
    expect(parseCallbackId('-1')).toBeNull();
    expect(parseCallbackId('-100')).toBeNull();
  });

  test('returns null for zero', () => {
    expect(parseCallbackId('0')).toBeNull();
  });

  test('returns null for NaN', () => {
    expect(parseCallbackId('abc')).toBeNull();
    expect(parseCallbackId('NaN')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(parseCallbackId('')).toBeNull();
  });

  test('returns null for non-numeric strings', () => {
    expect(parseCallbackId('42abc')).toBeNull();
    expect(parseCallbackId('abc42')).toBeNull();
    expect(parseCallbackId('timer_42')).toBeNull();
  });

  test('returns null for decimal numbers', () => {
    expect(parseCallbackId('42.5')).toBeNull();
  });

  test('returns null for very large (unsafe) numbers', () => {
    expect(parseCallbackId('99999999999999999999')).toBeNull();
  });

  test('returns null for null/undefined input', () => {
    expect(parseCallbackId(null)).toBeNull();
    expect(parseCallbackId(undefined)).toBeNull();
  });
});

describe('parsePageNumber', () => {
  test('returns parsed page for valid positive integer', () => {
    expect(parsePageNumber('1')).toBe(1);
    expect(parsePageNumber('5')).toBe(5);
    expect(parsePageNumber('100')).toBe(100);
  });

  test('returns 1 for zero', () => {
    expect(parsePageNumber('0')).toBe(1);
  });

  test('returns 1 for negative values', () => {
    expect(parsePageNumber('-1')).toBe(1);
    expect(parsePageNumber('-100')).toBe(1);
  });

  test('returns 1 for non-numeric string', () => {
    expect(parsePageNumber('abc')).toBe(1);
    expect(parsePageNumber('')).toBe(1);
    expect(parsePageNumber(null)).toBe(1);
  });

  test('clamps to maxPage when exceeded', () => {
    expect(parsePageNumber('9999', 100)).toBe(100);
    expect(parsePageNumber('101', 100)).toBe(100);
  });

  test('uses default maxPage of 1000', () => {
    expect(parsePageNumber('1001')).toBe(1000);
    expect(parsePageNumber('999')).toBe(999);
  });

  test('returns 1 for unsafe large numbers', () => {
    expect(parsePageNumber('99999999999999999999')).toBe(1);
  });
});

describe('parseChannelId', () => {
  test('returns string for valid negative channel IDs', () => {
    expect(parseChannelId('-1001234567890')).toBe('-1001234567890');
    expect(parseChannelId('-100')).toBe('-100');
    expect(parseChannelId('-1')).toBe('-1');
  });

  test('returns null for positive integers (not a channel)', () => {
    expect(parseChannelId('1234567890')).toBeNull();
    expect(parseChannelId('100')).toBeNull();
  });

  test('returns null for zero', () => {
    expect(parseChannelId('0')).toBeNull();
  });

  test('returns null for non-numeric strings', () => {
    expect(parseChannelId('abc')).toBeNull();
    expect(parseChannelId('-abc')).toBeNull();
    expect(parseChannelId('channel_123')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(parseChannelId('')).toBeNull();
    expect(parseChannelId(null)).toBeNull();
  });

  test('returns null for unsafe large negative numbers', () => {
    expect(parseChannelId('-99999999999999999999')).toBeNull();
  });
});

describe('parseIntInRange', () => {
  test('returns number when within range', () => {
    expect(parseIntInRange('5', 1, 10)).toBe(5);
    expect(parseIntInRange('1', 1, 10)).toBe(1);
    expect(parseIntInRange('10', 1, 10)).toBe(10);
  });

  test('returns null when below minimum', () => {
    expect(parseIntInRange('0', 1, 10)).toBeNull();
    expect(parseIntInRange('-1', 1, 10)).toBeNull();
  });

  test('returns null when above maximum', () => {
    expect(parseIntInRange('11', 1, 10)).toBeNull();
    expect(parseIntInRange('100', 1, 10)).toBeNull();
  });

  test('returns null for non-numeric string', () => {
    expect(parseIntInRange('abc', 1, 10)).toBeNull();
    expect(parseIntInRange('', 1, 10)).toBeNull();
  });

  test('returns null for null/undefined', () => {
    expect(parseIntInRange(null, 1, 10)).toBeNull();
    expect(parseIntInRange(undefined, 1, 10)).toBeNull();
  });

  test('accepts zero when min is 0', () => {
    expect(parseIntInRange('0', 0, 120)).toBe(0);
  });

  test('returns null for unsafe large numbers', () => {
    expect(parseIntInRange('99999999999999999999', 1, 100)).toBeNull();
  });
});

describe('sanitizeForLog', () => {
  test('returns the same string for normal input', () => {
    expect(sanitizeForLog('Hello world')).toBe('Hello world');
  });

  test('removes control characters', () => {
    expect(sanitizeForLog('Hello\x00World')).toBe('HelloWorld');
    expect(sanitizeForLog('line1\nline2')).toBe('line1line2');
    expect(sanitizeForLog('tab\there')).toBe('tabhere');
  });

  test('limits length to maxLength', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeForLog(long)).toHaveLength(200);
    expect(sanitizeForLog(long, 50)).toHaveLength(50);
  });

  test('returns empty string for falsy input', () => {
    expect(sanitizeForLog('')).toBe('');
    expect(sanitizeForLog(null)).toBe('');
    expect(sanitizeForLog(undefined)).toBe('');
  });

  test('converts non-string to string before processing', () => {
    expect(sanitizeForLog(42)).toBe('42');
  });
});
