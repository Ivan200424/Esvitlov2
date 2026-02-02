const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const config = require('./config');

// API routes
const settingsRouter = require('./api/settings');
const adminRouter = require('./api/admin');

const app = express();
app.set('trust proxy', 1);  // Довіряти першому proxy (Railway)
const PORT = process.env.PORT || 3000;

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Занадто багато запитів, спробуйте пізніше' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // More strict for auth endpoints
  message: { error: 'Занадто багато спроб автентифікації, спробуйте пізніше' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS для Telegram Web App
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-telegram-init-data');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Apply rate limiting to API routes
app.use('/api', apiLimiter);

// Rate limiting for static files (more lenient)
const staticLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Higher limit for static assets
  message: { error: 'Занадто багато запитів, спробуйте пізніше' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// API routes
app.use('/api', authLimiter, settingsRouter);
app.use('/api/admin', authLimiter, adminRouter);

// Статичні файли webapp з rate limiting
app.use(staticLimiter, express.static(path.join(__dirname, '../webapp')));

// SPA fallback - всі інші запити повертають index.html
app.get('*', staticLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, '../webapp/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
});

function startServer() {
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, () => {
      console.log(`🌐 Web App сервер запущено на порті ${PORT}`);
      resolve(server);
    });
    
    server.on('error', (error) => {
      console.error('❌ Помилка запуску Web App сервера:', error);
      reject(error);
    });
  });
}

function stopServer(server) {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('✅ Web App сервер зупинено');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  app,
  startServer,
  stopServer,
};
