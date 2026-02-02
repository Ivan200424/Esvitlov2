// Telegram Web App API
const tg = window.Telegram.WebApp;

// Ініціалізація
tg.ready();
tg.expand();

// Налаштування теми
document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', tg.themeParams.secondary_bg_color || '#f2f2f7');
document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#8e8e93');
document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#007aff');
document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');
document.documentElement.style.setProperty('--tg-theme-destructive-text-color', tg.themeParams.destructive_text_color || '#ff3b30');

// Global state
let userData = null;
let isAdmin = false;

// API базовий URL (для локальної розробки або production)
const API_BASE = window.location.origin;

// Допоміжна функція для API запитів
async function apiRequest(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
    'x-telegram-init-data': tg.initData,
  };

  const options = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Помилка запиту');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Показати помилку
function showError(message) {
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('main-content').classList.add('hidden');
  document.getElementById('error-screen').classList.remove('hidden');
  document.getElementById('error-message').textContent = message;
  
  tg.showAlert(message);
}

// Показати повідомлення
function showMessage(message, isError = false) {
  if (isError) {
    tg.showAlert(message);
  } else {
    tg.showPopup({
      message: message,
      buttons: [{ type: 'ok' }]
    });
  }
}

// Показати підтвердження
async function showConfirm(message) {
  return new Promise((resolve) => {
    tg.showConfirm(message, (confirmed) => {
      resolve(confirmed);
    });
  });
}

// Завантаження даних користувача
async function loadUserData() {
  try {
    userData = await apiRequest('/api/user');
    
    // Перевірка чи користувач є адміном (перевіряємо чи є ендпоінт адміна доступний)
    try {
      await apiRequest('/api/admin/stats');
      isAdmin = true;
    } catch (error) {
      isAdmin = false;
    }
    
    return true;
  } catch (error) {
    throw new Error('Не вдалося завантажити дані користувача');
  }
}

// Завантаження регіонів
async function loadRegions() {
  try {
    const regions = await apiRequest('/api/regions');
    const select = document.getElementById('region-select');
    select.innerHTML = '<option value="">Оберіть регіон</option>';
    
    regions.forEach(region => {
      const option = document.createElement('option');
      option.value = region.code;
      option.textContent = region.name;
      if (userData.region === region.code) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load regions:', error);
  }
}

// Завантаження черг
async function loadQueues() {
  try {
    const queues = await apiRequest('/api/queues');
    const select = document.getElementById('queue-select');
    select.innerHTML = '<option value="">Оберіть чергу</option>';
    
    queues.forEach(queue => {
      const option = document.createElement('option');
      option.value = queue;
      option.textContent = queue;
      if (userData.queue === queue) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load queues:', error);
  }
}

// Відображення інформації про канал
function displayChannelInfo() {
  const channelInfo = document.getElementById('channel-info');
  
  if (userData.channel) {
    channelInfo.innerHTML = `
      <div class="info-row">
        <span class="info-label">Статус:</span>
        <span class="info-value">${userData.channel.status === 'active' ? '✅ Активний' : '❌ Неактивний'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Назва:</span>
        <span class="info-value">${userData.channel.title || 'Не вказано'}</span>
      </div>
      <p class="info-text" style="margin-top: 12px;">
        Канал підключено. Для зміни налаштувань каналу скористайтесь ботом.
      </p>
    `;
  } else {
    channelInfo.innerHTML = `
      <p class="info-text">
        Канал не підключено. Для підключення каналу скористайтесь ботом.
      </p>
    `;
  }
}

// Заповнення форм даними користувача
function populateForms() {
  // IP
  document.getElementById('router-ip').value = userData.router_ip || '';
  
  // Alerts
  document.getElementById('alerts-off-enabled').checked = userData.alerts.alerts_off_enabled;
  document.getElementById('alerts-on-enabled').checked = userData.alerts.alerts_on_enabled;
  document.getElementById('notify-before-off').value = userData.alerts.notify_before_off;
  document.getElementById('notify-before-on').value = userData.alerts.notify_before_on;
  document.getElementById('notify-target').value = userData.alerts.notify_target;
  
  // Schedule alerts
  if (userData.schedule_alerts) {
    document.getElementById('schedule-alert-enabled').checked = userData.schedule_alerts.schedule_alert_enabled;
    document.getElementById('schedule-alert-minutes').value = userData.schedule_alerts.schedule_alert_minutes;
    document.getElementById('schedule-alert-target').value = userData.schedule_alerts.schedule_alert_target;
  }
}

// Завантаження статистики адміна
async function loadAdminStats() {
  try {
    const stats = await apiRequest('/api/admin/stats');
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-active').textContent = stats.active;
    document.getElementById('stat-channels').textContent = stats.with_channels;
    document.getElementById('stat-ip').textContent = stats.with_ip;
  } catch (error) {
    console.error('Failed to load admin stats:', error);
  }
}

// Завантаження системної інформації
async function loadSystemInfo() {
  try {
    const info = await apiRequest('/api/admin/system');
    document.getElementById('system-uptime').textContent = info.uptime_formatted;
    document.getElementById('system-memory').textContent = `${info.memory.rss} MB`;
    document.getElementById('system-node').textContent = info.node_version;
  } catch (error) {
    console.error('Failed to load system info:', error);
  }
}

// Завантаження інтервалів
async function loadIntervals() {
  try {
    const intervals = await apiRequest('/api/admin/intervals');
    document.getElementById('admin-schedule-interval').value = Math.floor(intervals.schedule_check_interval / 60);
    document.getElementById('admin-ip-interval').value = intervals.power_check_interval;
    document.getElementById('admin-debounce').value = intervals.power_debounce_minutes;
  } catch (error) {
    console.error('Failed to load intervals:', error);
  }
}

// Event Handlers

// Зберегти регіон та чергу
document.getElementById('save-region-btn').addEventListener('click', async () => {
  const region = document.getElementById('region-select').value;
  const queue = document.getElementById('queue-select').value;
  
  if (!region || !queue) {
    showMessage('Оберіть регіон та чергу', true);
    return;
  }
  
  try {
    tg.MainButton.showProgress();
    await apiRequest('/api/user/region', 'POST', { region, queue });
    showMessage('✅ Регіон та чергу оновлено');
    await loadUserData();
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    tg.MainButton.hideProgress();
  }
});

// Зберегти IP
document.getElementById('save-ip-btn').addEventListener('click', async () => {
  const ip = document.getElementById('router-ip').value.trim();
  
  if (ip && !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    showMessage('Невірний формат IP адреси', true);
    return;
  }
  
  try {
    tg.MainButton.showProgress();
    await apiRequest('/api/user/ip', 'POST', { ip });
    showMessage('✅ IP адресу оновлено');
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    tg.MainButton.hideProgress();
  }
});

// Видалити IP
document.getElementById('delete-ip-btn').addEventListener('click', async () => {
  const confirmed = await showConfirm('Видалити IP адресу?');
  if (!confirmed) return;
  
  try {
    tg.MainButton.showProgress();
    await apiRequest('/api/user/ip', 'POST', { ip: '' });
    document.getElementById('router-ip').value = '';
    showMessage('✅ IP адресу видалено');
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    tg.MainButton.hideProgress();
  }
});

// Зберегти налаштування сповіщень
document.getElementById('save-alerts-btn').addEventListener('click', async () => {
  const data = {
    alerts_off_enabled: document.getElementById('alerts-off-enabled').checked,
    alerts_on_enabled: document.getElementById('alerts-on-enabled').checked,
    notify_before_off: parseInt(document.getElementById('notify-before-off').value),
    notify_before_on: parseInt(document.getElementById('notify-before-on').value),
    notify_target: document.getElementById('notify-target').value,
  };
  
  try {
    tg.MainButton.showProgress();
    await apiRequest('/api/user/alerts', 'POST', data);
    showMessage('✅ Налаштування сповіщень оновлено');
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    tg.MainButton.hideProgress();
  }
});

// Зберегти налаштування попереджень про графік
document.getElementById('save-schedule-alerts-btn').addEventListener('click', async () => {
  const data = {
    schedule_alert_enabled: document.getElementById('schedule-alert-enabled').checked,
    schedule_alert_minutes: parseInt(document.getElementById('schedule-alert-minutes').value),
    schedule_alert_target: document.getElementById('schedule-alert-target').value,
  };
  
  try {
    tg.MainButton.showProgress();
    await apiRequest('/api/user/schedule-alerts', 'POST', data);
    showMessage('✅ Налаштування попереджень оновлено');
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    tg.MainButton.hideProgress();
  }
});

// Видалити дані
document.getElementById('delete-data-btn').addEventListener('click', async () => {
  const confirmed = await showConfirm('⚠️ Ви впевнені? Всі ваші дані будуть видалені!');
  if (!confirmed) return;
  
  const doubleConfirm = await showConfirm('❗️ Це остання можливість скасувати. Продовжити?');
  if (!doubleConfirm) return;
  
  try {
    tg.MainButton.showProgress();
    await apiRequest('/api/user/delete', 'POST');
    showMessage('✅ Дані видалено. Закрийте додаток.');
    setTimeout(() => tg.close(), 2000);
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    tg.MainButton.hideProgress();
  }
});

// Admin: Зберегти інтервали
document.getElementById('save-intervals-btn')?.addEventListener('click', async () => {
  const data = {
    schedule_check_interval: parseInt(document.getElementById('admin-schedule-interval').value),
    power_check_interval: parseInt(document.getElementById('admin-ip-interval').value),
    power_debounce_minutes: parseInt(document.getElementById('admin-debounce').value),
  };
  
  try {
    tg.MainButton.showProgress();
    await apiRequest('/api/admin/intervals', 'POST', data);
    showMessage('✅ Інтервали оновлено');
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    tg.MainButton.hideProgress();
  }
});

// Admin: Відправити broadcast
document.getElementById('send-broadcast-btn')?.addEventListener('click', async () => {
  const message = document.getElementById('broadcast-message').value.trim();
  
  if (!message) {
    showMessage('Введіть повідомлення', true);
    return;
  }
  
  const confirmed = await showConfirm(`Надіслати повідомлення всім користувачам?`);
  if (!confirmed) return;
  
  try {
    tg.MainButton.showProgress();
    const result = await apiRequest('/api/admin/broadcast', 'POST', { message });
    showMessage(`✅ Broadcast прийнято! Буде відправлено ${result.recipients} користувачам.`);
    document.getElementById('broadcast-message').value = '';
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    tg.MainButton.hideProgress();
  }
});

// Ініціалізація додатку
async function init() {
  try {
    // Показуємо loading
    document.getElementById('loading-screen').classList.remove('hidden');
    
    // Завантажуємо дані
    await loadUserData();
    await loadRegions();
    await loadQueues();
    
    // Заповнюємо форми
    populateForms();
    displayChannelInfo();
    
    // Якщо адмін - показуємо адмін панель
    if (isAdmin) {
      document.getElementById('admin-panel').classList.remove('hidden');
      await loadAdminStats();
      await loadSystemInfo();
      await loadIntervals();
    }
    
    // Ховаємо loading, показуємо контент
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    
  } catch (error) {
    showError(error.message);
  }
}

// Запуск при завантаженні
if (tg.initData) {
  init();
} else {
  showError('Додаток можна відкрити тільки через Telegram');
}
