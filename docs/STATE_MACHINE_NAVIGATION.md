# 📚 State Machine & Navigation Framework

## Огляд

Цей документ описує нові фреймворки для управління станами та навігацією у боті Вольтик, створені згідно з технічною специфікацією.

## 🔄 Formal State Machine

### Філософія

State Machine фреймворк реалізує формальну машину станів для управління користувацькими потоками (розділ 4 технічної специфікації):

- **ВСІ** взаємодії користувача як скінченна машина станів
- **ЖОДНИХ** неявних станів
- Кожен стан **ОБОВ'ЯЗКОВО** визначає: `onEnter`, `onInput`, `onCancel`, `onTimeout`, `onExit`
- Кожен стан **ОБОВ'ЯЗКОВО** має timeout
- Timeout **ОБОВ'ЯЗКОВО** очищає стан
- Cancel **ОБОВ'ЯЗКОВО** повертає контроль
- Переходи станів **ОБОВ'ЯЗКОВО** логуються
- Користувач **НІКОЛИ** не застряє у стані

### Базове Використання

```javascript
const { StateMachine, createStateHandler } = require('./src/state/stateMachine');

// Визначити стани
const wizardStates = {
  selectRegion: createStateHandler({
    // Викликається при вході в стан
    onEnter: async (userId, context, machine) => {
      // Відправити повідомлення користувачу
      await bot.sendMessage(userId, 'Оберіть регіон:', {
        reply_markup: regionKeyboard
      });
    },
    
    // Обробити введення користувача
    onInput: async (userId, input, context, machine) => {
      if (input.region) {
        // Перейти до наступного стану
        await machine.transition(userId, 'selectQueue', { 
          region: input.region 
        });
        return { handled: true };
      }
      return { handled: false };
    },
    
    // Користувач скасував
    onCancel: async (userId, context, machine) => {
      await bot.sendMessage(userId, 'Налаштування скасовано');
    },
    
    // Час вийшов
    onTimeout: async (userId, context, machine) => {
      await bot.sendMessage(userId, 'Час очікування минув. Почніть спочатку.');
    },
    
    // Вихід зі стану
    onExit: async (userId, context, machine) => {
      // Очистити тимчасові дані
    },
    
    // Таймаут для цього стану (1 година)
    timeout: 60 * 60 * 1000
  }),
  
  selectQueue: createStateHandler({
    onEnter: async (userId, context, machine) => {
      await bot.sendMessage(
        userId, 
        `Регіон: ${context.region}\nОберіть чергу:`,
        { reply_markup: queueKeyboard }
      );
    },
    onInput: async (userId, input, context, machine) => {
      if (input.queue) {
        // Завершити
        await saveUser(userId, context.region, input.queue);
        await machine.transition(userId, 'complete', { queue: input.queue });
        return { handled: true };
      }
      return { handled: false };
    },
    onCancel: async (userId, context, machine) => {
      await bot.sendMessage(userId, 'Налаштування скасовано');
    },
    onTimeout: async (userId, context, machine) => {
      await bot.sendMessage(userId, 'Час очікування минув');
    },
    onExit: async (userId, context, machine) => {}
  }),
  
  complete: createStateHandler({
    onEnter: async (userId, context, machine) => {
      await bot.sendMessage(userId, 'Налаштування завершено! ✅');
    },
    onInput: async () => ({ handled: true }),
    onCancel: async () => {},
    onTimeout: async () => {},
    onExit: async () => {}
  })
};

// Створити машину станів
const wizardMachine = new StateMachine('wizard', wizardStates, {
  defaultTimeout: 60 * 60 * 1000, // 1 година
  logTransitions: true,
  persistToDb: true
});

// Використання
// Початок
await wizardMachine.start(userId, 'selectRegion');

// Обробка введення
bot.on('callback_query', async (query) => {
  const userId = query.from.id;
  
  if (wizardMachine.isActive(userId)) {
    const result = await wizardMachine.handleInput(userId, {
      region: query.data // або інші дані
    });
  }
});

// Скасування
bot.onText(/\/cancel/, async (msg) => {
  await wizardMachine.cancel(msg.from.id);
});
```

### API

#### `StateMachine(name, states, options)`

Створює нову машину станів.

**Параметри:**
- `name` (string) - Ім'я машини станів
- `states` (object) - Об'єкт зі станами
- `options` (object):
  - `defaultTimeout` - Таймаут за замовчуванням (мс)
  - `logTransitions` - Логувати переходи (default: true)
  - `persistToDb` - Зберігати в БД (default: true)

**Методи:**
- `start(userId, initialState, context)` - Почати нову сесію
- `transition(userId, newState, additionalContext)` - Перехід до нового стану
- `handleInput(userId, input)` - Обробити введення користувача
- `cancel(userId)` - Скасувати машину станів
- `getState(userId)` - Отримати поточний стан
- `getInstance(userId)` - Отримати повну інформацію про сесію
- `isActive(userId)` - Перевірити чи активна сесія

#### `createStateHandler(handlers)`

Допоміжна функція для створення обробників стану.

**Параметри:**
- `handlers` (object):
  - `onEnter` (async function)
  - `onInput` (async function)
  - `onCancel` (async function)
  - `onTimeout` (async function)
  - `onExit` (async function)
  - `timeout` (number) - Таймаут у мілісекундах

## 🧭 Navigation Controller

### Філософія

Navigation Controller централізує управління клавіатурами та навігацією згідно з розділом 5 специфікації:

**Reply Keyboard:**
- Тільки глобальна навігація
- Статична
- Ніколи не змінює стан напряму

**Inline Keyboard:**
- Тільки контекстні дії
- Прив'язані до конкретного повідомлення та стану

**Обов'язкові кнопки:**
- ← Назад
- ⤴ Меню

### Базове Використання

```javascript
const navigationController = require('./src/services/NavigationController');

// Отримати глобальну Reply клавіатуру
const globalKeyboard = navigationController.getGlobalKeyboard();
await bot.sendMessage(userId, 'Головне меню:', globalKeyboard);

// Отримати контекстну Inline клавіатуру
const settingsKeyboard = navigationController.getContextualKeyboard('settings');
await bot.sendMessage(userId, 'Налаштування:', settingsKeyboard);

// Створити клавіатуру майстра (wizard)
const wizardKeyboard = navigationController.createWizardKeyboard(
  2,  // крок 2
  3,  // з 3 кроків
  [
    [{ text: 'Київ', callback_data: 'region_kyiv' }],
    [{ text: 'Дніпро', callback_data: 'region_dnipro' }]
  ]
);
await bot.sendMessage(userId, 'Крок 2: Оберіть регіон', wizardKeyboard);

// Створити клавіатуру підтвердження
const confirmKeyboard = navigationController.createConfirmationKeyboard(
  'delete_confirm',
  'delete_cancel',
  {
    confirmText: '🗑️ Видалити',
    cancelText: '❌ Скасувати'
  }
);
await bot.sendMessage(userId, 'Ви впевнені?', confirmKeyboard);

// Створити клавіатуру для помилки
const errorKeyboard = navigationController.createErrorKeyboard('retry_connection');
await bot.sendMessage(userId, '❌ Помилка з\'єднання', errorKeyboard);
```

### API

#### `getGlobalKeyboard()`

Повертає глобальну Reply клавіатуру для навігації.

#### `getContextualKeyboard(screen, options)`

Повертає контекстну Inline клавіатуру для екрану.

**Параметри:**
- `screen` (string) - Ім'я екрану (`main`, `settings`, `schedule`, тощо)
- `options` (object):
  - `hideBackButton` (boolean) - Сховати кнопку Назад
  - `hideMenuButton` (boolean) - Сховати кнопку Меню
  - `contentButtons` (array) - Додаткові кнопки

#### `createWizardKeyboard(step, totalSteps, buttons, options)`

Створює клавіатуру для багатокрокового майстра.

**Параметри:**
- `step` (number) - Поточний крок (від 1)
- `totalSteps` (number) - Загальна кількість кроків
- `buttons` (array) - Масив рядків кнопок
- `options` (object):
  - `hideCancel` (boolean) - Сховати кнопку Скасувати
  - `hideBack` (boolean) - Сховати кнопку Назад

#### `createConfirmationKeyboard(confirmData, cancelData, options)`

Створює клавіатуру підтвердження для критичних дій.

**Параметри:**
- `confirmData` (string) - callback_data для підтвердження
- `cancelData` (string) - callback_data для скасування
- `options` (object):
  - `confirmText` (string) - Текст кнопки підтвердження
  - `cancelText` (string) - Текст кнопки скасування
  - `hideMenu` (boolean) - Сховати кнопку Меню

#### `createErrorKeyboard(retryData)`

Створює клавіатуру для повідомлення про помилку (згідно з розділом 16.3 специфікації).

**Параметри:**
- `retryData` (string|null) - callback_data для повтору дії

#### `canNavigate(fromScreen, toScreen)`

Перевіряє чи можлива навігація між екранами.

**Параметри:**
- `fromScreen` (string) - Поточний екран
- `toScreen` (string) - Цільовий екран

**Повертає:** `boolean`

#### `getBackTarget(screen)`

Отримує цільовий екран для кнопки "Назад".

**Параметри:**
- `screen` (string) - Поточний екран

**Повертає:** `string` - Ім'я цільового екрану

#### `logNavigation(userId, from, to, method)`

Логує навігацію користувача (для моніторингу).

## 🔗 Інтеграція

### Приклад: Wizard з State Machine та Navigation Controller

```javascript
const { StateMachine, createStateHandler } = require('./src/state/stateMachine');
const navigationController = require('./src/services/NavigationController');

const onboardingStates = {
  welcome: createStateHandler({
    onEnter: async (userId) => {
      const keyboard = navigationController.createWizardKeyboard(1, 3, [
        [{ text: '▶️ Почати', callback_data: 'wizard_start' }]
      ], { hideBack: true });
      
      await bot.sendMessage(
        userId,
        '👋 Привіт! Налаштуймо бота для вас.',
        keyboard
      );
    },
    onInput: async (userId, input, context, machine) => {
      if (input.action === 'start') {
        await machine.transition(userId, 'selectRegion');
        return { handled: true };
      }
      return { handled: false };
    },
    onCancel: async (userId) => {
      await bot.sendMessage(userId, 'Налаштування скасовано');
    },
    onTimeout: async (userId) => {
      await bot.sendMessage(userId, 'Час очікування минув');
    },
    onExit: async () => {}
  }),
  
  selectRegion: createStateHandler({
    onEnter: async (userId) => {
      const keyboard = navigationController.createWizardKeyboard(2, 3, [
        [
          { text: 'Київ', callback_data: 'region_kyiv' },
          { text: 'Дніпро', callback_data: 'region_dnipro' }
        ],
        [
          { text: 'Одеса', callback_data: 'region_odesa' },
          { text: 'Київщина', callback_data: 'region_kyiv_region' }
        ]
      ]);
      
      await bot.sendMessage(
        userId,
        'Крок 2 з 3: Оберіть ваш регіон',
        keyboard
      );
    },
    onInput: async (userId, input, context, machine) => {
      if (input.region) {
        await machine.transition(userId, 'selectQueue', { region: input.region });
        return { handled: true };
      }
      if (input.action === 'back') {
        await machine.transition(userId, 'welcome');
        return { handled: true };
      }
      return { handled: false };
    },
    onCancel: async (userId) => {
      await bot.sendMessage(userId, 'Налаштування скасовано');
    },
    onTimeout: async (userId) => {
      await bot.sendMessage(userId, 'Час очікування минув');
    },
    onExit: async () => {}
  }),
  
  selectQueue: createStateHandler({
    onEnter: async (userId, context) => {
      const keyboard = navigationController.createWizardKeyboard(3, 3, [
        [
          { text: '1.1', callback_data: 'queue_1.1' },
          { text: '1.2', callback_data: 'queue_1.2' }
        ],
        [
          { text: '2.1', callback_data: 'queue_2.1' },
          { text: '2.2', callback_data: 'queue_2.2' }
        ]
      ]);
      
      await bot.sendMessage(
        userId,
        `Крок 3 з 3: Оберіть чергу\nРегіон: ${context.region}`,
        keyboard
      );
    },
    onInput: async (userId, input, context, machine) => {
      if (input.queue) {
        // Зберегти налаштування
        await saveUserSettings(userId, context.region, input.queue);
        await machine.transition(userId, 'complete', { queue: input.queue });
        return { handled: true };
      }
      if (input.action === 'back') {
        await machine.transition(userId, 'selectRegion');
        return { handled: true };
      }
      return { handled: false };
    },
    onCancel: async (userId) => {
      await bot.sendMessage(userId, 'Налаштування скасовано');
    },
    onTimeout: async (userId) => {
      await bot.sendMessage(userId, 'Час очікування минув');
    },
    onExit: async () => {}
  }),
  
  complete: createStateHandler({
    onEnter: async (userId, context) => {
      const globalKeyboard = navigationController.getGlobalKeyboard();
      
      await bot.sendMessage(
        userId,
        `✅ Готово!\n\nРегіон: ${context.region}\nЧерга: ${context.queue}\n\nТепер ви отримуватимете сповіщення про графік відключень.`,
        globalKeyboard
      );
    },
    onInput: async () => ({ handled: true }),
    onCancel: async () => {},
    onTimeout: async () => {},
    onExit: async () => {}
  })
};

const onboardingMachine = new StateMachine('onboarding', onboardingStates);

// Обробка callback
bot.on('callback_query', async (query) => {
  const userId = query.from.id;
  const data = query.data;
  
  if (onboardingMachine.isActive(userId)) {
    let input = {};
    
    if (data.startsWith('wizard_')) {
      const action = data.replace('wizard_', '');
      if (action === 'cancel') {
        await onboardingMachine.cancel(userId);
        return;
      }
      if (action === 'back') {
        input = { action: 'back' };
      } else {
        input = { action };
      }
    } else if (data.startsWith('region_')) {
      input = { region: data.replace('region_', '') };
    } else if (data.startsWith('queue_')) {
      input = { queue: data.replace('queue_', '') };
    }
    
    await onboardingMachine.handleInput(userId, input);
  }
});
```

## 📊 Моніторинг та Логування

Обидва фреймворки підтримують автоматичне логування:

```
🔄 [wizard] User 12345: START → selectRegion
🔄 [wizard] User 12345: selectRegion → selectQueue
🔄 [wizard] User 12345: selectQueue → complete
🧭 [Navigation] User 12345: main → settings (via button)
```

## 🧪 Тестування

Запустити тести:

```bash
# State Machine
NODE_ENV=test node test-state-machine.js

# Navigation Controller
NODE_ENV=test node test-navigation-controller.js
```

## 📝 Best Practices

1. **Завжди** визначайте всі 5 обробників для кожного стану
2. **Завжди** встановлюйте timeout для станів
3. **Використовуйте** Navigation Controller для всіх клавіатур
4. **Не створюйте** inline клавіатури вручну - використовуйте Navigation Controller
5. **Логуйте** всі навігаційні дії для моніторингу
6. **Тестуйте** кожен новий потік із state machine
7. **Перевіряйте** що користувач не може застрягти в жодному стані

## 🚀 Наступні Кроки

1. Мігрувати існуючі wizard потоки на State Machine
2. Інтегрувати Navigation Controller в усі хендлери
3. Додати інтеграційні тести для повних потоків
4. Створити візуальні діаграми станів для документації
