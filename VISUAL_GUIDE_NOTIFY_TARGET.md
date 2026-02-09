# Visual Guide: Power Notification Target Settings

## Feature Overview
Users can now choose where to receive notifications about power state changes (light on/off).

---

## 1. Settings Menu - New Button Added

### Main Settings Screen (Updated)
```
⚙️ Налаштування

Поточні параметри:

📍 Регіон: Київ • 1.1
📺 Канал: @mychannel ✅
📡 IP: 192.168.1.1 ✅
🔔 Сповіщення: увімкнено ✅

Керування:

[📍 Регіон]              [📺 Канал]
[📡 IP]                  [🔔 Сповіщення]
[🔔 Куди сповіщати]      ← NEW BUTTON ✨
[🗑 Видалити всі дані]
[← Назад]                [⤴︎ Меню]
```

---

## 2. Notification Target Menu

### When User Taps "🔔 Куди сповіщати"

**Example 1: Default Setting (Both)**
```
🔔 Сповіщення про світло

Куди публікувати повідомлення про 
увімкнення/вимкнення світла?

Поточне: 📱📺 В бот і канал

[📱 Тільки в бот]
[📺 Тільки в канал]
[✓ 📱📺 В бот і канал]    ← Checkmark shows current selection
[← Назад]
```

**Example 2: Bot Only Selected**
```
🔔 Сповіщення про світло

Куди публікувати повідомлення про 
увімкнення/вимкнення світла?

Поточне: 📱 Тільки в бот

[✓ 📱 Тільки в бот]        ← Checkmark
[📺 Тільки в канал]
[📱📺 В бот і канал]
[← Назад]
```

**Example 3: Channel Only Selected**
```
🔔 Сповіщення про світло

Куди публікувати повідомлення про 
увімкнення/вимкнення світла?

Поточне: 📺 Тільки в канал

[📱 Тільки в бот]
[✓ 📺 Тільки в канал]      ← Checkmark
[📱📺 В бот і канал]
[← Назад]
```

---

## 3. User Interaction Flow

### Step-by-Step User Journey

1️⃣ **User opens Settings**
```
User taps: ⚙️ Налаштування
→ Settings menu appears
```

2️⃣ **User finds new button**
```
User sees: [🔔 Куди сповіщати]
User taps button
→ Notification target menu appears
```

3️⃣ **User sees current setting**
```
Current setting is highlighted with ✓
User sees three options
```

4️⃣ **User changes setting**
```
User taps: [📱 Тільки в бот]
→ Confirmation popup appears
```

5️⃣ **Confirmation**
```
✅ Встановлено: 📱 Тільки в бот
(Small notification at top)

Menu updates immediately:
[✓ 📱 Тільки в бот]        ← Checkmark moved
[📺 Тільки в канал]
[📱📺 В бот і канал]
[← Назад]
```

---

## 4. How It Affects Notifications

### Scenario 1: "📱 Тільки в бот" Selected

**When Power Goes OFF:**
```
Personal Chat:
🔴 23:45 Світло зникло
🕓 Воно було 3 години 12 хвилин
🗓 Світло має з'явитися: 02:00

Channel:
(No message sent) ← User's choice
```

**When Power Comes ON:**
```
Personal Chat:
🟢 02:03 Світло з'явилося
🕓 Його не було 2 години 18 хвилин
🗓 Наступне планове: 08:00 - 11:00

Channel:
(No message sent) ← User's choice
```

---

### Scenario 2: "📺 Тільки в канал" Selected

**When Power Goes OFF:**
```
Personal Chat:
(No message sent) ← User's choice

Channel (@mychannel):
🔴 23:45 Світло зникло
🕓 Воно було 3 години 12 хвилин
🗓 Світло має з'явитися: 02:00
```

**When Power Comes ON:**
```
Personal Chat:
(No message sent) ← User's choice

Channel (@mychannel):
🟢 02:03 Світло з'явилося
🕓 Його не було 2 години 18 хвилин
🗓 Наступне планове: 08:00 - 11:00
```

---

### Scenario 3: "📱📺 В бот і канал" Selected (DEFAULT)

**When Power Goes OFF:**
```
Personal Chat:
🔴 23:45 Світло зникло
🕓 Воно було 3 години 12 хвилин
🗓 Світло має з'явитися: 02:00

Channel (@mychannel):
🔴 23:45 Світло зникло
🕓 Воно було 3 години 12 хвилин
🗓 Світло має з'явитися: 02:00
```

**When Power Comes ON:**
```
Personal Chat:
🟢 02:03 Світло з'явилося
🕓 Його не було 2 години 18 хвилин
🗓 Наступне планове: 08:00 - 11:00

Channel (@mychannel):
🟢 02:03 Світло з'явилося
🕓 Його не було 2 години 18 хвилин
🗓 Наступне планове: 08:00 - 11:00
```

---

## 5. Edge Cases & Special Behaviors

### Case 1: User Has No Channel Connected
```
Setting: "📺 Тільки в канал"
Behavior: Same as "📱 Тільки в бот"
         (Messages only go to personal chat)
```

### Case 2: Channel is Paused
```
Setting: "📱📺 В бот і канал"
Channel Status: Paused ⏸
Behavior: 
  ✅ Messages sent to personal chat
  ❌ Messages NOT sent to channel (respects pause)
```

### Case 3: User Switches Settings Mid-Outage
```
Before: "📱 Тільки в бот"
Power goes OFF → Message sent to bot only

User changes to: "📺 Тільки в канал"
Power comes ON → Message sent to channel only

Each event respects the setting at that moment.
```

---

## 6. Button States & Visual Feedback

### Normal State (Not Selected)
```
[📱 Тільки в бот]
```

### Selected State (With Checkmark)
```
[✓ 📱 Тільки в бот]
   ↑ Visual indicator
```

### After Tap (Confirmation Popup)
```
✅ Встановлено: 📱 Тільки в бот
↑ Small notification appears briefly at top
```

### Error State (If Database Update Fails)
```
❌ Помилка оновлення налаштування
↑ Alert popup (show_alert: true)
```

---

## 7. Complete User Flow Diagram

```
Settings Menu
     │
     ├─→ [🔔 Куди сповіщати] ──→ Notification Target Menu
                                          │
                     ┌────────────────────┼────────────────────┐
                     ↓                    ↓                     ↓
            [📱 Тільки в бот]  [📺 Тільки в канал]  [📱📺 В бот і канал]
                     │                    │                     │
                     └────────────────────┴─────────────────────┘
                                          │
                                          ↓
                              Update Database (users.power_notify_target)
                                          │
                                          ↓
                              ✅ Show Confirmation
                                          │
                                          ↓
                              Update UI with Checkmark
```

---

## 8. Default Behavior Summary

| User Type | Default Setting | Where Notifications Go |
|-----------|----------------|------------------------|
| New user | 📱📺 В бот і канал | Bot + Channel (if connected) |
| Existing user | 📱📺 В бот і канал | Bot + Channel (if connected) |
| No channel | Any setting | Always to bot only |
| Channel paused | Any setting with channel | Bot only (channel ignored) |

---

## 9. UI/UX Improvements

### What Makes This Feature User-Friendly:

✅ **Clear Visual Feedback**: Checkmark shows current selection  
✅ **Instant Updates**: Menu updates immediately after selection  
✅ **Confirmation**: Success message confirms the change  
✅ **Intuitive Icons**: Emojis make options immediately recognizable  
✅ **Consistent Placement**: Logically positioned in Settings menu  
✅ **Error Handling**: Clear error messages if something goes wrong  
✅ **Back Navigation**: Easy to return to settings  

---

## 10. Accessibility Notes

- **Clear Labels**: Each option has descriptive text
- **Visual Indicators**: Checkmark (✓) clearly shows selection
- **Consistent Navigation**: Standard back button behavior
- **Error Messages**: Clear feedback when operations fail
- **Confirmation**: User always knows when setting changes

---

**Feature Status**: ✅ Production Ready  
**Last Updated**: February 2026  
**Version**: 1.0
