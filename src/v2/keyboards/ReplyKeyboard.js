/**
 * Reply Keyboard Implementation
 * 
 * NEW implementation for v2 bot rewrite.
 * 
 * CRITICAL: Reply keyboards are for GLOBAL NAVIGATION ONLY.
 * Reply button presses are TEXT messages, NOT commands.
 * They must be handled by text message handlers, not command handlers.
 */

/**
 * Get the main reply keyboard
 * This keyboard is ALWAYS visible and provides global navigation.
 * 
 * Button presses generate TEXT messages:
 * - "🏠 Меню" → text: "🏠 Меню"
 * - "📊 Графік" → text: "📊 Графік"
 * etc.
 * 
 * DO NOT treat these as commands (/menu, /график, etc.)
 */
function getMainReplyKeyboard() {
  return {
    keyboard: [
      ['🏠 Меню', '📊 Графік'],
      ['⚙️ Налаштування', '📈 Статистика'],
      ['❓ Допомога']
    ],
    resize_keyboard: true,
    persistent: true
  };
}

/**
 * Remove reply keyboard (used rarely, e.g., during channel setup)
 */
function removeReplyKeyboard() {
  return {
    remove_keyboard: true
  };
}

module.exports = {
  getMainReplyKeyboard,
  removeReplyKeyboard
};
