# 🔎 Система моніторингу та алертів

Повна спостережуваність системи для виявлення проблем ДО того, як їх помітять користувачі.

## 📋 Огляд

Система моніторингу складається з трьох основних компонентів:

1. **Metrics Collector** - збір метрик зі всіх рівнів системи
2. **Alert Manager** - управління алертами з захистом від alert fatigue
3. **Monitoring Manager** - координація перевірок здоров'я та доставки алертів

## 🎯 Рівні спостереження

### 1. System Level (рівень системи)
Відстежує:
- Uptime процесу
- Використання пам'яті (heap, RSS)
- Рестарти
- Process ID та версія Node.js

**Алерти:**
- Високе використання пам'яті (>500MB за замовчуванням)
- Довгий uptime (>7 днів, рекомендовано перезапуск)

### 2. Application Level (рівень застосунку)
Відстежує:
- Помилки (errors, exceptions)
- Переходи станів (scheduler start/stop, pause on/off)
- Кількість помилок та унікальних помилок

**Алерти:**
- Сплеск помилок (>10 помилок за 5 хвилин)
- Повторювані помилки (одна помилка >5 разів)

### 3. Business Level (продуктові метрики)
Відстежує:
- Всього користувачів / активних користувачів
- DAU (Daily Active Users)
- WAU (Weekly Active Users)
- Підключені канали
- IP моніторинги

**Алерти:**
- Відсутність активних користувачів (коли DAU > 0, але active = 0)

### 4. UX Level (поведінка користувачів)
Відстежує:
- Cancel rate (скасування дій)
- Timeout rate (таймаути)
- Retry count (повторні спроби)
- Quick clicks (швидкі повторні кліки)
- Abort state (перерваний wizard)

**Алерти:**
- Високий abort rate (>30% взаємодій)
- Високий cancel rate (>40% взаємодій)

### 5. IP Monitoring Level
Відстежує:
- OFFLINE → ONLINE переходи
- UNSTABLE кількість
- Debounce події

**Алерти:**
- Масові OFFLINE → ONLINE переходи (>100)
- Багато debounce подій (>50)

### 6. Channel Level
Відстежує:
- Втрату адмін-прав
- Помилки публікацій
- Видалення повідомлень

**Алерти:**
- Втрачено права адміністратора
- Багато помилок публікації (>10)

## 🚀 Використання

### Запуск
Система моніторингу автоматично запускається разом з ботом:

```javascript
// В index.js
const { monitoringManager } = require('./monitoring/monitoringManager');

monitoringManager.init(bot, {
  checkIntervalMinutes: 5,
  errorSpikeThreshold: 10,
  errorSpikeWindow: 5,
  repeatedErrorThreshold: 5,
  memoryThresholdMB: 500,
  maxUptimeDays: 7
});
monitoringManager.start();
```

### Адміністративні команди

#### `/monitoring`
Переглянути поточний стан системи моніторингу:
- Статус (активна/неактивна)
- Системні метрики (uptime, пам'ять)
- Метрики застосунку (помилки, режим паузи)
- Бізнес метрики (користувачі, канали, DAU/WAU)
- Алерти (за годину, за добу, по рівнях)
- Канал для алертів

#### `/setalertchannel <channel_id>`
Налаштувати канал для отримання алертів:
```
/setalertchannel @my_alerts_channel
/setalertchannel -1001234567890
```

**Примітка:** Бот має бути адміністратором каналу з правами публікації.

## 📊 Tracking подій

### Tracking помилок
```javascript
const metricsCollector = require('./monitoring/metricsCollector');

try {
  // ваш код
} catch (error) {
  metricsCollector.trackError(error, { 
    context: 'my_function', 
    userId: user.telegram_id 
  });
}
```

### Tracking переходів станів
```javascript
metricsCollector.trackStateTransition('scheduler_start', {
  interval: 60,
  timestamp: new Date().toISOString()
});
```

### Tracking UX подій
```javascript
// Cancel
metricsCollector.trackUXEvent('cancel');

// Timeout
metricsCollector.trackUXEvent('timeout');

// Retry
metricsCollector.trackUXEvent('retry');

// Quick clicks
metricsCollector.trackUXEvent('quickClicks');

// Abort
metricsCollector.trackUXEvent('abort');
```

### Tracking IP подій
```javascript
// OFFLINE → ONLINE перехід
metricsCollector.trackIPEvent('offlineToOnline');

// Unstable стан
metricsCollector.trackIPEvent('unstableCount');

// Debounce подія
metricsCollector.trackIPEvent('debounceCount');
```

### Tracking подій каналів
```javascript
// Втрачено адмін права
metricsCollector.trackChannelEvent('adminRightsLost');

// Помилка публікації
metricsCollector.trackChannelEvent('publishErrors');

// Видалено повідомлення
metricsCollector.trackChannelEvent('messageDeleted');
```

## 🛡️ Захист від Alert Fatigue

### Debouncing
Алерти з однаковим signature не повторюються протягом певного часу (15 хвилин за замовчуванням):

```javascript
alertManager.config.debounceMinutes = 15;
```

### Rate Limiting
Максимальна кількість алертів на годину (20 за замовчуванням):

```javascript
alertManager.config.maxAlertsPerHour = 20;
```

### Escalation
Повторювані алерти автоматично ескалуються:
- INFO → WARN (після 3 повторень)
- WARN → CRITICAL (після 3 повторень)

```javascript
alertManager.config.escalationThreshold = 3;
```

## 🔔 Формат алертів

Алерти містять:
- Рівень (INFO/WARN/CRITICAL)
- Тип (System/Application/Business/UX/IP/Channel)
- Заголовок
- Повідомлення
- Деталі (дані)
- Рекомендовану дію
- Кількість повторень
- Час

Приклад:
```
🚨 CRITICAL ⚙️ Сплеск помилок

10 помилок за 5 хвилин

🔄 Повторення: 2 разів

Деталі:
• errorCount: 10
• threshold: 10
• windowMinutes: 5

💡 Дія: Перевірте логи та розгляньте увімкнення режиму паузи

⏰ 06.02.2026, 19:26:37
```

## 📈 Метрики

### System Metrics
```javascript
{
  uptime: 3600,  // секунди
  uptimeFormatted: "1г",
  memory: {
    heapUsedMB: 150,
    heapTotalMB: 200,
    heapUsedPercent: 75,
    rssMB: 180
  },
  process: {
    pid: 12345,
    nodeVersion: "v20.0.0"
  },
  restartCount: 0
}
```

### Application Metrics
```javascript
{
  botPaused: false,
  scheduleInterval: 60,
  errorCount: 5,
  uniqueErrors: 3,
  recentErrors: [...],
  stateTransitionCount: 10,
  recentTransitions: [...]
}
```

### Business Metrics
```javascript
{
  totalUsers: 100,
  activeUsers: 80,
  dau: 50,
  wau: 75,
  channelsConnected: 20,
  ipsMonitored: 15
}
```

## 🔧 Налаштування

### Через БД (settings таблиця)
```sql
INSERT INTO settings (key, value) VALUES 
  ('alert_debounce_minutes', '15'),
  ('alert_max_per_hour', '20'),
  ('alert_escalation_threshold', '3'),
  ('alert_channel_id', '@my_channel');
```

### Програмно
```javascript
const { alertManager } = require('./monitoring/alertManager');

alertManager.config.debounceMinutes = 15;
alertManager.config.maxAlertsPerHour = 20;
alertManager.config.escalationThreshold = 3;
alertManager.saveConfig();
```

## 🧪 Тестування

Запустити тести системи моніторингу:
```bash
node test-monitoring.js
```

## 📁 Файлова структура

```
src/monitoring/
├── metricsCollector.js    # Збір метрик
├── alertManager.js         # Управління алертами
└── monitoringManager.js    # Координація моніторингу
```

## ✅ Definition of Done

Monitoring + Alerts готові, якщо:
- [x] Ти знаєш про проблему першим
- [x] Можеш швидко відреагувати
- [x] Бачиш стан системи
- [x] Розумієш UX-сигнали
- [x] Система не шумить даремно

## 🔮 Майбутні покращення

- [ ] Webhook delivery для алертів (Slack, Discord)
- [ ] Dashboard для візуалізації метрик
- [ ] Історичні графіки метрик
- [ ] Автоматичні action triggers (наприклад, auto-pause при критичних помилках)
- [ ] Machine learning для аномалій detection
- [ ] Performance profiling integration

---

**Monitoring — це очі продукту. Без них система сліпа.**
