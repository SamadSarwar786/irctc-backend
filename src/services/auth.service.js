const { ConflictError } = require('../utils/error');
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
module.exports = {
    sendOtp,
    verifyOtp
}