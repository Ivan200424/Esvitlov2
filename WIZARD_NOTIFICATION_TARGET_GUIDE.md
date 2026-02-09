# Wizard Notification Target Selection - Visual Guide

## Overview
This feature adds a new step in the wizard flow for new users to choose where they want to receive notifications.

## User Flow for New Users

### Step 1: Select Region
User starts the bot with `/start` command (new user)

```
👋 Привіт! Я Вольтик 🤖

Допоможу відслідковувати відключення світла та сповіщу коли воно з'явиться чи зникне.

Давай налаштуємо! Обери свій регіон:

[Київщина] [Одещина]
[Дніпропетровщина] [Харківщина]
```

### Step 2: Select Queue
After selecting region, user selects their queue

```
✅ Регіон: Київ

2️⃣ Оберіть чергу:

[1.1] [1.2] [2.1]
[2.2] [3.1] [3.2]
[4.1] [4.2] [5.1]
[5.2] [6.1] [6.2]
[← Назад]
```

### Step 3: Select Notification Target (NEW!)
After selecting queue, user chooses where to receive notifications

```
✅ Налаштування:

📍 Регіон: Київ
⚡️ Черга: 1.1

📬 Куди надсилати сповіщення про світло/графіки?

Оберіть, де вам зручніше їх отримувати:

📱 У цьому боті
Повідомлення приходитимуть прямо в цей чат

📺 У вашому Telegram-каналі
Бот публікуватиме сповіщення у ваш канал
(потрібно додати бота як адміністратора)

[📱 У цьому боті]
[📺 У Telegram-каналі]
```

## Option A: User Selects "In This Bot"

### Result
```
✅ Налаштування завершено!

📍 Регіон: Київ
⚡️ Черга: 1.1
📬 Сповіщення: у цей чат

Сповіщення приходитимуть у цей чат.
```

*After 2 seconds, main menu appears*

```
🏠 Головне меню

[📊 Графік] [⏱ Таймер]
[📈 Статистика] [❓ Допомога]
[⚙️ Налаштування]
```

## Option B: User Selects "In Telegram Channel"

### Step 4: Channel Connection Instructions
```
📺 Підключення Telegram-каналу

Щоб бот міг публікувати у ваш канал:

1️⃣ Створіть канал або відкрийте існуючий
2️⃣ Додайте бота як адміністратора
3️⃣ Надайте права на публікацію повідомлень
4️⃣ Натисніть "🔄 Перевірити" нижче

ℹ️ Це займе менше хвилини

[🔄 Перевірити]
[← Назад]
```

### Step 5: Channel Detection
After user adds bot as admin and clicks "Перевірити"

```
📺 Знайдено канал!

Канал: Мій Канал
(@mychannel)

Підключити цей канал?

[✓ Так, підключити] [✕ Ні]
```

### Step 6: Channel Name Setup
After confirming channel

```
📝 Введіть назву для каналу

Вона буде додана після префіксу "Вольтик ⚡️ "

Приклад: Київ Черга 3.1
Результат: Вольтик ⚡️ Київ Черга 3.1
```

User types: `Київ Черга 1.1`

### Step 7: Optional Description
```
📝 Хочете додати додатковий опис каналу?

Наприклад: ЖК "Сонячний", під'їзд 2

[✍️ Додати опис] [⏭️ Пропустити]
```

### Step 8: Channel Setup Complete
```
✅ Канал успішно налаштовано!

📺 Канал: @mychannel
📝 Назва: Вольтик ⚡️ Київ Черга 1.1

⚠️ УВАГА: Не змінюйте назву, опис або фото каналу!
Якщо ви їх зміните — бот перестане працювати і
потрібно буде налаштовувати канал заново.
```

*After 4 seconds, main menu appears*

```
🏠 Головне меню

[📊 Графік] [⏱ Таймер]
[📈 Статистика] [❓ Допомога]
[⚙️ Налаштування]
[🛑 Тимчасово зупинити канал]
```

## Back Navigation

At the notification target selection step, user can go back:

```
[← Назад] → Returns to notification target selection
```

During channel connection, user can go back:

```
[← Назад] → Returns to notification target selection
```

## Database Changes

When user selects notification target:
- **"In This Bot"**: `power_notify_target = 'bot'`
- **"In Telegram Channel"**: `power_notify_target = 'channel'`

## Technical Implementation

### Files Modified
1. `src/keyboards/inline.js` - Added `getWizardNotifyTargetKeyboard()`
2. `src/handlers/start.js` - Added wizard notification target handlers
3. `src/bot.js` - Updated callback routing

### New Callback Handlers
- `wizard_notify_bot` - User selects bot notifications
- `wizard_notify_channel` - User selects channel notifications
- `wizard_notify_back` - User goes back to notification selection
- `wizard_channel_confirm_*` - User confirms channel selection

### Integration with Existing Code
- Leverages existing `pendingChannels` mechanism from channel.js
- Uses existing `conversationStates` for channel setup flow
- Reuses existing channel branding and setup logic
- Main menu display already handled by existing channel setup completion

## Benefits

1. **Clear User Intent**: Users explicitly choose their notification preference during setup
2. **Reduced Friction**: Users who only want bot notifications don't need to deal with channel setup
3. **Guided Experience**: Users who want channel notifications get step-by-step guidance
4. **Consistent Flow**: Integrates seamlessly with existing wizard and channel setup flows
5. **Database Ready**: `power_notify_target` field already exists in database schema

## Notes

- This change only affects **NEW users** going through the wizard
- Existing users are not affected
- Users in "edit mode" (changing region/queue) bypass this step
- Channel setup can be done later via Settings if user selects bot notifications initially
