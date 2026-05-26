document.addEventListener('DOMContentLoaded', () => {
    // const chatButton = document.getElementById('chatButton');
    const chatWindow = document.getElementById('chatWindow');
    const closeButton = document.getElementById('closeButton');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const pauseButton = document.getElementById('pauseButton');
    const chatMessages = document.getElementById('chatMessages');
    const techBrand = document.getElementById('techBrand');
    let isPaused = false;
    let currentReader = null;
    let aiMessageDiv = null;
    let loadingDiv = null;
    let aiResponse = '';
    var disposition = null;
    /**
     * 获取URL中的查询参数
     * @returns {Object} 包含所有查询参数键值对的对象
     */
    function getQueryParams() {
        // 创建一个空对象用于存储参数键值对
        const params = {};

        // 获取URL中的查询字符串部分（去除'?'）
        const queryString = window.location.search.substring(1);

        // 使用URLSearchParams接口解析查询字符串
        const urlParams = new URLSearchParams(queryString);

        // 遍历所有参数，并将它们添加到params对象中
        urlParams.forEach((value, key) => {
            params[key] = value;
        });

        return params;
    }

    closeButton.addEventListener('click', function() {
        window.parent.postMessage({close: true}, '*');
    })

    axios.get('http://120.26.105.110/aicg/queryCustomerService', {
        params: {
            appid: getQueryParams().appid
        }
    })
    .then(function (response) {
        if (response.data.code == 0) {
            var chatHeader = document.getElementById('chatHeader');
            var actionButton = document.querySelectorAll('.action-button')
            var assistant = document.getElementById('assistant')
            disposition = response.data.data;
            for (var i = 0; i < actionButton.length; i++) {
                actionButton[i].style.backgroundColor = disposition.themeColor;
            }
            chatHeader.style.backgroundColor = disposition.themeColor;
            assistant.innerText = disposition.title;
            techBrand.innerText = disposition.techBrand;
            addMessage(disposition.welcomeText, 'ai');
        } else {
            console.log("查询失败")
        }
    })
    .catch(function (error) {
      // handle error
      console.log(error);
    })


    // 打开聊天窗口
    // chatButton.addEventListener('click', () => {
    //     chatWindow.classList.add('active');
    // });

    // 关闭聊天窗口
    // closeButton.addEventListener('click', () => {
    //     chatWindow.classList.add('close');
    // });

    // 暂停响应
    pauseButton.addEventListener('click', () => {
        // 暂停响应
        isPaused = true;
        // 恢复发送按钮
        sendButton.style.display = 'flex';
        pauseButton.style.display = 'none';
        // 关闭当前的reader
        if (currentReader) {
            currentReader.cancel();
            currentReader = null;
        }
    });

    // 发送消息
    function sendMessage() {
        const message = messageInput.value.trim();
        if (message) {
            // 添加用户消息到聊天界面
            const userMessageDiv = addMessage(message, 'user');
            messageInput.value = '';
            let userMessage = document.getElementsByClassName('user-message')
            for (let i = 0;i < userMessage.length; i++) {
                userMessage[i].style.backgroundColor = disposition.themeColor;
            }
            // 显示暂停按钮，隐藏发送按钮
            sendButton.style.display = 'none';
            pauseButton.style.display = 'flex';
            isPaused = false;
            pauseButton.classList.remove('paused');
            pauseButton.innerHTML = '<i class="fas fa-pause"></i>';

            // 调用AI API
            fetchAIResponse(message, userMessageDiv);
        }
    }

    // 点击发送按钮发送消息
    sendButton.addEventListener('click', sendMessage);

    // 按Enter发送消息
    // messageInput.addEventListener('keypress', (e) => {
    //     if (e.key === 'Enter' && !e.shiftKey) {
    //         e.preventDefault();
    //         sendMessage();
    //     }
    // });

    // 调整输入框高度
    const adjustTextareaHeight = (event) => {
        const textarea = event.target
        textarea.style.height = 'auto'
        textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
    }

    messageInput.addEventListener('input', function(event) {
        adjustTextareaHeight(event)
    })

    messageInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && event.ctrlKey) {
            event.preventDefault();
            messageInput.value += '\n';
            adjustTextareaHeight(event);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            sendMessage();
        }
    })

    // 添加消息到聊天界面
    function addMessage(text, sender) {
        var wrapperDiv = document.createElement('div');
        wrapperDiv.classList.add('wrapper');
        var messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
        
        // 创建消息内容容器
        if (sender =='ai') {
            var messageContent = document.createElement('div');
            messageContent.classList.add('message-content', 'ai-content');
        } else {
            var messageContent = document.createElement('div');
            messageContent.classList.add('message-content');
        }
        
        // 如果是AI消息，解析Markdown
        if (sender === 'ai') {
            messageContent.innerHTML = marked.parse(text);
        } else {
            messageContent.textContent = text;
        }
        
        messageDiv.appendChild(messageContent);
        wrapperDiv.appendChild(messageDiv);
        // 添加签名
        if (sender === 'ai') {
            const timeSpan = document.createElement('span');
            timeSpan.classList.add('message-signature');
            timeSpan.textContent = disposition.signature;
            wrapperDiv.appendChild(timeSpan);
        }
        
        // 如果是用户消息，添加状态指示器
        // if (sender === 'user') {
        //     const statusSpan = document.createElement('span');
        //     statusSpan.classList.add('message-status', 'sending');
        //     messageDiv.appendChild(statusSpan);
        // }
        
        chatMessages.appendChild(wrapperDiv);
        scrollToBottom();
        
        return messageDiv;
    }

    // 继续读取流式响应
    async function continueReading() {
        if (currentReader) {
            try {
                const { done, value } = await currentReader.read();
                if (!done && !isPaused) {
                    processChunk(value);
                    continueReading();
                } else if (done) {
                    // 响应完成，显示时间戳
                    if (aiMessageDiv) {
                        // const timeSpan = document.createElement('span');
                        // timeSpan.classList.add('message-time');
                        // const now = new Date();
                        // timeSpan.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                        // aiMessageDiv.appendChild(timeSpan);
                        
                        // 恢复发送按钮
                        sendButton.style.display = 'flex';
                        pauseButton.style.display = 'none';
                    }
                }
            } catch (error) {
                console.error('读取响应失败:', error);
                // 发生错误时恢复按钮状态
                sendButton.style.display = 'flex';
                pauseButton.style.display = 'none';
            }
        }
    }

    // 处理响应数据块
    function processChunk(value) {
        const decoder = new TextDecoder();
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                    return;
                }
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.choices && parsed.choices[0].delta.content) {
                        aiResponse += parsed.choices[0].delta.content;
                        if (!aiMessageDiv) {
                            removeLoadingAnimation(loadingDiv);
                            aiMessageDiv = addMessage(aiResponse, 'ai');
                        } else {
                            aiMessageDiv.querySelector('.message-content').innerHTML = marked.parse(aiResponse);
                        }
                        scrollToBottom();
                    }
                } catch (e) {
                    console.error('解析响应数据失败:', e);
                }
            }
        }
    }

    // 添加加载动画
    function addLoadingAnimation() {
        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('loading-animation');
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.classList.add('loading-dot');
            loadingDiv.appendChild(dot);
        }
        
        chatMessages.appendChild(loadingDiv);
        scrollToBottom();
        
        return loadingDiv;
    }

    // 移除加载动画
    function removeLoadingAnimation(loadingDiv) {
        if (loadingDiv && loadingDiv.parentNode) {
            loadingDiv.parentNode.removeChild(loadingDiv);
        }
    }

    // 滚动到底部
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 更新消息状态
    // function updateMessageStatus(messageDiv, status) {
    //     const statusSpan = messageDiv.querySelector('.message-status');
    //     if (statusSpan) {
    //         statusSpan.className = 'message-status';
    //         statusSpan.classList.add(status);
    //     }
    // }

    // 调用DeepSeek API
    async function fetchAIResponse(message, userMessageDiv) {
        const API_KEY = 'sk-4016534216e24324b26e72dec9a394db'; // 请替换为你的API密钥
        const API_URL = 'https://api.deepseek.com/v1/chat/completions';

        try {
            // updateMessageStatus(userMessageDiv, 'sent');
            
            // 添加加载动画
            loadingDiv = addLoadingAnimation();
            
            // 重置AI响应
            aiResponse = '';
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [
                        {
                            role: "user",
                            content: message
                        }
                    ],
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error('API请求失败');
            }

            currentReader = response.body.getReader();
            aiMessageDiv = null;

            // 开始读取响应
            continueReading();

        } catch (error) {
            console.error('API调用失败:', error);
            removeLoadingAnimation(loadingDiv);
            addMessage('抱歉，发生了一些错误，请稍后再试。', 'ai');
            // updateMessageStatus(userMessageDiv, 'error');
            sendButton.style.display = 'flex';
            pauseButton.style.display = 'none';
        }
    }
}); 