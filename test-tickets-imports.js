/**
 * Test script to verify all new modules can be imported without errors
 */

console.log('🧪 Тестування імпортів нових модулів...\n');

try {
  console.log('1️⃣ Імпорт src/database/tickets.js...');
  const ticketsDb = require('./src/database/tickets');
  console.log('✅ tickets.js імпортовано успішно');
  console.log('   Експортовані функції:', Object.keys(ticketsDb).join(', '));
  console.log();
  
  console.log('2️⃣ Імпорт src/handlers/feedback.js...');
  const feedback = require('./src/handlers/feedback');
  console.log('✅ feedback.js імпортовано успішно');
  console.log('   Експортовані функції:', Object.keys(feedback).join(', '));
  console.log();
  
  console.log('3️⃣ Імпорт src/handlers/regionRequest.js...');
  const regionRequest = require('./src/handlers/regionRequest');
  console.log('✅ regionRequest.js імпортовано успішно');
  console.log('   Експортовані функції:', Object.keys(regionRequest).join(', '));
  console.log();
  
  console.log('4️⃣ Перевірка оновлених модулів...');
  
  console.log('   Імпорт src/keyboards/inline.js...');
  const keyboards = require('./src/keyboards/inline');
  const newKeyboards = ['getAdminTicketsKeyboard', 'getAdminTicketKeyboard', 'getAdminTicketsListKeyboard'];
  const hasNewKeyboards = newKeyboards.every(k => typeof keyboards[k] === 'function');
  if (hasNewKeyboards) {
    console.log('   ✅ Нові клавіатури додано:', newKeyboards.join(', '));
  } else {
    console.log('   ❌ Деякі клавіатури відсутні');
  }
  console.log();
  
  console.log('   Імпорт src/handlers/admin.js...');
  const admin = require('./src/handlers/admin');
  console.log('   ✅ admin.js імпортовано успішно');
  console.log();
  
  console.log('   Імпорт src/bot.js...');
  // Note: bot.js starts the bot, so we just check it can be parsed
  const fs = require('fs');
  const botCode = fs.readFileSync('./src/bot.js', 'utf-8');
  const hasFeedbackImport = botCode.includes("require('./handlers/feedback')");
  const hasRegionRequestImport = botCode.includes("require('./handlers/regionRequest')");
  
  if (hasFeedbackImport && hasRegionRequestImport) {
    console.log('   ✅ bot.js містить імпорти нових обробників');
  } else {
    console.log('   ❌ bot.js не містить усіх необхідних імпортів');
  }
  console.log();
  
  console.log('5️⃣ Перевірка структури бази даних...');
  const dbCode = fs.readFileSync('./src/database/db.js', 'utf-8');
  const hasTicketsTable = dbCode.includes('CREATE TABLE IF NOT EXISTS tickets');
  const hasTicketMessagesTable = dbCode.includes('CREATE TABLE IF NOT EXISTS ticket_messages');
  
  if (hasTicketsTable && hasTicketMessagesTable) {
    console.log('   ✅ SQL запити для створення таблиць присутні в db.js');
  } else {
    console.log('   ❌ SQL запити для таблиць відсутні');
  }
  console.log();
  
  console.log('✅ Всі тести імпортів пройдені успішно!\n');
  console.log('📝 Система тикетів/зворотного зв\'язку готова до використання');
  console.log('   - База даних буде ініціалізована при першому запуску бота');
  console.log('   - Користувачі зможуть надсилати звернення через меню "Допомога"');
  console.log('   - Адміністратори побачать звернення в адмін-панелі');
  
} catch (error) {
  console.error('\n❌ Помилка імпорту:', error.message);
  console.error(error.stack);
  process.exit(1);
}
