const jwt = require('jsonwebtoken')
const { isTokenBlacklisted } = require('../util/blacklist')

const keys = process.env.JWT_SECRET

// 验证token是否过期和正确（含黑名单检查）
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ code: 6, msg: 'token无效或已过期，请重新登录' });
    jwt.verify(token, keys, (err, user) => {
        if (err) return res.status(401).json({ code: 6, msg: 'token无效或已过期，请重新登录' });
        if (user.jti && isTokenBlacklisted(user.jti)) {
            return res.status(401).json({ code: 6, msg: 'token已失效，请重新登录' });
        }
        req.user = user;
        next();
    });
}

const generateAppId = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}

module.exports = { authenticateToken, generateAppId, keys }
