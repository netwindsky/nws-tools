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
    
    // 获取工具类
    const ConfigManager = window.ConfigManager;
    const StyleManager = window.StyleManager;
    
    // 从全局模块系统获取工具函数，使用别名避免冲突
    const elementSafeQuerySelector = window.DOMHelper?.safeQuerySelector || window.NWSModules?.utils?.safeQuerySelector;
    const elementSafeQuerySelectorAll = window.DOMHelper?.safeQuerySelectorAll || window.NWSModules?.utils?.safeQuerySelectorAll;
    const elementSafeAddEventListener = window.NWSModules?.utils?.safeAddEventListener;
    const elementSafeRemoveEventListener = window.NWSModules?.utils?.safeRemoveEventListener;

    /**
     * 防抖函数
     * @param {Function} func - 要防抖的函数
     * @param {number} wait - 延迟毫秒数
     * @returns {Function} 防抖后的函数
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
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
                highlightColor: '#7e57c2', // 更改为主题紫色
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
        this.configManager = null;
        this.styleManager = null;
        
        // 绑定事件处理函数，确保可以正确移除监听器
        this.boundHandleMouseMove = this.handleMouseMove.bind(this);
        this.boundHandleMouseLeave = this.handleMouseLeave.bind(this);
        this.boundHandleClick = this.handleClick.bind(this);
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        
        // 应用防抖，16ms约等于60fps
        this.debouncedHandleMouseMove = debounce(this.boundHandleMouseMove, 16);
        this.debouncedHandleClick = debounce(this.boundHandleClick, 100);
    }

    async onInitialize() {
        // 检查依赖模块
        this.chromeSettings = window.NWSModules?.ChromeSettingsModule;
        this.notification = window.NWSModules?.NotificationModule;

        if (!this.chromeSettings) {
            throw new Error('ChromeSettingsModule 依赖未找到');
        }

        // 初始化配置管理器
        this.configManager = new ConfigManager(
            this.chromeSettings,
            this.name,
            this.defaultConfig
        );

        // 添加配置验证器
        this.configManager
            .addValidator('enabled', v => typeof v === 'boolean')
            .addValidator('showTooltip', v => typeof v === 'boolean')
            .addValidator('showStyleInfo', v => typeof v === 'boolean')
            .addValidator('enableActions', v => typeof v === 'boolean')
            .addValidator('highlightColor', v => typeof v === 'string' && v.length > 0)
            .addValidator('tooltipPosition', v => ['auto', 'top', 'bottom', 'left', 'right'].includes(v))
            .addValidator('minElementSize', v => v > 0 && v <= 1000);

        // 加载配置
        this.config = await this.configManager.load();

        // 初始化样式管理器
        this.styleManager = window.styleManager || new StyleManager();

        // 创建UI元素
        this.createTooltip();
        this.createStyleInfo();
        
        // 注入样式
        this.injectStyles();

        // 监听配置变化
        this.configManager.addObserver((newConfig) => {
            this.config = newConfig;
            this.handleConfigChange();
        });

        // 注意：不在初始化时自动启用，让用户手动控制
        // 这样可以确保工具栏按钮的状态与模块状态保持同步

        // 监听Chrome消息
        this.setupMessageListener();
    }

    async onDestroy() {
        try {
            await this.disable();
            this.removeUI();
            
            // 清理样式
            if (this.styleManager) {
                this.styleManager.removeModuleStyles(this.name);
            }
            
            // 销毁配置管理器
            if (this.configManager) {
                this.configManager.destroy();
            }
            
            console.log('[ElementHighlighter] 模块已销毁');
        } catch (error) {
            console.error('[ElementHighlighter] 销毁模块时出错:', error);
        }
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
        document.addEventListener('mousemove', this.debouncedHandleMouseMove);
        document.addEventListener('mouseleave', this.boundHandleMouseLeave);
        document.addEventListener('click', this.debouncedHandleClick);
        document.addEventListener('keydown', this.boundHandleKeyDown);
    }

    /**
     * 移除事件监听器
     */
    removeEventListeners() {
        document.removeEventListener('mousemove', this.debouncedHandleMouseMove);
        document.removeEventListener('mouseleave', this.boundHandleMouseLeave);
        document.removeEventListener('click', this.debouncedHandleClick);
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
        const previousHighlight = elementSafeQuerySelector('.nws-element-highlight');
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

        this.tooltip.innerHTML = '';
        
        const tagDiv = document.createElement('div');
        tagDiv.className = 'nws-tooltip-tag';
        tagDiv.textContent = `<${tagName}${id}${className}>`;
        this.tooltip.appendChild(tagDiv);
        
        const pathDiv = document.createElement('div');
        pathDiv.className = 'nws-tooltip-path';
        pathDiv.textContent = this.getSimplifiedCssPath(element);
        this.tooltip.appendChild(pathDiv);
        
        if (text) {
            const textDiv = document.createElement('div');
            textDiv.className = 'nws-tooltip-text';
            textDiv.textContent = text;
            this.tooltip.appendChild(textDiv);
        }

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
        
        const copySelectorBtn = document.createElement('button');
        copySelectorBtn.innerHTML = `
            <svg style="width:14px;height:14px;vertical-align:middle;margin-right:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            复制选择器
        `;
        copySelectorBtn.onclick = () => {
            this.copySelector();
            this.hideButtonGroup();
        };
        
        const copyStyleBtn = document.createElement('button');
        copyStyleBtn.innerHTML = `
            <svg style="width:14px;height:14px;vertical-align:middle;margin-right:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
            复制计算样式
        `;
        copyStyleBtn.onclick = () => {
            this.copyStyle();
            this.hideButtonGroup();
        };

        const saveMdBtn = document.createElement('button');
        saveMdBtn.innerHTML = `
            <svg style="width:14px;height:14px;vertical-align:middle;margin-right:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
            保存为 Markdown
        `;
        saveMdBtn.onclick = () => {
            this.saveAsMD();
            this.hideButtonGroup();
        };

        const convertVueBtn = document.createElement('button');
        convertVueBtn.innerHTML = `
            <svg style="width:14px;height:14px;vertical-align:middle;margin-right:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
            转换为 Vue 组件
        `;
        convertVueBtn.onclick = () => {
            this.convertToVue();
            this.hideButtonGroup();
        };
        
        this.buttonGroup.appendChild(copySelectorBtn);
        this.buttonGroup.appendChild(copyStyleBtn);
        this.buttonGroup.appendChild(saveMdBtn);
        this.buttonGroup.appendChild(convertVueBtn);
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
        
        template += `<script>
module.exports = {
  name: 'ExtractedElement',
  data() {
    return {
      content: '${textContent || '内容'}'
    }
  }
}
</script>

`;
        
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
        if (!this.styleManager) return;

        const css = `
            .nws-element-highlight {
                position: absolute;
                border: 2px solid ${this.config.highlightColor};
                background: ${this.config.highlightColor}20;
                pointer-events: none;
                z-index: 9999;
                transition: all 0.2s ease;
            }
            
            .nws-element-highlight.active {
                box-shadow: 0 0 10px ${this.config.highlightColor}40;
            }
            
            .nws-tooltip {
                position: absolute;
                background: #333;
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-family: monospace;
                z-index: 10000;
                max-width: 300px;
                word-wrap: break-word;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                pointer-events: none;
            }
            
            .nws-tooltip-tag {
                color: #4CAF50;
                font-weight: bold;
                margin-bottom: 4px;
            }
            
            .nws-tooltip-path {
                color: #2196F3;
                font-size: 11px;
                margin-bottom: 4px;
            }
            
            .nws-tooltip-text {
                color: #FFC107;
                font-style: italic;
            }
            
            .nws-button-group {
                position: absolute;
                display: flex;
                gap: 8px;
                z-index: 10001;
            }
            
            .nws-action-btn {
                background: ${this.config.highlightColor};
                color: white;
                border: none;
                padding: 6px 10px;
                border-radius: 4px;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
            }
            
            .nws-action-btn:hover {
                opacity: 0.8;
                transform: translateY(-1px);
            }
            
            .nws-style-info {
                position: absolute;
                background: white;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 16px;
                font-size: 12px;
                font-family: monospace;
                z-index: 10002;
                max-width: 400px;
                max-height: 300px;
                overflow: auto;
                box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            }
            
            .nws-style-info h4 {
                margin: 0 0 12px 0;
                color: ${this.config.highlightColor};
                border-bottom: 1px solid #eee;
                padding-bottom: 8px;
            }
        `;

        this.styleManager.inject(this.name, css, null, {
            priority: 'high',
            cache: true
        });
    }

    /**
     * 处理配置变化
     */
    handleConfigChange() {
        if (!this.styleManager || !this.configManager) return;

        try {
            // 重新注入样式（因为高亮颜色可能变化）
            if (this.styleManager.has(`nws-style-${this.name}`)) {
                this.styleManager.removeModuleStyles(this.name);
                this.injectStyles();
            }

            // 如果启用状态改变
            if (this.config.enabled && !this.isActive) {
                this.enable();
            } else if (!this.config.enabled && this.isActive) {
                this.disable();
            }
        } catch (error) {
            console.error('[ElementHighlighter] 配置变更处理失败:', error);
        }
    }

    /**
     * 更新配置
     * @param {Object} newConfig 新配置
     * @returns {Promise<boolean>} 是否更新成功
     */
    async updateConfig(newConfig) {
        if (!this.configManager) return false;

        try {
            return await this.configManager.updateAndSave(newConfig);
        } catch (error) {
            console.error('[ElementHighlighter] 更新配置失败:', error);
            return false;
        }
    }

    /**
     * 重置配置
     * @returns {Promise<boolean>} 是否重置成功
     */
    async resetConfig() {
        if (!this.configManager) return false;

        try {
            return await this.configManager.reset();
        } catch (error) {
            console.error('[ElementHighlighter] 重置配置失败:', error);
            return false;
        }
    }
}

    // 注册到全局模块系统
    if (window.NWSModules) {
        window.NWSModules.ElementHighlighterModule = ElementHighlighterModule;
    }
})();