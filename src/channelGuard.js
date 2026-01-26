const cron = require('node-cron');
const usersDb = require('./database/users');

let bot = null;

// Initialize channel guard with daily check at 03:00
function initChannelGuard(botInstance) {
  bot = botInstance;
  console.log('🛡️ Ініціалізація захисту каналів...');
  
  // Schedule daily check at 03:00
  cron.schedule('0 3 * * *', async () => {
    console.log('🔍 Виконання щоденної перевірки каналів...');
    await verifyAllChannels();
  });
  
  console.log('✅ Захист каналів запущено (перевірка щодня о 03:00)');
}

// Verify all channels for branding compliance
async function verifyAllChannels() {
  try {
    const users = usersDb.getUsersWithChannelsForVerification();
    
    if (users.length === 0) {
      console.log('ℹ️ Немає каналів для перевірки');
      return;
    }
    
    console.log(`Перевірка ${users.length} каналів...`);
    
    for (const user of users) {
      try {
        await verifyChannelBranding(user);
      } catch (error) {
        console.error(`Помилка перевірки каналу для користувача ${user.telegram_id}:`, error.message);
      }
    }
    
    console.log('✅ Перевірка каналів завершена');
  } catch (error) {
    console.error('Помилка при перевірці каналів:', error);
  }
}

// Verify single channel branding
async function verifyChannelBranding(user) {
  // Skip already blocked channels
  if (user.channel_status === 'blocked') {
    return;
  }
  
  try {
    // Get current channel info
    const chatInfo = await bot.getChat(user.channel_id);
    
    const currentTitle = chatInfo.title || '';
    const currentDescription = chatInfo.description || '';
    let currentPhotoFileId = null;
    
    if (chatInfo.photo && chatInfo.photo.big_file_id) {
      currentPhotoFileId = chatInfo.photo.big_file_id;
    }
    
    // Check for violations
    const violations = [];
    
    if (currentTitle !== user.channel_title) {
      violations.push('назву');
      console.log(`[${user.telegram_id}] Змінено назву: "${user.channel_title}" -> "${currentTitle}"`);
    }
    
    if (currentDescription !== user.channel_description) {
      violations.push('опис');
      console.log(`[${user.telegram_id}] Змінено опис`);
    }
    
    if (user.channel_photo_file_id && currentPhotoFileId !== user.channel_photo_file_id) {
      violations.push('фото');
      console.log(`[${user.telegram_id}] Змінено фото`);
    }
    
    // If violations found, block the channel
    if (violations.length > 0) {
      console.log(`⚠️ Виявлено порушення для користувача ${user.telegram_id}: ${violations.join(', ')}`);
      
      // Update channel status to blocked
      usersDb.updateChannelStatus(user.telegram_id, 'blocked');
      
      // Send notification to user
      const violationText = violations.join('/');
      const message = 
        `⚠️ <b>Виявлено зміни в каналі "${user.channel_title}"</b>\n\n` +
        `Ви змінили ${violationText} каналу, що заборонено\n` +
        `правилами використання GridBot.\n\n` +
        `🔴 <b>Моніторинг зупинено.</b>\n\n` +
        `Щоб відновити роботу, налаштуйте канал заново\n` +
        `командою /setchannel`;
      
      try {
        await bot.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
      } catch (sendError) {
        console.error(`Не вдалося надіслати повідомлення користувачу ${user.telegram_id}:`, sendError.message);
      }
      
      console.log(`🔴 Канал користувача ${user.telegram_id} заблоковано`);
    }
    
  } catch (error) {
    // If channel is not accessible (deleted, bot removed, etc.), we don't block it
    // Just log the error
    console.error(`Не вдалося перевірити канал ${user.channel_id}:`, error.message);
  }
}

// Function to check and migrate existing users
async function checkExistingUsers(botInstance) {
  bot = botInstance;
  
  try {
    // Get all users with channels but without proper branding
    const stmt = require('./database/db').prepare(`
      SELECT * FROM users 
      WHERE channel_id IS NOT NULL 
      AND (channel_title IS NULL OR channel_title = '')
      AND is_active = 1
    `);
    
    const users = stmt.all();
    
    if (users.length === 0) {
      console.log('✅ Всі існуючі канали налаштовані правильно');
      return;
    }
    
    console.log(`⚠️ Знайдено ${users.length} каналів без правильного брендування`);
    
    // Block these channels and notify users
    for (const user of users) {
      try {
        // Update channel status to blocked
        usersDb.updateChannelStatus(user.telegram_id, 'blocked');
        
        // Send migration notification
        const message = 
          `⚠️ <b>Оновлення GridBot!</b>\n\n` +
          `Тепер всі канали мають використовувати стандартний формат:\n` +
          `• Назва: GridBot ⚡️ {ваша назва}\n` +
          `• Фото: стандартне фото GridBot\n\n` +
          `🔴 <b>Моніторинг вашого каналу зупинено.</b>\n\n` +
          `Щоб продовжити роботу, налаштуйте канал заново\n` +
          `командою /setchannel`;
        
        await bot.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
        console.log(`📧 Надіслано повідомлення про міграцію користувачу ${user.telegram_id}`);
      } catch (error) {
        console.error(`Помилка надсилання повідомлення користувачу ${user.telegram_id}:`, error.message);
      }
    }
    
    console.log('✅ Міграція існуючих користувачів завершена');
  } catch (error) {
    console.error('Помилка при перевірці існуючих користувачів:', error);
  }
}

module.exports = {
  initChannelGuard,
  verifyAllChannels,
  checkExistingUsers,
};
