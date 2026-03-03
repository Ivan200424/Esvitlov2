// reply.js - Converts inline keyboards to reply keyboards while preserving custom emoji and styling

function convertInlineToReply(inlineKeyboard) {
    // Assuming `inlineKeyboard` is an array of arrays representing the inline keyboard
    const replyKeyboard = inlineKeyboard.map(row => {
        return row.map(button => {
            // Preserve custom emojis and styles
            return {
                text: button.text,
                callback_data: button.callback_data || null,
                emoji: extractEmoji(button.text) // Hypothetical function to extract and preserve emoji
            };
        });
    });
    return replyKeyboard;
}

function extractEmoji(text) {
    // Dummy implementation for extraction of emojis
    const emojiPattern = /([\ud83c\u00a0-\ud83d\udfff]+)/g;
    const matches = text.match(emojiPattern);
    return matches ? matches : [];
}

module.exports = { convertInlineToReply };