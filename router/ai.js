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
const { toolDefinitions, executeTool } = require('../util/aiTools')

// 工具调用最多循环 3 轮，最后一轮不再下发工具，强制模型基于已有结果回答，避免无限调用
const MAX_TOOL_ROUNDS = 3

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
            cb(new Error('仅支持上传 PDF 文件'), false);
        } else {
            cb(null, true);
        }
    },
    limits: {
        fileSize: 1 * 1024 * 1024,
    },
});

// DeepSeek 上游异常 → 前端可直接展示的提示。
// 注意：上游 401 表示服务端 API Key 无效，不是用户 token 失效，
// 所以不能把 HTTP 401 透给前端，否则会被当成登录过期直接踢回登录页
const deepseekErrorMessage = (error) => {
    const status = Number(error && error.status)
    if (status === 401) return 'AI 服务认证失败，请联系管理员'
    if (status === 402) return 'AI 服务余额不足，请联系管理员'
    if (status === 429) return 'AI 服务请求过于频繁，请稍后再试'
    return 'AI 服务暂时不可用，请稍后再试'
}

// 统一 SSE 响应头：no-transform + X-Accel-Buffering 关闭反向代理缓冲，
// 否则 nginx 等会攒满缓冲区才下发，前端看起来就像“一次性输出”
const startSSE = (res) => {
    if (res.headersSent || res.destroyed) return
    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
    })
    res.flushHeaders()
}

// 客户端断开后继续写会抛错，这里统一兜底
const writeSSEError = (res, message) => {
    if (res.writableEnded || res.destroyed) return
    res.write(`data: ${JSON.stringify({ message })}\n\n`)
}

// 单轮流式请求：把上游分片原样转发给前端，同时收集本轮正文和工具调用。
// 前端只消费 delta.content / delta.reasoning_content，工具调用的分片不会影响展示
const streamChatRound = async (openai, params, res, controller) => {
    const gptStream = await openai.chat.completions.create(params, { signal: controller.signal })
    startSSE(res)
    const toolCalls = new Map()
    let assistantContent = ''
    let finishReason = ''
    for await (const chunk of gptStream) {
        if (res.writableEnded || res.destroyed) return { aborted: true, toolCalls: [] }
        res.write(`data: ${JSON.stringify(chunk)}\n\n`)
        const choice = chunk.choices && chunk.choices[0]
        if (!choice) continue
        const delta = choice.delta || {}
        if (typeof delta.content === 'string') assistantContent += delta.content
        // tool_calls 是增量分片：id/name 只在首片出现，arguments 会分多片拼接
        if (Array.isArray(delta.tool_calls)) {
            for (const part of delta.tool_calls) {
                const index = Number.isInteger(part.index) ? part.index : 0
                const item = toolCalls.get(index) || {
                    id: '',
                    type: 'function',
                    function: { name: '', arguments: '' }
                }
                if (part.id) item.id = part.id
                if (part.type) item.type = part.type
                if (part.function) {
                    if (part.function.name) item.function.name += part.function.name
                    if (part.function.arguments) item.function.arguments += part.function.arguments
                }
                toolCalls.set(index, item)
            }
        }
        if (choice.finish_reason) finishReason = choice.finish_reason
    }
    return {
        assistantContent,
        toolCalls: [...toolCalls.values()],
        finishReason,
        aborted: controller.signal.aborted
    }
}

// deepseek大模型 SSE 流式对话
// 必须登录后调用：该接口使用服务端 API Key，未鉴权时任何人都可无限消耗额度
ai.post('/deepseekMoudle', authenticateToken, async (req, res) => {
    const { text, moduleId, thinking } = req.body || {}
    if (!Array.isArray(text) || text.length === 0 || !moduleId) {
        return res.status(400).json({ code: 1, msg: '对话参数不完整' })
    }
    if (!process.env.DEEPSEEK_APIKEY) {
        return res.status(500).json({ code: 5, msg: 'AI 服务未配置，请联系管理员' })
    }

    const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: process.env.DEEPSEEK_APIKEY
    });

    // 用户点击停止或关闭页面时中止上游请求，避免继续消耗额度
    const controller = new AbortController()
    res.on('close', () => {
        if (!res.writableEnded) controller.abort()
    })

    try {
        // 工具调用闭环：模型可能先调用工具，拿到结果后再继续生成，最多循环 MAX_TOOL_ROUNDS 轮
        let messages = text
        let rounds = 0
        while (true) {
            const allowTools = rounds < MAX_TOOL_ROUNDS
            const params = {
                messages,
                model: moduleId,
                stream: true
            };
            // 实时信息（日期、天气）必须由工具提供，避免模型凭记忆编造
            if (allowTools) {
                params.tools = toolDefinitions
                params.tool_choice = 'auto'
            }
            // 思考模式由前端「贤者沉思」开关通过 thinking 显式控制：
            // disabled 时模型不输出 reasoning_content，普通模式可以立即开始回答；
            // 不传该参数时保持模型默认行为，兼容旧版客户端
            if (typeof thinking === 'boolean') {
                params.thinking = { type: thinking ? 'enabled' : 'disabled' };
            }
            rounds += 1

            const round = await streamChatRound(openai, params, res, controller)
            if (round.aborted || res.writableEnded || res.destroyed) return
            if (!allowTools || round.finishReason !== 'tool_calls' || round.toolCalls.length === 0) break

            // 先把带 tool_calls 的 assistant 消息回填，再逐个执行工具并回填 tool 消息，
            // 下一轮模型据此生成最终回答
            messages = messages.concat({
                role: 'assistant',
                content: round.assistantContent || '',
                tool_calls: round.toolCalls
            })
            for (const call of round.toolCalls) {
                const result = await executeTool(
                    call.function && call.function.name,
                    call.function && call.function.arguments,
                    { signal: controller.signal }
                )
                messages = messages.concat({
                    role: 'tool',
                    tool_call_id: call.id,
                    content: JSON.stringify(result)
                })
            }
        }
    } catch (error) {
        // 客户端主动中止（点停止/关闭页面）不算异常
        if (controller.signal.aborted) return
        console.error('DeepSeek 流式对话失败:', (error && error.status) || '', (error && error.message) || error)
        // 无论失败发生在流开始前还是中途，都保证客户端收到一条可展示的错误事件，
        // 否则前端只会看到空白回答（流正常结束但没有内容）
        startSSE(res)
        writeSSEError(res, deepseekErrorMessage(error))
    } finally {
        if (!res.writableEnded && !res.destroyed) res.end()
    }
})

// DeepSeek 网页搜索（返回标题、链接、摘要，供模型参考）
ai.post('/webSearch', [authenticateToken, validateFields(['query'])], async (req, res) => {
    const { query, count, ori_question } = req.body
    const searchQuery = String(query).trim().slice(0, 128)
    if (!searchQuery) {
        return res.json({ code: 1, msg: '搜索内容不能为空' })
    }
    try {
        const { data } = await axios.post('https://api.deepseek.com/v1/tools/search', {
            query: searchQuery,
            count: Math.min(50, Math.max(1, Number(count) || 5)),
            ori_question: ori_question ? String(ori_question).slice(0, 128) : undefined,
            need_content: false
        }, {
            headers: {
                Authorization: `Bearer ${process.env.DEEPSEEK_APIKEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        })
        const results = Array.isArray(data && data.results) ? data.results : []
        return res.json({ code: 0, msg: '成功', data: results })
    } catch (err) {
        console.error('网页搜索失败:', err.response?.data || err.message)
        const message = err.response?.status === 402 ? '搜索服务余额不足' : '网页搜索失败，请稍后再试'
        return res.json({ code: 1, msg: message })
    }
})

// DeepSeek 语音合成：把回答文本转成 WAV 音频流，供前端「朗读」播放
// 必须登录后调用：该接口消耗服务端 API Key 额度，不能匿名开放
ai.post('/tts', authenticateToken, async (req, res) => {
    if (!process.env.DEEPSEEK_APIKEY) {
        return res.status(500).json({ code: 5, msg: 'AI 服务未配置，请联系管理员' })
    }
    const content = typeof (req.body && req.body.text) === 'string' ? req.body.text.trim() : ''
    if (!content) {
        return res.status(400).json({ code: 1, msg: '朗读内容不能为空' })
    }
    // 上游单次最多 10000 字符，超长由前端分段请求
    if (content.length > 10000) {
        return res.status(400).json({ code: 1, msg: '朗读内容过长，请分段朗读' })
    }

    // 前端朗读需要边合成边播放，PCM 便于 Web Audio 逐块解码；其他客户端仍默认拿 wav
    const format = req.body && req.body.format === 'pcm' ? 'pcm' : 'wav'

    // 用户停止朗读或关闭页面时中止上游请求，避免继续消耗额度
    const controller = new AbortController()
    res.on('close', () => {
        if (!res.writableEnded) controller.abort()
    })

    try {
        const upstream = await axios.post('https://api.deepseek.com/v1/tools/tts', {
            text: content,
            format
        }, {
            headers: {
                Authorization: `Bearer ${process.env.DEEPSEEK_APIKEY}`,
                'Content-Type': 'application/json'
            },
            responseType: 'stream',
            timeout: 60000,
            signal: controller.signal,
            // 上游错误返回 JSON，这里自行判断状态码，避免异常日志吞掉具体原因
            validateStatus: () => true
        })

        if (upstream.status !== 200) {
            upstream.data.destroy()
            const message = upstream.status === 402 ? '语音合成余额不足，请联系管理员' : '语音合成失败，请稍后再试'
            return res.status(502).json({ code: 1, msg: message })
        }

        // 直接透传音频流，避免整段音频先落内存；浏览器原生支持 wav 播放
        res.setHeader('Content-Type', upstream.headers['content-type'] || 'audio/wav')
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('X-Accel-Buffering', 'no')
        if (upstream.headers['content-length']) {
            res.setHeader('Content-Length', upstream.headers['content-length'])
        }
        upstream.data.pipe(res)
        upstream.data.on('error', () => {
            if (!res.writableEnded && !res.destroyed) res.end()
        })
    } catch (error) {
        if (controller.signal.aborted) return
        console.error('语音合成失败:', (error && error.status) || '', (error && error.message) || error)
        if (!res.headersSent) {
            return res.status(500).json({ code: 1, msg: '语音合成失败，请稍后再试' })
        }
        if (!res.writableEnded && !res.destroyed) res.end()
    }
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

// 上传PDF文件（需登录，避免匿名请求占用磁盘和服务端解析资源）
ai.post('/uploadFile', authenticateToken, upload.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ code: 1, msg: '请选择要上传的 PDF 文件' })
    }
    try {
        const dataBuffer = fs.readFileSync(req.file.path);
        const pdfData = await pdf(dataBuffer);
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        return res.json({
            code: 0,
            msg: '上传成功',
            data: {
                originalName: req.file.filename,
                text: pdfData.text,
                metadata: pdfData.metadata,
                numPages: pdfData.numpages,
                url: imageUrl
            }
        });
    } catch (err) {
        // 解析失败时删除已落盘的文件，避免留下无效文件；同时防止异常变成未捕获的 Promise 拒绝
        fs.unlink(req.file.path, () => {});
        return res.status(500).json({ code: 1, msg: '文件解析失败，请确认是有效的 PDF 后重试' })
    }
});

// multer 错误处理
ai.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ code: 1, msg: '文件大小不能超过 1MB', maxSize: '1MB' });
    }
    return res.status(400).json({ code: 1, msg: '文件上传失败，请重试' });
  } else if (err) {
    return res.status(500).json({ code: 1, msg: '服务器错误，请稍后重试' });
  }
  next();
});

module.exports = ai
