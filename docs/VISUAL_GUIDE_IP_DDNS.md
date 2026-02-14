# Visual Guide: IP Instruction + DDNS Support Features

## 📱 User Interface

### 1. IP Monitoring Menu

When users navigate to **Settings → IP**, they see:

```
🌐 IP моніторинг

Поточна IP: не налаштовано

Оберіть опцію:

┌─────────────────────────┐
│  ℹ️ Інструкція          │  ← NEW: Instruction button (FIRST)
├─────────────────────────┤
│  ✚ Налаштувати IP       │
├─────────────────────────┤
│  📋 Показати поточний   │
├─────────────────────────┤
│  🗑️ Видалити IP         │
├─────────────────────────┤
│  ← Назад  |  ⤴︎ Меню    │
└─────────────────────────┘
```

### 2. Instruction Display (NEW)

Clicking **ℹ️ Інструкція** shows comprehensive guide:

```
ℹ️ Налаштування моніторингу через IP

Налаштування може здатися складним, особливо якщо ви не айтішник,
але всі кроки можна виконати самостійно.
Нижче описано, як саме працює моніторинг і що потрібно для його коректної роботи.

───

🔌 Важливі умови

Для роботи IP-моніторингу потрібен роутер,
який стає недоступним при вимкненні електроенергії.

Зверніть увагу:
• якщо роутер підключений до ДБЖ або powerbank'у,
  він не вимикатиметься разом зі світлом
• у такому випадку потрібно вказати інший роутер —
  саме той, який втрачає живлення під час відключень

───

⚡ Принцип роботи

Вольтик перевіряє доступність вашого роутера ззовні.
Якщо роутер перестає відповідати — вважається, що світло зникло.
Коли доступ до роутера відновлюється — світло зʼявилось.

───

🛠 Варіанти налаштування

1️⃣ Використання статичної IP-адреси

Корисні сервіси для перевірки:
• Визначення вашої IP-адреси: https://2ip.ua/ua
• Перевірка доступності: https://2ip.ua/ua/services/ip-service/ping-traceroute
• Перевірка портів: https://2ip.ua/ua/services/ip-service/port-check

───

2️⃣ Доменне імʼя DDNS (альтернатива статичній IP)

───

📘 Інструкції з налаштування DDNS

• ASUS — https://www.asus.com/ua-ua/support/FAQ/1011725/
• TP-Link — https://help-wifi.com/tp-link/...
• NETGEAR — https://www.hardreset.info/...
• D-Link — https://yesondd.com/...
• MikroTik — https://...
• Xiaomi — https://www.hardreset.info/...

───

✍️ Що потрібно ввести

Приклади:
• 89.267.32.1
• 89.267.32.1:80
• myhome.ddns.net
```

### 3. IP Setup Flow

**Step 1:** Click "✚ Налаштувати IP"

```
🌐 Налаштування IP

Надішліть IP-адресу вашого роутера або DDNS домен.

Приклади:
• 89.267.32.1
• 89.267.32.1:80
• myhome.ddns.net

⏰ Час очікування введення: 5 хвилин

┌─────────────────────────┐
│  ✕ Скасувати            │
└─────────────────────────┘
```

**Step 2:** User enters address (supports 4 formats):

```
User types: 192.168.1.1       ✅ Valid IPv4
User types: 192.168.1.1:8080  ✅ Valid IPv4 + port
User types: router.home.net   ✅ Valid DDNS domain
User types: home.net:443      ✅ Valid DDNS + port
```

**Step 3:** Validation feedback

```
✅ IP-адресу збережено: 192.168.1.1:8080

Тепер бот буде моніторити доступність цієї адреси 
для визначення наявності світла.
```

**Error examples:**

```
❌ Кожне число в IP-адресі має бути від 0 до 255

❌ Порт має бути від 1 до 65535

❌ Адреса не може містити пробіли

❌ Невірний формат. Введіть IP-адресу або доменне імʼя.

Приклади:
• 89.167.32.1
• 89.167.32.1:80
• myhome.ddns.net
```

### 4. Timeout Handling (NEW)

**After 4 minutes:**
```
⏳ Залишилась 1 хвилина.
Надішліть IP-адресу або продовжіть пізніше.
```

**After 5 minutes:**
```
⌛ Час вийшов.
Режим налаштування IP завершено.

🏠 Головне меню

┌─────────────────────────┐
│  📊 Графік  |  ⏱ Таймер │  ← Automatically returns
├─────────────────────────┤    to main menu
│  📈 Статистика | ❓ Допомога │
├─────────────────────────┤
│  ⚙️ Налаштування        │
└─────────────────────────┘
```

## 🔧 Technical Features

### Validation Function: isValidIPorDomain()

```javascript
Input: "192.168.1.1"
Output: { 
  valid: true, 
  address: "192.168.1.1",
  host: "192.168.1.1",
  port: null,
  type: "ip"
}

Input: "192.168.1.1:8080"
Output: { 
  valid: true, 
  address: "192.168.1.1:8080",
  host: "192.168.1.1",
  port: 8080,
  type: "ip"
}

Input: "myhome.ddns.net"
Output: { 
  valid: true, 
  address: "myhome.ddns.net",
  host: "myhome.ddns.net",
  port: null,
  type: "domain"
}

Input: "myhome.ddns.net:8080"
Output: { 
  valid: true, 
  address: "myhome.ddns.net:8080",
  host: "myhome.ddns.net",
  port: 8080,
  type: "domain"
}
```

### Router Availability Check

```javascript
// Before: Only supported basic IP
checkRouterAvailability("192.168.1.1")
  → fetch("http://192.168.1.1:80")

// After: Supports all formats
checkRouterAvailability("192.168.1.1:8080")
  → fetch("http://192.168.1.1:8080")

checkRouterAvailability("myhome.ddns.net")
  → fetch("http://myhome.ddns.net:80")

checkRouterAvailability("myhome.ddns.net:443")
  → fetch("http://myhome.ddns.net:443")
```

## 📊 Test Results

```
=== IP Instruction + DDNS Support Test Suite ===

Task 1: IP Instruction
✓ IP monitoring menu should have instruction button
✓ Instruction handler should exist for ip_instruction callback
✓ Instruction text should contain all required sections
✓ Instruction should include example formats
✓ Instruction should include useful service links

Task 2: IP/Domain Validation
✓ Should accept valid IPv4 address
✓ Should accept IPv4 with port
✓ Should reject invalid IPv4 octet (> 255)
✓ Should reject invalid port (> 65535)
✓ Should reject invalid port (< 1)
✓ Should accept valid DDNS domain
✓ Should accept DDNS domain with port
✓ Should accept domain with subdomain
✓ Should accept domain with hyphens
✓ Should reject address with spaces
✓ Should reject invalid format
✓ Should trim whitespace from input

Task 3: Router Availability Check
✓ checkRouterAvailability should extract host from address
✓ checkRouterAvailability should extract port from address
✓ checkRouterAvailability should use extracted host and port
✓ checkRouterAvailability should default to port 80

Task 4: Timeout Handling
✓ IP setup should have final timeout handler
✓ Timeout handler should send main menu
✓ Timeout handler should show timeout message
✓ Timeout handler should clear IP setup state

Task 5: Instruction Button Position
✓ Instruction button should be first in IP monitoring menu
✓ IP monitoring menu should have all required buttons

Integration Tests
✓ All keyboard exports should be available
✓ Settings module should export required functions

Edge Cases
✓ Should handle IPv4 with standard port 80
✓ Should handle IPv4 with port 443
✓ Should handle domain with port 8080
✓ Should accept partial IP as domain (edge case)
✓ Should reject single word (not a domain)
✓ Should accept long TLD domains

============================================================
Test Summary:
Passed: 35
Failed: 0
============================================================
✓ All tests passed!
```

## 🎯 Key Improvements

### Before
```
❌ No instruction button
❌ Only basic IP validation
❌ No DDNS support
❌ No custom port support
❌ Timeout → stuck in setup mode
```

### After
```
✅ Instruction button with comprehensive guide
✅ Enhanced validation for IP and domains
✅ Full DDNS support
✅ Custom port support (1-65535)
✅ Timeout → returns to main menu
```

## 🔒 Security

All features include security measures:
- ✅ Input validation prevents injection
- ✅ Timeout protection (5 minutes)
- ✅ Safe URL construction
- ✅ Error messages don't expose data
- ✅ Example IPs are invalid (can't be used)

---

**Status:** All features implemented and tested ✅
**Tests:** 35/35 passing ✅
**Security:** No vulnerabilities ✅
**Ready:** Production deployment ✅
