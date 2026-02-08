// 配置 marked 选项
if (typeof marked !== 'undefined') {
    marked.setOptions({
        breaks: true,
        gfm: true,
        sanitize: false,
        highlight: function(code, lang) {
            if (typeof Prism !== 'undefined' && Prism.languages[lang]) {
                return Prism.highlight(code, Prism.languages[lang], lang);
            }
            return code;
        }
    });
}

// 监听来自后台的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'pageSummary') {
        updateSummary(message.summary);
    }
});

// 检测内容是否为 markdown 格式
function isMarkdownContent(content) {
    // 简单的 markdown 检测规则
    const markdownPatterns = [
        /^#{1,6}\s+/m,  // 标题
        /\*\*.*\*\*/,   // 粗体
        /\*.*\*/,       // 斜体
        /^\s*[-*+]\s+/m, // 无序列表
        /^\s*\d+\.\s+/m, // 有序列表
        /`.*`/,         // 行内代码
        /```[\s\S]*```/, // 代码块
        /^>\s+/m,       // 引用
        /\[.*\]\(.*\)/, // 链接
        /\|.*\|/        // 表格
    ];
    
    return markdownPatterns.some(pattern => pattern.test(content));
}

// 渲染 markdown 内容为 HTML
function renderMarkdown(content) {
    if (typeof marked === 'undefined') {
        console.warn('Marked library not loaded, fallback to plain text');
        return content.replace(/\n/g, '<br>');
    }
    
    try {
        const html = marked.parse(content);
        return html;
    } catch (error) {
        console.error('Markdown parsing failed:', error);
        return content.replace(/\n/g, '<br>');
    }
}

// 更新页面总结内容
function updateSummary(summary) {
    const summaryElement = document.getElementById('pageSummary');
    if (!summaryElement) return;
    
    try {
        let content;
        
        if (isMarkdownContent(summary)) {
            // 如果是 markdown 内容，进行渲染
            const htmlContent = renderMarkdown(summary);
            content = `<div class="markdown-content">${htmlContent}</div>`;
        } else {
            // 普通文本内容
            const formattedContent = summary.replace(/\n/g, '<br>');
            content = `<div class="markdown-content"><p>${formattedContent}</p></div>`;
        }
        
        // 添加淡入动画
        summaryElement.style.opacity = '0';
        summaryElement.innerHTML = content;
        
        // 触发动画
        setTimeout(() => {
            summaryElement.style.transition = 'opacity 0.5s ease-in-out';
            summaryElement.style.opacity = '1';
        }, 100);
        
        // 如果有 Prism，重新高亮代码
        if (typeof Prism !== 'undefined') {
            Prism.highlightAllUnder(summaryElement);
        }
        
    } catch (error) {
        console.error('更新摘要失败:', error);
        showError('内容渲染失败，请刷新页面重试');
    }
}

// 显示错误信息
function showError(message) {
    const summaryElement = document.getElementById('pageSummary');
    if (summaryElement) {
        summaryElement.innerHTML = `
            <div class="error-content">
                <div class="error-icon">⚠️</div>
                <p>${message}</p>
            </div>
        `;
    }
}

// 显示加载状态
function showLoading() {
    const summaryElement = document.getElementById('pageSummary');
    if (summaryElement) {
        summaryElement.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p class="text-muted">正在分析页面内容...</p>
            </div>
        `;
    }
}

// 页面加载完成后，请求当前页面的内容总结
document.addEventListener('DOMContentLoaded', () => {
    showLoading();
    
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'requestSummary'
            }).catch(error => {
                console.error('发送消息失败:', error);
                showError('无法获取页面内容，请确保页面已加载完成');
            });
        } else {
            showError('无法获取当前页面信息');
        }
    });
});

// 添加刷新按钮功能（可选）
function addRefreshButton() {
    const summaryHeader = document.querySelector('.summary-header');
    if (summaryHeader) {
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'btn btn-outline-primary btn-sm float-end';
        refreshBtn.innerHTML = '🔄 刷新';
        refreshBtn.onclick = () => {
            showLoading();
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        type: 'requestSummary'
                    });
                }
            });
        };
        summaryHeader.appendChild(refreshBtn);
    }
}

// 页面加载完成后添加刷新按钮
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(addRefreshButton, 500);
});