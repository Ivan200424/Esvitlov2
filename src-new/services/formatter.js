// Formatter for schedule messages
import { createRequire } from 'module';
import { REGIONS } from '../config/constants.js';

const require = createRequire(import.meta.url);

// Import existing formatter
const formatter = require('../../src/formatter.js');

export function formatScheduleMessage(region, queue, scheduleData, nextEvent, changes = null, updateType = null, isChannel = false) {
  return formatter.formatScheduleMessage(region, queue, scheduleData, nextEvent, changes, updateType, isChannel);
}

export function formatNextEventMessage(nextEvent) {
  return formatter.formatNextEventMessage(nextEvent);
}

export function formatTimerMessage(nextEvent) {
  return formatter.formatTimerMessage(nextEvent);
}

export function formatWelcomeMessage(username) {
  return formatter.formatWelcomeMessage(username);
}

export function formatHelpMessage() {
  return formatter.formatHelpMessage();
}

export function formatErrorMessage(error) {
  return formatter.formatErrorMessage(error);
}

// Export utils for formatting
export { default as formatTime } from '../../src/utils.js';
