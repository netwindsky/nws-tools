/**
 * ElementHighlighterModule.js - 元素高亮模块
 * 提供页面元素高亮显示功能，支持多种高亮样式和交互效果
 */

(function() {
    'use strict';
    
    // 从全局模块系统获取ModuleBase
    let ModuleBase;
    if (window.NWSModules) {
        ModuleBase = window.NWSModules.get('ModuleBase');
    }
    
    // 从全局模块系统获取工具函数
    let safeQuerySelector, safeQuerySelectorAll, safeAddEventListener, safeRemoveEventListener;
    if (window.NWSModules && window.NWSModules.utils) {
        ({ safeQuerySelector, safeQuerySelectorAll, safeAddEventListener, safeRemoveEventListener } = window.NWSModules.utils);
    }

class ElementHighlighterModule extends ModuleBase {
    constructor(name, options = {}) {
        super(name, {
            version: '1.0.0',
            dependencies: ['ChromeSettingsModule', 'NotificationModule'],
            defaultConfig: {
                enabled: true,
                showTooltip: true,
                showStyleInfo: true,
                enableActions: true,
                highlightColor: '#42b883',
                tooltipPosition: 'auto', // auto, top, bottom, left, right
                excludeSelectors: ['html', 'body', 'head', 'script', 'style', 'meta', 'link'],
                minElementSize: 10 // 最小元素尺寸
            },
            ...options
        });

        this.tooltip = null;
        this.styleInfo = null;
        this.buttonGroup = null;
        this.lastHighlightedElement = null;
        this.lastCssPath = '';
        this.isActive = false;
        this.jszipLoaded = false;
        
        // 绑定事件处理函数，确保可以正确移除监听器
        this.boundHandleMouseMove = this.handleMouseMove.bind(this);
        this.boundHandleMouseLeave = this.handleMouseLeave.bind(this);
        this.boundHandleClick = this.handleClick.bind(this);
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    }

    async onInitialize() {
        // 检查依赖模块
        this.chromeSettings = window.NWSModules?.ChromeSettingsModule;
        this.notification = window.NWSModules?.NotificationModule;

        if (!this.chromeSettings) {
            throw new Error('ChromeSettingsModule 依赖未找到');
        }

        // 加载配置设置
        await this.loadConfigSettings();

        // 创建UI元素
        this.createTooltip();
        this.createStyleInfo();
        
        // 注入样式
        this.injectStyles();

        // 注意：不在初始化时自动启用，让用户手动控制
        // 这样可以确保工具栏按钮的状态与模块状态保持同步

        // 监听Chrome消息
        this.setupMessageListener();
        
        // 监听配置变化
        this.setupConfigListener();
    }

    async onDestroy() {
        await this.disable();
        this.removeUI();
        this.removeStyles();
    }

    async onEnable() {
        console.log("ElementHighlighterModule:onEnable")
        this.isActive = true;
        this.addEventListeners();
    }

    async onDisable() {
        this.isActive = false;
        this.removeEventListeners();
        this.hideTooltip();
        this.hideStyleInfo();
        this.hideButtonGroup();
    }

    /**
     * 添加事件监听器
     */
    addEventListeners() {
        document.addEventListener('mousemove', this.boundHandleMouseMove);
        document.addEventListener('mouseleave', this.boundHandleMouseLeave);
        document.addEventListener('click', this.boundHandleClick);
        document.addEventListener('keydown', this.boundHandleKeyDown);
    }

    /**
     * 移除事件监听器
     */
    removeEventListeners() {
        document.removeEventListener('mousemove', this.boundHandleMouseMove);
        document.removeEventListener('mouseleave', this.boundHandleMouseLeave);
        document.removeEventListener('click', this.boundHandleClick);
        document.removeEventListener('keydown', this.boundHandleKeyDown);
    }

    /**
     * 处理鼠标移动事件
     * @param {MouseEvent} e 鼠标事件
     */
    handleMouseMove(e) {
        if (!this.isActive) return;

        const element = e.target;
        
        // 检查是否应该高亮此元素
        if (!this.shouldHighlightElement(element)) {
            this.hideTooltip();
            return;
        }

        // 如果是同一个元素，不需要重新处理
        if (element === this.lastHighlightedElement) {
            return;
        }

        this.lastHighlightedElement = element;
        this.lastCssPath = this.getCssPath(element);

        // 高亮元素
        this.highlightElement(element);

        // 显示工具提示
        if (this.config.showTooltip) {
            this.showTooltip(element, e.clientX, e.clientY);
        }

        // 显示样式信息
        if (this.config.showStyleInfo) {
            this.showStyleInfo(element);
        }

        this.emit('elementHighlighted', { element, cssPath: this.lastCssPath });
    }

    /**
     * 处理鼠标离开事件
     * @param {MouseEvent} e 鼠标事件
     */
    handleMouseLeave(e) {
        if (e.target === document.documentElement) {
            this.hideTooltip();
            this.hideStyleInfo();
        }
    }

    /**
     * 处理点击事件
     * @param {MouseEvent} e 鼠标事件
     */
    handleClick(e) {
        if (!this.isActive || !this.config.enableActions) return;
        if (!this.lastHighlightedElement) return;

        // 右键点击显示操作按钮
        if (e.button === 2) {
            e.preventDefault();
            this.showButtonGroup(this.lastHighlightedElement, e.clientX, e.clientY);
        }
    }

    /**
     * 处理键盘事件
     * @param {KeyboardEvent} e 键盘事件
     */
    handleKeyDown(e) {
        if (!this.isActive || !this.lastHighlightedElement) return;

        // Ctrl+C 复制选择器
        if (e.ctrlKey && e.key === 'c') {
            e.preventDefault();
            this.copySelector();
        }
        
        // Ctrl+Shift+C 复制样式
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            this.copyStyle();
        }
    }

    /**
     * 检查是否应该高亮元素
     * @param {Element} element 元素
     * @returns {boolean}
     */
    shouldHighlightElement(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }

        // 检查排除选择器
        const tagName = element.tagName.toLowerCase();
        if (this.config.excludeSelectors.includes(tagName)) {
            return false;
        }

        // 检查是否是工具提示或按钮组
        if (element.closest('.nws-tooltip, .nws-style-info, .nws-button-group')) {
            return false;
        }

        // 检查元素尺寸
        const rect = element.getBoundingClientRect();
        if (rect.width < this.config.minElementSize || rect.height < this.config.minElementSize) {
            return false;
        }

        return true;
    }

    /**
     * 高亮元素
     * @param {Element} element 要高亮的元素
     */
    highlightElement(element) {
        // 移除之前的高亮
        const previousHighlight = safeQuerySelector('.nws-element-highlight');
        if (previousHighlight) {
            previousHighlight.remove();
        }

        // 创建高亮覆盖层
        const rect = element.getBoundingClientRect();
        const highlight = document.createElement('div');
        highlight.className = 'nws-element-highlight';
        highlight.style.cssText = `
            position: fixed;
            top: ${rect.top}px;
            left: ${rect.left}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            border: 2px solid ${this.config.highlightColor};
            background-color: ${this.config.highlightColor}20;
            pointer-events: none;
            z-index: 999998;
            box-sizing: border-box;
        `;

        document.body.appendChild(highlight);
    }

    /**
     * 显示工具提示
     * @param {Element} element 元素
     * @param {number} x 鼠标X坐标
     * @param {number} y 鼠标Y坐标
     */
    showTooltip(element, x, y) {
        if (!this.tooltip) return;

        const tagName = element.tagName.toLowerCase();
        const className = element.className ? `.${element.className.split(' ').join('.')}` : '';
        const id = element.id ? `#${element.id}` : '';
        const text = element.textContent ? element.textContent.substring(0, 50) + '...' : '';

        this.tooltip.innerHTML = `
            <div class="nws-tooltip-tag">&lt;${tagName}${id}${className}&gt;</div>
            <div class="nws-tooltip-path">${this.getSimplifiedCssPath(element)}</div>
            ${text ? `<div class="nws-tooltip-text">${text}</div>` : ''}
        `;

        // 计算位置
        const tooltipRect = this.tooltip.getBoundingClientRect();
        let left = x + 10;
        let top = y + 10;

        // 防止超出视窗
        if (left + tooltipRect.width > window.innerWidth) {
            left = x - tooltipRect.width - 10;
        }
        if (top + tooltipRect.height > window.innerHeight) {
            top = y - tooltipRect.height - 10;
        }

        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.display = 'block';
    }

    /**
     * 隐藏工具提示
     */
    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style.display = 'none';
        }

        // 移除高亮
        const highlight = safeQuerySelector('.nws-element-highlight');
        if (highlight) {
            highlight.remove();
        }
    }

    /**
     * 显示样式信息
     * @param {Element} element 元素
     */
    showStyleInfo(element) {
        if (!this.styleInfo) return;

        const computedStyle = window.getComputedStyle(element);
        const importantStyles = [
            'display', 'position', 'width', 'height', 'margin', 'padding',
            'border', 'background-color', 'color', 'font-size', 'font-family'
        ];

        let styleHtml = '<div class="nws-style-title">计算样式</div>';
        importantStyles.forEach(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'none' && value !== 'auto') {
                styleHtml += `<div class="nws-style-item"><span class="nws-style-prop">${prop}:</span> <span class="nws-style-value">${value}</span></div>`;
            }
        });

        this.styleInfo.innerHTML = styleHtml;
        this.styleInfo.style.display = 'block';
    }

    /**
     * 隐藏样式信息
     */
    hideStyleInfo() {
        if (this.styleInfo) {
            this.styleInfo.style.display = 'none';
        }
    }

    /**
     * 显示按钮组
     * @param {Element} element 目标元素
     * @param {number} x 鼠标X坐标
     * @param {number} y 鼠标Y坐标
     */
    showButtonGroup(element, x, y) {
        if (!this.buttonGroup) {
            this.createButtonGroup();
        }

        this.buttonGroup.style.left = `${x}px`;
        this.buttonGroup.style.top = `${y}px`;
        this.buttonGroup.style.display = 'block';

        // 5秒后自动隐藏
        setTimeout(() => {
            this.hideButtonGroup();
        }, 5000);
    }

    /**
     * 隐藏按钮组
     */
    hideButtonGroup() {
        if (this.buttonGroup) {
            this.buttonGroup.style.display = 'none';
        }
    }

    /**
     * 复制选择器
     */
    async copySelector() {
        if (!this.lastHighlightedElement) return;

        const simplifiedPath = this.getSimplifiedCssPath(this.lastHighlightedElement);
        
        try {
            await navigator.clipboard.writeText(simplifiedPath);
            if (this.notification) {
                this.notification.success(`选择器已复制: ${simplifiedPath}`);
            }
        } catch (error) {
            console.error('[ElementHighlighter] 复制选择器失败:', error);
            if (this.notification) {
                this.notification.error('复制选择器失败');
            }
        }

        this.emit('selectorCopied', { element: this.lastHighlightedElement, selector: simplifiedPath });
    }

    /**
     * 复制样式
     */
    async copyStyle() {
        if (!this.lastHighlightedElement) return;

        const computedStyle = window.getComputedStyle(this.lastHighlightedElement);
        const styleText = Array.from(computedStyle).map(prop => 
            `${prop}: ${computedStyle.getPropertyValue(prop)};`
        ).join('\n');

        try {
            await navigator.clipboard.writeText(styleText);
            if (this.notification) {
                this.notification.success('样式已复制到剪贴板');
            }
        } catch (error) {
            console.error('[ElementHighlighter] 复制样式失败:', error);
            if (this.notification) {
                this.notification.error('复制样式失败');
            }
        }

        this.emit('styleCopied', { element: this.lastHighlightedElement, style: styleText });
    }

    /**
     * 获取CSS路径
     * @param {Element} element 元素
     * @returns {string}
     */
    getCssPath(element) {
        const path = [];
        let current = element;

        while (current && current.nodeType === Node.ELEMENT_NODE) {
            let selector = current.tagName.toLowerCase();
            
            if (current.id) {
                selector += `#${current.id}`;
                path.unshift(selector);
                break;
            }
            
            if (current.className) {
                const classes = current.className.split(' ').filter(c => c.trim());
                if (classes.length > 0) {
                    selector += '.' + classes.join('.');
                }
            }
            
            // 添加nth-child选择器
            const siblings = Array.from(current.parentNode?.children || []);
            const sameTagSiblings = siblings.filter(s => s.tagName === current.tagName);
            if (sameTagSiblings.length > 1) {
                const index = sameTagSiblings.indexOf(current) + 1;
                selector += `:nth-child(${index})`;
            }
            
            path.unshift(selector);
            current = current.parentElement;
        }

        return path.join(' > ');
    }

    /**
     * 获取简化的CSS路径
     * @param {Element} element 元素
     * @returns {string}
     */
    getSimplifiedCssPath(element) {
        if (element.id) {
            return `#${element.id}`;
        }

        if (element.className) {
            const classes = element.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) {
                return `.${classes.join('.')}`;
            }
        }

        return element.tagName.toLowerCase();
    }

    /**
     * 创建工具提示
     */
    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'nws-tooltip';
        this.tooltip.style.display = 'none';
        document.body.appendChild(this.tooltip);
    }

    /**
     * 创建样式信息面板
     */
    createStyleInfo() {
        this.styleInfo = document.createElement('div');
        this.styleInfo.className = 'nws-style-info';
        this.styleInfo.style.display = 'none';
        document.body.appendChild(this.styleInfo);
    }

    /**
     * 创建按钮组
     */
    createButtonGroup() {
        this.buttonGroup = document.createElement('div');
        this.buttonGroup.className = 'nws-button-group';
        this.buttonGroup.style.display = 'none';

        const buttons = [
            { text: '复制选择器', action: () => this.copySelector() },
            { text: '复制样式', action: () => this.copyStyle() },
            { text: '保存为MD', action: () => this.saveAsMD() },
            { text: '转换为Vue', action: () => this.convertToVue() }
        ];

        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.textContent = btn.text;
            button.onclick = btn.action;
            this.buttonGroup.appendChild(button);
        });

        document.body.appendChild(this.buttonGroup);
    }

    /**
     * 保存为Markdown
     */
    async saveAsMD() {
        if (!this.lastHighlightedElement) return;

        try {
            // 加载JSZip库
            await this.loadJSZip();

            const element = this.lastHighlightedElement;
            const content = this.generateMarkdownContent(element);
            
            // 创建ZIP文件
            const zip = new JSZip();
            zip.file('element.md', content);
            
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            
            // 下载文件
            if (this.chromeSettings) {
                await this.chromeSettings.downloadFile({
                    url: url,
                    filename: `element_${Date.now()}.zip`,
                    saveAs: false
                });
            }

            if (this.notification) {
                this.notification.success('元素已保存为Markdown');
            }

        } catch (error) {
            console.error('[ElementHighlighter] 保存MD失败:', error);
            if (this.notification) {
                this.notification.error('保存失败');
            }
        }
    }

    /**
     * 转换为Vue组件
     */
    async convertToVue() {
        if (!this.lastHighlightedElement) return;

        const vueCode = this.generateVueComponent(this.lastHighlightedElement);
        
        try {
            await navigator.clipboard.writeText(vueCode);
            if (this.notification) {
                this.notification.success('Vue组件代码已复制到剪贴板');
            }
        } catch (error) {
            console.error('[ElementHighlighter] 复制Vue代码失败:', error);
            if (this.notification) {
                this.notification.error('复制失败');
            }
        }
    }

    /**
     * 生成Markdown内容
     * @param {Element} element 元素
     * @returns {string}
     */
    generateMarkdownContent(element) {
        const selector = this.getSimplifiedCssPath(element);
        const fullPath = this.getCssPath(element);
        const computedStyle = window.getComputedStyle(element);
        
        let content = `# 元素信息\n\n`;
        content += `**选择器**: \`${selector}\`\n\n`;
        content += `**完整路径**: \`${fullPath}\`\n\n`;
        content += `**标签**: ${element.tagName.toLowerCase()}\n\n`;
        
        if (element.textContent) {
            content += `**文本内容**: ${element.textContent.substring(0, 200)}\n\n`;
        }
        
        content += `## 样式信息\n\n`;
        content += `\`\`\`css\n`;
        
        const importantStyles = [
            'display', 'position', 'width', 'height', 'margin', 'padding',
            'border', 'background-color', 'color', 'font-size', 'font-family'
        ];
        
        importantStyles.forEach(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'none' && value !== 'auto') {
                content += `${prop}: ${value};\n`;
            }
        });
        
        content += `\`\`\`\n\n`;
        content += `**生成时间**: ${new Date().toLocaleString()}\n`;
        
        return content;
    }

    /**
     * 生成Vue组件
     * @param {Element} element 元素
     * @returns {string}
     */
    generateVueComponent(element) {
        const tagName = element.tagName.toLowerCase();
        const className = element.className;
        const textContent = element.textContent?.trim();
        
        let template = `<template>\n  <${tagName}`;
        
        if (className) {
            template += ` class="${className}"`;
        }
        
        template += `>`;
        
        if (textContent && textContent.length < 100) {
            template += textContent;
        } else {
            template += '{{ content }}';
        }
        
        template += `</${tagName}>\n</template>\n\n`;
        
        template += `<script>\nexport default {\n  name: 'ExtractedElement',\n  data() {\n    return {\n      content: '${textContent || '内容'}'\n    }\n  }\n}\n</script>\n\n`;
        
        template += `<style scoped>\n/* 添加样式 */\n</style>`;
        
        return template;
    }

    /**
     * 加载JSZip库
     */
    async loadJSZip() {
        if (this.jszipLoaded || window.JSZip) {
            this.jszipLoaded = true;
            return;
        }

        try {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('libs/jszip.min.js');

            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = () => reject(new Error('加载JSZip库失败'));
                document.head.appendChild(script);
            });

            this.jszipLoaded = true;
        } catch (error) {
            console.error('[ElementHighlighter] 加载JSZip库失败:', error);
            throw error;
        }
    }

    /**
     * 加载配置设置
     */
    async loadConfigSettings() {
        try {
            // 确保config对象已正确初始化为defaultConfig的副本
            if (!this.config || Object.keys(this.config).length === 0) {
                this.config = { ...this.defaultConfig };
            }
            
            const toggleSettings = await this.chromeSettings.getStorage(['toggleSettings']);
            if (toggleSettings && toggleSettings.toggleSettings) {
                const isEnabled = toggleSettings.toggleSettings.elementHighlighter;
                this.config.enabled = isEnabled !== undefined ? isEnabled : this.defaultConfig.enabled;
                console.log('[ElementHighlighter] 配置加载完成，启用状态:', this.config.enabled);
            } else {
                // 如果没有存储的设置，使用默认配置
                this.config = { ...this.defaultConfig };
            }
        } catch (error) {
            console.warn('[ElementHighlighter] 加载配置失败，使用默认设置:', error);
            // 确保在错误情况下也有完整的配置
            this.config = { ...this.defaultConfig };
        }
    }

    /**
     * 设置配置监听器
     */
    setupConfigListener() {
        if (this.chromeSettings) {
            this.chromeSettings.on('storageChanged', async (changes) => {
                if (changes.toggleSettings) {
                    const newSettings = changes.toggleSettings.newValue;
                    if (newSettings && newSettings.elementHighlighter !== undefined) {
                        const wasEnabled = this.config.enabled;
                        this.config.enabled = newSettings.elementHighlighter;
                        
                        console.log('[ElementHighlighter] 配置更新，启用状态:', this.config.enabled);
                        
                        // 根据新配置启用或禁用功能
                        if (this.config.enabled && !wasEnabled) {
                            await this.enable();
                        } else if (!this.config.enabled && wasEnabled) {
                            await this.disable();
                        }
                    }
                }
            });
        }
    }

    /**
     * 设置消息监听器
     */
    setupMessageListener() {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (!this.lastHighlightedElement) return;

                switch (request.action) {
                    case 'saveAsMD':
                        this.saveAsMD();
                        break;
                    case 'convertToVue':
                        this.convertToVue();
                        break;
                    case 'copySelector':
                        this.copySelector();
                        break;
                    case 'copyStyle':
                        this.copyStyle();
                        break;
                }
            });
        }
    }

    /**
     * 移除UI元素
     */
    removeUI() {
        [this.tooltip, this.styleInfo, this.buttonGroup].forEach(element => {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });

        const highlight = safeQuerySelector('.nws-element-highlight');
        if (highlight) {
            highlight.remove();
        }
    }

    /**
     * 注入样式
     */
    injectStyles() {
        if (document.getElementById('nws-element-highlighter-styles')) return;

        const style = document.createElement('style');
        style.id = 'nws-element-highlighter-styles';
        style.textContent = `
            .nws-tooltip {
                position: fixed;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-family: monospace;
                z-index: 999999;
                max-width: 300px;
                word-wrap: break-word;
            }

            .nws-tooltip-tag {
                color: #42b883;
                font-weight: bold;
            }

            .nws-tooltip-path {
                color: #ccc;
                margin-top: 4px;
            }

            .nws-tooltip-text {
                color: #fff;
                margin-top: 4px;
                font-style: italic;
            }

            .nws-style-info {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 12px;
                font-size: 12px;
                font-family: monospace;
                z-index: 999999;
                max-width: 300px;
                max-height: 400px;
                overflow-y: auto;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }

            .nws-style-title {
                font-weight: bold;
                margin-bottom: 8px;
                color: #333;
            }

            .nws-style-item {
                margin-bottom: 4px;
            }

            .nws-style-prop {
                color: #d73a49;
                font-weight: bold;
            }

            .nws-style-value {
                color: #032f62;
            }

            .nws-button-group {
                position: fixed;
                background: white;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 8px;
                z-index: 999999;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }

            .nws-button-group button {
                display: block;
                width: 100%;
                margin-bottom: 4px;
                padding: 6px 12px;
                border: 1px solid #ddd;
                border-radius: 3px;
                background: white;
                cursor: pointer;
                font-size: 12px;
            }

            .nws-button-group button:hover {
                background: #f5f5f5;
            }

            .nws-button-group button:last-child {
                margin-bottom: 0;
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * 移除样式
     */
    removeStyles() {
        const style = document.getElementById('nws-element-highlighter-styles');
        if (style) {
            style.parentNode.removeChild(style);
        }
    }
}

    // 注册到全局模块系统
    if (window.NWSModules) {
        window.NWSModules.ElementHighlighterModule = ElementHighlighterModule;
    }
})();