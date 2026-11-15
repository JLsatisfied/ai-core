const axios = require('axios')

// 大模型可调用的工具定义。
// 模型对「今天几号」「现在几点」「今天天气」这类实时问题只能凭训练数据猜测，
// 必须通过工具拿到真实数据后再回答，否则日期和天气会一直是错的。
const toolDefinitions = [
    {
        type: 'function',
        function: {
            name: 'get_current_datetime',
            description: '获取当前真实的日期、时间和星期。用户询问今天几号、现在几点、今天星期几等与当前时间相关的问题时，必须先调用此工具，不要凭记忆回答。',
            parameters: {
                type: 'object',
                properties: {
                    timezone: {
                        type: 'string',
                        description: 'IANA 时区名称，例如 Asia/Shanghai、America/New_York，默认 Asia/Shanghai'
                    }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_weather',
            description: '查询指定城市的实时天气和未来三天预报。用户询问天气、气温、是否下雨、穿衣建议等与天气相关的问题时，必须先调用此工具，不要凭记忆回答。',
            parameters: {
                type: 'object',
                properties: {
                    location: {
                        type: 'string',
                        description: '城市名称，例如 北京、上海、广州、Shenzhen'
                    }
                },
                required: ['location']
            }
        }
    }
]

const DEFAULT_TIMEZONE = 'Asia/Shanghai'

// WMO 天气代码 → 中文描述
const WEATHER_CODE_TEXT = {
    0: '晴',
    1: '大部晴朗',
    2: '多云',
    3: '阴',
    45: '雾',
    48: '雾凇',
    51: '小毛毛雨',
    53: '毛毛雨',
    55: '大毛毛雨',
    56: '冻毛毛雨',
    57: '强冻毛毛雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    66: '冻雨',
    67: '强冻雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    77: '米雪',
    80: '小阵雨',
    81: '阵雨',
    82: '强阵雨',
    85: '小阵雪',
    86: '强阵雪',
    95: '雷阵雨',
    96: '雷阵雨伴小冰雹',
    99: '雷阵雨伴大冰雹'
}

const weatherText = (code) => WEATHER_CODE_TEXT[code] || `未知天气(${code})`
const withUnit = (value, unit) => (value === undefined || value === null ? '未知' : `${value}${unit}`)

// 按指定时区格式化当前时间；时区非法时退回默认时区，避免工具直接失败
const formatDateTime = (timezone) => {
    const zone = typeof timezone === 'string' && timezone.trim() ? timezone.trim() : DEFAULT_TIMEZONE
    const format = (tz) => {
        const parts = new Intl.DateTimeFormat('zh-CN', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            weekday: 'long',
            hourCycle: 'h23'
        }).formatToParts(new Date())
        const pick = (type) => (parts.find((part) => part.type === type) || {}).value || ''
        return {
            date: `${pick('year')}-${pick('month')}-${pick('day')}`,
            time: `${pick('hour')}:${pick('minute')}:${pick('second')}`,
            weekday: pick('weekday')
        }
    }
    let parts
    try {
        parts = format(zone)
    } catch (error) {
        parts = format(DEFAULT_TIMEZONE)
        return {
            timezone: DEFAULT_TIMEZONE,
            ...parts,
            dateTime: `${parts.date} ${parts.time}`,
            utc: new Date().toISOString()
        }
    }
    return {
        timezone: zone,
        ...parts,
        dateTime: `${parts.date} ${parts.time}`,
        utc: new Date().toISOString()
    }
}

// 通过 Open-Meteo（免密钥）先做城市地理编码，再取实时天气和三日预报
const fetchWeather = async (location, signal) => {
    const name = String(location || '').trim().slice(0, 64)
    if (!name) throw new Error('缺少城市名称，请向用户确认要查询的城市')

    const geo = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
        params: { name, count: 1, language: 'zh', format: 'json' },
        timeout: 8000,
        signal
    })
    const place = Array.isArray(geo.data && geo.data.results) ? geo.data.results[0] : null
    if (!place) throw new Error(`未找到城市「${name}」，请换一个更常见的城市名`)

    const forecast = await axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
            latitude: place.latitude,
            longitude: place.longitude,
            current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
            timezone: 'auto',
            forecast_days: 3
        },
        timeout: 8000,
        signal
    })

    const current = (forecast.data && forecast.data.current) || {}
    const daily = (forecast.data && forecast.data.daily) || {}
    const dailyList = Array.isArray(daily.time)
        ? daily.time.map((date, index) => ({
            date,
            weather: weatherText(daily.weather_code && daily.weather_code[index]),
            max: withUnit(daily.temperature_2m_max && daily.temperature_2m_max[index], '°C'),
            min: withUnit(daily.temperature_2m_min && daily.temperature_2m_min[index], '°C'),
            rainProbability: withUnit(daily.precipitation_probability_max && daily.precipitation_probability_max[index], '%')
        }))
        : []

    const placeName = [place.name, place.admin1, place.country]
        .filter((item, index, arr) => item && arr.indexOf(item) === index)
        .join(' ')

    return {
        location: placeName,
        timezone: place.timezone,
        current: {
            time: current.time || '',
            weather: weatherText(current.weather_code),
            temperature: withUnit(current.temperature_2m, '°C'),
            feelsLike: withUnit(current.apparent_temperature, '°C'),
            humidity: withUnit(current.relative_humidity_2m, '%'),
            precipitation: withUnit(current.precipitation, 'mm'),
            windSpeed: withUnit(current.wind_speed_10m, 'km/h'),
            isDay: current.is_day === 1
        },
        daily: dailyList
    }
}

// 工具执行统一入口：参数解析失败、未知工具、上游异常都转成 { error } 交还给模型，
// 由模型向用户解释，避免单个工具失败导致整轮对话中断
const executeTool = async (name, argumentsJson, options = {}) => {
    let args = {}
    try {
        args = argumentsJson ? JSON.parse(argumentsJson) : {}
    } catch (error) {
        return { error: '工具参数不是合法的 JSON' }
    }
    try {
        if (name === 'get_current_datetime') return formatDateTime(args.timezone)
        if (name === 'get_weather') return await fetchWeather(args.location, options.signal)
        return { error: `不支持的工具：${name}` }
    } catch (error) {
        // 客户端中止时向上抛出，交由路由层结束响应，而不是当成工具错误继续请求
        if (options.signal && options.signal.aborted) throw error
        return { error: error instanceof Error ? error.message : '工具执行失败' }
    }
}

module.exports = { toolDefinitions, executeTool }
