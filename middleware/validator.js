const validateFields = (requiredFields) => {
    return (req, res, next) => {
        const missingFields = [];

        requiredFields.forEach(item => {
            const value = req.body[item]
            if (value === null || value === undefined || String(value).trim() === '') {
                missingFields.push(item)
            }
        });

        if (missingFields.length > 0) {
            res.status(200).json({
                code: 7,
                msg: missingFields + '字段不能为空'
            })
        } else {
            next()
        }
    }
}

module.exports = validateFields