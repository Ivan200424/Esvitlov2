/**
 * Inline Keyboard Implementation
 * 
 * NEW implementation for v2 bot rewrite.
 * 
 * Inline keyboards are used for ALL actions, flows, confirmations, and navigation.
 * Every flow screen MUST include navigation buttons (← Назад and/or ⤴ Меню).
 */

const { REGIONS } = require('../../constants/regions');

/**
 * Create a back button
 * @param {string} callbackData - Callback data for back action
 */
function createBackButton(callbackData = 'back') {
  return { text: '← Назад', callback_data: callbackData };
}

/**
 * Create a menu button
 * @param {string} callbackData - Callback data for menu action
 */
function createMenuButton(callbackData = 'menu') {
  return { text: '⤴ Меню', callback_data: callbackData };
}

/**
 * Create a cancel button
 * @param {string} callbackData - Callback data for cancel action
 */
function createCancelButton(callbackData = 'cancel') {
  return { text: '✖️ Скасувати', callback_data: callbackData };
}

/**
 * Region selection keyboard (onboarding step 1)
 */
function getRegionKeyboard() {
  const buttons = [];
  const regionEntries = Object.entries(REGIONS);
  
  // Create rows with 2 buttons each
  for (let i = 0; i < regionEntries.length; i += 2) {
    const row = [];
    row.push({
      text: regionEntries[i][1],
      callback_data: `region:${regionEntries[i][0]}`
    });
    
    if (i + 1 < regionEntries.length) {
      row.push({
        text: regionEntries[i + 1][1],
        callback_data: `region:${regionEntries[i + 1][0]}`
      });
    }
    
    buttons.push(row);
  }
  
  return { inline_keyboard: buttons };
}

/**
 * Queue selection keyboard (onboarding step 2)
 * @param {string} region - Selected region
 */
function getQueueKeyboard(region) {
  const queues = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2'];
  const buttons = [];
  
  // Create rows with 3 buttons each
  for (let i = 0; i < queues.length; i += 3) {
    const row = queues.slice(i, i + 3).map(queue => ({
      text: `Черга ${queue}`,
      callback_data: `queue:${queue}`
    }));
    buttons.push(row);
  }
  
  // Add back button
  buttons.push([createBackButton('onboarding:back_to_region')]);
  
  return { inline_keyboard: buttons };
}

/**
 * Notification target selection keyboard (onboarding step 3)
 */
function getNotificationTargetKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🤖 У бот', callback_data: 'notify_target:bot' }],
      [{ text: '📢 У канал', callback_data: 'notify_target:channel' }],
      [{ text: '💬 У бот і канал', callback_data: 'notify_target:both' }],
      [createBackButton('onboarding:back_to_queue')]
    ]
  };
}

/**
 * Onboarding confirmation keyboard
 * @param {Object} data - User data to confirm
 */
function getConfirmationKeyboard(data) {
  return {
    inline_keyboard: [
      [{ text: '✅ Підтвердити', callback_data: 'onboarding:confirm' }],
      [{ text: '✏️ Змінити регіон', callback_data: 'onboarding:change_region' }],
      [{ text: '✏️ Змінити чергу', callback_data: 'onboarding:change_queue' }],
      [createCancelButton('onboarding:cancel')]
    ]
  };
}

/**
 * Main menu inline keyboard (for schedule, stats, etc.)
 * This is shown on the main menu message, NOT as reply keyboard
 */
function getMainMenuInlineKeyboard(hasChannel = false) {
  const buttons = [
    [
      { text: '📊 Графік', callback_data: 'main:schedule' },
      { text: '⏱ Таймер', callback_data: 'main:timer' }
    ],
    [
      { text: '📈 Статистика', callback_data: 'main:statistics' },
      { text: '❓ Допомога', callback_data: 'main:help' }
    ],
    [
      { text: '⚙️ Налаштування', callback_data: 'main:settings' }
    ]
  ];

  // Add pause/resume button if channel is connected
  if (hasChannel) {
    buttons.push([
      { text: '⏸ Пауза', callback_data: 'main:pause' }
    ]);
  }

  return { inline_keyboard: buttons };
}

/**
 * Settings menu keyboard
 */
function getSettingsKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📍 Регіон та черга', callback_data: 'settings:region_queue' }],
      [{ text: '🔔 Сповіщення', callback_data: 'settings:notifications' }],
      [{ text: '🌐 IP моніторинг', callback_data: 'settings:ip_monitoring' }],
      [{ text: '📢 Підключити канал', callback_data: 'settings:channel' }],
      [{ text: '🎨 Формат повідомлень', callback_data: 'settings:format' }],
      [createMenuButton('main:menu')]
    ]
  };
}

/**
 * Schedule view keyboard
 */
function getScheduleKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '⏱ Таймер', callback_data: 'schedule:timer' },
        { text: '🔄 Оновити', callback_data: 'schedule:refresh' }
      ],
      [createMenuButton('main:menu')]
    ]
  };
}

/**
 * Timer view keyboard
 */
function getTimerKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '📊 Графік', callback_data: 'timer:schedule' },
        { text: '🔄 Оновити', callback_data: 'timer:refresh' }
      ],
      [createMenuButton('main:menu')]
    ]
  };
}

/**
 * Statistics keyboard
 */
function getStatisticsKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📊 За день', callback_data: 'stats:day' }],
      [{ text: '📊 За тиждень', callback_data: 'stats:week' }],
      [{ text: '📊 За місяць', callback_data: 'stats:month' }],
      [createMenuButton('main:menu')]
    ]
  };
}

/**
 * Help keyboard
 */
function getHelpKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📖 Як користуватись', callback_data: 'help:howto' }],
      [{ text: '❓ Часті питання', callback_data: 'help:faq' }],
      [{ text: '💬 Підтримка', url: 'https://t.me/voltyk_support' }],
      [createMenuButton('main:menu')]
    ]
  };
}

/**
 * Generic back and menu navigation
 * @param {string} backCallback - Callback for back button
 * @param {boolean} includeMenu - Whether to include menu button
 */
function getNavigationKeyboard(backCallback, includeMenu = true) {
  const buttons = [[createBackButton(backCallback)]];
  
  if (includeMenu) {
    buttons[0].push(createMenuButton('main:menu'));
  }
  
  return { inline_keyboard: buttons };
}

/**
 * Error keyboard (when something goes wrong)
 */
function getErrorKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🔄 Спробувати ще раз', callback_data: 'error:retry' }],
      [createMenuButton('main:menu')]
    ]
  };
}

module.exports = {
  createBackButton,
  createMenuButton,
  createCancelButton,
  getRegionKeyboard,
  getQueueKeyboard,
  getNotificationTargetKeyboard,
  getConfirmationKeyboard,
  getMainMenuInlineKeyboard,
  getSettingsKeyboard,
  getScheduleKeyboard,
  getTimerKeyboard,
  getStatisticsKeyboard,
  getHelpKeyboard,
  getNavigationKeyboard,
  getErrorKeyboard
};
