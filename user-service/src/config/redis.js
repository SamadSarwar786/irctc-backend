const Redis = require('ioredis');
const config = require('./index');
const logger = require('./logger');

// Node caches this module after the first require, so every importer shares one connection.
const redis = new Redis(config.redisUrl, {
  // Reconnect with a capped backoff and never give up.
  retryStrategy: (attempt) => Math.min(attempt * 100, 2000),
});

redis.on('ready', () => logger.info('Redis ready'));
redis.on('close', () => logger.warn('Redis connection closed'));
redis.on('error', (err) => logger.error({ err }, 'Redis error'));

module.exports = {redis};
