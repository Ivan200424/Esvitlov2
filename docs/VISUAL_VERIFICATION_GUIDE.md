# Visual Verification Guide - Bot Flows

This guide provides a visual walkthrough of the three fixed issues to demonstrate that all functionality is working correctly.

---

## Flow 1: Region Request (regionRequest State) ✅

### User Journey: Requesting a New Region

**Step 1: User opens Help Menu**
```
/help command

📖 Довідка

Основні функції:
• /start - Налаштування бота
• /stats - Статистика вимкнень
• /schedule - Графік вимкнень

[🏙 Запропонувати регіон] [💬 Зворотній зв'язок]
[← Назад до меню]
```

**Step 2: User clicks "🏙 Запропонувати регіон"**
```
Callback: region_request_start
State: regionRequest created in stateManager

🏙 Запит на новий регіон

Будь ласка, напишіть назву регіону або міста, 
який ви хочете додати до бота.

Наприклад: "Харківщина" або "Львів"

[❌ Скасувати]
```

**Step 3: User types region name**
```
User message: "Харківщина"
State: regionRequest updated with region name

🏙 Запит на новий регіон

📍 Регіон: Харківщина

Надіслати цей запит?

[✅ Надіслати] [❌ Скасувати]
```

**Step 4: User confirms**
```
Callback: region_request_confirm
State: regionRequest cleared
Ticket created in database
Admins notified

✅ Дякуємо за запит!

Ваш запит на додавання регіону "Харківщина" 
прийнято. Ми розглянемо його найближчим часом.

[⤴ До меню]
```

**✅ SUCCESS**: No error `Invalid state type: regionRequest` - state is properly registered!

---

## Flow 2: Feedback (feedback State) ✅

### User Journey: Submitting Feedback

**Step 1: User opens Help Menu**
```
/help command

📖 Довідка

[🏙 Запропонувати регіон] [💬 Зворотній зв'язок]
[← Назад до меню]
```

**Step 2: User clicks "💬 Зворотній зв'язок"**
```
Callback: feedback_start
State: feedback created in stateManager

💬 Зворотній зв'язок

Оберіть тип звернення:

[🐛 Баг]
[💡 Ідея]
[💬 Інше]
[← Назад]
```

**Step 3: User selects type (e.g., "💡 Ідея")**
```
Callback: feedback_type_idea
State: feedback updated with type

💡 Звернення (Ідея)

Опишіть вашу ідею. Можете додати текст, 
фото, або відео.

[❌ Скасувати]
```

**Step 4: User types message**
```
User message: "Було б добре мати push-сповіщення"
State: feedback updated with message

💡 Звернення (Ідея)

Ваше повідомлення:
Було б добре мати push-сповіщення

Надіслати це звернення?

[✅ Надіслати] [❌ Скасувати]
```

**Step 5: User confirms**
```
Callback: feedback_confirm
State: feedback cleared
Ticket created in database
Admins notified

✅ Дякуємо за звернення!

Ми отримали ваше повідомлення і розглянемо його.

[⤴ До меню]
```

**✅ SUCCESS**: No error `Invalid state type: feedback` - state is properly registered!

---

## Flow 3: New User Wizard with Development Warning ✅

### User Journey: First-Time Setup

**Step 1: New user starts bot**
```
/start command

👋 Привіт! Я СвітлоБот 🤖

Я допоможу відстежувати відключення світла
та повідомлю, коли воно зʼявиться або зникне.

Давайте налаштуємося.

⚠️ Бот знаходиться в активній фазі розробки.

Наразі підтримуються такі регіони:
• Київ
• Київщина
• Дніпропетровщина
• Одещина

Якщо вашого регіону немає — ви можете запропонувати його додати.

Оберіть свій регіон:

[Київ] [Київщина]
[Дніпропетровщина] [Одещина]
```

**✅ SUCCESS**: Development warning is shown to new users!

**Step 2: User selects region (e.g., Київ)**
```
Callback: region_kyiv
State: wizard updated with region

✅ Регіон: Київ

2️⃣ Оберіть свою чергу:

[1.1] [1.2] [2.1]
[2.2] [3.1] [3.2]
[4.1] [4.2] [5.1]
[5.2] [6.1] [6.2]

[← Назад]
```

**Step 3: User clicks "← Назад"**
```
Callback: back_to_region
State: wizard step changed to 'region'

1️⃣ Оберіть ваш регіон:

⚠️ Бот знаходиться в активній фазі розробки.

Наразі підтримуються такі регіони:
• Київ
• Київщина
• Дніпропетровщина
• Одещина

Якщо вашого регіону немає — ви можете запропонувати його додати.

[Київ] [Київщина]
[Дніпропетровщина] [Одещина]
```

**✅ SUCCESS**: Development warning is shown when going back to region selection!

---

## Flow 4: Settings Region Change ✅

### User Journey: Changing Region in Settings

**Step 1: User opens settings**
```
/settings command

⚙️ Налаштування

Поточні параметри:

📍 Регіон: Київ • 1.1
📺 Канал: не підключено
🔔 Сповіщення: увімкнено
📡 IP моніторинг: вимкнено

[📍 Регіон] [📡 IP]
[📺 Канал] [🔔 Сповіщення]
[🗑 Видалити всі дані]
[← Назад до меню]
```

**Step 2: User clicks "📍 Регіон"**
```
Callback: settings_region

⚠️ Зміна регіону/черги

Ви впевнені, що хочете змінити регіон або чергу?

Поточні налаштування:
📍 Регіон: Київ
🔢 Черга: 1.1

[✅ Так, змінити] [❌ Скасувати]
```

**✅ SUCCESS**: Confirmation dialog is shown!

**Step 3: User confirms**
```
Callback: settings_region_confirm
Previous message deleted
Wizard started in 'edit' mode

1️⃣ Оберіть ваш регіон:

⚠️ Бот знаходиться в активній фазі розробки.

Наразі підтримуються такі регіони:
• Київ
• Київщина
• Дніпропетровщина
• Одещина

Якщо вашого регіону немає — ви можете запропонувати його додати.

[Київ] [Київщина]
[Дніпропетровщина] [Одещина]
```

**✅ SUCCESS**: Wizard launched in edit mode with development warning!

**Step 4: User selects new region and queue**
```
User completes wizard...
Database updated
User returned to main menu

✅ Налаштування збережено!

Ваш новий регіон: Одещина • 2.2
```

**✅ SUCCESS**: Settings region change flow works perfectly!

---

## Summary

All three issues are verified as working correctly:

### ✅ Issue 1: State Registration
- `regionRequest` state properly registered in stateManager
- `feedback` state properly registered in stateManager
- Both states have appropriate expiration times
- No `Invalid state type` errors

### ✅ Issue 2: Development Warning
- Warning shown for new users (`mode === 'new'`)
- Warning shown for edit mode
- Warning shown when navigating back to region selection
- All regions listed correctly

### ✅ Issue 3: Settings Region Button
- Button exists in settings menu
- Confirmation dialog shown before changes
- Wizard launched in edit mode after confirmation
- Navigation works correctly
- Database updated properly

**All functionality is working as expected! 🎉**
