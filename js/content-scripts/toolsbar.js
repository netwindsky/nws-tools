
/**
 * toolsbar.js - 网页右侧悬浮工具栏
 * 提供批量下载图片、翻译网页、总结网页等功能
 */

// 从全局模块系统获取工具函数
const { safeQuerySelector, safeQuerySelectorAll } = window.NWSModules ? window.NWSModules.utils : {};

// 现代化UI组件库 - 需要在其他函数之前定义
function createLoadingOverlay(message, icon = '⏳') {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(5px);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease-out;
    `;
    
    overlay.innerHTML = `
        <div class="loading-content" style="
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
            text-align: center;
            min-width: 300px;
            animation: slideIn 0.3s ease-out;
        ">
            <div class="loading-icon" style="
                font-size: 48px;
                margin-bottom: 20px;
                animation: pulse 2s infinite;
            ">${icon}</div>
            <div class="loading-message" style="
                font-size: 16px;
                color: #333;
                margin-bottom: 20px;
                font-weight: 500;
            ">${message}</div>
            <div class="progress-container" style="
                width: 100%;
                height: 6px;
                background: #e9ecef;
                border-radius: 3px;
                overflow: hidden;
                margin-bottom: 10px;
            ">
                <div class="progress-fill" style="
                    height: 100%;
                    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                    width: 0%;
                    transition: width 0.3s ease;
                    border-radius: 3px;
                "></div>
            </div>
            <div class="progress-text" style="
                font-size: 12px;
                color: #666;
            ">准备中...</div>
        </div>
    `;
    
    return overlay;
}

function showErrorNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(255, 107, 107, 0.3);
        z-index: 10002;
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 12px;
    `;
    
    notification.innerHTML = `
        <span style="font-size: 20px;">⚠️</span>
        <div>
            <div style="font-weight: 600; margin-bottom: 4px;">错误</div>
            <div style="font-size: 14px; opacity: 0.9;">${message}</div>
        </div>
        <button onclick="this.parentElement.remove()" style="
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            margin-left: auto;
        ">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // 5秒后自动消失
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// UI组件函数已在文件开头定义

// 创建工具栏样式
const toolbarStyle = `
    position: fixed;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.95));
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 2147483647;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
`;

// 创建按钮基础样式
const buttonStyle = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 12px;
    color: white;
    padding: 12px;
    width: 56px;
    height: 56px;
    margin: 0;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    word-wrap: break-word;
    line-height: 1.2;
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
    position: relative;
    overflow: hidden;
`;

// 按钮悬停效果
const buttonHoverStyle = `
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
`;

// 创建按钮函数
function createToolbarButton(icon, text, clickHandler, gradient) {
    const button = document.createElement('button');
    button.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
            <div style="font-size: 18px;">${icon}</div>
            <div style="font-size: 8px; line-height: 1;">${text}</div>
        </div>
    `;
    
    const customButtonStyle = buttonStyle.replace(
        'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);',
        `background: ${gradient};`
    );
    
    button.style.cssText = customButtonStyle;
    button.addEventListener('click', clickHandler);
    
    // 添加悬停效果
    button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-2px) scale(1.05)';
        button.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)';
    });
    
    button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0) scale(1)';
        button.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.3)';
    });
    
    return button;
}

// 初始化工具栏
function initToolbar() {
    console.log('[Toolsbar] 开始初始化工具栏');
    
    // 检查是否已存在工具栏
    if (document.getElementById('nws-toolbar')) {
        return;
    }
    
    // 创建工具栏容器
    const toolbar = document.createElement('div');
    toolbar.id = 'nws-toolbar';
    toolbar.style.cssText = toolbarStyle;
    
    // 创建批量下载按钮
    const downloadBtn = createToolbarButton(
        '📥', 
        '批量下载', 
        handleBatchDownload,
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
    );
    
    // 创建翻译按钮
    const translateBtn = createToolbarButton(
        '🌐', 
        '翻译页面', 
        handleTranslate,
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
    );
    
    // 创建总结按钮
    const summaryBtn = createToolbarButton(
        '📋', 
        '页面总结', 
        handleSummary,
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    );
    
    // 创建元素高亮按钮
    const highlightBtn = createToolbarButton(
        '🎯', 
        '元素高亮', 
        handleElementHighlight,
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    );
    
    // 添加按钮到工具栏
    toolbar.appendChild(downloadBtn);
    toolbar.appendChild(translateBtn);
    toolbar.appendChild(summaryBtn);
    toolbar.appendChild(highlightBtn);
    
    // 添加工具栏到页面
    document.body.appendChild(toolbar);
    console.log('[Toolsbar] 工具栏初始化完成');
}

// 批量下载图片处理函数
function handleBatchDownload() {
    console.log('开始批量下载图片');
    batchDownloadImages();
}

// 元素高亮处理函数
let isHighlightEnabled = false;
function handleElementHighlight() {
    console.log('切换元素高亮功能');
    
    // 检查ElementHighlighterModule是否可用
    if (!window.NWSModules || !window.NWSModules.ElementHighlighterModule) {
        showErrorNotification('元素高亮模块未加载，请刷新页面重试');
        return;
    }
    
    const highlighter = window.NWSModules.ElementHighlighterModule;
    const button = document.querySelector('#nws-toolbar button:last-child');
    
    if (!isHighlightEnabled) {
        // 启用高亮功能
        highlighter.enable().then(() => {
            isHighlightEnabled = true;
            if (button) {
                button.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
                button.querySelector('.button-text').textContent = '关闭高亮';
            }
            
            // 显示使用提示
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 16px 20px;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
                z-index: 10002;
                max-width: 350px;
                animation: slideInRight 0.3s ease-out;
            `;
            
            notification.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 8px;">🎯 元素高亮已启用</div>
                <div style="font-size: 14px; opacity: 0.9; line-height: 1.4;">
                    • 鼠标悬停查看元素信息<br>
                    • 右键显示操作菜单<br>
                    • Ctrl+C 复制选择器<br>
                    • Ctrl+Shift+C 复制样式
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // 3秒后自动隐藏提示
            setTimeout(() => {
                notification.remove();
            }, 5000);
            
            console.log('[ElementHighlight] 元素高亮功能已启用');
        }).catch(error => {
            console.error('[ElementHighlight] 启用失败:', error);
            showErrorNotification('启用元素高亮功能失败: ' + error.message);
        });
    } else {
        // 禁用高亮功能
        highlighter.disable().then(() => {
            isHighlightEnabled = false;
            if (button) {
                button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                button.querySelector('.button-text').textContent = '元素高亮';
            }
            
            // 显示禁用提示
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
                color: white;
                padding: 16px 20px;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(108, 117, 125, 0.3);
                z-index: 10002;
                animation: slideInRight 0.3s ease-out;
            `;
            
            notification.innerHTML = `
                <div style="font-weight: 600;">🎯 元素高亮已禁用</div>
            `;
            
            document.body.appendChild(notification);
            
            // 2秒后自动隐藏提示
            setTimeout(() => {
                notification.remove();
            }, 2000);
            
            console.log('[ElementHighlight] 元素高亮功能已禁用');
        }).catch(error => {
            console.error('[ElementHighlight] 禁用失败:', error);
            showErrorNotification('禁用元素高亮功能失败: ' + error.message);
        });
    }
}

async function batchDownloadImages() {
    const images = document.querySelectorAll('img');
    const validImages = Array.from(images).filter(img => {
        const src = img.src || img.dataset.src;
        return src && !src.startsWith('data:') && src.length > 10;
    });

    if (validImages.length === 0) {
        showErrorNotification('未找到可下载的图片');
        return;
    }

    // 创建批量下载界面
    const downloadModal = createBatchDownloadModal(validImages);
    document.body.appendChild(downloadModal);
}

function createBatchDownloadModal(images) {
    const modal = document.createElement('div');
    modal.className = 'batch-download-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(5px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease-out;
    `;
    
    const imageList = images.map((img, index) => {
        const src = img.src || img.dataset.src;
        return `
            <div class="image-item" data-index="${index}" style="
                display: flex;
                align-items: center;
                padding: 12px;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                margin-bottom: 8px;
                background: white;
                transition: all 0.2s ease;
            " onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">
                <input type="checkbox" checked style="margin-right: 12px; transform: scale(1.2);">
                <img src="${src}" style="
                    width: 60px;
                    height: 60px;
                    object-fit: cover;
                    border-radius: 6px;
                    margin-right: 12px;
                    border: 1px solid #dee2e6;
                " onerror="this.style.display='none'">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 14px; font-weight: 500; margin-bottom: 4px; color: #333;">
                        图片 ${index + 1}
                    </div>
                    <div style="font-size: 12px; color: #666; word-break: break-all; line-height: 1.3;">
                        ${src.length > 60 ? src.substring(0, 60) + '...' : src}
                    </div>
                </div>
                <div class="download-status" style="
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    background: #e9ecef;
                    color: #666;
                ">待下载</div>
            </div>
        `;
    }).join('');
    
    modal.innerHTML = `
        <div class="modal-content" style="
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
            width: 90%;
            max-width: 800px;
            max-height: 80%;
            overflow: hidden;
            animation: slideIn 0.3s ease-out;
        ">
            <div class="modal-header" style="
                padding: 20px 24px;
                border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                display: flex;
                align-items: center;
                justify-content: space-between;
            ">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 24px;">📥</span>
                    <h2 style="margin: 0; font-size: 18px; font-weight: 600;">批量下载图片</h2>
                    <span style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 12px; font-size: 12px;">
                        共 ${images.length} 张
                    </span>
                </div>
                <button onclick="this.closest('.batch-download-modal').remove()" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 18px;
                ">×</button>
            </div>
            
            <div class="modal-controls" style="
                padding: 16px 24px;
                border-bottom: 1px solid #e9ecef;
                display: flex;
                align-items: center;
                gap: 12px;
                background: #f8f9fa;
            ">
                <button onclick="toggleAllImages(this)" style="
                    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                ">全选/取消</button>
                
                <button onclick="startBatchDownload(this)" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                ">开始下载</button>
                
                <div class="download-progress" style="
                    flex: 1;
                    margin-left: 16px;
                    display: none;
                ">
                    <div style="font-size: 12px; color: #666; margin-bottom: 4px;">下载进度: <span class="progress-text">0/0</span></div>
                    <div style="background: #e9ecef; height: 4px; border-radius: 2px; overflow: hidden;">
                        <div class="progress-bar" style="
                            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                            height: 100%;
                            width: 0%;
                            transition: width 0.3s ease;
                        "></div>
                    </div>
                </div>
            </div>
            
            <div class="modal-body" style="
                padding: 16px 24px;
                overflow-y: auto;
                max-height: 50vh;
            ">
                ${imageList}
            </div>
        </div>
    `;
    
    // 点击背景关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    return modal;
}

// 全选/取消功能
function toggleAllImages(button) {
    const modal = button.closest('.batch-download-modal');
    const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
    });
}

// 开始批量下载
async function startBatchDownload(button) {
    const modal = button.closest('.batch-download-modal');
    const checkedItems = modal.querySelectorAll('input[type="checkbox"]:checked');
    
    if (checkedItems.length === 0) {
        showErrorNotification('请至少选择一张图片');
        return;
    }
    
    button.disabled = true;
    button.textContent = '下载中...';
    
    const progressContainer = modal.querySelector('.download-progress');
    const progressBar = modal.querySelector('.progress-bar');
    const progressText = modal.querySelector('.progress-text');
    
    progressContainer.style.display = 'block';
    
    let completed = 0;
    const total = checkedItems.length;
    
    for (const checkbox of checkedItems) {
        const imageItem = checkbox.closest('.image-item');
        const index = parseInt(imageItem.dataset.index);
        const img = document.querySelectorAll('img')[index];
        const src = img.src || img.dataset.src;
        const statusElement = imageItem.querySelector('.download-status');
        
        try {
            statusElement.textContent = '下载中...';
            statusElement.style.background = '#ffc107';
            statusElement.style.color = 'white';
            
            await downloadImage(src);
            
            statusElement.textContent = '已完成';
            statusElement.style.background = '#28a745';
            statusElement.style.color = 'white';
            
        } catch (error) {
            statusElement.textContent = '失败';
            statusElement.style.background = '#dc3545';
            statusElement.style.color = 'white';
        }
        
        completed++;
        const progress = (completed / total) * 100;
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${completed}/${total}`;
        
        // 延迟避免过快请求
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    button.disabled = false;
    button.textContent = '下载完成';
    button.style.background = '#28a745';
    
    // 3秒后恢复按钮状态
    setTimeout(() => {
        button.textContent = '开始下载';
        button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }, 3000);
}

const OLLAMA_ENDPOINT = 'http://localhost:11434/api/generate';

async function callOllama(prompt, model = 'deepseek-r1:14b') {
    console.log(`调用Ollama API，模型：${model}，提示：${prompt}`);
    try {
        const response = await fetch(OLLAMA_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                prompt,
                stream: false
            })
            // body: JSON.stringify({
            //     model,
            //     prompt,
            //     stream: false
            // })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error('Ollama API 调用失败:', error);
        throw error;
    }
}

function splitTextIntoChunks(text, maxChunkSize = 2000) {
    const chunks = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= maxChunkSize) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
        } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = sentence;
        }
    }

    if (currentChunk) chunks.push(currentChunk);
    return chunks;
}

function extractPageContent() {
    const elementsToSkip = [
        'script', 'style', 'noscript', 'iframe', 'nav', 'footer',
        'header', '[role="banner"]', '[role="navigation"]', '[role="complementary"]'
    ];

    const content = [];
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                if (node.parentElement && 
                    elementsToSkip.some(selector => 
                        node.parentElement.matches(selector))) {
                    return NodeFilter.FILTER_REJECT;
                }
                return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        }
    );

    while (walker.nextNode()) {
        content.push(walker.currentNode.textContent.trim());
    }

    return content.join(' ').replace(/\s+/g, ' ').trim();
}

function createModernModal(title, icon, content, className = '') {
    const modal = document.createElement('div');
    modal.className = `modern-modal ${className}`;
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(5px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease-out;
    `;
    
    modal.innerHTML = `
        <div class="modal-content" style="
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
            max-width: 80%;
            max-height: 80%;
            overflow: hidden;
            animation: slideIn 0.3s ease-out;
            border: 1px solid rgba(255, 255, 255, 0.2);
        ">
            <div class="modal-header" style="
                padding: 20px 24px;
                border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                display: flex;
                align-items: center;
                justify-content: space-between;
            ">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 24px;">${icon}</span>
                    <h2 style="margin: 0; font-size: 18px; font-weight: 600;">${title}</h2>
                </div>
                <button class="close-btn" onclick="this.closest('.modern-modal').remove()" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    transition: all 0.2s ease;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                    ×
                </button>
            </div>
            <div class="modal-body" style="
                padding: 24px;
                overflow-y: auto;
                max-height: 60vh;
                line-height: 1.6;
            ">
                ${content}
            </div>
        </div>
    `;
    
    // 点击背景关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    return modal;
}

// 添加CSS动画
if (!document.getElementById('modern-ui-styles')) {
    const styles = document.createElement('style');
    styles.id = 'modern-ui-styles';
    styles.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideIn {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        .translation-block {
            background: #f8f9fa;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 16px;
            border-left: 4px solid #667eea;
        }
        
        .summary-content {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 20px;
            border-radius: 12px;
            border-left: 4px solid #764ba2;
            font-size: 16px;
            line-height: 1.8;
        }
    `;
    document.head.appendChild(styles);
}

async function translatePage(targetLang = '中文') {
    // 创建加载界面
    const loadingOverlay = createLoadingOverlay('正在翻译页面内容...', '🌐');
    document.body.appendChild(loadingOverlay);
    
    try {
        const content = extractPageContent();
        const chunks = splitTextIntoChunks(content);
        const translations = [];
        
        // 更新进度
        const progressBar = loadingOverlay.querySelector('.progress-fill');
        const progressText = loadingOverlay.querySelector('.progress-text');
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const prompt = `请将以下文本翻译成${targetLang}：\n${chunk}`;
            
            // 更新进度
            const progress = ((i + 1) / chunks.length) * 100;
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `翻译进度: ${Math.round(progress)}% (${i + 1}/${chunks.length})`;
            
            const translation = await callOllama(prompt);
            translations.push(translation);
        }
        
        // 移除加载界面
        loadingOverlay.remove();
        
        // 创建结果界面
        const translationOverlay = createModernModal(
            '页面翻译结果',
            '🌐',
            translations.map(text => `<div class="translation-block">${text}</div>`).join(''),
            'translation-modal'
        );
        
        document.body.appendChild(translationOverlay);
        
    } catch (error) {
        loadingOverlay.remove();
        console.error('翻译失败:', error);
        showErrorNotification('翻译失败，请检查 Ollama 服务是否正在运行');
    }
}

async function summarizePage() {
    // 创建加载界面
    const loadingOverlay = createLoadingOverlay('正在生成页面摘要...', '📋');
    document.body.appendChild(loadingOverlay);
    
    try {
        const content = extractPageContent();
        const prompt = `请对以下内容进行摘要总结（控制在300字以内）：\n${content}`;
        
        // 模拟进度更新
        const progressBar = loadingOverlay.querySelector('.progress-fill');
        const progressText = loadingOverlay.querySelector('.progress-text');
        
        progressBar.style.width = '30%';
        progressText.textContent = '正在分析页面内容...';
        
        const summary = await callOllama(prompt);
        
        progressBar.style.width = '100%';
        progressText.textContent = '摘要生成完成！';
        
        // 短暂延迟后移除加载界面
        setTimeout(() => {
            loadingOverlay.remove();
            
            // 创建结果界面
            const summaryOverlay = createModernModal(
                '页面摘要',
                '📋',
                `<div class="summary-content">${summary}</div>`,
                'summary-modal'
            );
            
            document.body.appendChild(summaryOverlay);
        }, 500);
        
    } catch (error) {
        loadingOverlay.remove();
        console.error('生成摘要失败:', error);
        showErrorNotification('生成摘要失败，请检查 Ollama 服务是否正在运行');
    }
}

// 翻译页面处理函数
async function handleTranslate() {
    console.log('开始翻译页面');
    await translatePage();
}

// 总结页面处理函数
async function handleSummary() {
    console.log('开始生成页面总结');
    await summarizePage();
}

// 在页面加载完成后初始化工具栏
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Toolsbar] DOM加载完成，准备初始化工具栏');
    initToolbar();
});

// 添加备用初始化方法
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('[Toolsbar] 页面已加载，直接初始化工具栏');
    initToolbar();
}