const express = require('express');
const router = express.Router();
const usersDb = require('../database/users');
const { REGIONS, QUEUES } = require('../constants/regions');
const { authMiddleware } = require('./auth');

// Застосовуємо auth middleware до всіх роутів
router.use(authMiddleware);

// Отримати дані користувача
router.get('/user', async (req, res) => {
  try {
    const user = usersDb.getUserByTelegramId(req.telegramUserId);
    
    if (!user) {
      return res.status(404).json({ error: 'Користувача не знайдено' });
    }
    
    // Формуємо відповідь
    const response = {
      telegram_id: user.telegram_id,
      username: user.username,
      region: user.region,
      queue: user.queue,
      channel: user.channel_id ? {
        id: user.channel_id,
        title: user.channel_title || user.channel_user_title,
        description: user.channel_description || user.channel_user_description,
        status: user.channel_status || 'active',
        paused: user.channel_paused || false,
        delete_old_message: user.delete_old_message || false,
        picture_only: user.picture_only || false,
      } : null,
      router_ip: user.router_ip,
      is_active: Boolean(user.is_active),
      alerts: {
        notify_before_off: user.notify_before_off || 15,
        notify_before_on: user.notify_before_on || 15,
        alerts_off_enabled: Boolean(user.alerts_off_enabled),
        alerts_on_enabled: Boolean(user.alerts_on_enabled),
        notify_target: user.notify_target || 'both',
      },
      schedule_alerts: {
        schedule_alert_enabled: Boolean(user.schedule_alert_enabled),
        schedule_alert_minutes: user.schedule_alert_minutes || 30,
        schedule_alert_target: user.schedule_alert_target || 'both',
      },
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
    
    res.json(response);
  } catch (error) {
    console.error('Помилка в GET /user:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// Оновити регіон та чергу
router.post('/user/region', async (req, res) => {
  try {
    const { region, queue } = req.body;
    
    // Валідація
    if (!region || !queue) {
      return res.status(400).json({ error: 'Регіон та черга обов\'язкові' });
    }
    
    if (!REGIONS[region]) {
      return res.status(400).json({ error: 'Невірний регіон' });
    }
    
    if (!QUEUES.includes(queue)) {
      return res.status(400).json({ error: 'Невірна черга' });
    }
    
    const success = usersDb.updateUserRegionAndQueue(req.telegramUserId, region, queue);
    
    if (!success) {
      return res.status(404).json({ error: 'Користувача не знайдено' });
    }
    
    res.json({ success: true, message: 'Регіон та чергу оновлено' });
  } catch (error) {
    console.error('Помилка в POST /user/region:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// Оновити IP роутера
router.post('/user/ip', async (req, res) => {
  try {
    const { ip } = req.body;
    
    // Валідація IP (якщо вказано)
    if (ip) {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(ip)) {
        return res.status(400).json({ error: 'Невірний формат IP адреси' });
      }
    }
    
    const success = usersDb.updateUserRouterIp(req.telegramUserId, ip || null);
    
    if (!success) {
      return res.status(404).json({ error: 'Користувача не знайдено' });
    }
    
    res.json({ 
      success: true, 
      message: ip ? 'IP адресу оновлено' : 'IP адресу видалено' 
    });
  } catch (error) {
    console.error('Помилка в POST /user/ip:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// Оновити налаштування сповіщень
router.post('/user/alerts', async (req, res) => {
  try {
    const { 
      notify_before_off, 
      notify_before_on, 
      alerts_off_enabled, 
      alerts_on_enabled,
      notify_target 
    } = req.body;
    
    const settings = {};
    
    if (notify_before_off !== undefined) {
      settings.notifyBeforeOff = parseInt(notify_before_off);
    }
    
    if (notify_before_on !== undefined) {
      settings.notifyBeforeOn = parseInt(notify_before_on);
    }
    
    if (alerts_off_enabled !== undefined) {
      settings.alertsOffEnabled = Boolean(alerts_off_enabled);
    }
    
    if (alerts_on_enabled !== undefined) {
      settings.alertsOnEnabled = Boolean(alerts_on_enabled);
    }
    
    if (notify_target !== undefined) {
      if (!['bot', 'channel', 'both'].includes(notify_target)) {
        return res.status(400).json({ error: 'Невірне значення notify_target' });
      }
      settings.notifyTarget = notify_target;
    }
    
    const success = usersDb.updateUserAlertSettings(req.telegramUserId, settings);
    
    if (!success) {
      return res.status(404).json({ error: 'Користувача не знайдено' });
    }
    
    res.json({ success: true, message: 'Налаштування сповіщень оновлено' });
  } catch (error) {
    console.error('Помилка в POST /user/alerts:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// Оновити налаштування попереджень про графік
router.post('/user/schedule-alerts', async (req, res) => {
  try {
    const { 
      schedule_alert_enabled, 
      schedule_alert_minutes, 
      schedule_alert_target 
    } = req.body;
    
    const settings = {};
    
    if (schedule_alert_enabled !== undefined) {
      settings.scheduleAlertEnabled = Boolean(schedule_alert_enabled);
    }
    
    if (schedule_alert_minutes !== undefined) {
      settings.scheduleAlertMinutes = parseInt(schedule_alert_minutes);
    }
    
    if (schedule_alert_target !== undefined) {
      if (!['bot', 'channel', 'both'].includes(schedule_alert_target)) {
        return res.status(400).json({ error: 'Невірне значення schedule_alert_target' });
      }
      settings.scheduleAlertTarget = schedule_alert_target;
    }
    
    const success = usersDb.updateUserScheduleAlertSettings(req.telegramUserId, settings);
    
    if (!success) {
      return res.status(404).json({ error: 'Користувача не знайдено' });
    }
    
    res.json({ success: true, message: 'Налаштування попереджень оновлено' });
  } catch (error) {
    console.error('Помилка в POST /user/schedule-alerts:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// Видалити дані користувача
router.post('/user/delete', async (req, res) => {
  try {
    const success = usersDb.deleteUser(req.telegramUserId);
    
    if (!success) {
      return res.status(404).json({ error: 'Користувача не знайдено' });
    }
    
    res.json({ success: true, message: 'Дані користувача видалено' });
  } catch (error) {
    console.error('Помилка в POST /user/delete:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// Отримати список регіонів
router.get('/regions', async (req, res) => {
  try {
    const regions = Object.keys(REGIONS).map(code => ({
      code,
      name: REGIONS[code].name,
    }));
    
    res.json(regions);
  } catch (error) {
    console.error('Помилка в GET /regions:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// Отримати список черг
router.get('/queues', async (req, res) => {
  try {
    res.json(QUEUES);
  } catch (error) {
    console.error('Помилка в GET /queues:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

module.exports = router;
