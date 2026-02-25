/**
 * Centralized input validation helpers for callback_data and user-supplied values.
 */

/**
 * Validate and parse a numeric ID from callback_data.
 * Accepts only positive safe integers (no decimals, no negatives).
 * @param {string} raw - Raw string extracted from callback_data
 * @returns {number|null} - Parsed number or null if invalid
 */
function parseCallbackId(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = parseInt(trimmed, 10);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

/**
 * Validate a page number from callback_data.
 * @param {string} raw - Raw page string
 * @param {number} maxPage - Maximum valid page (default 1000)
 * @returns {number} - Valid page number (clamped to 1..maxPage)
 */
function parsePageNumber(raw, maxPage = 1000) {
  if (!raw || typeof raw !== 'string') return 1;
  const n = parseInt(raw, 10);
  if (isNaN(n) || !Number.isSafeInteger(n) || n < 1) return 1;
  return Math.min(n, maxPage);
}

/**
 * Validate a Telegram channel ID (must be a negative integer for channels).
 * @param {string} raw - Raw channel ID string
 * @returns {string|null} - Valid channel ID string or null
 */
function parseChannelId(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^-\d+$/.test(trimmed)) return null;
  const n = parseInt(trimmed, 10);
  if (!Number.isSafeInteger(n) || n >= 0) return null;
  return trimmed;
}

/**
 * Validate a positive integer within range.
 * @param {string} raw - Raw string
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number|null} - Valid number or null
 */
function parseIntInRange(raw, min, max) {
  if (raw === null || raw === undefined || typeof raw !== 'string') return null;
  const n = parseInt(raw, 10);
  if (isNaN(n) || !Number.isSafeInteger(n) || n < min || n > max) return null;
  return n;
}

/**
 * Sanitize a string for safe logging (remove control chars, limit length).
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function sanitizeForLog(text, maxLength = 200) {
  if (!text) return '';
  return String(text)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '')
    .slice(0, maxLength);
}

module.exports = {
  parseCallbackId,
  parsePageNumber,
  parseChannelId,
  parseIntInRange,
  sanitizeForLog,
};
