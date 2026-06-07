const dotenv = require('dotenv');
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'production'}` });

const express = require('express');
const path = require('path');
const cors = require('cors');
const passport = require('passport');
const history = require('connect-history-api-fallback');
const session = require('express-session');

const app = express();

// ==================== 1. 基础中间件 ====================
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ==================== 2. Session（供验证码使用） ====================
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true }
}));

// ==================== 3. Passport 初始化 ====================
app.use(passport.initialize());
require('./config/passport.js')(passport);

// ==================== 4. API 路由（在 history 之前注册） ====================
app.use('/aicg', require('./router/user'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== 5. SPA history fallback + 静态文件 ====================
app.use(history());
app.use('/', express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, 'customerService')));
app.get('/kefu.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'customerService', 'index.html'));
});

// ==================== 6. 全局错误处理 ====================
app.use((err, req, res, next) => {
  console.error('未捕获错误:', err);
  res.status(500).json({ code: 5, msg: '服务器内部错误' });
});

// ==================== 7. 启动服务器 ====================
const port = process.env.PORT || 5002;
app.listen(port, '0.0.0.0', () => {
  console.log(`服务器启动成功: http://0.0.0.0:${port}`);
});