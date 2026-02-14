# Visual Guide: New "Live Status" Screen (Живий стан)

## Overview
This document shows examples of the new dynamic "Live Status" screen that replaces the old static settings menu.

---

## Example 1: Optimal Configuration (Power ON)
**Scenario:** User has everything configured correctly, and power is currently available.

```
🟢 Світло зараз: Є
🕓 Оновлено: 14:30

📍 Київщина · 3.1
📡 IP: підключено
📺 Канал: підключено
🔔 Сповіщення: увімкнено

✅ Моніторинг активний
```

**Buttons:**
```
[📍 Регіон]   [📡 IP]
[📺 Канал]    [🔔 Сповіщення]
[🗑 Видалити всі дані]
[← Назад]     [⤴︎ Меню]
```

---

## Example 2: Power Outage
**Scenario:** User has everything configured, but power is currently off.

```
🔴 Світло зараз: Немає
🕓 Оновлено: 14:30

📍 Київщина · 3.1
📡 IP: підключено
📺 Канал: підключено
🔔 Сповіщення: увімкнено

✅ Моніторинг активний
```

**Buttons:** (same as above)

---

## Example 3: IP Not Configured
**Scenario:** User hasn't set up IP monitoring yet.

```
⚪ Світло зараз: Невідомо

📍 Київщина · 3.1
📡 IP: не підключено
⚠️ Налаштуйте IP для моніторингу світла
📺 Канал: підключено
🔔 Сповіщення: увімкнено

```

**Note:** No "✅ Моніторинг активний" message since IP is not configured.

**Buttons:** (same as Example 1)

---

## Example 4: Channel Not Connected
**Scenario:** User has IP monitoring but hasn't connected a Telegram channel.

```
🟢 Світло зараз: Є
🕓 Оновлено: 14:30

📍 Київщина · 3.1
📡 IP: підключено
📺 Канал: не підключено
ℹ️ Сповіщення приходитимуть лише в бот
🔔 Сповіщення: увімкнено

✅ Моніторинг активний
```

**Buttons:** (same as Example 1)

---

## Example 5: Notifications Disabled
**Scenario:** User has everything configured but has disabled notifications.

```
🟢 Світло зараз: Є
🕓 Оновлено: 14:30

📍 Київщина · 3.1
📡 IP: підключено
📺 Канал: підключено
🔔 Сповіщення: вимкнено

```

**Note:** No "✅ Моніторинг активний" message since notifications are disabled.

**Buttons:** (same as Example 1)

---

## Example 6: Admin User
**Scenario:** Same as Example 1, but user is an administrator.

```
🟢 Світло зараз: Є
🕓 Оновлено: 14:30

📍 Київщина · 3.1
📡 IP: підключено
📺 Канал: підключено
🔔 Сповіщення: увімкнено

✅ Моніторинг активний
```

**Buttons:**
```
[📍 Регіон]   [📡 IP]
[📺 Канал]    [🔔 Сповіщення]
[👑 Адмін-панель]        <-- ADDITIONAL BUTTON FOR ADMINS
[🗑 Видалити всі дані]
[← Назад]     [⤴︎ Меню]
```

---

## Key Improvements Over Old Design

### Old Design (Static)
```
⚙️ Налаштування

Поточні параметри:

📍 Регіон: Київщина • 3.1
📺 Канал: @mychannel ✅
📡 IP: 192.168.1.1 ✅
🔔 Сповіщення: увімкнено ✅

Керування:
```

**Issues with old design:**
- Showed IP address (privacy concern)
- No real-time power status
- Static checkmarks didn't convey state well
- Too technical ("Settings" vs "Status")

### New Design (Dynamic)
```
🟢 Світло зараз: Є
🕓 Оновлено: 14:30

📍 Київщина · 3.1
📡 IP: підключено
📺 Канал: підключено
🔔 Сповіщення: увімкнено

✅ Моніторинг активний
```

**Benefits:**
- ✅ Real-time power status is prominent
- ✅ Privacy-friendly (doesn't show IP address)
- ✅ Contextual hints guide user
- ✅ Clean, readable format
- ✅ User-focused ("What's happening?" vs "Configuration")

---

## Technical Implementation

### Files Changed
1. **src/keyboards/inline.js**: Updated button layout (2x2 grid)
2. **src/bot.js**: Dynamic message generation in `menu_settings` callback
3. **src/handlers/settings.js**: Updated `/settings` command handler
4. **src/utils.js**: Added `generateLiveStatusMessage()` helper function

### Key Features
- Fetches real-time power state from database (`power_state` field)
- Shows last update time from `power_changed_at` field
- Contextual messages based on configuration state
- Maintains backward compatibility with old callback handlers
