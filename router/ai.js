const express = require('express');
const ai = express.Router();
const axios = require('axios')
const CryptoJS = require('crypto-js')
const OpenAI = require('openai')
const multer = require('multer')
const pdf = require('pdf-parse');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth')
const validateFields = require('../middleware/validator')

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, `${decodedName}`);
  }
});
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (!(file.mimetype == 'application/pdf')) {
            cb(new Error('文件类型不正确'), false);
        } else {
            cb(null, true);
        }
    },
    limits: {
        fileSize: 1 * 1024 * 1024,
    },
});

// deepseek大模型 SSE 流式对话
ai.post('/deepseekMoudle', (req, res) => {
    const { text, moduleId } = req.body
    const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: process.env.DEEPSEEK_APIKEY
    });
    async function streamChatCompletion() {
        try {
            const gptStream = await openai.chat.completions.create({
                messages: text,
                model: moduleId,
                stream: true
            });
            res.writeHead(200, { 'Content-Type': 'text/event-stream' })
            for await (const chunk of gptStream) {
                res.write(`data: ${JSON.stringify(chunk)}\n\n`)
            }
        } catch (error) {
            if (error.status == 402) {
                res.writeHead(200, { 'Content-Type': 'text/event-stream' })
                res.write(`data: ${JSON.stringify({message: "账户余额不足"})}\n\n`)
            }
        }
        res.end();
    }
    streamChatCompletion();
})

// 图片生成（讯飞星火）
ai.post('/queryImg', [authenticateToken, validateFields(['prompt'])], (req, res) => {
    const { prompt } = req.body
    const XUNFEI_CONFIG = {
        APPID: process.env.XUNFEI_APPID,
        API_SECRET: process.env.XUNFEI_API_SECRET,
        API_KEY: process.env.XUNFEI_API_KEY,
        API_URL: 'https://spark-api.cn-huabei-1.xf-yun.com/v2.1/tti',
    }
    const host = 'spark-api.xf-yun.com';
    const date = new Date().toUTCString();
    const algorithm = 'hmac-sha256';
    const headers = 'host date request-line';
    const requestLine = 'POST /v2.1/tti HTTP/1.1';
    const signature_origin = `host: ${host}\ndate: ${date}\n${requestLine}`;

    const signature = CryptoJS.HmacSHA256(signature_origin, XUNFEI_CONFIG.API_SECRET);
    const sign = CryptoJS.enc.Base64.stringify(signature);

    const authorization_origin = `api_key="${XUNFEI_CONFIG.API_KEY}", algorithm="${algorithm}", headers="${headers}", signature="${sign}"`;
    const authorization = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(authorization_origin));

    const url = `${XUNFEI_CONFIG.API_URL}?authorization=${authorization}&date=${encodeURI(date)}&host=${host}`;
    const requestBody = {
        header: { app_id: XUNFEI_CONFIG.APPID },
        parameter: { chat: { domain: "general", width: 640, height: 640 } },
        payload: { message: { text: [{ role: "user", content: prompt }] } }
    };

    axios({ method: 'post', url, headers: { 'Content-Type': 'application/json' }, data: requestBody })
        .then(response => {
            res.status(200).json({ code: 0, msg: '成功', imglist: response.data })
        })
        .catch(error => {
            res.status(500).json({ code: 4, msg: '图片生成失败' })
        });
})

// 上传PDF文件
ai.post('/uploadFile', upload.single('avatar'), async (req, res) => {
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdf(dataBuffer);
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    return res.json({
        code: 0,
        msg: '文件上传成功',
        data: {
            originalName: req.file.filename,
            text: pdfData.text,
            metadata: pdfData.metadata,
            numPages: pdfData.numpages,
            url: imageUrl
        }
    });
});

// multer 错误处理
ai.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ code: 1, msg: '文件大小超过限制(最大1MB)', maxSize: '1MB' });
    }
    return res.status(400).json({ code: 1, msg: '文件上传错误: ' + err.message });
  } else if (err) {
    return res.status(500).json({ code: 1, msg: '服务器错误: ' + err.message });
  }
  next();
});

module.exports = ai
