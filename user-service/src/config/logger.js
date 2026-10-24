const pino = require('pino');
const config = require('./index');

module.exports = pino({
  level: config.logLevel,
  ...(!config.isProd && { transport: { target: 'pino-pretty' } }),
});
