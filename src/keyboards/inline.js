const { REGIONS, GROUPS, SUBGROUPS, QUEUES } = require('../constants/regions');

// Головне меню після /start для існуючих користувачів
function getMainMenu(botStatus = 'active', channelPaused = false) {
  const buttons = [
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
  ];
  
  // Add pause/resume button if user has a channel
  if (botStatus !== 'no_channel') {
    if (channelPaused) {
      buttons.push([
        { text: '✅ Відновити роботу каналу', callback_data: 'channel_resume' }
      ]);
    } else {
      buttons.push([
        { text: '🛑 Тимчасово зупинити канал', callback_data: 'channel_pause' }
      ]);
    }
  }
  
  return {
    reply_markup: {
      inline_keyboard: buttons,
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
        [{ text: '⤴ Меню', callback_data: 'back_to_main' }],
      ],
    },
  };
}

// Меню налаштувань - Живий стан
function getSettingsKeyboard(isAdmin = false) {
  const buttons = [
    [
      { text: '📍 Регіон', callback_data: 'settings_region' },
      { text: '📡 IP', callback_data: 'settings_ip' }
    ],
    [
      { text: '📺 Канал', callback_data: 'settings_channel' },
      { text: '🔔 Сповіщення', callback_data: 'settings_alerts' }
    ],
  ];
  
  // Add admin panel button if user is admin
  if (isAdmin) {
    buttons.push(
      [{ text: '👑 Адмін-панель', callback_data: 'settings_admin' }]
    );
  }
  
  buttons.push(
    [{ text: '🗑 Видалити всі дані', callback_data: 'settings_delete_data' }]
  );
  
  buttons.push(
    [
      { text: '← Назад', callback_data: 'back_to_main' },
      { text: '⤴ Меню', callback_data: 'back_to_main' }
    ]
  );
  
  return {
    reply_markup: {
      inline_keyboard: buttons,
    },
  };
}

// Налаштування алертів (спрощена версія - тільки увімк/вимк)
function getAlertsSettingsKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '← Назад', callback_data: 'back_to_settings' },
          { text: '⤴ Меню', callback_data: 'back_to_main' }
        ],
      ],
    },
  };
}

// Вибір часу для алертів - ВИДАЛЕНО (більше не використовується)
// function getAlertTimeKeyboard(type) { ... }

// Адмін меню
function getAdminKeyboard() {
  const buttons = [
    [
      { text: '📊 Статистика', callback_data: 'admin_stats' },
      { text: '👥 Користувачі', callback_data: 'admin_users' }
    ],
    [
      { text: '📢 Розсилка', callback_data: 'admin_broadcast' },
      { text: '💻 Система', callback_data: 'admin_system' }
    ],
    [
      { text: '📈 Ріст', callback_data: 'admin_growth' },
      { text: '⏱ Інтервали', callback_data: 'admin_intervals' }
    ],
    [
      { text: '⏸ Debounce', callback_data: 'admin_debounce' },
      { text: '⏸️ Режим паузи', callback_data: 'admin_pause' }
    ],
    [
      { text: '🗑 Очистити базу', callback_data: 'admin_clear_db' }
    ],
  ];
  
  buttons.push([
    { text: '← Назад', callback_data: 'back_to_settings' },
    { text: '⤴ Меню', callback_data: 'back_to_main' }
  ]);
  
  return {
    reply_markup: {
      inline_keyboard: buttons,
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
          { text: '⤴ Меню', callback_data: 'back_to_main' }
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
          { text: '1 хв', callback_data: 'admin_schedule_1' },
          { text: '5 хв', callback_data: 'admin_schedule_5' },
          { text: '10 хв', callback_data: 'admin_schedule_10' },
          { text: '15 хв', callback_data: 'admin_schedule_15' }
        ],
        [
          { text: '← Назад', callback_data: 'admin_intervals' },
          { text: '⤴ Меню', callback_data: 'back_to_main' }
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
          { text: '⤴ Меню', callback_data: 'back_to_main' }
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

// Підтвердження видалення даних - Step 1
function getDeleteDataConfirmKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '← Скасувати', callback_data: 'back_to_settings' },
          { text: '→ Продовжити', callback_data: 'delete_data_step2' }
        ],
      ],
    },
  };
}

// Підтвердження видалення даних - Step 2
function getDeleteDataFinalKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '← Ні', callback_data: 'back_to_settings' },
          { text: '🗑 Так, видалити', callback_data: 'confirm_delete_data' }
        ],
      ],
    },
  };
}

// IP моніторинг меню
function getIpMonitoringKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'ℹ️ Інструкція', callback_data: 'ip_instruction' }],
        [{ text: '✚ Підключити IP', callback_data: 'ip_setup' }],
        [{ text: '📋 Показати поточний', callback_data: 'ip_show' }],
        [{ text: '🗑️ Видалити IP', callback_data: 'ip_delete' }],
        [
          { text: '← Назад', callback_data: 'back_to_settings' },
          { text: '⤴ Меню', callback_data: 'back_to_main' }
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
          { text: '← Назад', callback_data: 'back_to_main' },
          { text: '⤴ Меню', callback_data: 'back_to_main' }
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
        [{ text: '📖 Інструкція', callback_data: 'help_howto' }],
        [{ text: '💬 Обговорення/Підтримка', url: 'https://t.me/svitlocheckchat' }],
        [{ text: '⤴ Меню', callback_data: 'back_to_main' }],
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
    
    buttons.push([
      { text: 'ℹ️ Інфо', callback_data: 'channel_info' },
      { text: '✏️ Назва', callback_data: 'channel_edit_title' }
    ]);
    buttons.push([
      { text: '📝 Опис', callback_data: 'channel_edit_description' },
      { text: '📋 Формат', callback_data: 'channel_format' }
    ]);
    buttons.push([
      { text: '🧪 Тест', callback_data: 'channel_test' },
      // Add reconnect button if channel is blocked, otherwise disable
      channelStatus === 'blocked' 
        ? { text: '⚙️ Перепідключити', callback_data: 'channel_reconnect' }
        : { text: '🔴 Вимкнути', callback_data: 'channel_disable' }
    ]);
  }
  
  buttons.push([
    { text: '← Назад', callback_data: 'back_to_settings' },
    { text: '⤴ Меню', callback_data: 'back_to_main' }
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
        [{ text: '🔄 Відновити налаштування', callback_data: 'restore_profile' }],
        [{ text: '🆕 Почати заново', callback_data: 'create_new_profile' }],
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
          { text: '⤴ Меню', callback_data: 'back_to_main' }
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
          { text: '⤴ Меню', callback_data: 'back_to_main' }
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
  
  const buttons = [
    [{ text: `${statusIcon} ${statusText}`, callback_data: 'pause_status' }],
    [{ text: toggleText, callback_data: 'pause_toggle' }],
    [{ text: '📋 Налаштувати повідомлення', callback_data: 'pause_message_settings' }],
  ];
  
  if (isPaused) {
    buttons.push([{ text: '🏷 Тип паузи', callback_data: 'pause_type_select' }]);
  }
  
  buttons.push([{ text: '📜 Лог паузи', callback_data: 'pause_log' }]);
  buttons.push([
    { text: '← Назад', callback_data: 'admin_menu' },
    { text: '⤴ Меню', callback_data: 'back_to_main' }
  ]);
  
  return {
    reply_markup: {
      inline_keyboard: buttons
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
        [{ text: '🔧 Бот тимчасово оновлюється. Спробуйте пізніше.', callback_data: 'pause_template_3' }],
        [{ text: '⏸️ Бот на паузі. Скоро повернемось.', callback_data: 'pause_template_4' }],
        [{ text: '🚧 Технічні роботи. Дякуємо за розуміння.', callback_data: 'pause_template_5' }],
        [{ text: '✏️ Свій текст...', callback_data: 'pause_custom_message' }],
        [{ text: `${supportIcon} Показувати кнопку "Обговорення/Підтримка"`, callback_data: 'pause_toggle_support' }],
        [
          { text: '← Назад', callback_data: 'admin_pause' },
          { text: '⤴ Меню', callback_data: 'back_to_main' }
        ]
      ]
    }
  };
}

// Меню вибору типу паузи
function getPauseTypeKeyboard(currentType = 'update') {
  const types = [
    { value: 'update', label: '🔧 Оновлення', icon: '🔧' },
    { value: 'emergency', label: '🚨 Аварія', icon: '🚨' },
    { value: 'maintenance', label: '🔨 Обслуговування', icon: '🔨' },
    { value: 'testing', label: '🧪 Тестування', icon: '🧪' },
  ];
  
  const buttons = types.map(type => [{
    text: currentType === type.value ? `✓ ${type.label}` : type.label,
    callback_data: `pause_type_${type.value}`
  }]);
  
  buttons.push([
    { text: '← Назад', callback_data: 'admin_pause' },
    { text: '⤴ Меню', callback_data: 'back_to_main' }
  ]);
  
  return {
    reply_markup: {
      inline_keyboard: buttons
    }
  };
}

// Меню помилки з кнопкою підтримки
function getErrorKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Спробувати ще', callback_data: 'back_to_main' }],
        [{ text: '💬 Написати в чат', url: 'https://t.me/svitlocheckchat' }],
      ],
    },
  };
}

// Меню налаштування debounce
function getDebounceKeyboard(currentValue) {
  const options = [1, 2, 3, 5, 10, 15];
  const buttons = options.map(min => ({
    text: currentValue === String(min) || currentValue === min ? `✓ ${min} хв` : `${min} хв`,
    callback_data: `debounce_set_${min}`
  }));
  
  return {
    reply_markup: {
      inline_keyboard: [
        buttons.slice(0, 3),
        buttons.slice(3, 6),
        [
          { text: '← Назад', callback_data: 'admin_menu' },
          { text: '⤴ Меню', callback_data: 'back_to_main' }
        ]
      ]
    }
  };
}

// Меню вибору куди публікувати сповіщення про світло
function getNotifyTargetKeyboard(currentTarget = 'both') {
  const options = [
    { value: 'bot', label: '📱 Тільки в бот' },
    { value: 'channel', label: '📺 Тільки в канал' },
    { value: 'both', label: '📱📺 В бот і канал' }
  ];
  
  const buttons = options.map(opt => [{
    text: currentTarget === opt.value ? `✓ ${opt.label}` : opt.label,
    callback_data: `notify_target_${opt.value}`
  }]);
  
  buttons.push([
    { text: '← Назад', callback_data: 'back_to_settings' },
    { text: '⤴ Меню', callback_data: 'back_to_main' }
  ]);
  
  return {
    reply_markup: {
      inline_keyboard: buttons
    }
  };
}

// Wizard: вибір куди надсилати сповіщення (для нових користувачів)
function getWizardNotifyTargetKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📱 У цьому боті', callback_data: 'wizard_notify_bot' }],
        [{ text: '📺 У Telegram-каналі', callback_data: 'wizard_notify_channel' }]
      ]
    }
  };
}

// Growth management keyboard
function getGrowthKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 Метрики', callback_data: 'growth_metrics' }],
        [{ text: '🎯 Етап росту', callback_data: 'growth_stage' }],
        [{ text: '🔐 Реєстрація', callback_data: 'growth_registration' }],
        [{ text: '📝 Події', callback_data: 'growth_events' }],
        [
          { text: '← Назад', callback_data: 'admin_menu' },
          { text: '⤴ Меню', callback_data: 'back_to_main' }
        ]
      ]
    }
  };
}

// Growth stage selection keyboard
function getGrowthStageKeyboard(currentStage) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: `${currentStage === 0 ? '✓' : ''} Етап 0: Закрите тестування (0-50)`, callback_data: 'growth_stage_0' }],
        [{ text: `${currentStage === 1 ? '✓' : ''} Етап 1: Відкритий тест (50-300)`, callback_data: 'growth_stage_1' }],
        [{ text: `${currentStage === 2 ? '✓' : ''} Етап 2: Контрольований ріст (300-1000)`, callback_data: 'growth_stage_2' }],
        [{ text: `${currentStage === 3 ? '✓' : ''} Етап 3: Активний ріст (1000-5000)`, callback_data: 'growth_stage_3' }],
        [{ text: `${currentStage === 4 ? '✓' : ''} Етап 4: Масштаб (5000+)`, callback_data: 'growth_stage_4' }],
        [
          { text: '← Назад', callback_data: 'admin_growth' },
          { text: '⤴ Меню', callback_data: 'back_to_main' }
        ]
      ]
    }
  };
}

// Growth registration control keyboard
function getGrowthRegistrationKeyboard(enabled) {
  const toggleText = enabled ? '🔴 Вимкнути реєстрацію' : '🟢 Увімкнути реєстрацію';
  const statusText = enabled ? '🟢 Реєстрація увімкнена' : '🔴 Реєстрація вимкнена';
  
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: statusText, callback_data: 'growth_reg_status' }],
        [{ text: toggleText, callback_data: 'growth_reg_toggle' }],
        [
          { text: '← Назад', callback_data: 'admin_growth' },
          { text: '⤴ Меню', callback_data: 'back_to_main' }
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
  getAdminKeyboard,
  getAdminIntervalsKeyboard,
  getScheduleIntervalKeyboard,
  getIpIntervalKeyboard,
  getDeactivateConfirmKeyboard,
  getDeleteDataConfirmKeyboard,
  getDeleteDataFinalKeyboard,
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
  getPauseTypeKeyboard,
  getErrorKeyboard,
  getDebounceKeyboard,
  getNotifyTargetKeyboard,
  getWizardNotifyTargetKeyboard,
  getGrowthKeyboard,
  getGrowthStageKeyboard,
  getGrowthRegistrationKeyboard,
};
