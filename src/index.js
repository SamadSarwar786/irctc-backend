const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const config = require('./config');
const logger = require('./config/logger');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');
const authRoutes = require('./routes/auth.routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/v1/auth', authRoutes);

app.use(notFound);
app.use(errorHandler);



app.listen(config.port, () => {
  logger.info(`Server listening on port ${config.port} (${config.env})`);
});
