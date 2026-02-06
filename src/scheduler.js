const cron = require('node-cron');
const { fetchScheduleData } = require('./api');
const { parseScheduleForQueue, findNextEvent } = require('./parser');
const { calculateSchedulePeriodsHash, formatInterval } = require('./utils');
const usersDb = require('./database/users');
const config = require('./config');
const { REGION_CODES } = require('./constants/regions');

let bot = null;
let schedulerJob = null; // Track scheduler job for cleanup

// Day name constants
const DAY_NAMES = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота'];

// Helper: Get date string in format YYYY-MM-DD
function getDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Split events into today and tomorrow
function splitEventsByDay(events) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);
  
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);
  
  // Events are always within day boundaries (see parser.js), so we only check start time
  const todayEvents = events.filter(event => {
    const eventStart = new Date(event.start);
    return eventStart >= todayStart && eventStart <= todayEnd;
  });
  
  const tomorrowEvents = events.filter(event => {
    const eventStart = new Date(event.start);
    return eventStart >= tomorrowStart && eventStart <= tomorrowEnd;
  });
  
  return { todayEvents, tomorrowEvents };
}

// Handle day transition (midnight 00:00)
function handleDayTransition(user) {
  const now = new Date();
  const todayDateStr = getDateString(now);
  
  // Check if we need to shift tomorrow->today
  // This happens when:
  // 1. We have tomorrow's data saved
  // 2. Today's saved date is not today anymore (it's yesterday)
  if (user.last_published_date_tomorrow && user.last_published_date_today !== todayDateStr) {
    console.log(`[${user.telegram_id}] День змінився, зсуваємо завтра->сьогодні`);
    usersDb.shiftScheduleToToday(user.id);
    
    // Update user object for current check
    user.schedule_hash_today = user.schedule_hash_tomorrow;
    user.last_published_date_today = user.last_published_date_tomorrow;
    user.schedule_hash_tomorrow = null;
    user.last_published_date_tomorrow = null;
    
    return true;
  }
  
  return false;
}

// Determine what changed and what to publish
function determinePublicationScenario(user, todayHash, tomorrowHash, todayDateStr, tomorrowDateStr) {
  const todayIsNew = !user.schedule_hash_today;
  const todayChanged = user.schedule_hash_today && user.schedule_hash_today !== todayHash;
  const todayUnchanged = user.schedule_hash_today === todayHash;
  
  const tomorrowIsNew = !user.schedule_hash_tomorrow && tomorrowHash;
  const tomorrowChanged = user.schedule_hash_tomorrow && user.schedule_hash_tomorrow !== tomorrowHash;
  const tomorrowUnchanged = user.schedule_hash_tomorrow === tomorrowHash;
  
  // CRITICAL: Do not publish if nothing changed
  if (todayUnchanged && (tomorrowUnchanged || !tomorrowHash)) {
    return { shouldPublish: false, reason: 'Графіки не змінилися' };
  }
  
  // Determine scenarios according to requirements
  let scenario = null;
  
  if (todayIsNew && !tomorrowHash) {
    // Scenario 6.1: First publication of today's schedule (no tomorrow data)
    scenario = 'today_first';
  } else if (todayIsNew && tomorrowHash) {
    // First publication but we have tomorrow data too
    scenario = 'today_first_with_tomorrow';
  } else if (todayChanged && !tomorrowChanged && !tomorrowIsNew) {
    // Scenario 6.2: Today's schedule updated (tomorrow unchanged or doesn't exist)
    scenario = 'today_updated';
  } else if (tomorrowIsNew && todayUnchanged) {
    // Scenario 6.3: Tomorrow's schedule appeared for the first time, today unchanged
    scenario = 'tomorrow_appeared';
  } else if (tomorrowChanged && todayUnchanged) {
    // Tomorrow changed but today unchanged
    scenario = 'tomorrow_updated';
  } else if (tomorrowIsNew && todayChanged) {
    // Both tomorrow appeared AND today changed
    scenario = 'both_changed';
  } else if (todayChanged && tomorrowChanged) {
    // Both changed
    scenario = 'both_changed';
  } else if (todayChanged) {
    // Only today changed
    scenario = 'today_updated';
  } else if (tomorrowChanged) {
    // Only tomorrow changed
    scenario = 'tomorrow_updated';
  } else if (tomorrowIsNew) {
    // Tomorrow is new
    scenario = 'tomorrow_appeared';
  }
  
  return {
    shouldPublish: scenario !== null,
    scenario,
    todayIsNew,
    todayChanged,
    todayUnchanged,
    tomorrowIsNew,
    tomorrowChanged,
    tomorrowUnchanged
  };
}

// Format message according to scenario
function formatScheduleNotification(scenario, todayEvents, tomorrowEvents, region, queue, user) {
  const { REGIONS } = require('./constants/regions');
  const { formatTime, formatDurationFromMs } = require('./utils');
  
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  
  const todayDayName = DAY_NAMES[todayDate.getDay()];
  const tomorrowDayName = DAY_NAMES[tomorrowDate.getDay()];
  
  const todayDateStr = `${String(todayDate.getDate()).padStart(2, '0')}.${String(todayDate.getMonth() + 1).padStart(2, '0')}.${todayDate.getFullYear()}`;
  const tomorrowDateStr = `${String(tomorrowDate.getDate()).padStart(2, '0')}.${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}.${tomorrowDate.getFullYear()}`;
  
  const lines = [];
  
  // Helper to format event list
  const formatEvents = (events) => {
    const eventLines = [];
    let totalMinutes = 0;
    
    events.forEach(event => {
      const start = formatTime(event.start);
      const end = formatTime(event.end);
      const durationMs = new Date(event.end) - new Date(event.start);
      const durationStr = formatDurationFromMs(durationMs);
      totalMinutes += durationMs / 60000;
      eventLines.push(`🪫 ${start} - ${end} (~${durationStr})`);
    });
    
    // Add total duration
    const totalHours = Math.floor(totalMinutes / 60);
    const totalMins = Math.floor(totalMinutes % 60);
    let totalStr = '';
    if (totalHours > 0) {
      totalStr = `${totalHours} год`;
      if (totalMins > 0) totalStr += ` ${totalMins} хв`;
    } else {
      totalStr = `${totalMins} хв`;
    }
    eventLines.push(`\nЗагалом без світла: ~${totalStr}`);
    
    return eventLines.join('\n');
  };
  
  // Format based on scenario
  switch (scenario) {
    case 'today_first':
    case 'today_first_with_tomorrow':
      // Scenario 6.1: First publication of today's schedule
      lines.push(`📊 Графік відключень на сьогодні, ${todayDateStr} (${todayDayName}), для черги ${queue}:`);
      lines.push('');
      if (todayEvents.length > 0) {
        lines.push(formatEvents(todayEvents));
      } else {
        lines.push('✅ Відключень не заплановано');
      }
      
      // If we also have tomorrow data, add it
      if (scenario === 'today_first_with_tomorrow' && tomorrowEvents && tomorrowEvents.length > 0) {
        lines.push('');
        lines.push('─────────────────');
        lines.push('');
        lines.push(`💡 Зʼявився графік відключень на завтра, ${tomorrowDateStr} (${tomorrowDayName}), для черги ${queue}:`);
        lines.push('');
        lines.push(formatEvents(tomorrowEvents));
      }
      break;
      
    case 'today_updated':
      // Scenario 6.2: Today's schedule updated
      lines.push(`💡 Оновлено графік відключень на сьогодні, ${todayDateStr} (${todayDayName}), для черги ${queue}:`);
      lines.push('');
      if (todayEvents.length > 0) {
        lines.push(formatEvents(todayEvents));
      } else {
        lines.push('✅ Відключень не заплановано');
      }
      break;
      
    case 'tomorrow_appeared':
      // Scenario 6.3: Tomorrow's schedule appeared for first time
      lines.push(`💡 Зʼявився графік відключень на завтра, ${tomorrowDateStr} (${tomorrowDayName}), для черги ${queue}:`);
      lines.push('');
      if (tomorrowEvents.length > 0) {
        lines.push(formatEvents(tomorrowEvents));
      } else {
        lines.push('✅ Відключень не заплановано');
      }
      lines.push('');
      lines.push('─────────────────');
      lines.push('');
      lines.push('💡 Графік на сьогодні — без змін');
      break;
      
    case 'tomorrow_updated':
      // Tomorrow updated, today unchanged (Scenario 6.4)
      lines.push(`💡 Оновлено графік відключень на завтра, ${tomorrowDateStr} (${tomorrowDayName}), для черги ${queue}:`);
      lines.push('');
      if (tomorrowEvents.length > 0) {
        lines.push(formatEvents(tomorrowEvents));
      } else {
        lines.push('✅ Відключень не заплановано');
      }
      lines.push('');
      lines.push('─────────────────');
      lines.push('');
      lines.push('💡 Графік на сьогодні — без змін');
      break;
      
    case 'both_changed':
      // Both today and tomorrow changed
      // Show tomorrow first, then today (as per requirements when both change)
      if (tomorrowEvents && tomorrowEvents.length > 0) {
        lines.push(`💡 Оновлено графік відключень на завтра, ${tomorrowDateStr} (${tomorrowDayName}), для черги ${queue}:`);
        lines.push('');
        lines.push(formatEvents(tomorrowEvents));
        lines.push('');
        lines.push('─────────────────');
        lines.push('');
      }
      
      lines.push(`💡 Оновлено графік відключень на сьогодні, ${todayDateStr} (${todayDayName}), для черги ${queue}:`);
      lines.push('');
      if (todayEvents.length > 0) {
        lines.push(formatEvents(todayEvents));
      } else {
        lines.push('✅ Відключень не заплановано');
      }
      break;
      
    default:
      return null;
  }
  
  return lines.join('\n');
}

// Ініціалізація планувальника
function initScheduler(botInstance) {
  bot = botInstance;
  
  // CRITICAL FIX: Prevent duplicate scheduler initialization
  if (schedulerJob) {
    console.log('⚠️ Планувальник вже запущено, пропускаємо повторну ініціалізацію');
    return;
  }
  
  console.log('📅 Ініціалізація планувальника...');
  
  // Перевірка графіків - використовуємо секунди з конфігу
  const intervalSeconds = config.checkIntervalSeconds;
  
  // Якщо інтервал >= 60 секунд і ділиться на 60 націло, використовуємо cron в хвилинах
  // Інакше використовуємо setInterval
  if (intervalSeconds >= 60 && intervalSeconds % 60 === 0) {
    const intervalMinutes = intervalSeconds / 60;
    const cronExpression = `*/${intervalMinutes} * * * *`;
    
    schedulerJob = cron.schedule(cronExpression, async () => {
      console.log(`🔄 Перевірка графіків... (кожні ${formatInterval(intervalSeconds)})`);
      await checkAllSchedules();
    });
  } else {
    // Для інтервалів < 60 секунд або не кратних 60, використовуємо setInterval
    schedulerJob = setInterval(async () => {
      console.log(`🔄 Перевірка графіків... (кожні ${formatInterval(intervalSeconds)})`);
      await checkAllSchedules();
    }, intervalSeconds * 1000);
  }
  
  console.log(`✅ Планувальник запущено (перевірка кожні ${formatInterval(intervalSeconds)})`);
}

// Stop scheduler
function stopScheduler() {
  if (schedulerJob) {
    // Check if it's a cron job (has stop method) or setInterval (numeric ID)
    if (typeof schedulerJob === 'object' && schedulerJob.stop) {
      schedulerJob.stop();
    } else if (typeof schedulerJob === 'number') {
      clearInterval(schedulerJob);
    }
    schedulerJob = null;
    console.log('✅ Планувальник зупинено');
  }
}

// Перевірка всіх графіків
async function checkAllSchedules() {
  try {
    for (const region of REGION_CODES) {
      await checkRegionSchedule(region);
    }
  } catch (error) {
    console.error('Помилка при перевірці графіків:', error);
  }
}

// Перевірка графіка конкретного регіону
async function checkRegionSchedule(region) {
  try {
    // Отримуємо дані для регіону
    const data = await fetchScheduleData(region);
    
    // Отримуємо всіх користувачів для цього регіону
    const users = usersDb.getUsersByRegion(region);
    
    if (users.length === 0) {
      return;
    }
    
    console.log(`Перевірка ${region}: знайдено ${users.length} користувачів`);
    
    for (const user of users) {
      try {
        await checkUserSchedule(user, data);
      } catch (error) {
        console.error(`Помилка перевірки графіка для користувача ${user.telegram_id}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error(`Помилка при перевірці графіка для ${region}:`, error.message);
  }
}

// Перевірка графіка для конкретного користувача
async function checkUserSchedule(user, data) {
  try {
    // Skip blocked channels
    if (user.channel_status === 'blocked') {
      console.log(`[${user.telegram_id}] Пропущено - канал заблоковано`);
      return;
    }
    
    // Handle day transition
    handleDayTransition(user);
    
    // Parse schedule data
    const scheduleData = parseScheduleForQueue(data, user.queue);
    
    if (!scheduleData.hasData) {
      console.log(`[${user.telegram_id}] Немає даних графіка`);
      return;
    }
    
    // Split events by day
    const { todayEvents, tomorrowEvents } = splitEventsByDay(scheduleData.events);
    
    // Calculate hashes for today and tomorrow
    const todayHash = calculateSchedulePeriodsHash(todayEvents);
    const tomorrowHash = calculateSchedulePeriodsHash(tomorrowEvents);
    
    // Get current date strings
    const now = new Date();
    const todayDateStr = getDateString(now);
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowDateStr = getDateString(tomorrowDate);
    
    // Determine what to publish
    const decision = determinePublicationScenario(
      user,
      todayHash,
      tomorrowHash,
      todayDateStr,
      tomorrowDateStr
    );
    
    if (!decision.shouldPublish) {
      console.log(`[${user.telegram_id}] ${decision.reason}`);
      return;
    }
    
    console.log(`[${user.telegram_id}] Публікуємо: ${decision.scenario}`);
    
    // Format message
    const message = formatScheduleNotification(
      decision.scenario,
      todayEvents,
      tomorrowEvents,
      user.region,
      user.queue,
      user
    );
    
    if (!message) {
      console.log(`[${user.telegram_id}] Не вдалося сформувати повідомлення`);
      return;
    }
    
    // Get notification target setting
    const notifyTarget = user.power_notify_target || 'both';
    
    // Send to user's personal chat
    if (notifyTarget === 'bot' || notifyTarget === 'both') {
      try {
        const { fetchScheduleImage } = require('./api');
        
        // Try with photo
        try {
          const imageBuffer = await fetchScheduleImage(user.region, user.queue);
          await bot.sendPhoto(user.telegram_id, imageBuffer, {
            caption: message,
            parse_mode: 'HTML'
          }, { filename: 'schedule.png', contentType: 'image/png' });
        } catch (imgError) {
          // Without photo
          await bot.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
        }
        
        console.log(`📱 Графік відправлено користувачу ${user.telegram_id}`);
      } catch (error) {
        console.error(`Помилка відправки графіка користувачу ${user.telegram_id}:`, error.message);
      }
    }
    
    // Send to channel
    if (user.channel_id && (notifyTarget === 'channel' || notifyTarget === 'both')) {
      // Check if channel is paused
      if (user.channel_paused) {
        console.log(`Канал користувача ${user.telegram_id} зупинено, пропускаємо публікацію в канал`);
      } else {
        try {
          const { fetchScheduleImage } = require('./api');
          
          // Delete previous schedule message if delete_old_message is enabled
          if (user.delete_old_message && user.last_schedule_message_id) {
            try {
              await bot.deleteMessage(user.channel_id, user.last_schedule_message_id);
              console.log(`Видалено попереднє повідомлення ${user.last_schedule_message_id} з каналу ${user.channel_id}`);
            } catch (deleteError) {
              console.log(`Не вдалося видалити попереднє повідомлення: ${deleteError.message}`);
            }
          }
          
          let sentMessage;
          
          // Try with photo
          try {
            const imageBuffer = await fetchScheduleImage(user.region, user.queue);
            
            if (user.picture_only) {
              // Send only photo without caption
              sentMessage = await bot.sendPhoto(user.channel_id, imageBuffer, {}, 
                { filename: 'schedule.png', contentType: 'image/png' });
            } else {
              // Send photo with caption
              sentMessage = await bot.sendPhoto(user.channel_id, imageBuffer, {
                caption: message,
                parse_mode: 'HTML'
              }, { filename: 'schedule.png', contentType: 'image/png' });
            }
          } catch (imgError) {
            // Without photo
            sentMessage = await bot.sendMessage(user.channel_id, message, { parse_mode: 'HTML' });
          }
          
          // Save the message_id for potential deletion later
          if (sentMessage && sentMessage.message_id) {
            usersDb.updateLastScheduleMessageId(user.telegram_id, sentMessage.message_id);
          }
          
          console.log(`📢 Графік опубліковано в канал ${user.channel_id}`);
        } catch (channelError) {
          // CRITICAL FIX: Handle channel access errors properly
          console.error(`Не вдалося відправити в канал ${user.channel_id}:`, channelError.message);
          
          // Check if error indicates channel access lost
          const errorMsg = channelError.message || '';
          if (errorMsg.includes('chat not found') || 
              errorMsg.includes('bot was blocked') ||
              errorMsg.includes('bot was kicked') ||
              errorMsg.includes('not enough rights') ||
              errorMsg.includes('have no rights')) {
            // Mark channel as blocked
            console.log(`🚫 Канал ${user.channel_id} більше недоступний, позначаємо як заблокований`);
            usersDb.updateUser(user.telegram_id, { channel_status: 'blocked' });
            
            // Notify user about channel access loss (only if notifying to bot)
            if (notifyTarget === 'bot' || notifyTarget === 'both') {
              try {
                await bot.sendMessage(
                  user.telegram_id,
                  '⚠️ <b>Втрачено доступ до каналу</b>\n\n' +
                  `Не вдалося опублікувати графік у канал.\n` +
                  `Можливі причини:\n` +
                  `• Бот видалений з каналу\n` +
                  `• Бот втратив права адміністратора\n\n` +
                  `Перевірте налаштування каналу в меню.`,
                  { parse_mode: 'HTML' }
                );
              } catch (notifyError) {
                console.error(`Не вдалося сповістити користувача про втрату доступу:`, notifyError.message);
              }
            }
          }
        }
      }
    }
    
    // Update hashes after publication attempt
    // Note: We always update hashes to prevent infinite retry loops
    // even if channel publication failed, as the user will be notified
    usersDb.updateUserScheduleHashes(
      user.id,
      todayHash,
      tomorrowHash,
      todayDateStr,
      tomorrowDateStr
    );
    
  } catch (error) {
    console.error(`Помилка checkUserSchedule для користувача ${user.telegram_id}:`, error);
  }
}

module.exports = {
  initScheduler,
  checkAllSchedules,
  stopScheduler,
};
