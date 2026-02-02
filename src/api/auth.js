const crypto = require('crypto');
const config = require('../config');

/**
 * Перевірка Telegram initData для автентифікації Web App
 * Документація: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function verifyTelegramWebAppData(telegramInitData) {
  try {
    const encoded = decodeURIComponent(telegramInitData);
    const secret = crypto.createHmac('sha256', 'WebAppData').update(config.botToken);
    const arr = encoded.split('&');
    const hashIndex = arr.findIndex(str => str.startsWith('hash='));
    
    if (hashIndex === -1) {
      return null;
    }
    
    const hash = arr.splice(hashIndex)[0].split('=')[1];
    arr.sort((a, b) => a.localeCompare(b));
    const dataCheckString = arr.join('\n');
    
    const _hash = crypto.createHmac('sha256', secret.digest()).update(dataCheckString).digest('hex');
    
    if (_hash !== hash) {
      return null;
    }
    
    // Парсимо дані користувача
    const params = {};
    arr.forEach(item => {
      const [key, value] = item.split('=');
      params[key] = value;
    });
    
    // Перевіряємо термін дії (не старше 1 години)
    if (params.auth_date) {
      const authDate = parseInt(params.auth_date);
      const now = Math.floor(Date.now() / 1000);
      if (now - authDate > 3600) {
        return null;
      }
    }
    
    // Парсимо user JSON
    if (params.user) {
      try {
        params.user = JSON.parse(decodeURIComponent(params.user));
      } catch (e) {
        return null;
      }
    }
    
    return params;
  } catch (error) {
    console.error('Помилка перевірки Telegram Web App data:', error);
    return null;
  }
}

/**
 * Middleware для перевірки автентифікації
 */
function authMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'] || req.body.initData || req.query.initData;
  
  if (!initData) {
    return res.status(401).json({ error: 'Немає даних автентифікації' });
  }
  
  const verified = verifyTelegramWebAppData(initData);
  
  if (!verified || !verified.user) {
    return res.status(401).json({ error: 'Невірні дані автентифікації' });
  }
  
  req.telegramUser = verified.user;
  req.telegramUserId = String(verified.user.id);
  next();
}

/**
 * Middleware для перевірки адмін прав
 */
function adminMiddleware(req, res, next) {
  const userId = req.telegramUserId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Не автентифіковано' });
  }
  
  const isAdmin = config.adminIds.includes(userId) || userId === config.ownerId;
  
  if (!isAdmin) {
    return res.status(403).json({ error: 'Доступ заборонено' });
  }
  
  next();
}

module.exports = {
  verifyTelegramWebAppData,
  authMiddleware,
  adminMiddleware,
};
