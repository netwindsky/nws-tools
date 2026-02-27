// control-panel.js - Side Panel 控制面板脚本
// 测试脚本是否执行
console.log('[ControlPanel] ===== 脚本开始执行 =====');

// 消息历史
let messages = [];
let isProcessing = false;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('[ControlPanel] DOMContentLoaded 触发');
    // 请求当前页面摘要
    requestPageSummary();
});

// 自动调整输入框高度
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

// 处理键盘事件
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// 发送消息
function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message || isProcessing) return;

    // 添加用户消息
    addMessage('user', message);
    input.value = '';
    input.style.height = 'auto';

    // 模拟AI回复
    processUserMessage(message);
}

// 发送快捷消息
function sendQuickMessage(message) {
    if (isProcessing) return;
    
    document.getElementById('chatInput').value = message;
    sendMessage();
}

// 处理用户消息
function processUserMessage(message) {
    isProcessing = true;
    updateSendButton();

    // 显示加载状态
    const loadingId = addLoadingMessage();

    // 发送消息到content script处理
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'processAIQuery',
                query: message
            }).catch(() => {
                // 如果content script没有响应，使用默认回复
                setTimeout(() => {
                    removeMessage(loadingId);
                    addMessage('ai', generateDefaultResponse(message));
                    isProcessing = false;
                    updateSendButton();
                }, 1000);
            });
        } else {
            removeMessage(loadingId);
            addMessage('ai', '无法获取当前页面信息，请确保您在浏览网页。');
            isProcessing = false;
            updateSendButton();
        }
    });
}

// 生成默认回复
function generateDefaultResponse(query) {
    const responses = {
        '总结当前页面': '正在为您生成页面摘要...\n\n## 页面概述\n\n这是一个现代化的网页，包含丰富的内容和交互元素。\n\n## 主要内容\n\n- **页面结构**：清晰的层次结构，良好的语义化标签使用\n- **视觉设计**：现代化的UI设计，配色协调\n- **交互体验**：流畅的用户交互，响应式设计\n\n## 技术特点\n\n1. 使用现代前端技术栈\n2. 优化的性能表现\n3. 良好的可访问性支持',
        '提取关键信息': '## 关键信息提取\n\n### 页面元数据\n- **标题**：' + (document.title || '未获取') + '\n- **URL**：当前浏览页面\n\n### 主要内容\n页面包含丰富的文本内容、多媒体资源和交互元素。\n\n### 资源统计\n- 文本段落：多个\n- 图片资源：若干\n- 链接地址：多个',
        '分析页面结构': '## 页面结构分析\n\n### DOM结构\n```\nDocument\n├── Head\n│   ├── Meta tags\n│   ├── Title\n│   └── Stylesheets\n└── Body\n    ├── Header\n    ├── Main Content\n    └── Footer\n```\n\n### 布局特点\n- 响应式设计\n- 模块化组件\n- 清晰的视觉层次',
        '优化建议': '## 优化建议\n\n### 性能优化\n1. **图片优化**：使用WebP格式，添加懒加载\n2. **代码压缩**：压缩CSS和JavaScript文件\n3. **缓存策略**：合理配置浏览器缓存\n\n### SEO优化\n1. 完善meta描述\n2. 优化标题结构\n3. 添加结构化数据\n\n### 用户体验\n1. 提升首屏加载速度\n2. 优化交互反馈\n3. 增强可访问性'
    };

    return responses[query] || '我收到了您的问题："' + query + '"\n\n作为AI助手，我可以帮您：\n\n- 📋 总结页面内容\n- 🔍 提取关键信息\n- 🏗️ 分析页面结构\n- 💡 提供优化建议\n\n请使用上方的快捷按钮或直接告诉我您想了解什么。';
}

// 添加消息
function addMessage(role, content) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageId = 'msg-' + Date.now();
    
    // 移除欢迎消息
    const welcomeMsg = messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.className = 'message ' + role;
    
    const avatar = role === 'user' ? '👤' : '🤖';
    const renderedContent = role === 'ai' ? renderMarkdown(content) : escapeHtml(content);
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            ${renderedContent}
            ${role === 'ai' ? `
                <div class="message-actions">
                    <button class="message-action-btn" onclick="copyMessage('${messageId}')">
                        <i class="fas fa-copy"></i> 复制
                    </button>
                    <button class="message-action-btn" onclick="regenerateMessage('${messageId}')">
                        <i class="fas fa-redo"></i> 重新生成
                    </button>
                </div>
            ` : ''}
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    
    messages.push({ id: messageId, role, content });
    return messageId;
}

// 添加加载消息
function addLoadingMessage() {
    const messagesContainer = document.getElementById('chatMessages');
    const messageId = 'loading-' + Date.now();
    
    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.className = 'message ai';
    messageDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    return messageId;
}

// 移除消息
function removeMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
        message.remove();
    }
}

// 渲染Markdown
function renderMarkdown(content) {
    if (typeof marked === 'undefined') {
        return escapeHtml(content).replace(/\n/g, '<br>');
    }
    
    // 处理思考内容
    let processedContent = content.replace(/<thinking>([\s\S]*?)<\/thinking>/g, '<div class="think-content">$1</div>');
    
    try {
        return marked.parse(processedContent);
    } catch (e) {
        return escapeHtml(content).replace(/\n/g, '<br>');
    }
}

// 转义HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 滚动到底部
function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
}

// 更新发送按钮状态
function updateSendButton() {
    const btn = document.getElementById('sendBtn');
    btn.disabled = isProcessing;
}

// 复制消息
function copyMessage(messageId) {
    const message = messages.find(m => m.id === messageId);
    if (message) {
        navigator.clipboard.writeText(message.content).then(() => {
            showToast('已复制到剪贴板');
        });
    }
}

// 重新生成消息
function regenerateMessage(messageId) {
    const index = messages.findIndex(m => m.id === messageId);
    if (index > 0 && messages[index - 1].role === 'user') {
        const userMessage = messages[index - 1].content;
        removeMessage(messageId);
        messages.splice(index, 1);
        processUserMessage(userMessage);
    }
}

// 清空对话
function clearChat() {
    messages = [];
    const container = document.getElementById('chatMessages');
    container.innerHTML = `
        <div class="welcome-message">
            <h2>👋 你好！我是 NWS AI 助手</h2>
            <p>我可以帮你分析页面内容、提取关键信息、生成摘要等。<br>点击上方快捷按钮或直接在下方输入你的问题。</p>
        </div>
    `;
}

// 请求页面摘要
function requestPageSummary() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'requestSummary' }).catch(() => {});
        }
    });
}

// 刷新分析
function refreshAnalysis() {
    clearChat();
    requestPageSummary();
    showToast('正在重新分析页面...');
}

// 打开设置
function openSettings() {
    chrome.runtime.openOptionsPage();
}

// 显示提示
function showToast(message) {
    // 简单的提示实现
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        font-size: 14px;
        z-index: 1000;
        animation: fadeInUp 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// 用于防止重复处理相同消息
let lastProcessedSummary = null;
let lastProcessedTime = 0;

// 流式消息相关
let streamMessageId = null;
let streamContent = '';

// 处理页面摘要的函数
function handlePageSummary(summary) {
    console.log('[ControlPanel] handlePageSummary 被调用');
    
    // 检查是否是重复消息（5秒内相同内容）
    const now = Date.now();
    if (lastProcessedSummary === summary && (now - lastProcessedTime) < 5000) {
        console.log('[ControlPanel] 跳过重复消息');
        return;
    }
    
    // 记录已处理的消息
    lastProcessedSummary = summary;
    lastProcessedTime = now;
    
    // 移除加载状态
    const loadingMsg = document.querySelector('.typing-indicator');
    if (loadingMsg) {
        loadingMsg.closest('.message').remove();
    }
    
    // 添加AI回复
    addMessage('ai', summary);
    isProcessing = false;
    updateSendButton();
}

// 处理流式页面摘要
function handlePageSummaryStream(chunk, fullContent, isDone) {
    console.log('[ControlPanel] handlePageSummaryStream 被调用', { chunkLength: chunk.length, isDone });
    
    // 如果是第一次接收流式消息，创建新的消息元素
    if (!streamMessageId) {
        // 移除加载状态
        const loadingMsg = document.querySelector('.typing-indicator');
        if (loadingMsg) {
            loadingMsg.closest('.message').remove();
        }
        
        // 创建新的流式消息
        streamMessageId = createStreamMessage();
        streamContent = '';
    }
    
    // 更新内容
    streamContent = fullContent;
    updateStreamMessage(streamMessageId, streamContent);
    
    // 如果完成，重置状态
    if (isDone) {
        console.log('[ControlPanel] 流式消息完成');
        streamMessageId = null;
        streamContent = '';
        isProcessing = false;
        updateSendButton();
    }
}

// 创建流式消息元素
function createStreamMessage() {
    const messagesContainer = document.getElementById('chatMessages');
    const messageId = 'stream-' + Date.now();
    
    // 移除欢迎消息
    const welcomeMsg = messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.className = 'message ai stream-message';
    messageDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="stream-content"></div>
            <div class="stream-cursor">▊</div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    
    return messageId;
}

// 更新流式消息内容
function updateStreamMessage(messageId, content) {
    const messageDiv = document.getElementById(messageId);
    if (!messageDiv) return;
    
    const contentDiv = messageDiv.querySelector('.stream-content');
    if (contentDiv) {
        contentDiv.innerHTML = renderMarkdown(content);
    }
    
    scrollToBottom();
}

// 立即初始化（脚本在 body 末尾，DOM 已经加载完成）
console.log('[ControlPanel] 立即初始化消息监听');

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[ControlPanel] 收到消息:', message);
    
    if (message.type === 'pageSummary' && message.summary) {
        console.log('[ControlPanel] 处理页面摘要消息');
        handlePageSummary(message.summary);
        sendResponse({ received: true });
    }
    
    if (message.type === 'pageSummaryStream') {
        console.log('[ControlPanel] 处理流式页面摘要消息');
        handlePageSummaryStream(message.chunk, message.fullContent, message.isDone);
        sendResponse({ received: true });
    }
    
    return true; // 保持消息通道开放
});

// 检查 storage 中是否有待处理的消息
console.log('[ControlPanel] 检查待处理的消息');
chrome.storage.local.get('nws_pending_summary', (result) => {
    console.log('[ControlPanel] storage 查询结果:', result);
    if (result.nws_pending_summary) {
        const { message, timestamp } = result.nws_pending_summary;
        // 检查消息是否在30秒内
        if (Date.now() - timestamp < 30000) {
            console.log('[ControlPanel] 发现待处理的消息:', message);
            handlePageSummary(message.summary);
            // 清除已处理的消息
            chrome.storage.local.remove('nws_pending_summary');
        }
    }
});

// 监听 storage 变化
chrome.storage.onChanged.addListener((changes, namespace) => {
    console.log('[ControlPanel] storage 变化:', changes, namespace);
    if (namespace === 'local' && changes.nws_pending_summary) {
        const newValue = changes.nws_pending_summary.newValue;
        if (newValue && newValue.message) {
            console.log('[ControlPanel] 检测到新消息:', newValue.message);
            handlePageSummary(newValue.message.summary);
            // 清除已处理的消息
            chrome.storage.local.remove('nws_pending_summary');
        }
    }
});
