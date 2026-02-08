/**
 * ModuleBase.js - 模块基类
 * 定义所有模块的统一接口和生命周期管理
 */

class ModuleBase {
    constructor(name, options = {}) {
        this.name = name;
        this.version = options.version || '1.0.0';
        this.dependencies = options.dependencies || [];
        this.initialized = false;
        this.destroyed = false;
        
        // 事件系统
        this.eventListeners = new Map();
        
        // 配置管理
        this.defaultConfig = options.defaultConfig || {};
        this.config = options.config || {};
        
        // 设置enabled状态，优先级：options.enabled > defaultConfig.enabled > true
        this.enabled = options.enabled !== undefined ? options.enabled : 
                      (this.defaultConfig.enabled !== undefined ? this.defaultConfig.enabled : true);
    }

    /**
     * 模块初始化 - 子类必须实现
     * @returns {Promise<boolean>} 初始化是否成功
     */
    async initialize() {
        if (this.initialized) {
            console.warn(`[${this.name}] 模块已经初始化`);
            return true;
        }

        try {
            // 检查依赖
            await this.checkDependencies();
            
            // 加载配置
            await this.loadConfig();
            
            // 子类实现的初始化逻辑
            await this.onInitialize();
            
            this.initialized = true;
            this.emit('initialized');
            
            console.log(`[${this.name}] 模块初始化成功`);
            return true;
        } catch (error) {
            console.error(`[${this.name}] 模块初始化失败:`, error);
            return false;
        }
    }

    /**
     * 模块销毁
     */
    async destroy() {
        if (this.destroyed) {
            console.warn(`[${this.name}] 模块已经销毁`);
            return;
        }

        try {
            await this.onDestroy();
            this.eventListeners.clear();
            this.destroyed = true;
            this.initialized = false;
            
            console.log(`[${this.name}] 模块销毁成功`);
        } catch (error) {
            console.error(`[${this.name}] 模块销毁失败:`, error);
        }
    }

    /**
     * 启用模块
     */
    async enable() {
        if (this.enabled) return;
        
        this.enabled = true;
        await this.onEnable();
        this.emit('enabled');
    }

    /**
     * 禁用模块
     */
    async disable() {
        if (!this.enabled) return;
        
        this.enabled = false;
        await this.onDisable();
        this.emit('disabled');
    }

    /**
     * 检查依赖
     */
    async checkDependencies() {
        for (const dep of this.dependencies) {
            if (!window[dep] && !this.isModuleLoaded(dep)) {
                throw new Error(`依赖模块 ${dep} 未加载`);
            }
        }
    }

    /**
     * 检查模块是否已加载
     */
    isModuleLoaded(moduleName) {
        // 检查多种可能的模块存在方式
        return (window.NWSModules && window.NWSModules[moduleName]) ||
               (window.NWSModules && window.NWSModules.get && typeof window.NWSModules.get === 'function' && window.NWSModules.get(moduleName)) ||
               (window.NWSModules && window.NWSModules.getModule && typeof window.NWSModules.getModule === 'function' && window.NWSModules.getModule(moduleName)) ||
               window[moduleName];
    }

    /**
     * 加载配置
     */
    async loadConfig() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.sync.get(this.name);
                this.config = { ...this.defaultConfig, ...result[this.name] };
                
                // 更新enabled状态
                if (this.config.enabled !== undefined) {
                    this.enabled = this.config.enabled;
                }
            } else {
                this.config = { ...this.defaultConfig };
                
                // 更新enabled状态
                if (this.config.enabled !== undefined) {
                    this.enabled = this.config.enabled;
                }
            }
        } catch (error) {
            console.warn(`[${this.name}] 加载配置失败，使用默认配置:`, error);
            this.config = { ...this.defaultConfig };
            
            // 更新enabled状态
            if (this.config.enabled !== undefined) {
                this.enabled = this.config.enabled;
            }
        }
    }

    /**
     * 保存配置
     */
    async saveConfig(config = null) {
        try {
            const configToSave = config || this.config;
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.sync.set({ [this.name]: configToSave });
                this.config = { ...this.config, ...configToSave };
                this.emit('configChanged', this.config);
            }
        } catch (error) {
            console.error(`[${this.name}] 保存配置失败:`, error);
        }
    }

    /**
     * 事件监听
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    /**
     * 移除事件监听
     */
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * 触发事件
     */
    emit(event, ...args) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`[${this.name}] 事件处理器错误:`, error);
                }
            });
        }
    }

    /**
     * 获取模块信息
     */
    getInfo() {
        return {
            name: this.name,
            version: this.version,
            enabled: this.enabled,
            initialized: this.initialized,
            dependencies: this.dependencies
        };
    }

    // 子类需要实现的方法
    async onInitialize() {
        // 子类实现具体的初始化逻辑
    }

    async onDestroy() {
        // 子类实现具体的销毁逻辑
    }

    async onEnable() {
        // 子类实现启用逻辑
    }

    async onDisable() {
        // 子类实现禁用逻辑
    }
}

// 注册到全局模块系统
if (window.NWSModules) {
    window.NWSModules.register('ModuleBase', ModuleBase);
}