// Parser for schedule data from outage-data-ua
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Import existing parser
const parser = require('../../src/parser.js');

export function parseScheduleForQueue(data, queue) {
  return parser.parseScheduleForQueue(data, queue);
}

export function getNextEvent(scheduleData) {
  return parser.getNextEvent(scheduleData);
}

export function detectScheduleChanges(oldData, newData, queue) {
  return parser.detectScheduleChanges(oldData, newData, queue);
}
