const usersDb = require('../database/users');
const { formatWelcomeMessage } = require('../formatter');
const { getRegionKeyboard, getMainMenu, getQueueKeyboard, getConfirmKeyboard } = require('../keyboards/inline');
const { REGIONS } = require('../constants/regions');

// Стан wizard для кожного користувача
const wizardState = new Map();

// Запустити wizard для нового або існуючого користувача
async function startWizard(bot, chatId, telegramId, username, mode = 'new') {
  wizardState.set(telegramId, { step: 'region', mode });
  
  if (mode === 'new') {
    await bot.sendMessage(
      chatId,
      formatWelcomeMessage(username),
      { parse_mode: 'HTML', ...getRegionKeyboard() }
    );
  } else {
    await bot.sendMessage(
      chatId,
      '1️⃣ Оберіть ваш регіон:',
      getRegionKeyboard()
    );
  }
}

// Обробник команди /start
async function handleStart(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const username = msg.from.username || msg.from.first_name;
  
  try {
    // Перевіряємо чи користувач вже існує
    const user = usersDb.getUserByTelegramId(telegramId);
    
    if (user) {
      // Check if user was deactivated
      if (!user.is_active) {
        const { getRestorationKeyboard } = require('../keyboards/inline');
        await bot.sendMessage(
          chatId,
          `👋 З поверненням!\n\n` +
          `Ваш профіль було деактивовано.\n\n` +
          `Оберіть опцію:`,
          getRestorationKeyboard()
        );
        return;
      }
      
      // Існуючий користувач - показуємо головне меню
      const region = REGIONS[user.region]?.name || user.region;
      await bot.sendMessage(
        chatId,
        `Вітаємо знову! 👋\n\n` +
        `📍 Регіон: ${region}\n` +
        `⚡️ Черга: ${user.queue}\n\n` +
        `Використовуйте меню нижче:`,
        getMainMenu()
      );
    } else {
      // Новий користувач - запускаємо wizard
      await startWizard(bot, chatId, telegramId, username, 'new');
    }
  } catch (error) {
    console.error('Помилка в handleStart:', error);
    await bot.sendMessage(chatId, '❌ Виникла помилка. Спробуйте ще раз.');
  }
}

// Обробник callback query для wizard
async function handleWizardCallback(bot, query) {
  const chatId = query.message.chat.id;
  const telegramId = String(query.from.id);
  const data = query.data;
  
  try {
    const state = wizardState.get(telegramId) || { step: 'region' };
    
    // Вибір регіону
    if (data.startsWith('region_')) {
      const region = data.replace('region_', '');
      state.region = region;
      state.step = 'queue';
      wizardState.set(telegramId, state);
      
      await bot.editMessageText(
        `✅ Регіон: ${REGIONS[region].name}\n\n2️⃣ Оберіть чергу:`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: getQueueKeyboard().reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Вибір черги
    if (data.startsWith('queue_')) {
      const queue = data.replace('queue_', '');
      state.queue = queue;
      state.step = 'confirm';
      wizardState.set(telegramId, state);
      
      const region = REGIONS[state.region]?.name || state.region;
      
      await bot.editMessageText(
        `✅ Налаштування:\n\n` +
        `📍 Регіон: ${region}\n` +
        `⚡️ Черга: ${queue}\n\n` +
        `Підтвердіть налаштування:`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: getConfirmKeyboard().reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Підтвердження
    if (data === 'confirm_setup') {
      const username = query.from.username || query.from.first_name;
      const mode = state.mode || 'new';
      
      if (mode === 'edit') {
        // Режим редагування - оновлюємо існуючого користувача
        usersDb.updateUserRegionAndQueue(telegramId, state.region, state.queue);
        wizardState.delete(telegramId);
        
        const region = REGIONS[state.region]?.name || state.region;
        
        await bot.editMessageText(
          `✅ Налаштування оновлено!\n\n` +
          `📍 Регіон: ${region}\n` +
          `⚡️ Черга: ${state.queue}\n\n` +
          `Графік буде опублікований при наступній перевірці.`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
          }
        );
      } else {
        // Режим створення нового користувача
        usersDb.createUser(telegramId, username, state.region, state.queue);
        wizardState.delete(telegramId);
        
        const region = REGIONS[state.region]?.name || state.region;
        
        await bot.editMessageText(
          `✅ Налаштування збережено!\n\n` +
          `📍 Регіон: ${region}\n` +
          `⚡️ Черга: ${state.queue}\n\n` +
          `Тепер ви будете отримувати сповіщення про зміни графіка.\n\n` +
          `Використовуйте команду /channel для підключення до каналу.`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
          }
        );
        
        // Відправляємо головне меню
        await bot.sendMessage(chatId, 'Головне меню:', getMainMenu());
      }
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Назад до регіону
    if (data === 'back_to_region') {
      state.step = 'region';
      wizardState.set(telegramId, state);
      
      await bot.editMessageText(
        '1️⃣ Оберіть ваш регіон:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: getRegionKeyboard().reply_markup,
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
  } catch (error) {
    console.error('Помилка в handleWizardCallback:', error);
    await bot.answerCallbackQuery(query.id, { text: '❌ Виникла помилка' });
  }
}

module.exports = {
  handleStart,
  handleWizardCallback,
  startWizard,
};
