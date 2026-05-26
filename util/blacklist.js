// Token 黑名单（退出登录后失效的 token）
// key: jti, value: 过期时间戳(ms)
const tokenBlacklist = new Map()

// 按需清理：查黑名单时顺带清理已过期条目
const isTokenBlacklisted = (jti) => {
    const expiresAt = tokenBlacklist.get(jti)
    if (!expiresAt) return false
    if (expiresAt <= Date.now()) {
        tokenBlacklist.delete(jti)
        return false
    }
    return true
}

module.exports = { tokenBlacklist, isTokenBlacklisted }
