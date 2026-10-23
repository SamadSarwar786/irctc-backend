require('dotenv').config();

const env = process.env.NODE_ENV || 'development';

module.exports = {
  env,
  isProd: env === 'production',
  port: Number(process.env.PORT) || 3000,
  logLevel: process.env.LOG_LEVEL || 'info',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  databaseUrl: process.env.DATABASE_URL,
  otpTTL : Number(process.env.OTP_TTL),
  otpRateMaxPerHour : Number(process.env.OTP_RATE_MAX_PER_HOUR) || 5,
  otpMaxVerifyAttempts : Number(process.env.OTP_MAX_VERIFY_ATTEMPTS) || 5,
  hmacSecret : process.env.HMAC_SECRET,
  smtpHost : process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  smtpPort : Number(process.env.SMTP_PORT) || 587,
  smtpUser : process.env.SMTP_USER,
  smtpKey : process.env.SMTP_KEY,
  mailFromEmail : process.env.MAIL_FROM_EMAIL,
  mailFromName : process.env.MAIL_FROM_NAME || 'IRCTC',
  jwtAccessSecret : process.env.JWT_ACCESS_SECRET,
  accessTokenTTL : Number(process.env.ACCESS_TOKEN_TTL) || 900,
  refreshTokenTTL : Number(process.env.REFRESH_TOKEN_TTL) || 604800,

};
