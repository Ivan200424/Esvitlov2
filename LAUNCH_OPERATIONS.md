# 📘 LAUNCH OPERATIONS PLAYBOOK
## Операційний посібник для всіх фаз запуску

> **Призначення**: Покрокові інструкції для кожної фази launch  
> **Аудиторія**: Адміністратори, DevOps, Product Owner

---

## 📑 ЗМІСТ

1. [Pre-Launch Checklist](#pre-launch-checklist)
2. [Phase 1: Soft-Launch](#phase-1-soft-launch)
3. [Phase 2: Stabilization](#phase-2-stabilization)
4. [Phase 3: Public Launch Preparation](#phase-3-public-launch-preparation)
5. [Phase 4: Public Launch](#phase-4-public-launch)
6. [Phase 5: Post-Launch (72h)](#phase-5-post-launch-72h)
7. [Daily Operations](#daily-operations)
8. [Weekly Operations](#weekly-operations)

---

## 🔍 PRE-LAUNCH CHECKLIST

### За 24 години до Soft-Launch:

#### ✅ Технічна перевірка:
```bash
# 1. Перевірити версію коду
git status
git log -1

# 2. Перевірити конфігурацію
cat .env | grep -v "TOKEN"  # Не показувати токени!

# 3. Перевірити Railway deployment
Railway Dashboard → Latest deployment status
```

#### ✅ Функціональна перевірка:
- [ ] Відкрити бот → `/start` (новий чат)
  - [ ] Wizard працює
  - [ ] Кнопки "Назад" та "Скасувати" працюють
  - [ ] Можна обрати регіон і чергу
  - [ ] Графік публікується

- [ ] Перевірити налаштування
  - [ ] `/start` → Налаштування
  - [ ] Всі секції відкриваються
  - [ ] Зміни зберігаються

- [ ] Перевірити канал (тестовий)
  - [ ] Додати бота як адміна
  - [ ] Налаштування → Канал → Підключити
  - [ ] Канал підключається
  - [ ] Графік публікується
  - [ ] Відключення працює

- [ ] Перевірити IP моніторинг
  - [ ] Налаштування → IP
  - [ ] Можна ввести IP
  - [ ] Перевірка працює (ping)

#### ✅ Адмін перевірка:
- [ ] `/admin` → Панель відкривається
- [ ] Статистика показується
- [ ] Режим паузи:
  - [ ] Увімкнути
  - [ ] Перевірити що channel connect блокується
  - [ ] Вимкнути
- [ ] Контроль росту:
  - [ ] Встановити Stage 1
  - [ ] Перевірити ліміт (300)
  - [ ] Реєстрація enabled

#### ✅ Логування:
- [ ] Railway Logs працюють
- [ ] Console output читабельний
- [ ] Критичні події логуються

#### ✅ Backup:
- [ ] Створити backup БД
```bash
# Скопіювати bot.db
Railway → Data → Download bot.db
# Зберегти локально з датою: bot-backup-2026-02-06.db
```

#### ✅ Документація:
- [ ] `LAUNCH_READINESS.md` актуальний
- [ ] `EMERGENCY_PLAYBOOK.md` доступний
- [ ] Контакти для аварій оновлені

---

## 🚀 PHASE 1: SOFT-LAUNCH

**Тривалість**: 7-14 днів  
**Мета**: Збір даних в реальних умовах

### День 0: Запуск

#### Ранок запуску:

```
T-1h: Фінальна перевірка
├── Всі тести пройшли
├── Pause mode вимкнений
├── Growth Stage = 1 (300 users)
└── Логування активне

T-0: ЗАПУСК ✅
├── Інформування команди
├── Моніторинг увімкнено
└── Готовність до швидкого реагування

T+1h: Перша перевірка
├── Перевірити логи (помилки?)
├── Перевірити метрики (/admin)
├── Тестово зареєструватись
└── Все працює? → Продовжити моніторинг

T+4h: Друга перевірка
├── Статистика
├── Логи
└── UX фідбек (якщо є)

T+12h: Вечірня перевірка
├── Детальний перегляд логів
├── Аналіз метрик
├── Запис спостережень
└── Підготовка до наступного дня
```

#### Обмеження фази:
```
✅ ДОЗВОЛЕНО:
- Органічне зростання
- Пряме посилання в обговореннях
- Відповіді на питання

❌ ЗАБОРОНЕНО:
- Масові анонси
- Реклама
- Публікації в популярних каналах
- Штучне стимулювання
```

### Дні 1-7: Активний моніторинг

#### Щодня:
```
Ранок (10 хв):
1. /admin → Статистика
   - Записати ключові метрики
   - Порівняти з попереднім днем
   
2. Railway Logs
   - Scan на критичні помилки
   - Error rate в нормі?

3. Швидка перевірка функцій
   - Bot responds
   - Wizard works
   - Admin panel accessible

Вечір (15-20 хв):
1. Детальний аналіз логів
   - Які помилки були?
   - Які дії робили користувачі?
   - Де застрягли?

2. Метрики
   - Growth rate
   - Completion rate
   - Error rate
   
3. UX спостереження
   - Фідбек з підтримки
   - Типові питання
   - Проблемні місця

4. Документування
   - Записати спостереження
   - Баги в backlog
   - Ідеї для покращень
```

### Критерії для переходу до Stabilization:

```
✅ Технічні:
- Uptime > 99% (7 днів)
- Критичні баги відсутні
- Memory stable
- Error rate < 5%

✅ Метрики:
- Completion rate > 70%
- Активні користувачі ростуть
- Channel adoption > 20%

✅ UX:
- Немає скарг на незрозумілість
- Користувачі завершують wizard
- Фідбек позитивний/нейтральний

→ Якщо всі ✅ → Перехід до Phase 2
→ Якщо є проблеми → Подовжити Phase 1
```

---

## 🔧 PHASE 2: STABILIZATION

**Тривалість**: 7-14 днів  
**Мета**: Довести якість до "можна радити"

### Початок фази:

```
1. Задокументувати Phase 1:
   - Створити Sound-Launch Report
   - Список виявлених багів
   - UX insights
   
2. Пріоритизувати фікси:
   P0: Критичні (робити негайно)
   P1: Високі (цього тижня)
   P2: Середні (можна в наступній фазі)
   
3. Створити план фіксів
```

### Дозволені зміни:
```
✅ МОЖНА:
- Bug fixes
- Текстові покращення
- Дрібні UX правки
- Оптимізація логів
- Performance improvements

❌ ЗАБОРОНЕНО:
- Нові фічі
- Зміна архітектури
- Реструктуризація БД
- Зміна ключової логіки
```

### Процес фіксу:

```
Для кожного фіксу:

1. Створити issue/task
   - Опис проблеми
   - Очікувана поведінка
   - Пріоритет

2. Розробка
   - Minimal changes
   - Тести (якщо є)
   - Code review

3. Deploy
   - Staging test (якщо є)
   - Deploy в production
   - Моніторинг 2-4 години

4. Верифікація
   - Баг виправлений?
   - Нові проблеми?
   - Користувачі помітили?

5. Документування
   - Оновити changelog
   - Закрити task
```

### Аналіз використання:

```
Тижневий аналіз:

1. Які сценарії найчастіші?
   - /start
   - Підключення каналу
   - Налаштування IP
   → Оптимізувати ці flow

2. Де користувачі "випадають"?
   - Wizard step X
   - Channel connection
   → Спростити проблемні місця

3. Де найбільше помилок?
   - Function Y
   - API call Z
   → Додати error handling

4. Feedback patterns
   - Що подобається?
   - Що незрозуміло?
   → UX adjustments
```

### Критерії завершення:

```
DoD Stabilization:
- ✅ Всі P0 баги виправлені
- ✅ Більшість P1 багів виправлені
- ✅ Бот стабільно працює 7+ днів після останнього фіксу
- ✅ Навантаження передбачуване
- ✅ UX feedback позитивний
- ✅ Команда впевнена в якості

→ Готовність до Public Launch
```

---

## 🎯 PHASE 3: PUBLIC LAUNCH PREPARATION

**Тривалість**: 2-3 дні  
**Мета**: Підготувати систему до масштабування

### Технічна підготовка:

```
1. ✅ Фінальні тести:
   - All functional tests pass
   - Rate limiting tested under load
   - Pause mode tested
   - Backup procedures verified

2. ✅ Capacity planning:
   - Current: Stage 1 (300 users)
   - Plan: Move to Stage 2 (1000 users)
   - Action: /admin → Growth → Set Stage 2
   
3. ✅ Monitoring enhanced:
   - Verify all metrics working
   - Test alert thresholds
   - Document escalation paths

4. ✅ Emergency готовність:
   - EMERGENCY_PLAYBOOK.md reviewed
   - Team knows pause procedure
   - Rollback plan ready
```

### UX підготовка:

```
1. ✅ Перевірити onboarding:
   - Новий користувач може зареєструватись?
   - Інструкції зрозумілі?
   - Немає тупиків?

2. ✅ Перевірити всі cancel buttons:
   - Всі ведуть в меню/назад?
   - Немає "зависань"?

3. ✅ Перевірити messages:
   - Без граматичних помилок?
   - Тон дружній?
   - Не плутають користувача?
```

### Контент підготовка:

```
1. ✅ Оновити README.md:
   - Актуальний опис
   - Правильні посилання
   - Скріншоти (опціонально)

2. ✅ Оновити bot description:
   Telegram BotFather:
   /setdescription
   → "Бот для моніторингу відключень світла в Україні. 
       Графіки, сповіщення, публікація в канали."
   
   /setabouttext
   → "⚡ Вольтик — слідкує, щоб ти не слідкував"
   
   /setshortdescription
   → "Моніторинг світла для України 🇺🇦"

3. ✅ Підготувати announcement (не публікувати ще):
   - Короткий опис
   - Ключові фічі
   - Посилання на бот
   - Call to action
```

### Операційна готовність:

```
Перевірка швидкості реакції:

1. ✅ Як швидко увімкнути паузу?
   → Практика: < 1 хвилина

2. ✅ Як швидко зупинити фічу?
   → Практика pause specific features

3. ✅ Як швидко зменшити навантаження?
   → /admin → Intervals → Increase

4. ✅ Як швидко rollback?
   → Railway → Previous deployment → Redeploy
```

### Final Go/No-Go Decision:

```
GO критерії:
✅ Всі тести пройшли
✅ Баги P0/P1 виправлені
✅ Команда готова
✅ Monitoring working
✅ Emergency procedures known
✅ Впевненість в якості

NO-GO критерії:
❌ Є невирішені P0 баги
❌ Нестабільність системи
❌ Команда не готова
❌ Недостатньо даних з Stabilization

Decision meeting:
- Review всіх критеріїв
- Обговорення ризиків
- Остаточне рішення: GO / NO-GO / DELAY
```

---

## 🚀 PHASE 4: PUBLIC LAUNCH

**День X**: Public Launch Day

### Pre-Launch (T-2h):

```
1. ✅ Фінальна перевірка системи:
   /admin → Все працює?
   Railway → Status OK?
   Logs → No errors?

2. ✅ Set Growth Stage:
   /admin → Growth Control → Stage 2 (1000 users)

3. ✅ Enable maximum logging:
   (Вже активно за замовчуванням)

4. ✅ Anti-abuse stricter:
   (Вже активний за замовчуванням)

5. ✅ Team ready:
   - Pause procedure known
   - Emergency playbook ready
   - Communication channels open

6. ✅ Create backup:
   Railway → Download latest bot.db
```

### Launch (T-0):

```
1. 📢 Публікація announcement:
   - Bot channel
   - Personal channels (if applicable)
   - Related communities (with permission)

2. 🔗 Оновити посилання:
   - README.md
   - Bot description
   - Channel descriptions

3. 📊 Start intensive monitoring:
   - Every 30 minutes first 4 hours
   - Every hour rest of day
```

### Launch Day Monitoring:

```
T+30min:
- Перевірити logs (errors?)
- Перевірити metrics (growth?)
- System stable?

T+1h:
- Detailed stats review
- Error rate OK?
- Users completing wizard?

T+2h:
- Growth rate analysis
- Any issues reported?
- Support queries?

T+4h:
- Channel connections working?
- IP monitoring working?
- Any bottlenecks?

T+8h:
- Day summary
- Issues to watch
- Plan for tomorrow

T+12h (before sleep):
- Final review
- Set alerts
- Document observations
```

### Launch Day Actions:

```
✅ РОБИТИ:
- Відповідати на питання швидко
- Моніторити метрики
- Збирати фідбек
- Документувати issues
- Реагувати на проблеми

❌ НЕ РОБИТИ:
- Panic при малих проблемах
- Вносити code changes (unless P0)
- Обіцяти неіснуючі фічі
- Ігнорувати фідбек
```

---

## 📅 PHASE 5: POST-LAUNCH (72h)

**Перші 3 дні після launch - критичні**

### Години 0-24 (День 1):

```
Intensive monitoring:

00:00-08:00: Overnight watch
- Set up alerts for critical errors
- Check periodically (if possible)

08:00-09:00: Morning review
- Overnight logs review
- Metrics since launch
- Any incidents?

09:00-12:00: Active monitoring
- Every hour: quick check
- Respond to support

12:00-13:00: Midday analysis
- Growth rate
- Error patterns
- User behavior

13:00-18:00: Afternoon monitoring
- Continue hourly checks
- Address any issues

18:00-20:00: Evening review
- Day 1 summary
- Document learnings
- Plan for Day 2

20:00-00:00: Light monitoring
- Check before sleep
- Set alerts
```

### День 2-3:

```
Reduce monitoring intensity:

Morning (30 min):
- Overnight review
- Metrics analysis
- Priority issues

Midday (15 min):
- Quick check
- Support review

Evening (30 min):
- Daily summary
- Issue tracking
- Trend analysis
```

### 72h Review:

```
Після 3 днів зібрати:

📊 Metrics:
- Total users
- Growth rate
- Completion rate
- Channel adoption
- Error rate
- Uptime

🐛 Issues:
- Critical: [count]
- High: [count]
- Resolved: [count]
- Pending: [count]

💬 Feedback:
- Positive comments
- Feature requests
- Complaints
- Suggestions

✅ Success criteria:
- Growth healthy?
- System stable?
- Users satisfied?
- No major incidents?

📝 Next steps:
- Continue monitoring (reduced intensity)
- Plan fixes for P1/P2 issues
- Consider Stage 3 (5000 users)
- Plan v2 features
```

---

## 📅 DAILY OPERATIONS (Steady State)

**Після перших 72 годин**

### Morning Routine (10 min):

```bash
1. Check uptime
   Railway Dashboard → Status

2. Review metrics
   /admin → Statistics v2
   - Users growth
   - Active percentage
   - Channel adoption

3. Scan logs
   Railway → Logs
   - Critical errors?
   - Unusual patterns?

4. Quick functional test
   - Bot responds?
   - Can complete wizard?
```

### Evening Routine (15 min):

```bash
1. Detailed log review
   - Error patterns
   - User actions
   - Performance issues

2. Metrics analysis
   - Compare with yesterday
   - Trends
   - Anomalies

3. Support review
   - Questions answered?
   - Feedback collected?

4. Document observations
   - Issues found
   - Ideas for improvements
   - Tasks for tomorrow
```

### Weekly Operations

See: [Weekly Operations](#weekly-operations) section below

---

## 📅 WEEKLY OPERATIONS

### Monday: Planning

```
1. Review last week metrics
2. Prioritize backlog
3. Plan fixes/improvements
4. Set goals for week
```

### Tuesday-Thursday: Development

```
1. Implement planned changes
2. Test thoroughly
3. Deploy to production
4. Monitor after deploy
```

### Friday: Review & Documentation

```
1. Week summary report
2. Update documentation
3. Backup database
4. Plan for next week
```

### Monthly Review:

```
1. Comprehensive metrics analysis
2. User satisfaction survey (optional)
3. Performance optimization review
4. Capacity planning
5. Growth stage evaluation
6. Feature roadmap update
```

---

## 🎯 SUCCESS METRICS SUMMARY

### Phase 1 (Soft-Launch):
- Users: 50-300
- Completion rate: > 70%
- Uptime: > 99%
- No critical bugs

### Phase 2 (Stabilization):
- All P0/P1 bugs fixed
- 7+ days stable
- Positive feedback

### Phase 3-4 (Public Launch):
- Growth controlled
- System stable
- Users satisfied

### Long-term (Steady State):
- Continuous growth
- High satisfaction
- Low error rate
- Proactive improvements

---

**Документ створено**: 2026-02-06  
**Версія**: 1.0  
**Наступний перегляд**: Після Public Launch
