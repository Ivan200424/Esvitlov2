const express = require('express');
const path = require('path');
const config = require('./config');

// API routes
const settingsRouter = require('./api/settings');
const adminRouter = require('./api/admin');

const app = express();
const PORT = process.env.PORT || 3000;

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

// API routes
app.use('/api', settingsRouter);
app.use('/api/admin', adminRouter);

// Статичні файли webapp
app.use(express.static(path.join(__dirname, '../webapp')));

// SPA fallback - всі інші запити повертають index.html
app.get('*', (req, res) => {
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
