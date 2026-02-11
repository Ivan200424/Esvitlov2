# Visual Guide - Ticketing System User Flow

## User Flow: Submitting Feedback

### Step 1: Open Help Menu
```
User clicks: Меню → Допомога → 💬 Зворотній зв'язок
```

**Bot displays:**
```
💬 Зворотній зв'язок

Оберіть тип вашого звернення:

[🐛 Баг]
[💡 Ідея]
[💬 Інше]
[← Назад]
```

### Step 2: Select Type
```
User clicks: 🐛 Баг
```

**Bot displays:**
```
🐛 Баг

Надішліть ваше повідомлення (текст, фото або відео).

⏱ У вас є 5 хвилин на введення.

[❌ Скасувати]
```

### Step 3: Send Message
```
User sends: "Не працює кнопка таймера"
OR
User sends: Photo with caption "Ось скріншот помилки"
OR
User sends: Video
```

**Bot displays preview:**
```
🐛 Баг

📝 Ваше повідомлення:
Не працює кнопка таймера

Надіслати це звернення?

[✅ Надіслати] [❌ Скасувати]
```

### Step 4: Confirm
```
User clicks: ✅ Надіслати
```

**Bot confirms:**
```
✅ Дякуємо за звернення!

Ваше звернення #123 прийнято.
Ми розглянемо його найближчим часом.
```

**Admins receive notification:**
```
🎫 Нове звернення #123

🐛 Тип: Баг
👤 Від: @username (ID: 1234567890)
📅 Дата: 11.02.2026, 08:27:45

📝 Повідомлення:
Не працює кнопка таймера

[📩 Переглянути]
```

---

## User Flow: Region Request

### Step 1: Open Help Menu
```
User clicks: Меню → Допомога → 🏙 Запропонувати регіон
```

**Bot displays:**
```
🏙 Запит на новий регіон

Введіть назву міста або регіону, який ви хочете додати.

Приклад: Житомир, Вінниця, Черкаси

⏱ У вас є 5 хвилин на введення.

[❌ Скасувати]
```

### Step 2: Enter Region Name
```
User sends: "Житомир"
```

**Bot displays preview:**
```
🏙 Запит на новий регіон

📍 Регіон: Житомир

Надіслати цей запит?

[✅ Надіслати] [❌ Скасувати]
```

### Step 3: Confirm
```
User clicks: ✅ Надіслати
```

**Bot confirms:**
```
✅ Дякуємо за запит!

Ваш запит #124 на додавання регіону "Житомир" прийнято.

Ми розглянемо його найближчим часом.
```

**Admins receive notification:**
```
🏙 Запит на новий регіон #124

📍 Регіон: Житомир
👤 Від: @username (ID: 1234567890)
📅 Дата: 11.02.2026, 08:30:12

[📩 Переглянути]
```

---

## Admin Flow: Managing Tickets

### Step 1: Open Admin Panel
```
Admin clicks: /admin → 📩 Звернення (3)
```

**Bot displays:**
```
📩 Звернення

Відкритих звернень: 3

Оберіть звернення для перегляду:

[🆕 🐛 #123 - Не працює кнопка таймера]
[🆕 🏙 #124 - Запит на додавання регіону: Жит...]
[🆕 💬 #122 - Дякую за бота!]

[← Назад] [⤴ Меню]
```

### Step 2: View Ticket
```
Admin clicks: [🆕 🐛 #123 - Не працює кнопка таймера]
```

**Bot displays:**
```
📩 Звернення #123

🐛 Баг
🆕 Відкрито
👤 Від: 1234567890
📅 Створено: 11.02.2026, 08:27:45
📝 Тема: Баг

Повідомлення:

👤 Користувач:
Не працює кнопка таймера

[💬 Відповісти] [✅ Закрити]
[← Назад до списку]
```

### Step 3: Close Ticket
```
Admin clicks: [✅ Закрити]
```

**Bot updates view:**
```
📩 Звернення #123

🐛 Баг
✅ Закрито
👤 Від: 1234567890
📅 Створено: 11.02.2026, 08:27:45
📝 Тема: Баг

Повідомлення:

👤 Користувач:
Не працює кнопка таймера

[🔄 Відкрити знову]
[← Назад до списку]
```

**User receives notification:**
```
✅ Ваше звернення #123 закрито

Дякуємо за звернення!
```

---

## Edge Cases Handled

### Timeout (5 minutes)
```
User opens feedback form but doesn't send message within 5 minutes
```

**Bot notifies:**
```
⏱ Час очікування минув. Спробуйте знову, натиснувши на кнопку "💬 Зворотній зв'язок".
```

### Cancel
```
User clicks: [❌ Скасувати] at any step
```

**Bot confirms:**
```
❌ Звернення скасовано.
```

### Invalid Media Type
```
User sends audio or document instead of text/photo/video
```

**Bot notifies:**
```
❌ Підтримуються тільки текст, фото та відео. Спробуйте ще раз.
```

### Region Name Too Short/Long
```
User enters "A" or 200-character string
```

**Bot notifies:**
```
❌ Назва регіону занадто коротка/довга. Спробуйте ще раз.
```

---

## Database Structure

### tickets table
```
+---------------+-----------+--------------------+
| Column        | Type      | Description        |
+---------------+-----------+--------------------+
| id            | SERIAL    | Primary key        |
| telegram_id   | TEXT      | User's Telegram ID |
| type          | TEXT      | feedback/bug/...   |
| status        | TEXT      | open/closed        |
| subject       | TEXT      | Brief description  |
| created_at    | TIMESTAMP | When created       |
| updated_at    | TIMESTAMP | Last update        |
| closed_at     | TIMESTAMP | When closed        |
| closed_by     | TEXT      | Admin who closed   |
+---------------+-----------+--------------------+
```

### ticket_messages table
```
+---------------+-----------+--------------------+
| Column        | Type      | Description        |
+---------------+-----------+--------------------+
| id            | SERIAL    | Primary key        |
| ticket_id     | INTEGER   | FK to tickets      |
| sender_type   | TEXT      | user/admin         |
| sender_id     | TEXT      | Telegram ID        |
| message_type  | TEXT      | text/photo/video   |
| content       | TEXT      | Message text       |
| file_id       | TEXT      | Telegram file ID   |
| created_at    | TIMESTAMP | When sent          |
+---------------+-----------+--------------------+
```

---

## Key Features

✅ **Multi-type Support**: Bug reports, feature ideas, general feedback, region requests
✅ **Media Support**: Text, photos, and videos
✅ **Timeout Protection**: 5-minute timeout prevents abandoned sessions
✅ **Preview & Confirm**: Users can review before sending
✅ **Admin Notifications**: All admins notified immediately
✅ **Ticket Management**: View, close, reopen tickets
✅ **User Notifications**: Users notified when tickets are closed
✅ **Pagination**: Ticket list supports pagination (5 per page)
✅ **Message History**: Full conversation history per ticket

---

## Technical Details

### State Management
- Uses centralized `stateManager` with type: `feedback` or `regionRequest`
- Automatic cleanup after timeout or completion
- State persisted to database for recovery

### Security
- All inputs validated
- Parameterized SQL queries
- Admin-only access controls
- No file downloads (only file_id references)

### Performance
- Indexed columns for fast lookups
- Efficient pagination
- Minimal database queries

### User Experience
- Ukrainian language throughout
- Clear instructions
- Immediate feedback
- Cancel option at every step
- Mobile-friendly inline keyboards
