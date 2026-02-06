# Scaling Guide

## Overview

This guide explains how to scale the eSvitlo-monitor-bot to handle more users, channels, regions, and parallel tasks.

## Current Architecture Readiness

The bot is designed to scale according to these principles:

### ✅ Already Implemented
- **State Persistence**: All critical state in database
- **Event-Driven**: Components communicate via events
- **Structured Logging**: Ready for log aggregation
- **Separation of Concerns**: Business logic separated from handlers
- **Explicit Scheduler Lifecycle**: Controlled task execution
- **Fault Isolation**: Errors don't cascade
- **Retry Logic**: Automatic retry with backoff
- **Idempotent Tasks**: Prevents duplicate execution

### 🔄 Ready for Implementation
- **Horizontal Scaling**: Multiple instances with coordination
- **Distributed State**: Redis for shared state
- **Load Balancing**: Multiple workers
- **Circuit Breakers**: Protect external APIs

## Scaling Dimensions

### 1. More Users

**Current Capacity**: ~1000 users
**Target Capacity**: 10,000+ users

#### Changes Needed:
1. **Database Optimization**
   ```sql
   -- Ensure indexes exist
   CREATE INDEX IF NOT EXISTS idx_users_region_queue ON users(region, queue);
   CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
   CREATE INDEX IF NOT EXISTS idx_users_channel_id ON users(channel_id);
   ```

2. **Batch Processing**
   ```javascript
   // Process users in batches
   const BATCH_SIZE = 100;
   const users = usersDb.getUsersByRegion(region);
   
   for (let i = 0; i < users.length; i += BATCH_SIZE) {
     const batch = users.slice(i, i + BATCH_SIZE);
     await Promise.all(batch.map(user => processUser(user)));
   }
   ```

3. **Rate Limiting**
   ```javascript
   // Add rate limiter for Telegram API
   const rateLimiter = new RateLimiter({
     tokensPerInterval: 30,
     interval: 1000 // 30 messages per second
   });
   
   await rateLimiter.removeTokens(1);
   await bot.sendMessage(...);
   ```

### 2. More Channels

**Current Capacity**: ~500 channels
**Target Capacity**: 5,000+ channels

#### Changes Needed:
1. **Channel Health Monitoring**
   ```javascript
   // Track channel health
   schedulerManager.register('channel_health', async () => {
     const channels = usersDb.getAllChannels();
     for (const channel of channels) {
       try {
         await bot.getChat(channel.channel_id);
         // Channel is healthy
       } catch (error) {
         // Mark as blocked
         usersDb.updateChannelStatus(channel.id, 'blocked');
       }
     }
   }, { interval: 3600 }); // Check every hour
   ```

2. **Channel Grouping**
   ```javascript
   // Group channels by region for efficient processing
   const channelsByRegion = new Map();
   for (const user of users) {
     if (!user.channel_id) continue;
     
     if (!channelsByRegion.has(user.region)) {
       channelsByRegion.set(user.region, []);
     }
     channelsByRegion.get(user.region).push(user);
   }
   ```

### 3. More Regions

**Current Capacity**: 4 regions
**Target Capacity**: 20+ regions

#### Changes Needed:
1. **Parallel Region Processing**
   ```javascript
   // Process regions in parallel
   async function checkAllSchedules() {
     const regionPromises = REGION_CODES.map(region => 
       checkRegionSchedule(region)
     );
     
     await Promise.allSettled(regionPromises);
   }
   ```

2. **Region-Specific Schedulers**
   ```javascript
   // One scheduler per region for isolation
   for (const region of REGION_CODES) {
     schedulerManager.register(`schedule_${region}`, async () => {
       await checkRegionSchedule(region);
     }, { 
       interval: 60,
       idempotent: true 
     });
     
     schedulerManager.start(`schedule_${region}`);
   }
   ```

### 4. More Parallel Tasks

**Current Capacity**: Sequential processing
**Target Capacity**: Full parallelization

#### Changes Needed:
1. **Worker Pool Pattern**
   ```javascript
   const { Worker } = require('worker_threads');
   
   class WorkerPool {
     constructor(size) {
       this.workers = [];
       this.queue = [];
       
       for (let i = 0; i < size; i++) {
         this.workers.push(new Worker('./worker.js'));
       }
     }
     
     async execute(task) {
       const worker = await this.getAvailableWorker();
       return worker.execute(task);
     }
   }
   ```

2. **Async Queue**
   ```javascript
   const { Queue } = require('async');
   
   const taskQueue = new Queue(async (task) => {
     await processTask(task);
   }, { concurrency: 10 }); // 10 parallel tasks
   
   // Add tasks
   taskQueue.push({ user, type: 'schedule_check' });
   ```

## Horizontal Scaling (Multiple Instances)

### Prerequisites
1. Shared database (PostgreSQL recommended for production)
2. Redis for distributed state
3. Load balancer (nginx, HAProxy)
4. Message queue (RabbitMQ, Redis pub/sub)

### Architecture

```
                    ┌────────────────┐
                    │ Load Balancer  │
                    └────────┬───────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
   │ Bot     │         │ Bot     │         │ Bot     │
   │ Instance│         │ Instance│         │ Instance│
   │    1    │         │    2    │         │    3    │
   └────┬────┘         └────┬────┘         └────┬────┘
        │                   │                    │
        └───────────────────┼────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
       ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
       │PostgreSQL│    │  Redis  │    │RabbitMQ │
       │    DB   │    │  Cache  │    │  Queue  │
       └─────────┘    └─────────┘    └─────────┘
```

### Implementation Steps

#### 1. Shared Database
```javascript
// config.js
const config = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'esvitlo',
    user: process.env.DB_USER,
    password: process.env.DB_PASS
  }
};
```

#### 2. Redis for State
```javascript
// src/core/StateManager.js
const Redis = require('ioredis');

class StateManager {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }
  
  async set(namespace, key, value, options = {}) {
    const fullKey = `${namespace}:${key}`;
    const data = JSON.stringify({
      value,
      timestamp: Date.now(),
      ttl: options.ttl
    });
    
    if (options.ttl) {
      await this.redis.setex(fullKey, options.ttl / 1000, data);
    } else {
      await this.redis.set(fullKey, data);
    }
  }
  
  async get(namespace, key) {
    const fullKey = `${namespace}:${key}`;
    const data = await this.redis.get(fullKey);
    
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    return parsed.value;
  }
}
```

#### 3. Distributed Locks
```javascript
const Redlock = require('redlock');

class SchedulerManager {
  constructor() {
    this.redlock = new Redlock([redis], {
      driftFactor: 0.01,
      retryCount: 3,
      retryDelay: 200
    });
  }
  
  async _executeTask(name) {
    const lockKey = `scheduler:lock:${name}`;
    const ttl = 60000; // 60 seconds
    
    try {
      const lock = await this.redlock.acquire([lockKey], ttl);
      
      try {
        await this.task();
      } finally {
        await lock.release();
      }
    } catch (error) {
      // Lock already held by another instance
      log.debug('Task already running on another instance', {
        scheduler: name
      });
    }
  }
}
```

#### 4. Message Queue
```javascript
const amqp = require('amqplib');

class MessageQueue {
  async connect() {
    this.connection = await amqp.connect(process.env.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();
  }
  
  async publish(queue, message) {
    await this.channel.assertQueue(queue, { durable: true });
    this.channel.sendToQueue(
      queue, 
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
  }
  
  async consume(queue, handler) {
    await this.channel.assertQueue(queue, { durable: true });
    this.channel.prefetch(1);
    
    this.channel.consume(queue, async (msg) => {
      const data = JSON.parse(msg.content.toString());
      
      try {
        await handler(data);
        this.channel.ack(msg);
      } catch (error) {
        log.error('Failed to process message', error);
        this.channel.nack(msg, false, true); // Requeue
      }
    });
  }
}
```

### 5. Instance Coordination

```javascript
// One instance handles scheduled tasks
const isLeader = async () => {
  const leader = await redis.get('scheduler:leader');
  return leader === process.env.INSTANCE_ID;
};

// Leader election
const electLeader = async () => {
  const acquired = await redis.set(
    'scheduler:leader',
    process.env.INSTANCE_ID,
    'EX', 30, // 30 seconds TTL
    'NX' // Only if not exists
  );
  
  return acquired === 'OK';
};

// Heartbeat
setInterval(async () => {
  if (await isLeader()) {
    // Refresh leadership
    await redis.expire('scheduler:leader', 30);
  } else {
    // Try to become leader
    await electLeader();
  }
}, 10000); // Every 10 seconds
```

## Monitoring and Observability

### 1. Health Check Endpoint

```javascript
const express = require('express');
const app = express();

app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: Date.now(),
    checks: {}
  };
  
  // Database check
  try {
    await db.raw('SELECT 1');
    health.checks.database = 'ok';
  } catch (error) {
    health.checks.database = 'error';
    health.status = 'degraded';
  }
  
  // Scheduler check
  const schedulerStats = schedulerManager.getStats();
  health.checks.scheduler = {
    status: schedulerStats.running > 0 ? 'ok' : 'error',
    running: schedulerStats.running,
    totalRuns: schedulerStats.totalRuns
  };
  
  // Redis check (if using)
  try {
    await redis.ping();
    health.checks.redis = 'ok';
  } catch (error) {
    health.checks.redis = 'error';
    health.status = 'degraded';
  }
  
  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

app.listen(process.env.HEALTH_PORT || 3000);
```

### 2. Metrics

```javascript
const prometheus = require('prom-client');

// Create metrics
const scheduleChecks = new prometheus.Counter({
  name: 'schedule_checks_total',
  help: 'Total number of schedule checks',
  labelNames: ['region', 'status']
});

const notificationsSent = new prometheus.Counter({
  name: 'notifications_sent_total',
  help: 'Total notifications sent',
  labelNames: ['type', 'success']
});

// Record metrics
scheduleChecks.inc({ region: 'kyiv', status: 'success' });
notificationsSent.inc({ type: 'schedule', success: 'true' });

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});
```

### 3. Log Aggregation

```javascript
// Use structured logging
const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');

const logger = winston.createLogger({
  transports: [
    new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_URL
      }
    })
  ]
});
```

## Performance Optimization

### 1. Database Connection Pool

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  max: 20, // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

### 2. Caching

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

async function fetchScheduleData(region) {
  const cacheKey = `schedule:${region}`;
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  // Fetch from API
  const data = await api.fetchScheduleData(region);
  
  // Store in cache
  cache.set(cacheKey, data);
  
  return data;
}
```

### 3. Batch Operations

```javascript
// Batch database updates
async function updateMultipleUsers(updates) {
  const query = `
    UPDATE users
    SET updated_at = NOW(),
        last_hash = data.hash
    FROM (VALUES ${updates.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',')})
      AS data(telegram_id, hash)
    WHERE users.telegram_id = data.telegram_id
  `;
  
  const params = updates.flatMap(u => [u.telegram_id, u.hash]);
  await db.query(query, params);
}
```

## Deployment Strategies

### 1. Rolling Update

```yaml
# docker-compose.yml
version: '3.8'
services:
  bot:
    image: esvitlo-bot:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
```

### 2. Blue-Green Deployment

```bash
# Deploy new version (green)
docker-compose -f docker-compose.green.yml up -d

# Test green deployment
curl http://green.example.com/health

# Switch traffic to green
# Update load balancer config

# Stop blue deployment
docker-compose -f docker-compose.blue.yml down
```

### 3. Canary Deployment

```nginx
# nginx.conf
upstream bot_stable {
  server bot1:3000 weight=9;
}

upstream bot_canary {
  server bot_canary:3000 weight=1;
}

server {
  location / {
    proxy_pass http://bot_stable;
  }
}
```

## Troubleshooting at Scale

### High CPU Usage
1. Check scheduler concurrency
2. Look for infinite loops
3. Profile with `node --prof`

### High Memory Usage
1. Check for memory leaks
2. Verify state cleanup is running
3. Monitor event history size

### Slow Database Queries
1. Enable query logging
2. Check missing indexes
3. Analyze slow query log

### Telegram Rate Limits
1. Implement proper rate limiting
2. Use queue for messages
3. Batch notifications when possible

## Conclusion

The bot is architecturally ready for scaling. Key points:

✅ **Current State**: Ready for 1000+ users, 4 regions
✅ **With DB Optimization**: 10,000+ users, 20+ regions
✅ **With Horizontal Scaling**: 100,000+ users, unlimited regions

Scale incrementally and monitor metrics at each stage.
