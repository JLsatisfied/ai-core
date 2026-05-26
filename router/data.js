const express = require('express');
const data = express.Router();
const db = require('../config/mysqlConfig')
const validateFields = require('../middleware/validator')
const { authenticateToken } = require('../middleware/auth')

const query = (sql, params) => db.promise().query(sql, params)

const dbError = (res, err) => {
    console.error('数据库错误:', err)
    return res.status(500).json({ code: 4, msg: '服务器内部错误' })
}

// 添加大模型分类
data.post('/addCategory', [authenticateToken, validateFields(['self_introduction', 'my_name', 'name', 'introduce', 'user_id'])], async (req, res) => {
    try {
        const { self_introduction, my_name, name, introduce, user_id } = req.body;
        const imgIndex = Math.floor(Math.random() * 6) + 1;
        let category_img = ""
        switch (imgIndex) {
            case 1:
                category_img = "https://s1.imagehub.cc/images/2024/12/23/7049b9735c066e9267ca75ed043b0852.th.png"
                break;
            case 2:
                category_img = "https://s1.imagehub.cc/images/2024/12/23/1645c7845cafece9c8b6cb83306c7b66.th.png"
                break;
            case 3:
                category_img = "https://s1.imagehub.cc/images/2024/12/23/5696a6b0eb9637dfa55fff8bf616bb35.th.png"
                break;
            case 4:
                category_img = "https://s1.imagehub.cc/images/2024/12/23/4c83b1abee9c6631259a95086bac0b9e.th.png"
                break;
            case 5:
                category_img = "https://s1.imagehub.cc/images/2024/12/23/d6b4f1f876bcad914fe6f1b31b2220c7.th.jpeg"
                break;
            default:
                category_img = "https://s1.imagehub.cc/images/2024/12/23/7c50bce03c953e9f031424a1f36d2510.th.jpg"
        }

        const [existing] = await query('select * from category where my_name = ? and user_id = ?', [my_name, user_id])
        if (existing.length > 0) {
            return res.json({ code: 1, msg: '已存在聊天搭子' })
        }

        await query('insert into category (self_introduction, my_name, name, introduce, user_id, category_img) values (?,?,?,?,?,?)', [self_introduction, my_name, name, introduce, user_id, category_img])
        return res.json({ code: 0, msg: '添加成功' })
    } catch (err) {
        return dbError(res, err)
    }
})

// 添加客服应用配置项
data.post('/addCustomerService', authenticateToken, async (req, res) => {
    try {
        const { appid, welcomeText, signature, title, techBrand, themeColor } = req.body;
        const [result] = await query('select * from customer_service where appid = ?', [appid])
        if (result.length > 0) {
            await query('update customer_service set welcomeText = ?, signature = ?, title = ?, techBrand = ?, themeColor = ? where appid = ?', [welcomeText, signature, title, techBrand, themeColor, appid])
            return res.json({ code: 0, msg: '客服配置更新成功' })
        } else {
            await query('insert into customer_service (appid, welcomeText, signature, title, techBrand, themeColor) values (?,?,?,?,?,?)', [appid, welcomeText, signature, title, techBrand, themeColor])
            return res.json({ code: 0, msg: '客服配置保存成功' })
        }
    } catch (err) {
        return dbError(res, err)
    }
})

// 查询客服应用配置项
data.get('/queryCustomerService', authenticateToken, async (req, res) => {
    try {
        const { appid } = req.query
        const [results] = await query('select * from customer_service where appid = ?', [appid])
        if (results.length > 0) {
            return res.json({ code: 0, msg: '成功', data: results[0] })
        } else {
            return res.json({ code: 1, msg: '查询失败' })
        }
    } catch (err) {
        return dbError(res, err)
    }
})

// 添加对话信息
data.post('/addDialogue', authenticateToken, async (req, res) => {
    try {
        const dialogue = req.body;
        const values = dialogue.map(item => [item.myself_reply, item.ai_reply, item.category_id, item.user_id]);
        if (values.length === 0) {
            return res.json({ code: 1, msg: '对话内容不能为空' })
        }
        await query('insert into dialogue (myself_reply, ai_reply, category_id, user_id) values ?', [values])
        return res.json({ code: 0, data: '添加成功' })
    } catch (err) {
        return dbError(res, err)
    }
})

// 查询用户下的大模型分类
data.get('/queryCategory', authenticateToken, async (req, res) => {
    try {
        const { user_id } = req.query
        const [results] = await query('select * from category where user_id = ?', [user_id])
        return res.json({ code: 0, msg: '成功', data: results })
    } catch (err) {
        return dbError(res, err)
    }
})

// 查询大模型分类下的对话内容
data.get('/queryDialogue', authenticateToken, async (req, res) => {
    try {
        const { category_id, user_id } = req.query
        const [results] = await query('select * from dialogue where category_id = ? and user_id = ?', [category_id, user_id])
        const a1 = results.map(item => ({
            userText: item.myself_reply,
            adminContent: {
                adminText: item.ai_reply,
                isShow: false
            },
            quote: item.quote
        }))
        return res.json({ code: 0, msg: '成功', data: a1 })
    } catch (err) {
        return dbError(res, err)
    }
})

// 删除大模型分类
data.post('/deleteCategory', [authenticateToken, validateFields(['category_id'])], async (req, res) => {
    try {
        const { category_id } = req.body
        await query('delete from category where category_id = ?', [category_id])
        return res.json({ code: 0, msg: "删除成功" })
    } catch (err) {
        return dbError(res, err)
    }
})

// 删除大模型分类下的内容
data.post('/deleteDialogue', [authenticateToken, validateFields(['category_id', 'user_id'])], async (req, res) => {
    try {
        const { category_id, user_id } = req.body
        if (!category_id) {
            return res.json({ code: 1, msg: "大模型类别id不能为空" })
        }
        await query('delete from dialogue where category_id = ? and user_id = ?', [category_id, user_id])
        return res.json({ code: 0, msg: "已清空历史记录" })
    } catch (err) {
        return dbError(res, err)
    }
})

// 查询模板大类
data.get('/queryPrompt', authenticateToken, async (req, res) => {
    try {
        const [results] = await query('select * from tag')
        return res.json({ code: 0, msg: '成功', data: results })
    } catch (err) {
        return dbError(res, err)
    }
})

// 查询模板信息（包含分页功能）
data.get('/queryTemplate', authenticateToken, async (req, res) => {
    try {
        const { template_id } = req.query
        const page = parseInt(req.query.page)
        const pageSize = parseInt(req.query.pageSize)
        const offset = (page - 1) * pageSize

        // 并行查询数据和总数，消除回调嵌套
        const [[results], [totalResult]] = await Promise.all([
            query('select * from text_template where template_id = ? limit ? offset ?', [template_id, pageSize, offset]),
            query('select count(*) as count from text_template where template_id = ?', [template_id])
        ])

        return res.json({
            code: 0,
            msg: '成功',
            data: {
                page,
                pageSize,
                total: totalResult[0].count,
                data: results
            }
        })
    } catch (err) {
        return dbError(res, err)
    }
})

module.exports = data
