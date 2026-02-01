const { REGIONS, GROUPS, SUBGROUPS } = require('../constants/regions');

// Головне меню після /start для існуючих користувачів
function getMainMenu() {
  return {
    reply_markup: {
      keyboard: [
        ['📊 Графік', '💡 Статус'],
        ['⚙️ Налаштування', '❓ Допомога'],
      ],
      resize_keyboard: true,
      persistent: true,
    },
  };
}

// Вибір регіону
function getRegionKeyboard() {
  const buttons = [];
  const row = [];
  
  Object.keys(REGIONS).forEach((code, index) => {
    row.push({
      text: REGIONS[code].name,
      callback_data: `region_${code}`,
    });
    
    if (row.length === 2 || index === Object.keys(REGIONS).length - 1) {
      buttons.push([...row]);
      row.length = 0;
    }
  });
  
  return {
    reply_markup: {
      inline_keyboard: buttons,
    },
  };
}

// Вибір черги (без підгруп - прямий список всіх черг)
function getQueueKeyboard() {
  const buttons = [];
  const row = [];
  
  QUEUES.forEach((queue, index) => {
    row.push({
      text: queue,
      callback_data: `queue_${queue}`,
    });
    
    // 3 кнопки в рядку
    if (row.length === 3 || index === QUEUES.length - 1) {
      buttons.push([...row]);
      row.length = 0;
    }
  });
  
  buttons.push([{ text: '« Назад', callback_data: 'back_to_region' }]);
  
  return {
    reply_markup: {
      inline_keyboard: buttons,
    },
  };
}

// Підтвердження налаштувань
function getConfirmKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Підтвердити', callback_data: 'confirm_setup' }],
        [{ text: '🔄 Змінити регіон', callback_data: 'back_to_region' }],
      ],
    },
  };
}

// Меню налаштувань
function getSettingsKeyboard(isAdmin = false) {
  const buttons = [
    [{ text: '📍 Змінити регіон/чергу', callback_data: 'settings_region' }],
    [{ text: '🔔 Налаштування сповіщень', callback_data: 'settings_alerts' }],
    [{ text: '🌐 IP моніторинг', callback_data: 'settings_ip' }],
    [{ text: '📺 Канал', callback_data: 'settings_channel' }],
    [{ text: '🧪 Тест', callback_data: 'settings_test' }],
  ];
  
  if (isAdmin) {
    buttons.push([{ text: '👑 Адмін-панель', callback_data: 'settings_admin' }]);
  }
  
  buttons.push(
    [{ text: '🔴 Деактивувати', callback_data: 'settings_deactivate' }],
    [{ text: '🔙 Назад', callback_data: 'back_to_main' }]
  );
  
  return {
    reply_markup: {
      inline_keyboard: buttons,
    },
  };
}

// Налаштування алертів
function getAlertsSettingsKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Час сповіщення перед відключенням', callback_data: 'alert_off_time' }],
        [{ text: 'Час сповіщення перед включенням', callback_data: 'alert_on_time' }],
        [{ text: 'Увімк/Вимк сповіщення про відключення', callback_data: 'alert_off_toggle' }],
        [{ text: 'Увімк/Вимк сповіщення про включення', callback_data: 'alert_on_toggle' }],
        [{ text: '« Назад', callback_data: 'back_to_settings' }],
      ],
    },
  };
}

// Вибір часу для алертів (5, 10, 15, 30, 60 хвилин)
function getAlertTimeKeyboard(type) {
  const times = [5, 10, 15, 30, 60];
  const buttons = [];
  
  times.forEach(time => {
    buttons.push([{
      text: `${time} хв`,
      callback_data: `alert_time_${type}_${time}`,
    }]);
  });
  
  buttons.push([{ text: '« Назад', callback_data: 'settings_alerts' }]);
  
  return {
    reply_markup: {
      inline_keyboard: buttons,
    },
  };
}

// Адмін меню
function getAdminKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 Статистика', callback_data: 'admin_stats' }],
        [{ text: '👥 Користувачі', callback_data: 'admin_users' }],
        [{ text: '💻 Система', callback_data: 'admin_system' }],
        [{ text: '« Назад', callback_data: 'back_to_main' }],
      ],
    },
  };
}

// Підтвердження деактивації
function getDeactivateConfirmKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Так, деактивувати', callback_data: 'confirm_deactivate' }],
        [{ text: '❌ Скасувати', callback_data: 'back_to_settings' }],
      ],
    },
  };
}

// IP моніторинг меню
function getIpMonitoringKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Налаштувати IP', callback_data: 'ip_setup' }],
        [{ text: '📋 Показати поточний', callback_data: 'ip_show' }],
        [{ text: '🗑️ Видалити IP', callback_data: 'ip_delete' }],
        [{ text: '🔙 Назад', callback_data: 'back_to_settings' }],
      ],
    },
  };
}

// Кнопка скасування для IP setup
function getIpCancelKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '❌ Скасувати', callback_data: 'ip_cancel' }],
      ],
    },
  };
}

// Статистика меню
function getStatisticsKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '⚡ Відключення за тиждень', callback_data: 'stats_week' }],
        [{ text: '📡 Статус пристрою', callback_data: 'stats_device' }],
        [{ text: '⚙️ Мої налаштування', callback_data: 'stats_settings' }],
        [{ text: '🔙 Назад', callback_data: 'back_to_main' }],
      ],
    },
  };
}

// Допомога меню
function getHelpKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📖 Як користуватись', callback_data: 'help_howto' }],
        [{ text: '⚠️ Проблеми та рішення', callback_data: 'help_faq' }],
        [{ text: '🐛 Повідомити про проблему', url: 'https://github.com/Ivan200424/GridBot-feedback/issues/new/choose' }],
        [{ text: '🔙 Назад', callback_data: 'back_to_main' }],
      ],
    },
  };
}

// Канал меню
function getChannelMenuKeyboard(channelUsername = null, isPublic = false) {
  const buttons = [
    [{ text: 'ℹ️ Інфо про канал', callback_data: 'channel_info' }],
    [{ text: '✏️ Змінити канал', callback_data: 'channel_change' }],
    [{ text: '🔕 Вимкнути публікацію', callback_data: 'channel_disable' }],
  ];
  
  // Add "Open channel" button for public channels
  if (isPublic && channelUsername) {
    buttons.unshift([{ text: '📺 Відкрити канал', url: `https://t.me/${channelUsername.replace('@', '')}` }]);
  }
  
  buttons.push([{ text: '🔙 Назад', callback_data: 'back_to_settings' }]);
  
  return {
    reply_markup: {
      inline_keyboard: buttons,
    },
  };
}

// Restoration keyboard for deactivated users
function getRestorationKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Відновити налаштування', callback_data: 'restore_settings' }],
        [{ text: '🆕 Почати заново', callback_data: 'start_new' }],
      ],
    },
  };
}

module.exports = {
  getMainMenu,
  getRegionKeyboard,
  getQueueKeyboard,
  getConfirmKeyboard,
  getSettingsKeyboard,
  getAlertsSettingsKeyboard,
  getAlertTimeKeyboard,
  getAdminKeyboard,
  getDeactivateConfirmKeyboard,
  getIpMonitoringKeyboard,
  getIpCancelKeyboard,
  getStatisticsKeyboard,
  getHelpKeyboard,
  getChannelMenuKeyboard,
  getRestorationKeyboard,
};
