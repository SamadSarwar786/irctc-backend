const { TooManyRequestsError, BadRequestError } = require("./error");
const config = require('../config');
const { redis } = require("../config/redis");
const crypto = require('crypto');
const { th } = require("zod/locales");

const getKeys = {
    otpSession: (otpSessionId) => `otp:${otpSessionId}`,
    otpAttempts: (otpSessionId) => `otp:attempts:${otpSessionId}`,
    otpRate: (email) => `otp:rate:${email}`,
}


const generateAndStoreOtp = async (firstName, lastName, email, hashedPassword) => {
   
    // how many times the OTP has been generated for this email in the last hour
   const rateKey = getKeys.otpRate(email);

    const sentCount = Number(await redis.get(rateKey)) || 0;
    if (sentCount >= config.otpRateMaxPerHour) {
        throw new TooManyRequestsError('Too many OTP requests. Please try again later.');
    }

    const otp = crypto.randomInt(100000, 1000000).toString(); // Generate a 6-digit OTP 
    const otpSessionId = crypto.randomUUID(); // Generate a unique session ID for the OTP

    const hashedOtp = crypto.createHmac('sha256', config.hmacSecret).update(`${email}:${otp}`).digest('hex'); // Hash the OTP with email as salt

    await redis.set(getKeys.otpSession(otpSessionId), JSON.stringify({ firstName, lastName, email, hashedPassword, hashedOtp }), 'EX', config.otpTTL); // Store OTP with TTL

    await redis.set(getKeys.otpAttempts(otpSessionId), 0, 'EX', config.otpTTL);

    await redis.incr(rateKey);
    await redis.expire(rateKey, 3600); // Set the rate limit key to expire in 1 hour
    return { otp, otpSessionId };
}

const validateOtp = async (otpSessionId, otp) => {

    const otpAttemptsKey = getKeys.otpAttempts(otpSessionId);
    const otpSessionKey = getKeys.otpSession(otpSessionId);

    const attempts = await redis.get(otpAttemptsKey);
    if(attempts === null){
        throw new BadRequestError('OTP session not found or expired. Please request a new OTP.');
    }
    if (attempts >= config.otpMaxVerifyAttempts) {
        await redis.del(otpSessionKey, otpAttemptsKey);
        throw new TooManyRequestsError('Too many incorrect attempts. Please request a new OTP.');
    }

    const otpData = await redis.get(otpSessionKey);
    if(otpData === null) {
        throw new BadRequestError('OTP expired or invalid. Please request a new one.');
    }

    const {firstName, lastName, email,hashedPassword, hashedOtp : storedOtp} = JSON.parse(otpData);
   
    const givenOtp = crypto.createHmac('sha256', config.hmacSecret).update(`${email}:${otp}`).digest('hex');
    if(crypto.timingSafeEqual(Buffer.from(givenOtp), Buffer.from(storedOtp))) {
        await redis.del(otpSessionKey, otpAttemptsKey);
        return {firstName, lastName, email, hashedPassword};
    }
    else {
        await redis.incr(otpAttemptsKey);
        throw new BadRequestError('Incorrect OTP. Please try again.');
    }
}

module.exports = {
    generateAndStoreOtp,
    validateOtp,
}