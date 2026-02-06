# 🚀 LAUNCH QUICK REFERENCE
## Швидкий довідник для критичних моментів

> **💾 ЗБЕРЕЖІТЬ ЦЕЙ ФАЙЛ**: Додайте в закладки або роздрукуйте  
> **🎯 МЕТА**: Швидкий доступ до найважливіших команд і процедур

---

## ⚡ КРИТИЧНІ КОМАНДИ (< 1 хвилини)

### 🔴 EMERGENCY: Увімкнути паузу
```
1. Відкрити бот
2. /admin
3. "⏸️ Режим паузи"
4. "Увімкнути паузу"
5. Обрати тип (🚨 Аварія)
```

### 🔴 EMERGENCY: Рестарт бота
```
Railway Dashboard → Deployments → Restart
```

### 🔴 EMERGENCY: Блокувати реєстрацію
```
/admin → Контроль росту → 🚫 Заблокувати реєстрацію
```

### 🔴 EMERGENCY: Rollback
```
Railway Dashboard → Deployments → 
Знайти попередній стабільний → Redeploy
```

---

## 📊 МОНІТОРИНГ КОМАНДИ

### Швидка перевірка
```bash
/admin                    # Адмін панель
/stats                    # Швидка статистика
```

### Детальна статистика
```
/admin → Статистика v2
→ Користувачі (загалом/активні)
→ Канали (кількість/відсоток)
→ IP-моніторинг (кількість/відсоток)
→ Регіони (розподіл)
```

### Система
```
/admin → Система
→ Uptime
→ Memory (RSS/Heap)
→ Node.js version
```

### Growth metrics
```
/admin → Контроль росту
→ Поточний етап
→ Ліміт користувачів
→ Метрики етапу
→ Статус реєстрації
```

---

## 🛠️ НАЛАШТУВАННЯ

### Інтервали
```
/admin → Інтервали

Графіки:
- 60 сек (нормально)
- 120+ сек (зменшити навантаження)

IP моніторинг:
- 2 сек (нормально)
- 5+ сек (зменшити навантаження)
```

### Режим паузи
```
/admin → Режим паузи

Статус: 🟢 Активний / 🔴 На паузі

Дії:
- Увімкнути/Вимкнути
- Змінити повідомлення
- Обрати тип паузи
- Переглянути лог
```

### Growth Control
```
/admin → Контроль росту

Етапи:
- Stage 0: 50 користувачів
- Stage 1: 300 користувачів ← Soft-Launch
- Stage 2: 1000 користувачів ← Public Launch
- Stage 3: 5000 користувачів
- Stage 4: Необмежено

Дії:
- Змінити етап
- Блокувати/Розблокувати реєстрацію
- Переглянути метрики
```

---

## 🔍 ЛОГИ

### Railway Logs
```
Railway Dashboard → Logs

Фільтрація:
- Останні 50/100/500 рядків
- Real-time streaming
- Search by keyword

Що шукати:
✅ "✅" - Успішні операції
❌ "❌" "ERROR" - Помилки
⚠️ "⚠️" "WARNING" - Попередження
```

### Критичні патерни
```javascript
🚨 КРИТИЧНО:
"Uncaught exception"
"Database error"
"Bot stopped"
"Out of memory"
"ECONNREFUSED"

⚠️ ВАЖЛИВО:
"429 Too Many Requests"
"Failed to send message"
"Validation failed"

ℹ️ ІНФОРМАЦІЯ:
"Schedule unchanged"
"User cancelled"
```

---

## 🎯 GROWTH STAGES

```
┌──────────────────────────────────────────┐
│ Stage 0: Закрите тестування (0-50)       │
│ → Внутрішнє тестування                   │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ Stage 1: Відкритий тест (51-300)    ⬅️  │
│ → SOFT-LAUNCH                            │
│ → Збір UX фідбеку                        │
│ → Виявлення багів                        │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ Stage 2: Контрольований ріст (301-1000)  │
│ → PUBLIC LAUNCH                          │
│ → Масштабування                          │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ Stage 3: Активний ріст (1001-5000)       │
│ → Розповсюдження                         │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ Stage 4: Масштаб (5000+)                 │
│ → Необмежений ріст                       │
└──────────────────────────────────────────┘
```

### Коли переходити далі?

```
Stage 1 → Stage 2:
✅ 7+ днів стабільної роботи
✅ Критичних багів немає
✅ UX зрозумілий
✅ 200+ користувачів
✅ Готовність до масштабування

Stage 2 → Stage 3:
✅ 2+ тижні стабільної роботи
✅ Інфраструктура витримує
✅ 800+ користувачів
✅ Позитивний фідбек
```

---

## 📈 ЗДОРОВІ МЕТРИКИ

```
👥 Completion Rate: > 70%
   Якщо < 70% → UX проблеми

📺 Channel Adoption: 30-50%
   Якщо < 20% → Незрозуміло як підключити
   Якщо > 60% → Дуже добре!

📡 IP Monitoring: 10-30%
   Це нормально - не всім потрібно

⏱️ Uptime: > 99%
   Кілька хвилин на deploy - нормально

❌ Error Rate: < 5%
   Якщо > 10% → Проблеми!

💾 Memory: Стабільна
   Якщо постійно зростає → Витік
```

---

## 🚨 КРИТИЧНІ ПОРОГИ

```
⚠️ ПОПЕРЕДЖЕННЯ:
- Users 80% від ліміту → Готуватись до переходу
- Error rate > 5% → Розслідувати
- Response time > 5 сек → Перевірити навантаження
- Memory growing → Моніторити

🚨 КРИТИЧНО:
- Bot не відповідає → EMERGENCY RESTART
- Error rate > 10% → PAUSE + Investigate
- Database errors → BACKUP + Investigate
- Memory spike → RESTART
- Users at 100% limit → Increase stage або pause registration
```

---

## 📞 КОНТАКТИ

```
Telegram Support:
https://t.me/c/3857764385/2

Railway Dashboard:
https://railway.app

Bot:
@svitlochekbot

Admin:
/admin
```

---

## 📚 ДОКУМЕНТАЦІЯ

```
📋 LAUNCH_READINESS.md
   → Оцінка готовності

📊 SOFT_LAUNCH_MONITORING.md
   → Гайд по моніторингу

🚨 EMERGENCY_PLAYBOOK.md
   → Аварійні процедури

📘 LAUNCH_OPERATIONS.md
   → Операційний playbook

📊 LAUNCH_METRICS_TEMPLATE.md
   → Шаблон для метрик
```

---

## ✅ ЩОДЕННИЙ CHECKLIST

### Ранок (5-10 хв):
```
□ Railway → Status (працює?)
□ /admin → Статистика (ріст?)
□ Logs → Scan (помилки?)
□ Growth → Check (наближення до ліміту?)
```

### Вечір (10-15 хв):
```
□ Logs → Детальний огляд
□ Метрики → Аналіз трендів
□ Support → Відповісти на питання
□ Записати спостереження
```

---

## 🎯 SUCCESS INDICATORS

```
✅ GOOD:
- Uptime > 99%
- Growth steady
- Completion rate > 70%
- Positive feedback
- Low error rate

⚠️ NEEDS ATTENTION:
- Completion rate 60-70%
- Growth slowing
- Some user complaints
- Error rate 5-10%

🚨 CRITICAL:
- Bot unstable
- Error rate > 10%
- Negative feedback
- Users dropping off
```

---

## 💡 ШВИДКІ TIPS

### Перед будь-яким deploy:
```
1. ✅ Переконатись що не peak hours
2. ✅ Створити backup БД
3. ✅ Підготувати rollback план
4. ✅ Моніторити після deploy 2+ години
```

### Якщо щось пішло не так:
```
1. 🔴 Не панікуй
2. 📊 Перевір metrics
3. 📋 Переглянь logs
4. 🚨 Якщо критично → PAUSE
5. 🔧 Виправ проблему
6. ✅ Тестуй
7. ▶️ Resume
```

### Комунікація з користувачами:
```
✅ DO:
- Будь чесним
- Швидко відповідай
- Дякуй за фідбек
- Визнавай помилки

❌ DON'T:
- Не обіцяй що не можеш
- Не ігноруй скарги
- Не звинувачуй користувачів
```

---

## 🏆 LAUNCH PHASES SUMMARY

```
Phase 1: SOFT-LAUNCH (7-14 днів)
├── Stage 1 (300 users max)
├── No ads, organic growth
├── Collect UX feedback
├── Find bugs
└── DoD: Stable + No critical bugs

Phase 2: STABILIZATION (7-14 днів)
├── Fix all P0/P1 bugs
├── UX improvements
├── Performance optimization
└── DoD: 7+ days stable + Quality

Phase 3: PREP (2-3 дні)
├── Final testing
├── Set Stage 2 (1000 users)
├── Content updates
└── DoD: Team ready + Go/No-Go decision

Phase 4: PUBLIC LAUNCH (Day X)
├── Announcement
├── Intensive monitoring
├── Quick issue response
└── DoD: Successful first 72h

Phase 5: POST-LAUNCH (72h+)
├── Daily monitoring
├── Issue tracking
├── Continuous improvement
└── DoD: Steady state achieved
```

---

**Створено**: 2026-02-06  
**Версія**: 1.0  
**💾 SAVE THIS FILE**
