// Schedule monitoring service - checks for schedule updates
import * as storage from './storage.js';
import * as scheduleService from './schedules.js';
import * as parser from './parser.js';
import * as formatter from './formatter.js';
import * as deduplication from './deduplication.js';
import { env } from '../config/env.js';
import { InputFile } from 'grammy';

let monitoringInterval = null;
let bot = null;

export function startScheduleMonitoring(botInstance) {
  if (monitoringInterval) {
    console.log('⚠️ Schedule monitoring already running');
    return;
  }
  
  bot = botInstance;
  const intervalMs = env.CHECK_INTERVAL_SECONDS * 1000;
  
  monitoringInterval = setInterval(async () => {
    await checkAllUsers();
  }, intervalMs);
  
  console.log(`✅ Schedule monitoring запущено (інтервал: ${env.CHECK_INTERVAL_SECONDS}с)`);
}

export function stopScheduleMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('✅ Schedule monitoring зупинено');
  }
}

async function checkAllUsers() {
  try {
    const users = storage.getActiveUsers();
    
    // Group users by region for efficient API calls
    const usersByRegion = {};
    for (const user of users) {
      if (!usersByRegion[user.region]) {
        usersByRegion[user.region] = [];
      }
      usersByRegion[user.region].push(user);
    }
    
    // Check each region
    for (const [region, regionUsers] of Object.entries(usersByRegion)) {
      await checkRegion(region, regionUsers);
    }
  } catch (error) {
    console.error('Error in checkAllUsers:', error);
  }
}

async function checkRegion(region, users) {
  try {
    const scheduleData = await scheduleService.fetchScheduleData(region);
    
    for (const user of users) {
      await checkUserSchedule(user, scheduleData);
    }
  } catch (error) {
    console.error(`Error checking region ${region}:`, error);
  }
}

async function checkUserSchedule(user, scheduleData) {
  try {
    const parsedData = parser.parseScheduleForQueue(scheduleData, user.queue);
    
    if (!parsedData.hasData) {
      return;
    }
    
    // Check if schedule changed using hash
    const newHash = deduplication.createScheduleHash(parsedData);
    
    if (newHash === user.last_hash) {
      // No changes
      return;
    }
    
    // Schedule changed - detect what changed
    const oldData = user.last_schedule_data ? JSON.parse(user.last_schedule_data) : null;
    const changes = oldData ? parser.detectScheduleChanges(oldData, parsedData, user.queue) : null;
    
    // Update user hash
    storage.updateUser(user.telegram_id, {
      last_hash: newHash,
      last_schedule_data: JSON.stringify(parsedData)
    });
    
    // Send notification to user
    await notifyUser(user, parsedData, changes);
    
  } catch (error) {
    console.error(`Error checking schedule for user ${user.telegram_id}:`, error);
  }
}

async function notifyUser(user, scheduleData, changes) {
  try {
    const nextEvent = parser.getNextEvent(scheduleData);
    
    const message = formatter.formatScheduleMessage(
      user.region,
      user.queue,
      scheduleData,
      nextEvent,
      changes,
      null,
      false
    );
    
    // Try to send with image
    try {
      const imageBuffer = await scheduleService.fetchScheduleImage(user.region, user.queue);
      const imageFile = new InputFile(Buffer.from(imageBuffer));
      
      await bot.api.sendPhoto(user.telegram_id, imageFile, {
        caption: message,
        parse_mode: 'HTML'
      });
    } catch (imageError) {
      // Send text only if image fails
      await bot.api.sendMessage(user.telegram_id, message, {
        parse_mode: 'HTML'
      });
    }
    
    // If user has channel, publish there too
    if (user.channel_id && user.channel_status === 'active') {
      await publishToChannel(user, scheduleData, changes);
    }
    
  } catch (error) {
    console.error(`Error notifying user ${user.telegram_id}:`, error);
  }
}

async function publishToChannel(user, scheduleData, changes) {
  try {
    const nextEvent = parser.getNextEvent(scheduleData);
    
    const message = formatter.formatScheduleMessage(
      user.region,
      user.queue,
      scheduleData,
      nextEvent,
      changes,
      null,
      true // isChannel = true
    );
    
    // Check if we need to send or edit
    const newHash = deduplication.createScheduleHash(scheduleData);
    
    // Try to send with image
    const imageBuffer = await scheduleService.fetchScheduleImage(user.region, user.queue);
    const imageFile = new InputFile(Buffer.from(imageBuffer));
    
    if (user.delete_old_message && user.last_post_id) {
      // Delete old message first
      try {
        await bot.api.deleteMessage(user.channel_id, user.last_post_id);
      } catch (e) {
        // Ignore deletion errors
      }
    }
    
    let sentMessage;
    if (user.picture_only) {
      // Send only image with minimal caption
      sentMessage = await bot.api.sendPhoto(user.channel_id, imageFile, {
        caption: `Черга ${user.queue}`,
        parse_mode: 'HTML'
      });
    } else {
      // Send with full caption
      sentMessage = await bot.api.sendPhoto(user.channel_id, imageFile, {
        caption: message,
        parse_mode: 'HTML'
      });
    }
    
    // Update user with last post ID and hash
    storage.updateUser(user.telegram_id, {
      last_post_id: sentMessage.message_id,
      last_published_hash: newHash
    });
    
  } catch (error) {
    console.error(`Error publishing to channel for user ${user.telegram_id}:`, error);
    
    // Mark channel as blocked if we get a bot blocked error
    if (error.description && error.description.includes('bot was blocked')) {
      storage.updateUser(user.telegram_id, {
        channel_status: 'blocked'
      });
    }
  }
}
