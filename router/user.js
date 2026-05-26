const express = require('express');
const admin = express.Router();

const auth = require('./auth')
const ai = require('./ai')
const data = require('./data')

admin.use(auth)
admin.use(ai)
admin.use(data)

module.exports = admin
