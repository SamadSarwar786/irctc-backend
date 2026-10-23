const config = require('../config');
const authService = require('../services/auth.service');
const { z } = require('zod');
const { BadRequestError, UnauthorizedError } = require('../utils/error');

const OTP_SESSION_COOKIE = 'otp_session_id';
const sendOtp = async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
   if(!firstName || !lastName || !email || !password) {
    throw new BadRequestError('Please fill all the fields');
   }

   const {otpSessionId} = await authService.sendOtp({ firstName, lastName, email, password });
   res.cookie(OTP_SESSION_COOKIE, otpSessionId, {
       httpOnly: true,
       secure : true,
       sameSite: 'strict',
       maxAge: config.otpTTL * 1000, // Convert seconds to milliseconds
   }).status(200).json({ success : true,  message: 'OTP sent successfully' });
};

const verifyOtp = async (req, res) => {
    const { otp } = req.body;
    const otpSessionId = req.cookies[OTP_SESSION_COOKIE];

    console.log(`Verifying OTP for session: ${otpSessionId} with OTP: ${otp}`);

    if (!otpSessionId) {
        throw new UnauthorizedError('session are required');
    }
    if (!otp) {
        throw new UnauthorizedError('OTP are required');
    }
    const { user } = await authService.verifyOtp(otpSessionId, otp);
    res.status(200).json({ success : true,  message: 'OTP verified successfully', user });
};


const REFRESH_COOKIE = 'refresh_token';

const refreshCookieOptions = {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'strict',
    path: '/api/v1/auth', // only sent to auth endpoints, not every API call
};

const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1),
});

const login = async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new BadRequestError('Valid email and password are required');
    }

    const { accessToken, refreshToken, user } = await authService.login(parsed.data, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });

    res.cookie(REFRESH_COOKIE, refreshToken, {
        ...refreshCookieOptions,
        maxAge: config.refreshTokenTTL * 1000,
    }).status(200).json({ success: true, accessToken, expiresIn: config.accessTokenTTL, user });
};

const refresh = async (req, res) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) {
        throw new UnauthorizedError('Refresh token missing');
    }

    try {
        const { accessToken, refreshToken } = await authService.refresh(token);
        res.cookie(REFRESH_COOKIE, refreshToken, {
            ...refreshCookieOptions,
            maxAge: config.refreshTokenTTL * 1000,
        }).status(200).json({ success: true, accessToken, expiresIn: config.accessTokenTTL });
    } catch (err) {
        res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
        throw err;
    }
};

const logout = async (req, res) => {
    await authService.logout(req.user.id, req.user.sid);
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions)
        .status(200).json({ success: true, message: 'Logged out' });
};

const logoutAll = async (req, res) => {
    await authService.logoutAll(req.user.id);
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions)
        .status(200).json({ success: true, message: 'Logged out from all devices' });
};

const me = async (req, res) => {
    const user = await authService.getMe(req.user.id);
    res.status(200).json({ success: true, user });
};

module.exports = {
    sendOtp,
    verifyOtp,
    login,
    refresh,
    logout,
    logoutAll,
    me,
}