const express = require('express');
const auth = express.Router();
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken');
const crypto = require('crypto')
const svgCaptcha = require('svg-captcha');
const forge = require('node-forge')
const db = require('../config/mysqlConfig')
const resend = require('../config/resendConfig')
const validateFields = require('../middleware/validator')
const { generatePassword } = require('../util/tool')
const { authenticateToken, generateAppId, keys } = require('../middleware/auth')
const { tokenBlacklist } = require('../util/blacklist')

const salt = bcrypt.genSaltSync(10);

// 生成RSA密钥对
const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
const publicKey = forge.pki.publicKeyToPem(keypair.publicKey);
const privateKey = forge.pki.privateKeyToPem(keypair.privateKey);

const decryptData = (encryptedData) => {
    try {
        const { pki, util } = forge;
        const privateKeyObj = pki.privateKeyFromPem(privateKey);
        const decodedData = forge.util.decode64(encryptedData);
        const decryptedData = privateKeyObj.decrypt(decodedData, 'RSA-OAEP');
        return util.decodeUtf8(decryptedData);
    } catch (err) {
        return ''
    }
};

const query = (sql, params) => db.promise().query(sql, params)

const dbError = (res, err) => {
    console.error('数据库错误:', err)
    return res.status(500).json({ code: 4, msg: '服务器内部错误' })
}

// 密码重置频率限制：同一IP 60分钟内最多3次
const rateLimitMap = new Map()
const checkRateLimit = (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress
    const now = Date.now()
    const record = rateLimitMap.get(ip)
    if (record && now - record.start < 60 * 60 * 1000 && record.count >= 3) {
        return res.status(429).json({ code: 4, msg: '操作过于频繁，请稍后再试' })
    }
    if (!record || now - record.start >= 60 * 60 * 1000) {
        rateLimitMap.set(ip, { start: now, count: 0 })
    }
    next()
}

auth.get('/publicKey', (req, res) => {
    res.json({ code: 0, msg: '成功', key: publicKey });
})

const sendMail = async (user, email) => {
    const numbers = generatePassword()
    try {
        const { error } = await resend.emails.send({
            from: '冒险纪元 <noreply@resend.dev>',
            to: email,
            subject: '冒险者请查看您的通行密令',
            html: `<div style="background:#0a0a12;padding:40px 0;font-family:Arial,sans-serif">
  <table width="480" align="center" style="background:rgba(16,28,46,0.9);border:2px solid #31415b;border-collapse:collapse">
    <tr>
      <td style="padding:32px 36px 0;text-align:center">
        <div style="font-size:20px;color:#f7ead0;letter-spacing:4px">⚔️ 冒险纪元 ⚔️</div>
        <div style="height:2px;background:linear-gradient(90deg,transparent,#7dd8c7,#d8a657,#7dd8c7,transparent);margin:18px 0"></div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 36px">
        <p style="color:#b6a989;font-size:14px;margin:0 0 20px;text-align:center">冒险者，你申请了重置通行密令。</p>
        <p style="color:#b6a989;font-size:14px;margin:0 0 24px;text-align:center">请使用以下密令重新进入这片神奇大陆：</p>
        <div style="background:rgba(0,0,0,0.4);border:2px solid #7dd8c7;padding:22px 0;text-align:center">
          <span style="font-family:'Courier New',monospace;font-size:28px;color:#c9fff2;letter-spacing:6px;text-shadow:0 0 10px #7dd8c7">${numbers}</span>
        </div>
        <p style="color:#6b6178;font-size:12px;margin:16px 0 0;text-align:center">进入世界后请尽快修改密令</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 36px 28px;text-align:center">
        <div style="height:1px;background:rgba(125,216,199,0.15);margin-bottom:16px"></div>
        <span style="color:#4a5568;font-size:11px">— 未来智匠 · 冒险纪元 —</span>
      </td>
    </tr>
  </table>
</div>`
        })
        if (error) {
            console.error('邮件发送失败:', error)
            return { code: 4, msg: '邮件发送失败', status: 500 }
        }
        await query('update users set password = ? where username = ?', [bcrypt.hashSync(numbers, salt), user])
        return { code: 0, msg: '密码重置成功，请前往邮箱查看', status: 200 }
    } catch (err) {
        console.error('邮件发送失败:', err)
        return { code: 4, msg: '邮件发送失败', status: 500 }
    }
}

// 修改密码
auth.post('/changePassword', async (req, res) => {
    try {
        const { user, password, newPassword } = req.body;
        const decryptUser = decryptData(user)
        const decryptPassword = decryptData(password)
        const decryptNewPassword = decryptData(newPassword)

        const [results] = await query('select * from users where username = ?', [decryptUser])
        if (results.length === 0) {
            return res.status(404).json({ code: 1, msg: '账号不存在' })
        }

        const isMatch = bcrypt.compareSync(decryptPassword, results[0].password);
        if (!isMatch) {
            return res.json({ code: 2, msg: '密令错误' })
        }

        await query('update users set password = ? where username = ?', [bcrypt.hashSync(decryptNewPassword, salt), decryptUser])
        return res.json({ code: 0, msg: '密令修改成功' })
    } catch (err) {
        return dbError(res, err)
    }
})

// 重置密码邮件
auth.post('/resetPassword', checkRateLimit, async (req, res) => {
    try {
        const { user, email } = req.body
        const [results] = await query('select * from users where username = ?', [user])
        if (results.length === 0) {
            return res.status(404).json({ code: 1, msg: '账号不存在' })
        }
        const ip = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress
        rateLimitMap.get(ip).count++
        const result = await sendMail(user, email)
        return res.status(result.status || 200).json(result)
    } catch (err) {
        return dbError(res, err)
    }
})

// 用户注册
auth.post('/register', async (req, res) => {
    try {
        let { name, user, email, password, img_url, captcha } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress;

        if (/[\u4e00-\u9fa5]/.test(user) || /[\u4e00-\u9fa5]/.test(password)) {
            return res.status(400).json({ code: 4, msg: '冒险者ID或通行密令不能使用中文' })
        }

        const [ipResults] = await query('select * from users where ip = ?', [ip])
        if (ipResults.length > 0) {
            return res.status(400).json({ code: 2, msg: '该ip地址已注册过一个账号' })
        }

        const [userResults] = await query('select * from users where username = ?', [user])
        if (userResults.length > 0) {
            return res.status(409).json({ code: 1, msg: '账号已存在' })
        }

        const [emailResults] = await query('select * from users where email = ?', [email])
        if (emailResults.length > 0) {
            return res.status(409).json({ code: 1, msg: '邮箱已存在' })
        }

        if (req.session.captcha !== captcha.toLowerCase()) {
            return res.status(400).json({ code: 3, msg: '验证码错误' })
        }

        await query('insert into users (username, password, nickname, email, img_url, ip, appid) values (?, ?, ?, ?, ?, ?, ?)', [user, bcrypt.hashSync(password, salt), name, email, img_url, ip, generateAppId()])
        req.session.destroy(err => {
            if (err) console.error('session销毁失败:', err)
        })
        return res.json({ code: 0, msg: '注册成功' })
    } catch (err) {
        return dbError(res, err)
    }
})

// 用户登录
auth.post('/login', validateFields(['user', 'password']), async (req, res) => {
    try {
        const { user, password, freeLogin } = req.body;
        const decryptUser = decryptData(user)
        const decryptPassword = decryptData(password)
        const expiresIn = freeLogin ? '30d' : '1d'

        if (!decryptUser) {
            return res.status(400).json({ code: 4, msg: '账号解密失败' })
        }

        const [results] = await query('select * from users where binary username = ? or email = ?', [decryptUser, decryptUser])
        if (results.length === 0) {
            return res.json({ code: 1, msg: '账号或者邮箱不存在' })
        }

        if (!decryptPassword) {
            return res.status(400).json({ code: 4, msg: '密码解密失败' })
        }

        const isMatch = bcrypt.compareSync(decryptPassword, results[0].password);
        if (!isMatch) {
            return res.json({ code: 2, msg: '密码错误' })
        }

        const rules = { id: results[0].id, name: results[0].username, jti: crypto.randomUUID() }
        jwt.sign(rules, keys, { expiresIn }, (tokenErr, token) => {
            if (tokenErr) {
                console.error('token生成失败:', tokenErr)
                return res.status(500).json({ code: 5, msg: '服务器内部错误' })
            }
            res.json({ code: 0, msg: '登录成功', token })
        })
    } catch (err) {
        return dbError(res, err)
    }
})

// 退出登录（将 token 加入黑名单）
auth.post('/logout', (req, res) => {
    const token = req.headers['authorization'].split(' ')[1];
    const decoded = jwt.decode(token);
    if (decoded && decoded.jti && decoded.exp) {
        tokenBlacklist.set(decoded.jti, decoded.exp * 1000);
    }
    res.json({ code: 0, msg: '已退出登录' });
})

// 获取用户信息
auth.get('/getUser', authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ code: 4, msg: '非法Token' })
        }
        const [results] = await query('select * from users where username = ? AND id = ?', [req.user.name, req.user.id])
        res.json({
            code: 0,
            msg: '成功',
            users: {
                id: results[0].id,
                nickname: results[0].nickname,
                username: results[0].username,
                img_url: results[0].img_url,
                appid: results[0].appid,
            }
        })
    } catch (err) {
        return dbError(res, err)
    }
})

// 修改个人头像和昵称
auth.post('/updateUser', [authenticateToken, validateFields(['nickname', 'img_url', 'username'])], async (req, res) => {
    try {
        const { nickname, img_url, username } = req.body;
        await query('update users set nickname = ?, img_url = ? where username = ?', [nickname, img_url, username])
        res.json({ code: 0, msg: '保存成功' })
    } catch (err) {
        return dbError(res, err)
    }
})

// 验证码生成
auth.get('/captcha', (req, res) => {
    const captcha = svgCaptcha.create({
        size: 6,
        ignoreChars: '0o1i',
        noise: 2,
        color: true,
        background: '#cc9966'
    });
    req.session.captcha = captcha.text.toLowerCase()
    res.json({ code: 0, imgData: captcha.data });
});

module.exports = auth
