const { REGIONS, GROUPS, SUBGROUPS } = require('../constants/regions');

// Головне меню після /start для існуючих користувачів
function getMainMenu() {
  return {
    reply_markup: {
      keyboard: [
        ['📋 Графік', '⏭ Наступне', '⏰ Таймер'],
        ['⚙️ Налаштування', '📺 Канал'],
        ['⚡ Світло', '❓ Допомога'],
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

// Вибір групи
function getGroupKeyboard() {
  const buttons = [];
  const row = [];
  
  GROUPS.forEach((group, index) => {
    row.push({
      text: `Група ${group}`,
      callback_data: `group_${group}`,
    });
    
    if (row.length === 3 || index === GROUPS.length - 1) {
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

// Вибір підгрупи
function getSubgroupKeyboard(group) {
  const buttons = [];
  
  SUBGROUPS.forEach(subgroup => {
    buttons.push([{
      text: `${group}.${subgroup}`,
      callback_data: `subgroup_${group}.${subgroup}`,
    }]);
  });
  
  buttons.push([{ text: '« Назад', callback_data: 'back_to_group' }]);
  
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
        [{ text: '🔄 Змінити чергу', callback_data: 'back_to_group' }],
      ],
    },
  };
}

// Меню налаштувань
function getSettingsKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📍 Змінити регіон/чергу', callback_data: 'settings_region' }],
        [{ text: '🔔 Налаштування сповіщень', callback_data: 'settings_alerts' }],
        [{ text: '📺 Підключити канал', callback_data: 'settings_channel' }],
        [{ text: '🔴 Деактивувати бота', callback_data: 'settings_deactivate' }],
        [{ text: '« Назад', callback_data: 'back_to_main' }],
      ],
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

module.exports = {
  getMainMenu,
  getRegionKeyboard,
  getGroupKeyboard,
  getSubgroupKeyboard,
  getConfirmKeyboard,
  getSettingsKeyboard,
  getAlertsSettingsKeyboard,
  getAlertTimeKeyboard,
  getAdminKeyboard,
  getDeactivateConfirmKeyboard,
};
