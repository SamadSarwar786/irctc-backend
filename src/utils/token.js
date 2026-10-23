const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { redis } = require('../config/redis');
const { UnauthorizedError } = require('./error');

const getKeys = {
    session: (sid) => `session:${sid}`,
    refresh: (tokenHash) => `refresh:${tokenHash}`,
    userSessions: (userId) => `user:sessions:${userId}`,
};

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const signAccessToken = (userId, sid) =>
    jwt.sign({ sid }, config.jwtAccessSecret, {
        subject: userId,
        algorithm: 'HS256',
        expiresIn: config.accessTokenTTL,
    });

const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, config.jwtAccessSecret, { algorithms: ['HS256'] });
    } catch (err) {
        throw new UnauthorizedError('Invalid or expired access token');
    }
};

// Refresh token format: `<sid>.<secret>`. Only the hash of the whole token is stored.
const issueRefreshToken = async (userId, sid) => {
    const token = `${sid}.${crypto.randomBytes(32).toString('base64url')}`;
    await redis.set(
        getKeys.refresh(sha256(token)),
        JSON.stringify({ userId, sid }),
        'EX',
        config.refreshTokenTTL
    );
    return token;
};

// New login: creates a session and its first refresh token.
const createSession = async (userId, meta = {}) => {
    const sid = crypto.randomUUID();
    await redis.set(
        getKeys.session(sid),
        JSON.stringify({ userId, ...meta, createdAt: Date.now() }),
        'EX',
        config.refreshTokenTTL
    );
    await redis.sadd(getKeys.userSessions(userId), sid);
    await redis.expire(getKeys.userSessions(userId), config.refreshTokenTTL);

    const refreshToken = await issueRefreshToken(userId, sid);
    return { accessToken: signAccessToken(userId, sid), refreshToken };
};

const revokeSession = async (userId, sid) => {
    await redis.del(getKeys.session(sid));
    if (userId) await redis.srem(getKeys.userSessions(userId), sid);
};

const revokeAllSessions = async (userId) => {
    const sids = await redis.smembers(getKeys.userSessions(userId));
    const keys = sids.map(getKeys.session);
    if (keys.length) await redis.del(...keys);
    await redis.del(getKeys.userSessions(userId));
};

const isSessionActive = async (sid) => (await redis.exists(getKeys.session(sid))) === 1;

// Rotates the refresh token. GETDEL is atomic, so of two concurrent requests with the same
// token only one gets the record; the other is treated as reuse and kills the session.
const rotateRefreshToken = async (token) => {
    const sid = typeof token === 'string' ? token.split('.')[0] : null;
    if (!sid || !token.includes('.')) throw new UnauthorizedError('Invalid refresh token');

    const record = await redis.getdel(getKeys.refresh(sha256(token)));
    if (!record) {
        // Unknown token for a known session = a used-up token being replayed: revoke the family.
        const session = await redis.get(getKeys.session(sid));
        if (session) await revokeSession(JSON.parse(session).userId, sid);
        throw new UnauthorizedError('Invalid refresh token');
    }

    const { userId } = JSON.parse(record);
    if (!(await isSessionActive(sid))) throw new UnauthorizedError('Session expired');

    await redis.expire(getKeys.session(sid), config.refreshTokenTTL);
    const refreshToken = await issueRefreshToken(userId, sid);
    return { accessToken: signAccessToken(userId, sid), refreshToken, userId, sid };
};

module.exports = {
    createSession,
    rotateRefreshToken,
    revokeSession,
    revokeAllSessions,
    isSessionActive,
    verifyAccessToken,
};
