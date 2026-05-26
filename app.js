const dotenv = require('dotenv');
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

const express = require('express')
const path = require('path');
const cors = require('cors')
const app = express();
const bodyParser = require('body-parser');
const passport = require('passport')
const history = require('connect-history-api-fallback'); // 解决前端history模式路由找不到的问题
const session = require('express-session')
// const expressStaticGzip = require('express-static-gzip');

// 配置session中间件
app.use(session({
	secret: process.env.SESSION_SECRET,
	resave: false,   // 固定写法
	saveUninitialized: false   // 固定写法
}))
app.use(history())
app.use('/',express.static(__dirname + '/dist'))
app.use(express.static(path.join(__dirname, 'customerService')));
app.get('/kefu.html', (req, res) => {
	res.sendFile(path.join(__dirname, 'customerService', 'index.html'));
});
app.use('/uploads', express.static('uploads'))
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))
 
// parse application/json
app.use(bodyParser.json())

app.use(cors())

//初始化passport
app.use(passport.initialize());

require("./config/passport.js")(passport);

const user = require('./router/user')
app.use('/aicg', user)

const prot = "5002"

app.listen(prot, '0.0.0.0', ()=>{
	console.log('开始服务器')
})