const http = require('http');

let server = null;
let botRef = null;
let startedAt = Date.now();

function startHealthCheck(bot, port = process.env.PORT || process.env.HEALTH_PORT || 3000) {
  botRef = bot;
  
  server = http.createServer(async (req, res) => {
    if (req.url === '/health' || req.url === '/') {
      try {
        const { pool } = require('./database/db');
        const dbCheck = await pool.query('SELECT 1').then(() => true).catch(() => false);
        const { getUserCount } = require('./database/users');
        const userCount = await getUserCount();
        
        const health = {
          status: 'ok',
          uptime: Math.floor((Date.now() - startedAt) / 1000),
          timestamp: new Date().toISOString(),
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
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
  
  server.listen(port, () => {
    console.log(`🏥 Health check server running on port ${port}`);
  });
}

function stopHealthCheck() {
  if (server) {
    server.close();
    console.log('✅ Health check server stopped');
  }
}

module.exports = { startHealthCheck, stopHealthCheck };
