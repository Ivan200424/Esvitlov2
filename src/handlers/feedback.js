const { 
  saveFeedback, 
  updateFeedbackStats, 
  canSubmitFeedback 
} = require('../database/db');
const { getFeedbackTypeKeyboard, getFeedbackCancelKeyboard } = require('../keyboards/inline');
const { safeSendMessage, safeEditMessageText } = require('../utils/errorHandler');
const { getState, setState, clearState } = require('../state/stateManager');

// Constants
const MIN_FEEDBACK_LENGTH = 3;
const FEEDBACK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CONTEXTUAL_FEEDBACK_DELAY_MS = 2000; // 2 seconds

// Feedback type mappings
const FEEDBACK_TYPES = {
  bug: '🐞 Помилка',
  unclear: '🤔 Незрозуміло',
  idea: '💡 Ідея'
};

// Helper functions to manage feedback state
function setFeedbackState(telegramId, data) {
  setState('feedback', telegramId, { ...data, timestamp: Date.now() });
}

function getFeedbackState(telegramId) {
  return getState('feedback', telegramId);
}

function clearFeedbackState(telegramId) {
  const state = getState('feedback', telegramId);
  if (state && state.timeout) {
    clearTimeout(state.timeout);
  }
  clearState('feedback', telegramId);
}

// Main feedback handler
async function handleFeedback(bot, msg, context = null) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const username = msg.from.username || null;
  
  try {
    // Check if user can submit feedback (rate limiting)
    const permission = canSubmitFeedback(telegramId);
    
    if (!permission.allowed) {
      if (permission.reason === 'rate_limit') {
        await safeSendMessage(
          bot,
          chatId,
          `⏳ Зачекайте ${permission.waitMinutes} хв перед наступним відгуком.\n\n` +
          'Це допомагає уникнути спаму.',
          { parse_mode: 'HTML' }
        );
      } else if (permission.reason === 'daily_limit') {
        await safeSendMessage(
          bot,
          chatId,
          '📊 Досягнуто ліміт відгуків на сьогодні (10).\n\n' +
          'Спробуйте завтра.',
          { parse_mode: 'HTML' }
        );
      }
      return;
    }
    
    // Start feedback flow
    const sentMessage = await safeSendMessage(
      bot,
      chatId,
      '💬 <b>Зворотний звʼязок</b>\n\n' +
      'Оберіть тип відгуку:',
      {
        parse_mode: 'HTML',
        ...getFeedbackTypeKeyboard()
      }
    );
    
    if (sentMessage) {
      // Set up timeout for feedback flow
      const timeout = setTimeout(() => {
        clearFeedbackState(telegramId);
      }, FEEDBACK_TIMEOUT_MS);
      
      setFeedbackState(telegramId, {
        step: 'type_selection',
        messageId: sentMessage.message_id,
        context: context,
        timeout: timeout
      });
    }
    
  } catch (error) {
    console.error('Error in handleFeedback:', error);
    await safeSendMessage(
      bot,
      chatId,
      '❌ Виникла помилка. Спробуйте пізніше.',
      { parse_mode: 'HTML' }
    );
  }
}

// Handle feedback callback (type selection)
async function handleFeedbackCallback(bot, query) {
  const chatId = query.message.chat.id;
  const telegramId = String(query.from.id);
  const data = query.data;
  
  try {
    // Handle cancellation
    if (data === 'feedback_cancel') {
      clearFeedbackState(telegramId);
      
      await safeEditMessageText(
        bot,
        '❌ Скасовано.\n\nДякуємо за інтерес!',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        }
      );
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle type selection
    if (data.startsWith('feedback_type_')) {
      const type = data.replace('feedback_type_', '');
      const state = getFeedbackState(telegramId);
      
      if (!state) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Сесія завершена. Почніть знову.',
          show_alert: true
        });
        return;
      }
      
      // Update state with selected type
      setFeedbackState(telegramId, {
        ...state,
        step: 'text_input',
        feedbackType: type
      });
      
      // Ask for text input
      await safeEditMessageText(
        bot,
        `${FEEDBACK_TYPES[type]}\n\n` +
        'Опишіть ваш відгук одним повідомленням.\n' +
        'Можете писати скільки завгодно.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          ...getFeedbackCancelKeyboard()
        }
      );
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
  } catch (error) {
    console.error('Error in handleFeedbackCallback:', error);
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Виникла помилка',
      show_alert: true
    });
  }
}

// Handle feedback conversation (text input)
async function handleFeedbackConversation(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const username = msg.from.username || null;
  const text = msg.text;
  
  try {
    const state = getFeedbackState(telegramId);
    
    if (!state || state.step !== 'text_input') {
      return false; // Not in feedback conversation
    }
    
    // Validate text length
    if (!text || text.trim().length < MIN_FEEDBACK_LENGTH) {
      await safeSendMessage(
        bot,
        chatId,
        '❌ Відгук занадто короткий. Опишіть детальніше.',
        { parse_mode: 'HTML' }
      );
      return true; // Handled
    }
    
    // Save feedback to database
    const feedbackId = saveFeedback(
      telegramId,
      username,
      state.feedbackType,
      text.trim(),
      state.context?.type || null,
      state.context?.data || null
    );
    
    if (!feedbackId) {
      await safeSendMessage(
        bot,
        chatId,
        '❌ Не вдалося зберегти відгук. Спробуйте пізніше.',
        { parse_mode: 'HTML' }
      );
      clearFeedbackState(telegramId);
      return true;
    }
    
    // Update feedback stats for rate limiting
    updateFeedbackStats(telegramId);
    
    // Clear feedback state
    clearFeedbackState(telegramId);
    
    // Send thank you message
    await safeSendMessage(
      bot,
      chatId,
      '🙌 <b>Дякую!</b>\n\n' +
      'Це допоможе зробити бота кращим.',
      { parse_mode: 'HTML' }
    );
    
    return true; // Handled
    
  } catch (error) {
    console.error('Error in handleFeedbackConversation:', error);
    await safeSendMessage(
      bot,
      chatId,
      '❌ Виникла помилка. Спробуйте пізніше.',
      { parse_mode: 'HTML' }
    );
    clearFeedbackState(telegramId);
    return true;
  }
}

// Contextual feedback after wizard cancel/timeout
async function offerFeedbackAfterCancel(bot, chatId, telegramId) {
  try {
    await safeSendMessage(
      bot,
      chatId,
      '🤔 Що було незрозуміло?\n\n' +
      'Можете залишити відгук, щоб допомогти покращити бота.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💬 Залишити відгук', callback_data: 'offer_feedback_cancel' }],
            [{ text: '❌ Пропустити', callback_data: 'skip_feedback' }]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Error offering feedback after cancel:', error);
  }
}

// Contextual feedback after error
async function offerFeedbackAfterError(bot, chatId, telegramId, errorType = null) {
  try {
    await safeSendMessage(
      bot,
      chatId,
      '🐞 Хочете повідомити про проблему?\n\n' +
      'Ваш відгук допоможе виправити помилку.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🐞 Повідомити про помилку', callback_data: 'offer_feedback_error' }],
            [{ text: '❌ Пропустити', callback_data: 'skip_feedback' }]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Error offering feedback after error:', error);
  }
}

module.exports = {
  handleFeedback,
  handleFeedbackCallback,
  handleFeedbackConversation,
  offerFeedbackAfterCancel,
  offerFeedbackAfterError
};
