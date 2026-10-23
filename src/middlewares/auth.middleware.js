const { verifyAccessToken, isSessionActive } = require('../utils/token');
const { UnauthorizedError } = require('../utils/error');

const authenticate = async (req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
        throw new UnauthorizedError('Missing access token');
    }

    const payload = verifyAccessToken(token);
    // Lets logout take effect immediately instead of waiting for the access token to expire.
    if (!(await isSessionActive(payload.sid))) {
        throw new UnauthorizedError('Session expired');
    }

    req.user = { id: payload.sub, sid: payload.sid };
    next();
};

module.exports = { authenticate };
