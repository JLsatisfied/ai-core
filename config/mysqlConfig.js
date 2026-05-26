const mysql = require('mysql2')

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    connectionLimit: 10,        // 最大连接数
    waitForConnections: true,   // 连接池满时排队等待
    queueLimit: 100,            // 排队上限，超出直接报错避免内存溢出
    enableKeepAlive: true,      // 防长时间空闲被 MySQL 服务端断开
    keepAliveInitialDelay: 30000,
    connectTimeout: 5000,       // 5 秒连接不上即超时
});

db.on('error', (err) => {
    console.error('MySQL连接池错误:', err)
})

module.exports = db