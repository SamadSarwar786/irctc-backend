const config = require('../config');

const notFound = (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  req.log.error(err);
  res.status(status).json({
    error: status >= 500 && config.isProd ? 'Internal Server Error' : err.message,
    ...(!config.isProd && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
