const express = require('express');
const router = express.Router();
const usersDb = require('../database/users');
const { getSetting, setSetting } = require('../database/db');
const { authMiddleware, adminMiddleware } = require('./auth');

// Застосовуємо auth та admin middleware до всіх роутів
router.use(authMiddleware);
router.use(adminMiddleware);

// Отримати статистику
router.get('/stats', async (req, res) => {
  try {
    const stats = usersDb.getUserStats();
    
    // Додаткова статистика
    const allUsers = usersDb.getAllUsers();
    const withIp = allUsers.filter(u => u.router_ip).length;
    const withAlerts = allUsers.filter(u => u.is_active).length;
    const pausedChannels = allUsers.filter(u => u.channel_id && u.channel_paused).length;
    
    const response = {
      total: stats.total,
      active: stats.active,
      with_channels: stats.withChannels,
      with_ip: withIp,
      with_alerts: withAlerts,
      paused_channels: pausedChannels,
    };
    
    res.json(response);
  } catch (error) {
    console.error('Помилка в GET /admin/stats:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// Отримати системну інформацію
router.get('/system', async (req, res) => {
  try {
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    
    const response = {
      uptime_seconds: Math.floor(uptime),
      uptime_formatted: formatUptime(uptime),
      memory: {
        rss: Math.round(memory.rss / 1024 / 1024),
        heap_total: Math.round(memory.heapTotal / 1024 / 1024),
        heap_used: Math.round(memory.heapUsed / 1024 / 1024),
        external: Math.round(memory.external / 1024 / 1024),
      },
      node_version: process.version,
      platform: process.platform,
    };
    
    res.json(response);
  } catch (error) {
    console.error('Помилка в GET /admin/system:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// Отримати налаштування інтервалів
router.get('/intervals', async (req, res) => {
  try {
    const scheduleInterval = getSetting('schedule_check_interval') || '60';
    const ipInterval = getSetting('power_check_interval') || '2';
    const debounceMinutes = getSetting('power_debounce_minutes') || '5';
    
    const response = {
      schedule_check_interval: parseInt(scheduleInterval),
      power_check_interval: parseInt(ipInterval),
      power_debounce_minutes: parseInt(debounceMinutes),
    };
    
    res.json(response);
  } catch (error) {
    console.error('Помилка в GET /admin/intervals:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// Оновити налаштування інтервалів
router.post('/intervals', async (req, res) => {
  try {
    const { schedule_check_interval, power_check_interval, power_debounce_minutes } = req.body;
    
    if (schedule_check_interval !== undefined) {
      const value = parseInt(schedule_check_interval);
      if (value < 1 || value > 60) {
        return res.status(400).json({ error: 'schedule_check_interval має бути від 1 до 60 хвилин' });
      }
      setSetting('schedule_check_interval', String(value * 60)); // зберігаємо в секундах
    }
    
    if (power_check_interval !== undefined) {
      const value = parseInt(power_check_interval);
      if (value < 1 || value > 300) {
        return res.status(400).json({ error: 'power_check_interval має бути від 1 до 300 секунд' });
      }
      setSetting('power_check_interval', String(value));
    }
    
    if (power_debounce_minutes !== undefined) {
      const value = parseInt(power_debounce_minutes);
      if (value < 1 || value > 30) {
        return res.status(400).json({ error: 'power_debounce_minutes має бути від 1 до 30 хвилин' });
      }
      setSetting('power_debounce_minutes', String(value));
    }
    
    res.json({ success: true, message: 'Налаштування інтервалів оновлено' });
  } catch (error) {
    console.error('Помилка в POST /admin/intervals:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// Broadcast повідомлення (повертає тільки підтвердження, фактична розсилка буде окремо)
router.post('/broadcast', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Повідомлення не може бути порожнім' });
    }
    
    // Отримуємо список активних користувачів
    const users = usersDb.getAllUsers();
    const activeUsers = users.filter(u => u.is_active);
    
    // В реальному використанні тут має бути виклик функції розсилки
    // Для Web App це просто повертає підтвердження
    res.json({ 
      success: true, 
      message: 'Broadcast прийнято до відправки',
      recipients: activeUsers.length 
    });
  } catch (error) {
    console.error('Помилка в POST /admin/broadcast:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// Helper функція для форматування uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}д`);
  if (hours > 0) parts.push(`${hours}г`);
  if (minutes > 0) parts.push(`${minutes}хв`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}с`);
  
  return parts.join(' ');
}

module.exports = router;
