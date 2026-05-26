const appId = window.BotConfig.appId
var disposition = null

function loadCSS(url) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.type = 'text/css'
    link.href = url
    document.head.appendChild(link)
}

function loadJS(url, callback) {
    const link = document.createElement('script')
    link.src = url
    
    // 添加加载完成事件监听
    if (callback) {
        link.onload = callback
    }
    
    document.head.appendChild(link)
}

loadCSS('http://120.26.105.110/css/kefu.css');
loadCSS('https://cdn.bootcdn.net/ajax/libs/font-awesome/6.4.0/css/all.min.css');

// 创建聊天按钮
const chatButton = document.createElement('div');
chatButton.className = 'chat-button';
chatButton.id = 'chatButton';

// 创建图标
const chatIcon = document.createElement('i');
chatIcon.className = 'fas fa-robot chat-icon';

// 将图标添加到按钮中
chatButton.appendChild(chatIcon);

// 将按钮添加到文档中
document.body.appendChild(chatButton);

// 创建iframe
const iframe = document.createElement('iframe');
iframe.id = 'chatIframe';
iframe.src = 'http://120.26.105.110/kefu.html?appid=' + appId;
iframe.style.display = 'none';
iframe.style.position = 'fixed';
iframe.style.bottom = '100px';
iframe.style.right = '20px';
iframe.style.width = '400px';
iframe.style.height = '500px';
iframe.style.border = 'none';
iframe.style.zIndex = '999';

// 将iframe添加到文档中
document.body.appendChild(iframe);

window.addEventListener('message', function(event) {
    if (event.origin == 'http://120.26.105.110') {
        if (event.data.close) {
            iframe.style.display = 'none'
        }
    }
})
// 添加点击事件监听器
chatButton.addEventListener('click', () => {
    iframe.style.display = iframe.style.display === 'none' ? 'block' : 'none';
});

// 在axios加载完成后执行请求
loadJS('http://120.26.105.110/js/axios.min.js', function() {
    // 现在axios已经加载完成，可以安全使用
    axios.get('http://120.26.105.110/aicg/queryCustomerService', {
        params: {
            appid: appId
        }
    })
    .then(function (response) {
        if (response.data.code == 0) {
            disposition = response.data.data;
            var chatButton = document.getElementById('chatButton')
            chatButton.style.backgroundColor = disposition.themeColor;
        } else {
            console.log("查询失败")
        }
    })
    .catch(function (error) {
        console.log(error);
    });
});
