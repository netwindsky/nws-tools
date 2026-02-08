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
                enabled: false,
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

        this.lastHighlightedElement = null;
        this.lastCssPath = '';
        this.isActive = false;
        this.configManager = null;
        this.styleManager = null;
        this.view = null;
        this.service = null;
        
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

        const ElementHighlighterService = window.NWSModules?.ElementHighlighterService || window.NWSModules?.get?.('ElementHighlighterService');
        if (ElementHighlighterService) {
            this.service = new ElementHighlighterService({
                chromeSettings: this.chromeSettings,
                notification: this.notification
            });
        }
        const ElementHighlighterView = window.NWSModules?.ElementHighlighterView || window.NWSModules?.get?.('ElementHighlighterView');
        if (ElementHighlighterView) {
            this.view = new ElementHighlighterView({
                getConfig: () => this.config,
                getSimplifiedCssPath: (element) => this.service ? this.service.getSimplifiedCssPath(element) : '',
                onCopySelector: () => this.copySelector(),
                onCopyStyle: () => this.copyStyle(),
                onSaveAsMD: () => this.saveAsMD(),
                onConvertToVue: () => this.convertToVue(),
                safeQuerySelector: elementSafeQuerySelector,
                styleManager: this.styleManager,
                moduleName: this.name
            });
        }

        this.view?.createTooltip();
        this.view?.createStyleInfo();
        this.view?.injectStyles();

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
            this.view?.removeUI();
            
            // 清理样式
            if (this.styleManager) {
                this.styleManager.removeModuleStyles(this.name);
            }
            
            // 销毁配置管理器
            if (this.configManager) {
                this.configManager.destroy();
            }
            this.view = null;
            this.service = null;
            
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
        this.view?.hideTooltip();
        this.view?.hideStyleInfo();
        this.view?.hideButtonGroup();
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
            this.view?.hideTooltip();
            return;
        }

        // 如果是同一个元素，不需要重新处理
        if (element === this.lastHighlightedElement) {
            return;
        }

        this.lastHighlightedElement = element;
        this.lastCssPath = this.service ? this.service.getCssPath(element) : '';

        this.view?.highlightElement(element);

        // 显示工具提示
        if (this.config.showTooltip) {
            this.view?.showTooltip(element, e.clientX, e.clientY);
        }

        // 显示样式信息
        if (this.config.showStyleInfo) {
            this.view?.showStyleInfo(element);
        }

        this.emit('elementHighlighted', { element, cssPath: this.lastCssPath });
    }

    /**
     * 处理鼠标离开事件
     * @param {MouseEvent} e 鼠标事件
     */
    handleMouseLeave(e) {
        if (e.target === document.documentElement) {
            this.view?.hideTooltip();
            this.view?.hideStyleInfo();
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
            this.view?.showButtonGroup(this.lastHighlightedElement, e.clientX, e.clientY);
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
        const excludeSelectors = Array.isArray(this.config?.excludeSelectors)
            ? this.config.excludeSelectors
            : this.defaultConfig.excludeSelectors;
        if (excludeSelectors.includes(tagName)) {
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
     * 复制选择器
     */
    async copySelector() {
        if (!this.lastHighlightedElement) return;

        try {
            const simplifiedPath = this.service ? await this.service.copySelector(this.lastHighlightedElement) : '';
            this.emit('selectorCopied', { element: this.lastHighlightedElement, selector: simplifiedPath });
        } catch (error) {
            console.error('[ElementHighlighter] 复制选择器失败:', error);
        }
    }

    /**
     * 复制样式
     */
    async copyStyle() {
        if (!this.lastHighlightedElement) return;

        try {
            const styleText = this.service ? await this.service.copyStyle(this.lastHighlightedElement) : '';
            this.emit('styleCopied', { element: this.lastHighlightedElement, style: styleText });
        } catch (error) {
            console.error('[ElementHighlighter] 复制样式失败:', error);
        }
    }
    /**
     * 保存为Markdown
     */
    async saveAsMD() {
        if (!this.lastHighlightedElement) return;

        try {
            if (this.service) {
                await this.service.saveAsMD(this.lastHighlightedElement);
            }
        } catch (error) {
            console.error('[ElementHighlighter] 保存MD失败:', error);
        }
    }

    /**
     * 转换为Vue组件
     */
    async convertToVue() {
        if (!this.lastHighlightedElement) return;

        try {
            if (this.service) {
                await this.service.convertToVue(this.lastHighlightedElement);
            }
        } catch (error) {
            console.error('[ElementHighlighter] 复制Vue代码失败:', error);
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
     * 处理配置变化
     */
    handleConfigChange() {
        if (!this.styleManager || !this.configManager) return;

        try {
            // 重新注入样式（因为高亮颜色可能变化）
            if (this.styleManager.has(`nws-style-${this.name}`)) {
                this.styleManager.removeModuleStyles(this.name);
                this.view?.injectStyles();
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
