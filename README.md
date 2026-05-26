# ai-core

未来智匠平台后端服务，基于 Express 框架构建的 Node.js 服务端应用。

## 项目架构

```
ai-core/
├── app.js                  # 入口文件，挂载中间件、注册路由
├── package.json            # 项目依赖与脚本
├── .env.development        # 开发环境变量
├── .env.production         # 生产环境变量
├── config/
│   ├── mysqlConfig.js      # MySQL 连接池配置
│   ├── passport.js         # Passport JWT 策略
│   └── resendConfig.js     # Resend 邮件服务配置
├── router/
│   ├── user.js             # 路由入口，聚合所有子路由
│   ├── auth.js             # 认证模块（注册/登录/密码重置/验证码）
│   ├── ai.js               # AI 模块（DeepSeek流式对话/讯飞星火图片生成/PDF上传）
│   └── data.js             # 数据模块（分类/对话/模板 CRUD）
├── middleware/
│   ├── auth.js             # JWT 认证中间件 + token 黑名单校验
│   └── validator.js        # 请求字段校验中间件
├── util/
│   ├── tool.js             # 工具函数（密码生成等）
│   └── blacklist.js        # token 黑名单
├── customerService/        # 客服前端静态页面
├── uploads/                # 上传文件存储目录
└── dist/                   # 前端打包产物
```

### 路由结构

所有接口统一挂载在 `/aicg` 前缀下：

| 路由文件 | 前缀 | 功能 |
|---------|------|------|
| `auth.js` | `/aicg` | 注册、登录、退出、密码修改/重置、验证码、用户信息 |
| `ai.js` | `/aicg` | DeepSeek 流式对话、讯飞星火图片生成、PDF 上传解析 |
| `data.js` | `/aicg` | 大模型分类 CRUD、对话记录 CRUD、客服配置、模板查询 |

### 核心依赖

- **Express 4** — Web 框架
- **MySQL2** — 数据库驱动（连接池模式）
- **JWT + Passport** — 认证体系
- **node-forge** — RSA-OAEP 加解密
- **crypto-js** — AES/HMAC 签名
- **OpenAI SDK** — 对接 DeepSeek 大模型
- **Resend** — 邮件发送
- **Multer + pdf-parse** — 文件上传与 PDF 解析
- **svg-captcha** — 图形验证码

## 启动方式

```bash
# 安装依赖
npm install

# 开发模式（nodemon 热重载）
npm run dev

# 生产模式（PM2）
npm run start
```

服务默认监听 **5002** 端口（`0.0.0.0`）。

## 环境变量

需要配置 `.env.development` 和 `.env.production` 文件，主要变量包括：

- 数据库：`DB_HOST`、`DB_USER`、`DB_PASSWORD`、`DB_DATABASE`
- 认证：`JWT_SECRET`、`SESSION_SECRET`
- AI 服务：`DEEPSEEK_APIKEY`、`XUNFEI_APPID`、`XUNFEI_API_KEY`、`XUNFEI_API_SECRET`
- 邮件：`RESEND_API_KEY`
