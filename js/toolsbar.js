// 导入 LangChain 服务
import langChainService from './langchain-service.js';

/**
 * toolsbar.js - 网页右侧悬浮工具栏
 * 提供批量下载图片、翻译网页、总结网页等功能
 */

// 创建工具栏样式
const toolbarStyle = `
    position: fixed;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    background-color: rgba(25, 113, 194, 0.8);
    border-radius: 8px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 2147483647;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

// 创建按钮基础样式
const buttonStyle = `
    background-color: white;
    border: none;
    border-radius: 4px;
    color: #1971c2;
    padding: 8px 12px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
    &:hover {
        background-color: #e7f5ff;
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
    const images = Array.from(document.querySelectorAll('img, [style*="background-image"]'));
    
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

// 翻译页面处理函数
function handleTranslate() {
    console.log('开始翻译页面');
    langChainService.translatePage();
}

// 总结页面处理函数
function handleSummary() {
    console.log('开始生成页面总结');
    langChainService.summarizePage();
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