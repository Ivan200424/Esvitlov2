/**
 * Help UI
 * 
 * NEW implementation for v2 bot rewrite.
 */

const { getHelpKeyboard, getNavigationKeyboard } = require('../keyboards/InlineKeyboard');

/**
 * Show help menu
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {string} userId - User ID
 * @param {number} editMessageId - Message ID to edit (optional)
 */
async function showHelp(bot, chatId, userId, editMessageId = null) {
  const message = 
    '❓ <b>Допомога</b>\n\n' +
    'Оберіть розділ для отримання інформації:';

  const keyboard = getHelpKeyboard();

  try {
    if (editMessageId) {
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: editMessageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    } else {
      await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    }
  } catch (error) {
    console.error('Error showing help:', error);
  }
}

/**
 * Show how-to guide
 */
async function showHowTo(bot, query) {
  const message =
    '📖 <b>Як користуватись ботом</b>\n\n' +
    '1️⃣ <b>Налаштування</b>\n' +
    '   • Оберіть свій регіон та чергу\n' +
    '   • Підключіть канал (опційно)\n' +
    '   • Налаштуйте IP моніторинг (опційно)\n\n' +
    '2️⃣ <b>Перегляд графіка</b>\n' +
    '   • Натисніть "📊 Графік" для перегляду\n' +
    '   • Використайте "⏱ Таймер" для відліку часу\n\n' +
    '3️⃣ <b>Сповіщення</b>\n' +
    '   • Бот автоматично повідомляє про зміни\n' +
    '   • Налаштуйте куди отримувати сповіщення\n\n' +
    '4️⃣ <b>Статистика</b>\n' +
    '   • Переглядайте історію відключень\n' +
    '   • Аналізуйте час без світла';

  try {
    await bot.editMessageText(message, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: getNavigationKeyboard('help:back')
    });
  } catch (error) {
    console.error('Error showing how-to:', error);
  }
}

/**
 * Show FAQ
 */
async function showFaq(bot, query) {
  const message =
    '❓ <b>Часті питання</b>\n\n' +
    '<b>Чому не приходять сповіщення?</b>\n' +
    '→ Перевірте налаштування в меню ⚙️\n' +
    '→ Переконайтесь що регіон і черга вірні\n\n' +
    '<b>Як працює IP моніторинг?</b>\n' +
    '→ Бот пінгує ваш роутер\n' +
    '→ Визначає наявність світла за доступністю IP\n\n' +
    '<b>Що робити якщо графік не відображається?</b>\n' +
    '→ Спробуйте оновити: кнопка "🔄 Оновити"\n' +
    '→ Можливо дані ще не опубліковані\n\n' +
    '<b>Як підключити канал?</b>\n' +
    '→ Перейдіть в ⚙️ Налаштування\n' +
    '→ Оберіть "📢 Підключити канал"\n' +
    '→ Додайте бота адміністратором каналу';

  try {
    await bot.editMessageText(message, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: getNavigationKeyboard('help:back')
    });
  } catch (error) {
    console.error('Error showing FAQ:', error);
  }
}

/**
 * Handle help callback queries
 */
async function handleHelpCallback(bot, query) {
  const action = query.data.replace('help:', '');

  switch (action) {
    case 'howto':
      await showHowTo(bot, query);
      break;

    case 'faq':
      await showFaq(bot, query);
      break;

    case 'back':
      const chatId = query.message.chat.id;
      const userId = String(query.from.id);
      await showHelp(bot, chatId, userId, query.message.message_id);
      break;

    default:
      await bot.answerCallbackQuery(query.id, {
        text: '❓ Невідома дія',
        show_alert: false
      });
  }
}

module.exports = {
  showHelp,
  showHowTo,
  showFaq,
  handleHelpCallback
};
