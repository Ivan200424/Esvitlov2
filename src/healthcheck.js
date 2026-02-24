const http = require('http');
const config = require('./config');
const { pool } = require('./database/pool');
const { getUserCount } = require('./database/users');
const logger = require('./logger').child({ module: 'healthcheck' });

let server = null;
let botRef = null;

function startHealthCheck(bot, port = config.WEBHOOK_PORT) {
  botRef = bot;
  const useWebhook = config.USE_WEBHOOK;
  const webhookPath = config.WEBHOOK_PATH;

  server = http.createServer(async (req, res) => {
    // Webhook endpoint
    if (useWebhook && req.method === 'POST' && req.url === webhookPath) {
      let body = '';
      req.on('data', (chunk) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const update = JSON.parse(body);
          bot.handleUpdate(update);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          logger.error({ err: error }, 'Webhook processing error');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // Health check endpoint
    if (req.url === '/health' || req.url === '/') {
      try {
        const dbCheck = await pool.query('SELECT 1').then(() => true).catch((err) => {
          logger.error({ err: err }, 'Health check DB error');
          return false;
        });
        const userCount = await getUserCount();

        const health = {
          status: 'ok',
          uptime: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
          bot: 'running',
          mode: useWebhook ? 'webhook' : 'polling',
          database: dbCheck ? 'connected' : 'disconnected',
          users: userCount,
          memory: {
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          },
        };

        const statusCode = dbCheck ? 200 : 503;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: error.message }));
      }
    } else if (req.url === '/metrics') {
      const mem = process.memoryUsage();
      const metrics = {
        pool: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
          active: pool.totalCount - pool.idleCount,
        },
        uptime: process.uptime(),
        memory: {
          rss: mem.rss,
          heapTotal: mem.heapTotal,
          heapUsed: mem.heapUsed,
          external: mem.external,
        },
        timestamp: new Date().toISOString(),
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(metrics));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    logger.info(`🏥 Health check server running on port ${port}`);

    if (useWebhook && config.WEBHOOK_URL) {
      // Set webhook with Telegram
      const fullWebhookUrl = `${config.WEBHOOK_URL}${webhookPath}`;
      bot.api.setWebhook(fullWebhookUrl, {
        max_connections: config.WEBHOOK_MAX_CONNECTIONS,
      }).then(() => {
        logger.info(`🔗 Webhook встановлено: ${fullWebhookUrl}`);
      }).catch((error) => {
        logger.error({ err: error }, '❌ Помилка встановлення webhook');
        logger.info('⚠️ Перемикаємось на polling...');
        bot.start();
      });
    }
  });
}

function stopHealthCheck() {
  if (server) {
    // If using webhook, delete it before stopping
    if (botRef && config.USE_WEBHOOK) {
      botRef.api.deleteWebhook().catch((error) => {
        logger.error({ err: error }, '⚠️  Помилка при видаленні webhook');
      });
    }
    server.close();
    logger.info('✅ Health check server stopped');
  }
}

module.exports = { startHealthCheck, stopHealthCheck };
