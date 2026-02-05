#!/usr/bin/env node

/**
 * Тест нової логіки публікації графіків відключень
 * 
 * Перевіряє:
 * - Обчислення хешів тільки з періодів відключень
 * - Порівняння графіків сьогодні/завтра
 * - Перехід календарного дня
 * - Форматування повідомлень
 */

console.log('🧪 Тестування нової логіки публікації графіків\n');

const { calculateScheduleHash } = require('./src/utils');
const { formatScheduleMessageNew } = require('./src/formatter');

// Тест 1: Обчислення хешу з періодів відключень
console.log('📝 Тест 1: Обчислення хешу з періодів відключень');

const events1 = [
  { start: '2026-02-05T10:00:00Z', end: '2026-02-05T12:00:00Z' },
  { start: '2026-02-05T15:00:00Z', end: '2026-02-05T17:00:00Z' }
];

const events2 = [
  { start: '2026-02-05T10:00:00Z', end: '2026-02-05T12:00:00Z' },
  { start: '2026-02-05T15:00:00Z', end: '2026-02-05T17:00:00Z' }
];

const events3 = [
  { start: '2026-02-05T10:00:00Z', end: '2026-02-05T13:00:00Z' }, // інша тривалість
  { start: '2026-02-05T15:00:00Z', end: '2026-02-05T17:00:00Z' }
];

const hash1 = calculateScheduleHash(events1);
const hash2 = calculateScheduleHash(events2);
const hash3 = calculateScheduleHash(events3);

console.log(`Hash 1: ${hash1}`);
console.log(`Hash 2: ${hash2}`);
console.log(`Hash 3: ${hash3}`);

if (hash1 === hash2) {
  console.log('✅ Однакові графіки мають однаковий хеш');
} else {
  console.log('❌ ПОМИЛКА: Однакові графіки повинні мати однаковий хеш');
}

if (hash1 !== hash3) {
  console.log('✅ Різні графіки мають різний хеш');
} else {
  console.log('❌ ПОМИЛКА: Різні графіки повинні мати різний хеш');
}

console.log('');

// Тест 2: Хеш для порожнього графіка
console.log('📝 Тест 2: Хеш для порожнього графіка');

const emptyHash = calculateScheduleHash([]);
console.log(`Empty hash: ${emptyHash}`);

if (emptyHash === null) {
  console.log('✅ Порожній графік повертає null');
} else {
  console.log('❌ ПОМИЛКА: Порожній графік повинен повертати null');
}

console.log('');

// Тест 3: Форматування повідомлення - перша публікація сьогодні
console.log('📝 Тест 3: Форматування повідомлення - перша публікація сьогодні');

const todayEvents = [
  { start: '2026-02-05T10:00:00Z', end: '2026-02-05T12:00:00Z' },
  { start: '2026-02-05T15:00:00Z', end: '2026-02-05T17:00:00Z' }
];

const updateContext1 = {
  todayChanged: true,
  tomorrowChanged: false,
  todayFirstAppearance: true,
  tomorrowFirstAppearance: false,
  todayUnchanged: false,
  todayDate: '2026-02-05',
  tomorrowDate: '2026-02-06'
};

const message1 = formatScheduleMessageNew('kyiv', '1', todayEvents, [], updateContext1);
console.log(message1);

if (message1.includes('📊 Графік відключень на сьогодні')) {
  console.log('✅ Правильний заголовок для першої публікації');
} else {
  console.log('❌ ПОМИЛКА: Неправильний заголовок для першої публікації');
}

console.log('');

// Тест 4: Форматування повідомлення - оновлення сьогодні
console.log('📝 Тест 4: Форматування повідомлення - оновлення сьогодні');

const updateContext2 = {
  todayChanged: true,
  tomorrowChanged: false,
  todayFirstAppearance: false,
  tomorrowFirstAppearance: false,
  todayUnchanged: false,
  todayDate: '2026-02-05',
  tomorrowDate: '2026-02-06'
};

const message2 = formatScheduleMessageNew('kyiv', '1', todayEvents, [], updateContext2);
console.log(message2);

if (message2.includes('💡 Оновлено графік відключень на сьогодні')) {
  console.log('✅ Правильний заголовок для оновлення сьогодні');
} else {
  console.log('❌ ПОМИЛКА: Неправильний заголовок для оновлення сьогодні');
}

console.log('');

// Тест 5: Форматування повідомлення - перша поява завтра
console.log('📝 Тест 5: Форматування повідомлення - перша поява завтра');

const tomorrowEvents = [
  { start: '2026-02-06T10:00:00Z', end: '2026-02-06T12:00:00Z' }
];

const updateContext3 = {
  todayChanged: false,
  tomorrowChanged: true,
  todayFirstAppearance: false,
  tomorrowFirstAppearance: true,
  todayUnchanged: true,
  todayDate: '2026-02-05',
  tomorrowDate: '2026-02-06'
};

const message3 = formatScheduleMessageNew('kyiv', '1', todayEvents, tomorrowEvents, updateContext3);
console.log(message3);

if (message3.includes('💡 Зʼявився графік відключень на завтра')) {
  console.log('✅ Правильний заголовок для першої появи завтра');
} else {
  console.log('❌ ПОМИЛКА: Неправильний заголовок для першої появи завтра');
}

console.log('');

// Тест 6: Форматування повідомлення - завтра змінився, сьогодні без змін
console.log('📝 Тест 6: Форматування повідомлення - завтра змінився, сьогодні без змін');

const updateContext4 = {
  todayChanged: false,
  tomorrowChanged: true,
  todayFirstAppearance: false,
  tomorrowFirstAppearance: true,
  todayUnchanged: true,
  todayDate: '2026-02-05',
  tomorrowDate: '2026-02-06'
};

const message4 = formatScheduleMessageNew('kyiv', '1', todayEvents, tomorrowEvents, updateContext4);
console.log(message4);

if (message4.includes('💡 Зʼявився графік відключень на завтра') && 
    message4.includes('💡 Графік на сьогодні — без змін:')) {
  console.log('✅ Правильне форматування для двох блоків (завтра + сьогодні без змін)');
} else {
  console.log('❌ ПОМИЛКА: Неправильне форматування для двох блоків');
}

console.log('');

// Тест 7: Обчислення хешу стабільне при зміні порядку
console.log('📝 Тест 7: Обчислення хешу стабільне при зміні порядку');

const eventsOrdered = [
  { start: '2026-02-05T10:00:00Z', end: '2026-02-05T12:00:00Z' },
  { start: '2026-02-05T15:00:00Z', end: '2026-02-05T17:00:00Z' }
];

const eventsReversed = [
  { start: '2026-02-05T15:00:00Z', end: '2026-02-05T17:00:00Z' },
  { start: '2026-02-05T10:00:00Z', end: '2026-02-05T12:00:00Z' }
];

const hashOrdered = calculateScheduleHash(eventsOrdered);
const hashReversed = calculateScheduleHash(eventsReversed);

console.log(`Hash ordered: ${hashOrdered}`);
console.log(`Hash reversed: ${hashReversed}`);

if (hashOrdered === hashReversed) {
  console.log('✅ Хеш стабільний незалежно від порядку елементів');
} else {
  console.log('❌ ПОМИЛКА: Хеш повинен бути стабільним незалежно від порядку');
}

console.log('');
console.log('✅ Всі тести завершено!');
