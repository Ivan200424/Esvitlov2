const { REGIONS, GROUPS, SUBGROUPS, QUEUES } = require('../constants/regions');

// Головне меню після /start для існуючих користувачів
function getMainMenu(botStatus = 'active') {
  // Визначаємо текст статусу
  let statusText = '🟢 Бот активний';
  if (botStatus === 'no_channel') {
    statusText = '🟡 Без каналу';
  } else if (botStatus === 'paused') {
    statusText = '🔴 Пауза';
  }
  
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📊 Графік', callback_data: 'menu_schedule' },
          { text: '⏱ Таймер', callback_data: 'menu_timer' }
        ],
        [
          { text: '📈 Статистика', callback_data: 'menu_stats' },
          { text: '❓ Допомога', callback_data: 'menu_help' }
        ],
        [
          { text: '⚙️ Налаштування', callback_data: 'menu_settings' }
        ],
        [
          { text: statusText, callback_data: 'menu_status' }
        ],
      ],
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
  
  buttons.push([{ text: '← Назад', callback_data: 'back_to_region' }]);
  
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
        [{ text: '✓ Підтвердити', callback_data: 'confirm_setup' }],
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
  ];
  
  if (isAdmin) {
    buttons.push([{ text: '👑 Адмін-панель', callback_data: 'settings_admin' }]);
  }
  
  buttons.push(
    [{ text: '🗑️ Видалити мої дані', callback_data: 'settings_delete_data' }],
    [
      { text: '← Назад', callback_data: 'back_to_main' }
    ]
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
        [
          { text: '← Назад', callback_data: 'back_to_settings' },
          { text: '⤴︎ Меню', callback_data: 'back_to_main' }
        ],
      ],
    },
  };
}

// Вибір часу для алертів (5, 10, 15, 30, 60 хвилин + вимкнути)
function getAlertTimeKeyboard(type) {
  const times = [5, 10, 15, 30, 60];
  const buttons = [];
  
  // Add time options in rows of 3
  const row = [];
  times.forEach((time, index) => {
    row.push({
      text: `${time} хв`,
      callback_data: `alert_time_${type}_${time}`,
    });
    
    if (row.length === 3 || index === times.length - 1) {
      buttons.push([...row]);
      row.length = 0;
    }
  });
  
  // Add disable option
  buttons.push([{
    text: '✕ Вимкнути',
    callback_data: `alert_time_${type}_0`,
  }]);
  
  buttons.push([
    { text: '← Назад', callback_data: 'settings_alerts' },
    { text: '⤴︎ Меню', callback_data: 'back_to_main' }
  ]);
  
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
        [{ text: '⏱️ Інтервали', callback_data: 'admin_intervals' }],
        [{ text: '⏸️ Режим паузи', callback_data: 'admin_pause' }],
        [{ text: '💻 Система', callback_data: 'admin_system' }],
        [
          { text: '← Назад', callback_data: 'menu_settings' },
          { text: '⤴︎ Меню', callback_data: 'back_to_main' }
        ],
      ],
    },
  };
}

// Меню інтервалів (адмін)
function getAdminIntervalsKeyboard(currentScheduleInterval, currentIpInterval) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: `⏱ Графіки: ${currentScheduleInterval} хв`, callback_data: 'admin_interval_schedule' }],
        [{ text: `📡 IP: ${currentIpInterval}`, callback_data: 'admin_interval_ip' }],
        [
          { text: '← Назад', callback_data: 'admin_menu' },
          { text: '⤴︎ Меню', callback_data: 'back_to_main' }
        ]
      ]
    }
  };
}

// Вибір інтервалу графіків
function getScheduleIntervalKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '5 хв', callback_data: 'admin_schedule_5' },
          { text: '10 хв', callback_data: 'admin_schedule_10' },
          { text: '15 хв', callback_data: 'admin_schedule_15' },
          { text: '30 хв', callback_data: 'admin_schedule_30' }
        ],
        [
          { text: '← Назад', callback_data: 'admin_intervals' },
          { text: '⤴︎ Меню', callback_data: 'back_to_main' }
        ]
      ]
    }
  };
}

// Вибір інтервалу IP моніторингу
function getIpIntervalKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '10 сек', callback_data: 'admin_ip_10' },
          { text: '30 сек', callback_data: 'admin_ip_30' },
          { text: '1 хв', callback_data: 'admin_ip_60' },
          { text: '2 хв', callback_data: 'admin_ip_120' }
        ],
        [
          { text: '← Назад', callback_data: 'admin_intervals' },
          { text: '⤴︎ Меню', callback_data: 'back_to_main' }
        ]
      ]
    }
  };
}

// Підтвердження деактивації
function getDeactivateConfirmKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✓ Так, деактивувати', callback_data: 'confirm_deactivate' }],
        [{ text: '✕ Скасувати', callback_data: 'back_to_settings' }],
      ],
    },
  };
}

// Підтвердження видалення даних
function getDeleteDataConfirmKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✓ Так, видалити', callback_data: 'confirm_delete_data' }],
        [{ text: '✕ Скасувати', callback_data: 'back_to_settings' }],
      ],
    },
  };
}

// IP моніторинг меню
function getIpMonitoringKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✚ Налаштувати IP', callback_data: 'ip_setup' }],
        [{ text: '📋 Показати поточний', callback_data: 'ip_show' }],
        [{ text: '🗑️ Видалити IP', callback_data: 'ip_delete' }],
        [
          { text: '← Назад', callback_data: 'back_to_settings' },
          { text: '⤴︎ Меню', callback_data: 'back_to_main' }
        ],
      ],
    },
  };
}

// Кнопка скасування для IP setup
function getIpCancelKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✕ Скасувати', callback_data: 'ip_cancel' }],
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
        [
          { text: '← Назад', callback_data: 'back_to_main' }
        ],
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
        [{ text: '👨‍💻 Контакт розробника', url: 'https://t.me/th3ivn' }],
        [
          { text: '← Назад', callback_data: 'back_to_main' }
        ],
      ],
    },
  };
}

// Канал меню
function getChannelMenuKeyboard(channelId = null, isPublic = false, channelStatus = 'active') {
  const buttons = [];
  
  if (!channelId) {
    // Канал НЕ підключено
    buttons.push([{ text: '✚ Підключити канал', callback_data: 'channel_connect' }]);
  } else {
    // Канал підключено
    // Add "Open channel" button for public channels
    if (isPublic && channelId.startsWith('@')) {
      buttons.push([{ text: '📺 Відкрити канал', url: `https://t.me/${channelId.replace('@', '')}` }]);
    }
    
    buttons.push([{ text: 'ℹ️ Інфо про канал', callback_data: 'channel_info' }]);
    buttons.push([{ text: '✏️ Змінити назву', callback_data: 'channel_edit_title' }]);
    buttons.push([{ text: '📝 Змінити опис', callback_data: 'channel_edit_description' }]);
    buttons.push([{ text: '📋 Формат публікацій', callback_data: 'channel_format' }]);
    buttons.push([{ text: '🧪 Тест публікації', callback_data: 'channel_test' }]);
    
    // Add reconnect button if channel is blocked
    if (channelStatus === 'blocked') {
      buttons.push([{ text: '⚙️ Перепідключити канал', callback_data: 'channel_reconnect' }]);
    } else {
      buttons.push([{ text: '🔴 Вимкнути публікації', callback_data: 'channel_disable' }]);
    }
  }
  
  buttons.push([
    { text: '← Назад', callback_data: 'back_to_settings' },
    { text: '⤴︎ Меню', callback_data: 'back_to_main' }
  ]);
  
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

// Меню формату публікацій
function getFormatSettingsKeyboard(user) {
  const deleteOld = user.delete_old_message ? '✓' : '○';
  const picOnly = user.picture_only ? '✓' : '○';
  
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '── 📊 ГРАФІК ВІДКЛЮЧЕНЬ ──', callback_data: 'format_noop' }],
        [{ text: '📝 Шаблон підпису', callback_data: 'format_schedule_caption' }],
        [{ text: '⏰ Формат періодів', callback_data: 'format_schedule_periods' }],
        [{ text: `${deleteOld} Видаляти попереднє`, callback_data: 'format_toggle_delete' }],
        [{ text: `${picOnly} Тільки картинка`, callback_data: 'format_toggle_piconly' }],
        [{ text: '── ⚡ ФАКТИЧНИЙ СТАН ──', callback_data: 'format_noop' }],
        [{ text: '📴 Текст "Світло зникло"', callback_data: 'format_power_off' }],
        [{ text: '💡 Текст "Світло є"', callback_data: 'format_power_on' }],
        [
          { text: '← Назад', callback_data: 'settings_channel' },
          { text: '⤴︎ Меню', callback_data: 'back_to_main' }
        ]
      ]
    }
  };
}

// Меню тесту публікації
function getTestPublicationKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 Графік відключень', callback_data: 'test_schedule' }],
        [{ text: '⚡ Фактичний стан (світло є)', callback_data: 'test_power_on' }],
        [{ text: '📴 Фактичний стан (світла немає)', callback_data: 'test_power_off' }],
        [{ text: '✏️ Своє повідомлення', callback_data: 'test_custom' }],
        [
          { text: '← Назад', callback_data: 'settings_channel' },
          { text: '⤴︎ Меню', callback_data: 'back_to_main' }
        ]
      ]
    }
  };
}

// Меню режиму паузи
function getPauseMenuKeyboard(isPaused) {
  const statusIcon = isPaused ? '🔴' : '🟢';
  const statusText = isPaused ? 'Бот на паузі' : 'Бот активний';
  const toggleText = isPaused ? '🟢 Вимкнути паузу' : '🔴 Увімкнути паузу';
  
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: `${statusIcon} ${statusText}`, callback_data: 'pause_status' }],
        [{ text: toggleText, callback_data: 'pause_toggle' }],
        [{ text: '📋 Налаштувати повідомлення', callback_data: 'pause_message_settings' }],
        [
          { text: '← Назад', callback_data: 'admin_menu' },
          { text: '⤴︎ Меню', callback_data: 'back_to_main' }
        ]
      ]
    }
  };
}

// Меню налаштування повідомлення паузи
function getPauseMessageKeyboard(showSupportButton) {
  const supportIcon = showSupportButton ? '✓' : '○';
  
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔧 Бот тимчасово недоступний...', callback_data: 'pause_template_1' }],
        [{ text: '⏸️ Бот на паузі. Скоро повернемось', callback_data: 'pause_template_2' }],
        [{ text: '🚀 Йде оновлення. Поверніться згодом', callback_data: 'pause_template_3' }],
        [{ text: '☕ Бот пішов за кавою', callback_data: 'pause_template_4' }],
        [{ text: '💤 Технічна перерва', callback_data: 'pause_template_5' }],
        [{ text: '✏️ Свій текст...', callback_data: 'pause_custom_message' }],
        [{ text: `${supportIcon} Показувати кнопку "Обговорення/Підтримка"`, callback_data: 'pause_toggle_support' }],
        [
          { text: '← Назад', callback_data: 'admin_pause' }
        ]
      ]
    }
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
  getAdminIntervalsKeyboard,
  getScheduleIntervalKeyboard,
  getIpIntervalKeyboard,
  getDeactivateConfirmKeyboard,
  getDeleteDataConfirmKeyboard,
  getIpMonitoringKeyboard,
  getIpCancelKeyboard,
  getStatisticsKeyboard,
  getHelpKeyboard,
  getChannelMenuKeyboard,
  getRestorationKeyboard,
  getFormatSettingsKeyboard,
  getTestPublicationKeyboard,
  getPauseMenuKeyboard,
  getPauseMessageKeyboard,
};
