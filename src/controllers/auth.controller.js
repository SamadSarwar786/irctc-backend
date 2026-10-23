const config = require('../config');
const authService = require('../services/auth.service');
const { BadRequestError } = require('../utils/error');

const sendOtp = async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
   if(!firstName || !lastName || !email || !password) {
    throw new BadRequestError('Please fill all the fields');
   }

   const {otpSessionId} = await authService.sendOtp({ firstName, lastName, email, password });
   res.cookie('otp_session_id', otpSessionId, {
       httpOnly: true,
       secure : true,
       sameSite: 'strict',
       maxAge: config.otpTTL * 1000, // Convert seconds to milliseconds
   }).status(200).json({ success : true,  message: 'OTP sent successfully' });
};

const verifyOtp = async (req, res) => {
    const { otp } = req.body;
    const otpSessionId = req.cookies['otp_session_id'];
    if (!otpSessionId || !otp) {
        throw new BadRequestError('OTP and session are required');
    }
    const { user } = await authService.verifyOtp(otpSessionId, otp);
    res.status(200).json({ success : true,  message: 'OTP verified successfully', user });
};


module.exports = {
    sendOtp,
    verifyOtp
}