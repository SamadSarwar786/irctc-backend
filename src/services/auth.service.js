const { ConflictError, UnauthorizedError, ForbiddenError } = require('../utils/error');
const { createSession, rotateRefreshToken, revokeSession, revokeAllSessions } = require('../utils/token');
const prisma = require('../config/prisma').getInstance().getClient();
const bcrypt = require('bcrypt');
const { generateAndStoreOtp, validateOtp } = require('../utils/otp');
const { sendOtpEmail} = require('../utils/email');
const { redis } = require('../config/redis');

const sendOtp = async ({ firstName, lastName, email, password }) => {
   // user already exists check
   const existingUser = await prisma.user.findUnique({
      where: { email }
   });

   if (existingUser) {
      throw new ConflictError('User already exists');
   }

   const hashedPassword = await bcrypt.hash(password, 10);
   const {otp , otpSessionId}  = await generateAndStoreOtp(firstName, lastName, email, hashedPassword);
   console.log(`OTP for ${email}: ${otp}`);
   // await sendOtpEmail(email, otp);
   return {otpSessionId};

}

const verifyOtp = async (otpSessionId, otp) => {
    
   const userData = await validateOtp(otpSessionId, otp);

   const {firstName, lastName, email, hashedPassword} = userData;
   await redis.del(`otp:${otpSessionId}`);
    const user = await prisma.user.create({
        data: {
            firstName,
            lastName,
            email,
            password: hashedPassword,
            emailVerified: true,
        },
    });
    return { user };
}
// Compared against when the user does not exist so response time doesn't reveal valid emails.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

const login = async ({ email, password }, meta) => {
    const user = await prisma.user.findUnique({ where: { email } });
    const valid = await bcrypt.compare(password, user?.password || DUMMY_HASH);
    if (!user || !user.password || !valid) {
        throw new UnauthorizedError('Invalid email or password');
    }
    if (!user.emailVerified) {
        throw new ForbiddenError('Email not verified');
    }

    const tokens = await createSession(user.id, meta);
    const { password: _pw, ...safeUser } = user;
    return { ...tokens, user: safeUser };
};

const refresh = async (refreshToken) => {
    const { accessToken, refreshToken: newRefreshToken } = await rotateRefreshToken(refreshToken);
    return { accessToken, refreshToken: newRefreshToken };
};

const logout = async (userId, sid) => revokeSession(userId, sid);

const logoutAll = async (userId) => revokeAllSessions(userId);

const getMe = async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedError('User not found');
    const { password: _pw, ...safeUser } = user;
    return safeUser;
};

module.exports = {
    sendOtp,
    verifyOtp,
    login,
    refresh,
    logout,
    logoutAll,
    getMe,
}