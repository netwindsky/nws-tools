/**
 * main.js - NWS Tools 主入口文件
 * 负责初始化和管理所有功能模块
 */

(function() {
    'use strict';
    
    // 从全局模块系统获取模块
    let ModuleManager, ChromeSettingsModule, NotificationModule, ImageDownloaderModule, ElementHighlighterModule, ErrorHandler, initErrorHandler;
    
    if (window.NWSModules) {
        ModuleManager = window.NWSModules.ModuleManager;
        ChromeSettingsModule = window.NWSModules.ChromeSettingsModule;
        NotificationModule = window.NWSModules.NotificationModule;
        ImageDownloaderModule = window.NWSModules.ImageDownloaderModule;
        ElementHighlighterModule = window.NWSModules.ElementHighlighterModule;
        ErrorHandler = window.NWSModules.ErrorHandler;
        if (ErrorHandler) {
            ({ initErrorHandler } = ErrorHandler);
        }
    }

class NWSTools {
    constructor() {
        this.moduleManager = ModuleManager;
        this.initialized = false;
    }

    /**
     * 初始化应用
     */
    async initialize() {
        if (this.initialized) {
            console.warn('[NWSTools] 应用已经初始化');
            return;
        }

        try {
            console.log('[NWSTools] 开始初始化...');

            // 初始化全局错误处理器
            initErrorHandler();

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

        } catch (error) {
            console.error('[NWSTools] 初始化失败:', error);
            throw error;
        }
    }

    /**
     * 注册所有模块
     */
    async registerModules() {
        // 按依赖顺序注册模块
        
        // 1. 基础模块（无依赖）
        this.moduleManager.register('ChromeSettingsModule', ChromeSettingsModule);
        
        // 2. 功能模块（依赖基础模块）
        this.moduleManager.register('NotificationModule', NotificationModule);
        this.moduleManager.register('ImageDownloaderModule', ImageDownloaderModule);
        this.moduleManager.register('ElementHighlighterModule', ElementHighlighterModule);

        console.log('[NWSTools] 模块注册完成');
    }

    /**
     * 设置全局访问
     */
    setupGlobalAccess() {
        // 设置全局模块访问
        window.NWSModules = {};
        
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