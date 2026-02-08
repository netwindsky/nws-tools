/**
 * main.js - NWS Tools 主入口文件
 * 负责初始化和管理所有功能模块
 */

(function() {
    'use strict';
    
    // 从全局模块系统获取模块
    let ModuleManager, ChromeSettingsModule, NotificationModule, TranslationModule, SummaryModule, ImageDownloaderModule, ElementHighlighterModule, SidebarModule, ErrorHandler;
    
    if (window.NWSModules) {
        ModuleManager = window.NWSModules.ModuleManager;
        ChromeSettingsModule = window.NWSModules.ChromeSettingsModule;
        NotificationModule = window.NWSModules.NotificationModule;
        TranslationModule = window.NWSModules.TranslationModule;
        SummaryModule = window.NWSModules.SummaryModule;
        ImageDownloaderModule = window.NWSModules.ImageDownloaderModule;
        ElementHighlighterModule = window.NWSModules.ElementHighlighterModule;
        SidebarModule = window.NWSModules.SidebarModule;
        ErrorHandler = window.NWSModules.ErrorHandler;
    }
    
    // 从全局作用域获取initErrorHandler函数
    const initErrorHandler = (typeof window.initErrorHandler === 'function') 
        ? window.initErrorHandler 
        : (ErrorHandler && typeof ErrorHandler.initErrorHandler === 'function') 
            ? ErrorHandler.initErrorHandler 
            : function() { console.log('[NWSTools] 使用默认错误处理器'); };

class NWSTools {
    constructor() {
        this.moduleManager = ModuleManager; // ModuleManager is already an instance
        this.initialized = false;
    }

    async waitForModule(name, maxRetries = 20, delayMs = 50) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const moduleClass = window.NWSModules ? window.NWSModules[name] : null;
            if (moduleClass) {
                return moduleClass;
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        return null;
    }

    /**
     * 初始化应用
     */
    async initialize() {
        if (this.initialized) {
            console.warn('[NWSTools] 应用已经初始化');
            return;
        }

        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`[NWSTools] 开始初始化（第${attempt}次尝试）...`);

                    // 初始化全局错误处理器
                    try {
                        initErrorHandler();
                    } catch (error) {
                        console.warn('[NWSTools] 错误处理器初始化失败，继续执行:', error);
                    }

                    // 注册所有模块
                    await this.registerModules();

                // 初始化所有模块
                await this.moduleManager.initializeAll();

                // 设置全局访问
                this.setupGlobalAccess();

                this.initialized = true;
                console.log('[NWSTools] 初始化完成');

                // 触发初始化完成事件
                this.dispatchEvent('initialized');
                return;

            } catch (error) {
                console.error(`[NWSTools] 初始化失败（第${attempt}次）:`, error);
                
                if (attempt === maxRetries) {
                    // 最后一次尝试失败，显示用户友好的错误信息
                    this.showInitializationError(error);
                    throw error;
                }
                
                // 等待后重试，指数退避
                await new Promise(resolve => 
                    setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
                );
            }
        }
    }

    /**
     * 显示初始化错误
     * @param {Error} error - 错误对象
     */
    showInitializationError(error) {
        try {
            // 显示用户友好的错误提示
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #f44336;
                color: white;
                padding: 16px;
                border-radius: 4px;
                z-index: 10000;
                font-family: Arial, sans-serif;
                font-size: 14px;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            errorDiv.textContent = 'NWS Tools 初始化失败，请刷新页面重试';
            document.body.appendChild(errorDiv);
            
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.remove();
                }
            }, 5000);
        } catch (displayError) {
            console.error('[NWSTools] 无法显示错误提示:', displayError);
        }
    }

    /**
     * 注册所有模块
     */
    async registerModules() {
        console.log('[NWSTools] 开始注册模块...');
        
        // 模块已经通过各个模块文件直接注册到 window.NWSModules
        // 现在将它们注册到 ModuleManager 进行统一管理
        const summaryModuleClass = await this.waitForModule('SummaryModule');
        const availableModules = {
            'ChromeSettingsModule': window.NWSModules.ChromeSettingsModule,
            'NotificationModule': window.NWSModules.NotificationModule,
            'TranslationModule': window.NWSModules.TranslationModule,
            'SummaryModule': summaryModuleClass,
            'ImageDownloaderModule': window.NWSModules.ImageDownloaderModule,
            'ElementHighlighterModule': window.NWSModules.ElementHighlighterModule,
            'SidebarModule': window.NWSModules.SidebarModule
        };
        
        for (const [name, moduleClass] of Object.entries(availableModules)) {
            if (!moduleClass) {
                if (name === 'SummaryModule') {
                    console.warn(`[NWSTools] 模块 ${name} 不可用，跳过注册`);
                    continue;
                } else {
                    console.warn(`[NWSTools] 模块 ${name} 不可用`);
                    throw new Error(`模块 ${name} 不可用`);
                }
            }
            console.log(`[NWSTools] 模块 ${name} 可用，注册到管理器`);
            
            // 注册到 ModuleManager
            this.moduleManager.register(name, moduleClass);
        }

        console.log('[NWSTools] 模块注册完成');
    }

    /**
     * 设置全局访问
     */
    setupGlobalAccess() {
        // 设置全局模块访问
        if (!window.NWSModules) {
            window.NWSModules = {};
        }
        
        // 添加模块管理器的 get 方法以保持向后兼容
        if (this.moduleManager && !window.NWSModules.get) {
            window.NWSModules.get = this.moduleManager.get.bind(this.moduleManager);
        }
        
        const modules = this.moduleManager.getAllModules();
        for (const [name, module] of modules) {
            window.NWSModules[name] = module;
        }

        // 设置全局应用实例
        window.NWSTools = this;

        console.log('[NWSTools] 全局访问设置完成');
    }

    /**
     * 获取模块
     * @param {string} name 模块名称
     * @returns {ModuleBase|null}
     */
    getModule(name) {
        return this.moduleManager.getModule(name);
    }

    /**
     * 启用模块
     * @param {string} name 模块名称
     */
    async enableModule(name) {
        const module = this.getModule(name);
        if (module) {
            await module.enable();
            console.log(`[NWSTools] 模块 ${name} 已启用`);
        }
    }

    /**
     * 禁用模块
     * @param {string} name 模块名称
     */
    async disableModule(name) {
        const module = this.getModule(name);
        if (module) {
            await module.disable();
            console.log(`[NWSTools] 模块 ${name} 已禁用`);
        }
    }

    /**
     * 重新加载模块
     * @param {string} name 模块名称
     */
    async reloadModule(name) {
        const module = this.getModule(name);
        if (module) {
            await module.disable();
            await module.enable();
            console.log(`[NWSTools] 模块 ${name} 已重新加载`);
        }
    }

    /**
     * 获取所有模块状态
     * @returns {Object}
     */
    getModulesStatus() {
        const modules = this.moduleManager.getAllModules();
        const status = {};

        for (const [name, module] of modules) {
            status[name] = {
                enabled: module.enabled,
                version: module.version,
                dependencies: module.dependencies,
                config: module.config
            };
        }

        return status;
    }

    /**
     * 销毁应用
     */
    async destroy() {
        if (!this.initialized) {
            return;
        }

        try {
            console.log('[NWSTools] 开始销毁...');

            // 销毁所有模块
            await this.moduleManager.destroyAll();

            // 清理全局访问
            delete window.NWSModules;
            delete window.NWSTools;

            this.initialized = false;
            console.log('[NWSTools] 销毁完成');

            // 触发销毁完成事件
            this.dispatchEvent('destroyed');

        } catch (error) {
            console.error('[NWSTools] 销毁失败:', error);
            throw error;
        }
    }

    /**
     * 触发自定义事件
     * @param {string} eventName 事件名称
     * @param {*} detail 事件详情
     */
    dispatchEvent(eventName, detail = null) {
        const event = new CustomEvent(`nws:${eventName}`, { detail });
        document.dispatchEvent(event);
    }

    /**
     * 监听自定义事件
     * @param {string} eventName 事件名称
     * @param {Function} handler 事件处理器
     */
    addEventListener(eventName, handler) {
        document.addEventListener(`nws:${eventName}`, handler);
    }

    /**
     * 移除事件监听器
     * @param {string} eventName 事件名称
     * @param {Function} handler 事件处理器
     */
    removeEventListener(eventName, handler) {
        document.removeEventListener(`nws:${eventName}`, handler);
    }
}

// 创建应用实例
const app = new NWSTools();

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app.initialize().catch(console.error);
    });
} else {
    // 如果页面已经加载完成，立即初始化
    app.initialize().catch(console.error);
}

    // 将应用实例注册到全局模块系统
    if (window.NWSModules) {
        window.NWSModules.register('NWSApp', app);
    }
})();
