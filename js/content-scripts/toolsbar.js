
/**
 * toolsbar.js - 网页右侧悬浮工具栏
 * 提供批量下载图片、翻译网页、总结网页等功能
 */

// 从全局模块系统获取工具函数
const { safeQuerySelector, safeQuerySelectorAll } = window.NWSModules ? window.NWSModules.utils : {};

// 创建工具栏样式
const toolbarStyle = `
    position: fixed;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    background-color: transparent;
    border-radius: 5px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 2147483647;
`;

// 创建按钮基础样式
const buttonStyle = `
    background-color: rgba(255, 209, 0, 0.75);
    border: none;
    border-radius: 50%;
    color: #B05346;
    padding: 8px;
    width: 48px;
    height: 48px;
    margin: 5px 0;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    word-wrap: break-word;
    &:hover {
        background-color: rgba(255, 238, 111, 0.9);
        transform: scale(1.05);
    }
`;

// 初始化工具栏
function initToolbar() {
    console.log('[Toolsbar] 开始初始化工具栏');
    // 创建工具栏容器
    const toolbar = document.createElement('div');
    toolbar.style.cssText = toolbarStyle;
    
    // 创建批量下载按钮
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = '批量下载';
    downloadBtn.style.cssText = buttonStyle;
    downloadBtn.addEventListener('click', handleBatchDownload);
    
    // 创建翻译按钮
    const translateBtn = document.createElement('button');
    translateBtn.textContent = '翻译页面';
    translateBtn.style.cssText = buttonStyle;
    translateBtn.addEventListener('click', handleTranslate);
    
    // 创建总结按钮
    const summaryBtn = document.createElement('button');
    summaryBtn.textContent = '页面总结';
    summaryBtn.style.cssText = buttonStyle;
    summaryBtn.addEventListener('click', handleSummary);
    
    // 添加按钮到工具栏
    toolbar.appendChild(downloadBtn);
    toolbar.appendChild(translateBtn);
    toolbar.appendChild(summaryBtn);
    
    // 添加工具栏到页面
    document.body.appendChild(toolbar);
    console.log('[Toolsbar] 工具栏初始化完成');
}

// 批量下载图片处理函数
function handleBatchDownload() {
    console.log('开始批量下载图片');
    // 获取页面上所有图片，包括背景图片
    const images = Array.from(safeQuerySelectorAll('img, [style*="background-image"]'));
    
    // 过滤和处理图片
    const validImages = images.map(element => {
        if (element.tagName.toLowerCase() === 'img') {
            const rect = element.getBoundingClientRect();
            return rect.width >= 100 && rect.height >= 100 ? element.src : null;
        } else {
            const style = window.getComputedStyle(element);
            const bgImage = style.backgroundImage;
            if (bgImage && bgImage !== 'none') {
                const imgUrl = bgImage.slice(4, -1).replace(/["']/g, '');
                return imgUrl;
            }
            return null;
        }
    }).filter(Boolean);
    
    console.log(`找到 ${validImages.length} 个有效图片`);
    
    // 批量下载
    validImages.forEach((url, index) => {
        if (url) {
            console.log(`下载第 ${index + 1} 个图片：${url}`);
            downloadImage(url);
        }
    });
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

async function translatePage(targetLang = '中文') {
    try {
        const content = extractPageContent();
        const chunks = splitTextIntoChunks(content);
        const translations = [];

        for (const chunk of chunks) {
            const prompt = `请将以下文本翻译成${targetLang}：\n${chunk}`;
            const translation = await callOllama(prompt);
            translations.push(translation);
        }

        const translationOverlay = document.createElement('div');
        translationOverlay.style.cssText = `
            position: fixed;
            top: 10%;
            left: 10%;
            transform: translate(-50%, -50%);
            width: 80%;
            height: 80%;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0,0,0,0.3);
            z-index: 10000;
            overflow-y: auto;
        `;

        translationOverlay.innerHTML = `
            <div style="position: sticky; top: 0; background: white; padding: 10px 0;">
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="float: right; padding: 5px 10px; cursor: pointer;">
                    关闭
                </button>
                <h2>页面翻译结果</h2>
            </div>
            <div style="margin-top: 20px;">
                ${translations.join('\n\n')}
            </div>
        `;

        document.body.appendChild(translationOverlay);

    } catch (error) {
        console.error('翻译失败:', error);
        alert('翻译失败，请检查 Ollama 服务是否正在运行');
    }
}

async function summarizePage() {
    try {
        const content = extractPageContent();
        const prompt = `请对以下内容进行摘要总结（控制在300字以内）：\n${content}`;
        const summary = await callOllama(prompt);

        const summaryOverlay = document.createElement('div');
        summaryOverlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 60%;
            max-height: 80%;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0,0,0,0.3);
            z-index: 10000;
            overflow-y: auto;
        `;

        summaryOverlay.innerHTML = `
            <div style="position: sticky; top: 0; background: white; padding: 10px 0;">
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="float: right; padding: 5px 10px; cursor: pointer;">
                    关闭
                </button>
                <h2>页面摘要</h2>
            </div>
            <div style="margin-top: 20px;">
                ${summary}
            </div>
        `;

        document.body.appendChild(summaryOverlay);

    } catch (error) {
        console.error('生成摘要失败:', error);
        alert('生成摘要失败，请检查 Ollama 服务是否正在运行');
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