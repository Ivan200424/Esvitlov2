const usersDb = require('../database/users');

// Обробник команди /channel
async function handleChannel(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  
  try {
    const user = usersDb.getUserByTelegramId(telegramId);
    
    if (!user) {
      await bot.sendMessage(chatId, '❌ Спочатку налаштуйте бота командою /start');
      return;
    }
    
    const message = 
      `📺 <b>Підключення до каналу</b>\n\n` +
      `Щоб підключити бота до вашого каналу:\n\n` +
      `1️⃣ Додайте бота як адміністратора вашого каналу\n` +
      `2️⃣ Дайте боту права на публікацію повідомлень\n` +
      `3️⃣ Відправте в канал будь-яке повідомлення\n` +
      `4️⃣ Переслідіть це повідомлення боту\n\n` +
      (user.channel_id 
        ? `✅ Канал підключено: <code>${user.channel_id}</code>\n\nДля зміни каналу виконайте інструкції вище.`
        : `ℹ️ Канал ще не підключено.`);
    
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Помилка в handleChannel:', error);
    await bot.sendMessage(chatId, '❌ Виникла помилка.');
  }
}

// Обробник пересланих повідомлень для підключення каналу
async function handleForwardedMessage(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  
  try {
    // Перевіряємо чи це переслане повідомлення з каналу
    if (!msg.forward_from_chat || msg.forward_from_chat.type !== 'channel') {
      return;
    }
    
    const user = usersDb.getUserByTelegramId(telegramId);
    
    if (!user) {
      await bot.sendMessage(chatId, '❌ Спочатку налаштуйте бота командою /start');
      return;
    }
    
    const channelId = String(msg.forward_from_chat.id);
    const channelTitle = msg.forward_from_chat.title;
    
    // Перевіряємо чи бот є адміном каналу
    try {
      const chatMember = await bot.getChatMember(channelId, bot.options.id);
      
      if (chatMember.status !== 'administrator') {
        await bot.sendMessage(
          chatId,
          '❌ Бот не є адміністратором каналу. Додайте бота як адміністратора з правами на публікацію.'
        );
        return;
      }
      
      // Зберігаємо channel_id
      usersDb.updateUserChannel(telegramId, channelId);
      
      await bot.sendMessage(
        chatId,
        `✅ Канал "<b>${channelTitle}</b>" успішно підключено!\n\n` +
        `Тепер бот буде відправляти оновлення графіка в цей канал.`,
        { parse_mode: 'HTML' }
      );
      
    } catch (error) {
      console.error('Помилка перевірки прав бота:', error);
      await bot.sendMessage(
        chatId,
        '❌ Не вдалося перевірити права бота в каналі. ' +
        'Переконайтесь, що бот є адміністратором з правами на публікацію.'
      );
    }
    
  } catch (error) {
    console.error('Помилка в handleForwardedMessage:', error);
    await bot.sendMessage(chatId, '❌ Виникла помилка при підключенні каналу.');
  }
}

module.exports = {
  handleChannel,
  handleForwardedMessage,
};
