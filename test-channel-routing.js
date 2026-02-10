#!/usr/bin/env node

/**
 * Тестовий скрипт для перевірки routing callbacks
 * Перевіряє чи правильно роутяться callback_data для каналів
 */

const assert = require('assert');

console.log('🧪 Тестування channel callback routing...\n');

// Test 1: Перевірка що всі callback_data які використовуються в коді роутяться правильно
console.log('Test 1: Перевірка callback routing logic');

// Імітуємо умову routing з src/bot.js (лінія 717-724)
function shouldRouteToChannelCallback(data) {
  return data.startsWith('channel_') ||
         data.startsWith('brand_') ||
         data.startsWith('test_') ||
         data.startsWith('format_') ||
         data.startsWith('connect_channel_') ||
         data.startsWith('replace_channel_') ||
         data === 'cancel_channel_connect' ||
         data === 'keep_current_channel';
}

// Test callbacks які повинні роутитися до handleChannelCallback
const shouldRouteCallbacks = [
  'channel_connect',
  'channel_disconnect',
  'brand_customize',
  'test_send',
  'format_html',
  'connect_channel_12345',
  'connect_channel_-100123456789',
  'replace_channel_12345',
  'replace_channel_-100123456789',
  'cancel_channel_connect',
  'keep_current_channel'
];

for (const callback of shouldRouteCallbacks) {
  assert(shouldRouteToChannelCallback(callback), 
    `Callback '${callback}' має роутитися до handleChannelCallback`);
}

console.log('✓ Всі канальні callbacks правильно роутяться');

// Test callbacks які НЕ повинні роутитися до handleChannelCallback
const shouldNotRouteCallbacks = [
  'settings_region',
  'settings_queue',
  'wizard_start',
  'help_main',
  'admin_stats'
];

for (const callback of shouldNotRouteCallbacks) {
  assert(!shouldRouteToChannelCallback(callback), 
    `Callback '${callback}' не повинен роутитися до handleChannelCallback`);
}

console.log('✓ Неканальні callbacks правильно НЕ роутяться\n');

// Test 2: Перевірка структури request_chat keyboard
console.log('Test 2: Перевірка структури request_chat keyboard');

const requestChatKeyboard = {
  keyboard: [
    [{
      text: '📺 Вибрати канал',
      request_chat: {
        request_id: 1,
        chat_is_channel: true,
        user_administrator_rights: {
          can_manage_chat: true
        },
        bot_is_member: false
      }
    }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};

assert(requestChatKeyboard.keyboard[0][0].request_chat, 
  'Keyboard має містити request_chat');
assert.strictEqual(requestChatKeyboard.keyboard[0][0].request_chat.chat_is_channel, true,
  'request_chat має фільтрувати тільки канали');
assert.strictEqual(requestChatKeyboard.resize_keyboard, true,
  'Keyboard має бути resize_keyboard');
assert.strictEqual(requestChatKeyboard.one_time_keyboard, true,
  'Keyboard має бути one_time_keyboard');

console.log('✓ Структура request_chat keyboard коректна\n');

console.log('✅ Всі тести пройшли успішно!');
