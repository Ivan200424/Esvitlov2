# IP Monitoring - Visual User Guide

This document shows the complete user experience of IP monitoring in the eSvitlo-monitor-bot.

---

## 📍 Navigation Path

```
/start → ⚙️ Налаштування → 🌐 IP → ✚ Підключити IP
```

---

## 🎬 User Flow

### Step 1: Access IP Menu

**Message:**
```
🌐 IP моніторинг

Поточна IP: не налаштовано

Оберіть опцію:
```

**Buttons:**
```
[ℹ️ Інструкція]
[✚ Підключити IP]
[📋 Показати поточний]
[🗑️ Видалити IP]
[← Назад]  [⤴ Меню]
```

---

### Step 2: Click "Підключити IP"

**Message:**
```
🌐 Налаштування IP

Надішліть IP-адресу вашого роутера або DDNS домен.

Приклади:
• 89.267.32.1
• 89.267.32.1:80
• myhome.ddns.net

⏰ Час очікування: 5 хвилин
💡 Натисніть кнопку нижче, щоб скасувати
```

**Button:**
```
[✕ Скасувати]
```

**Status:** ⏳ Waiting for input...

---

### Step 3A: User Enters Valid IP

**User sends:** `192.168.1.1`

**Bot response:**
```
✅ IP-адресу збережено: 192.168.1.1

Тепер бот буде моніторити доступність цієї адреси 
для визначення наявності світла.

Оберіть наступну дію:
```

**Buttons:**
```
[📊 Графік]  [⏱ Таймер]
[⚙️ Налаштування]  [🏠 Меню]
```

---

### Step 3B: User Enters Invalid IP (Incomplete)

**User sends:** `192.168.1`

**Bot response:**
```
❌ Неповна IP-адреса. IP має складатися з 4 чисел.

Приклад: 192.168.1.1
```

**Status:** ⏳ Still waiting (timer reset)...

---

### Step 3C: User Enters Invalid Port

**User sends:** `192.168.1.1:70000`

**Bot response:**
```
❌ Порт має бути від 1 до 65535
```

**Status:** ⏳ Still waiting (timer reset)...

---

### Step 3D: User Clicks "Скасувати"

**Bot response:**
```
❌ Налаштування IP скасовано.

Оберіть наступну дію:
```

**Buttons:**
```
[← Назад]  [⤴ Меню]
```

**Status:** ✅ Pending state cleared, timers stopped

---

### Step 3E: Timeout (No Input for 5 Minutes)

**At 4 minutes:**
```
⏳ Залишилась 1 хвилина.
Надішліть IP-адресу або продовжіть пізніше.
```

**At 5 minutes:**
```
⌛ Час вийшов.

Режим налаштування IP завершено.

Оберіть наступну дію:
```

**Buttons:**
```
[🔄 Спробувати ще]
[← Назад]  [⤴ Меню]
```

---

## 🔔 Monitoring Notifications

### When Power Goes OFF

```
🔴 21:30 Світло зникло
🕓 Воно було 2 год 15 хв
🗓 Світло має з'явитися: 23:00
```

**or** (if unplanned):
```
🔴 21:30 Світло зникло
🕓 Воно було 2 год 15 хв
⚠️ Позапланове відключення
```

---

### When Power Comes ON

```
🟢 23:05 Світло з'явилося
🕓 Його не було 1 год 35 хв
🗓 Наступне планове: 08:00 - 12:00
```

---

## 📋 IP Menu Options

### Show Current IP

**User clicks:** [📋 Показати поточний]

**Popup message:**
```
📍 Ваша IP-адреса: 192.168.1.1:8080
```

---

### Delete IP

**User clicks:** [🗑️ Видалити IP]

**Bot response:**
```
✅ IP-адресу видалено.

Оберіть наступну дію:
```

**Buttons:**
```
[← Назад]  [⤴ Меню]
```

**Effect:** Monitoring stops immediately

---

### View Instruction

**User clicks:** [ℹ️ Інструкція]

**Bot shows:** Long detailed instruction (see IP_MONITORING_IMPLEMENTATION.md section 4)

**Key points:**
- How IP monitoring works
- Requirements (router without UPS)
- Static IP vs DDNS
- Setup guides for different routers
- Examples of valid formats

---

## ⚙️ Admin Panel

### View Current Debounce

**Command:** `/getdebounce`

**Response:**
```
⚙️ Поточний час debounce: 5 хв

Debounce - це час очікування стабільного стану перед 
відправкою сповіщення про зміну стану світла.

Змінити: /setdebounce <хвилини>
```

---

### Change Debounce

**Command:** `/setdebounce 3`

**Response:**
```
✅ Час debounce встановлено: 3 хв

Зміна набуде чинності для наступних перевірок.
```

**Valid range:** 1-30 minutes

---

## 🎨 Color Coding

- 🔴 Red = Power OFF (no light)
- 🟢 Green = Power ON (light available)
- ⏰ Clock = Time/duration information
- 🗓 Calendar = Scheduled events
- ⚠️ Warning = Unplanned outage
- ✅ Green check = Success
- ❌ Red X = Error/cancellation
- 💡 Lightbulb = Hint/tip
- 🔄 Arrows = Retry option

---

## 📊 State Diagram

```
[Idle] 
  ↓ User clicks "Підключити IP"
[Awaiting Input]
  ↓ Timer: 5 minutes
  ├─ User sends valid IP → [IP Saved] → [Idle]
  ├─ User sends invalid IP → [Show Error] → [Awaiting Input]
  ├─ User clicks "Скасувати" → [Cancelled] → [Idle]
  └─ Timeout (5 min) → [Timeout] → [Idle]

[Monitoring Active]
  ├─ Router accessible → [Power ON]
  │   └─ Becomes inaccessible → [Pending OFF] → wait debounce → [Power OFF]
  └─ Router inaccessible → [Power OFF]
      └─ Becomes accessible → [Pending ON] → wait debounce → [Power ON]
```

---

## 🛡️ Error Handling Examples

### 1. Empty Input
**Input:** `   ` (spaces)
**Error:** `❌ Невірний формат. Введіть IP-адресу або доменне імʼя.`

### 2. Single Number
**Input:** `192`
**Error:** `❌ Невірний формат. Введіть IP-адресу або доменне імʼя.`

### 3. Space in Address
**Input:** `192.168.1.1 :80`
**Error:** `❌ Адреса не може містити пробіли`

### 4. Octet Out of Range
**Input:** `256.1.1.1`
**Error:** `❌ Кожне число в IP-адресі має бути від 0 до 255`

### 5. Invalid Domain
**Input:** `-invalid.com`
**Error:** `❌ Невірний формат. Введіть IP-адресу або доменне імʼя.`

---

## ✨ Best Practices

### For Users

1. **Test your IP first**
   - Use https://2ip.ua/ua to find your public IP
   - Test accessibility with https://2ip.ua/ua/services/ip-service/port-check

2. **Use DDNS if possible**
   - More stable than dynamic IP
   - Many routers have built-in DDNS support

3. **Check router requirements**
   - Must not be on UPS/powerbank
   - Must be accessible from internet
   - Port forwarding may be needed

4. **Don't rush**
   - Take time to enter correct address
   - Use copy-paste to avoid typos
   - Double-check before sending

### For Admins

1. **Monitor debounce settings**
   - Default 5 minutes is good for most cases
   - Increase for unstable connections
   - Decrease only if needed and tested

2. **Check logs regularly**
   - Look for instability patterns
   - Investigate frequent switches
   - Verify debounce is working

3. **User support**
   - Guide users to instruction
   - Help with router setup
   - Explain monitoring principle

---

## 📱 Mobile Experience

All buttons and text are optimized for mobile:
- Large, easy-to-tap buttons
- Clear emoji icons
- Concise messages
- No horizontal scrolling
- Navigation always visible

---

**Last Updated:** 2026-02-05  
**Status:** ✅ Production Ready
