const crypto = require('crypto');
const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../config/logger');
const { redis } = require('../config/redis');
const { BadRequestError, TooManyRequestsError } = require('./error');

// Brevo SMTP relay. Port 587 uses STARTTLS (secure: false is correct here).
const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: { user: config.smtpUser, pass: config.smtpKey },
    connectionTimeout: 10_000,
    socketTimeout: 10_000,
});

const sendOtpEmail = async (email, otp) => {
    if (!config.smtpUser || !config.smtpKey) {
        if (config.isProd) {
            throw new Error('SMTP_USER and SMTP_KEY are not configured');
        }
        // Local development without SMTP: surface the OTP in the log instead.
        logger.warn({ email, otp }, 'SMTP not configured, skipping email (dev only)');
        return;
    }

    const minutes = Math.ceil(config.otpTTL / 60);
    try {
        await transporter.sendMail({
            from: { name: config.mailFromName, address: config.mailFromEmail },
            to: email,
            subject: 'Your verification code',
            text: `Your verification code is ${otp}. It expires in ${minutes} minutes. Do not share it with anyone.`,
            html: `<p>Your verification code is <strong>${otp}</strong>.</p><p>It expires in ${minutes} minutes. Do not share it with anyone.</p>`,
        });
    } catch (err) {
        logger.error({ err }, 'Failed to send OTP email');
        throw new Error('Failed to send OTP email');
    }
};

// Returns the signup data stored by generateAndStoreOtp. The session is single use.
const verifyOtpEmail = async (otpSessionId, otp) => {
    if (!otpSessionId || !otp) {
        throw new BadRequestError('OTP and session are required');
    }

    const sessionKey = `otp:${otpSessionId}`;
    const attemptsKey = `otp:attempts:${otpSessionId}`;

    const stored = await redis.get(sessionKey);
    if (!stored) {
        throw new BadRequestError('OTP expired or invalid. Please request a new one.');
    }

    // Count the attempt before comparing so parallel guesses cannot bypass the limit.
    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) {
        await redis.expire(attemptsKey, config.otpTTL);
    }
    if (attempts > config.otpMaxVerifyAttempts) {
        await redis.del(sessionKey, attemptsKey);
        throw new TooManyRequestsError('Too many incorrect attempts. Please request a new OTP.');
    }

    const session = JSON.parse(stored);
    const expected = Buffer.from(session.hashedOtp, 'hex');
    const actual = crypto
        .createHmac('sha256', config.hmacSecret)
        .update(`${session.email}:${otp}`)
        .digest();

    if (!crypto.timingSafeEqual(expected, actual)) {
        throw new BadRequestError('Invalid OTP');
    }

    await redis.del(sessionKey, attemptsKey);
    const { hashedOtp, ...data } = session;
    return data;
};

module.exports = { sendOtpEmail, verifyOtpEmail };
