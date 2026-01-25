const { formatTime, formatDate, getCurrentTime, getMinutesDifference } = require('./utils');

// Парсити дані графіка для конкретної черги
function parseScheduleForQueue(data, queue) {
  try {
    const queueKey = `GPV${queue}`;
    const queueData = data[queueKey];
    
    if (!queueData) {
      return {
        queue,
        events: [],
        hasData: false,
      };
    }
    
    const events = [];
    const now = getCurrentTime();
    
    // Парсимо події (відключення та включення)
    if (Array.isArray(queueData)) {
      queueData.forEach(event => {
        if (event.start && event.end) {
          events.push({
            type: 'outage',
            start: new Date(event.start),
            end: new Date(event.end),
            isPossible: event.type === 'possible' || event.possible === true,
          });
        }
      });
    } else if (typeof queueData === 'object') {
      // Альтернативний формат даних
      Object.keys(queueData).forEach(key => {
        const event = queueData[key];
        if (event.start && event.end) {
          events.push({
            type: 'outage',
            start: new Date(event.start),
            end: new Date(event.end),
            isPossible: event.type === 'possible' || event.possible === true,
          });
        }
      });
    }
    
    // Сортуємо події по часу початку
    events.sort((a, b) => a.start - b.start);
    
    return {
      queue,
      queueKey,
      events,
      hasData: events.length > 0,
    };
  } catch (error) {
    console.error(`Помилка парсингу графіка для черги ${queue}:`, error.message);
    return {
      queue,
      events: [],
      hasData: false,
      error: error.message,
    };
  }
}

// Знайти наступну подію (відключення або включення)
function findNextEvent(scheduleData) {
  const now = getCurrentTime();
  const events = scheduleData.events || [];
  
  for (const event of events) {
    // Перевіряємо чи ми зараз у періоді відключення
    if (now >= event.start && now <= event.end) {
      return {
        type: 'power_on',
        time: event.end,
        minutes: getMinutesDifference(event.end, now),
        isPossible: event.isPossible,
      };
    }
    
    // Перевіряємо чи відключення ще попереду
    if (now < event.start) {
      return {
        type: 'power_off',
        time: event.start,
        minutes: getMinutesDifference(event.start, now),
        isPossible: event.isPossible,
      };
    }
  }
  
  return null;
}

// Отримати події на сьогодні
function getTodayEvents(scheduleData) {
  const now = getCurrentTime();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  
  const events = scheduleData.events || [];
  
  return events.filter(event => {
    return event.start <= todayEnd && event.end >= todayStart;
  });
}

// Отримати події на завтра
function getTomorrowEvents(scheduleData) {
  const now = getCurrentTime();
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);
  
  const events = scheduleData.events || [];
  
  return events.filter(event => {
    return event.start <= tomorrowEnd && event.end >= tomorrowStart;
  });
}

// Перевірити чи зараз відключення
function isCurrentlyOff(scheduleData) {
  const now = getCurrentTime();
  const events = scheduleData.events || [];
  
  for (const event of events) {
    if (now >= event.start && now <= event.end) {
      return true;
    }
  }
  
  return false;
}

module.exports = {
  parseScheduleForQueue,
  findNextEvent,
  getTodayEvents,
  getTomorrowEvents,
  isCurrentlyOff,
};
