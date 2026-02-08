/**
 * ConfigManager.js - 配置管理器
 * 统一管理模块配置，提供验证和持久化功能
 */

(function() {
    'use strict';

/**
 * 配置管理器
 * 统一管理模块配置，提供验证和持久化功能
 */
class ConfigManager {
    /**
     * 构造函数
     * @param {Object} storage - 存储对象
     * @param {string} moduleName - 模块名称
     * @param {Object} defaultConfig - 默认配置
     */
    constructor(storage, moduleName, defaultConfig = {}) {
        this.storage = storage;
        this.moduleName = moduleName;
        this.defaultConfig = { ...defaultConfig };
        this.config = { ...defaultConfig };
        this.validators = new Map();
        this.observers = new Set();
    }

    /**
     * 加载配置
     * @returns {Promise<Object>} 配置对象
     */
    async load() {
        try {
            const result = await this.storage.getStorage(this.moduleName);
            const savedConfig = result[this.moduleName] || {};
            
            // 合并配置并验证
            this.config = this.validate({
                ...this.defaultConfig,
                ...savedConfig
            });
            
            console.log(`[ConfigManager] ${this.moduleName} 配置加载完成:`, this.config);
            return this.config;
        } catch (error) {
            console.error(`[ConfigManager] ${this.moduleName} 加载配置失败:`, error);
            // 加载失败时使用默认配置
            this.config = { ...this.defaultConfig };
            return this.config;
        }
    }

    /**
     * 保存配置
     * @param {Object} newConfig - 新配置
     * @returns {Promise<boolean>} 是否保存成功
     */
    async save(newConfig = null) {
        try {
            const configToSave = newConfig || this.config;
            const validatedConfig = this.validate({ ...this.defaultConfig, ...configToSave });
            
            // 检查配置是否有变化
            const hasChanged = JSON.stringify(validatedConfig) !== JSON.stringify(this.config);
            
            if (hasChanged || newConfig) {
                this.config = validatedConfig;
                await this.storage.setStorage({
                    [this.moduleName]: validatedConfig
                });
                
                console.log(`[ConfigManager] ${this.moduleName} 配置保存成功:`, validatedConfig);
                
                // 通知观察者
                this.notifyObservers(validatedConfig);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error(`[ConfigManager] ${this.moduleName} 保存配置失败:`, error);
            return false;
        }
    }

    /**
     * 验证配置
     * @param {Object} config - 要验证的配置
     * @returns {Object} 验证后的配置
     */
    validate(config) {
        const validated = { ...config };
        
        for (const [key, value] of Object.entries(validated)) {
            // 检查类型
            const expectedType = typeof this.defaultConfig[key];
            if (expectedType && typeof value !== expectedType) {
                console.warn(`[ConfigManager] ${this.moduleName} 配置项 ${key} 类型错误（期望${expectedType}，实际${typeof value}），使用默认值`);
                validated[key] = this.defaultConfig[key];
                continue;
            }

            // 运行自定义验证器
            const validator = this.validators.get(key);
            if (validator && !validator(value)) {
                console.warn(`[ConfigManager] ${this.moduleName} 配置项 ${key} 验证失败，使用默认值`);
                validated[key] = this.defaultConfig[key];
            }
        }
        
        return validated;
    }

    /**
     * 添加验证器
     * @param {string} key - 配置项键名
     * @param {Function} validator - 验证函数
     * @returns {ConfigManager} 返回自身以支持链式调用
     */
    addValidator(key, validator) {
        if (typeof validator !== 'function') {
            throw new Error('验证器必须是函数');
        }
        this.validators.set(key, validator);
        return this;
    }

    /**
     * 移除验证器
     * @param {string} key - 配置项键名
     * @returns {ConfigManager} 返回自身以支持链式调用
     */
    removeValidator(key) {
        this.validators.delete(key);
        return this;
    }

    /**
     * 获取配置值
     * @param {string} key - 配置项键名
     * @param {*} defaultValue - 默认值
     * @returns {*} 配置值
     */
    get(key, defaultValue = undefined) {
        return this.config.hasOwnProperty(key) ? this.config[key] : defaultValue;
    }

    /**
     * 设置配置值（不自动保存）
     * @param {string} key - 配置项键名
     * @param {*} value - 配置值
     * @returns {ConfigManager} 返回自身以支持链式调用
     */
    set(key, value) {
        this.config[key] = value;
        return this;
    }

    /**
     * 设置配置值并保存
     * @param {string} key - 配置项键名
     * @param {*} value - 配置值
     * @returns {Promise<boolean>} 是否保存成功
     */
    async setAndSave(key, value) {
        this.set(key, value);
        return await this.save();
    }

    /**
     * 获取所有配置
     * @returns {Object} 配置对象副本
     */
    getAll() {
        return { ...this.config };
    }

    /**
     * 更新配置
     * @param {Object} updates - 更新的配置
     * @returns {ConfigManager} 返回自身以支持链式调用
     */
    update(updates) {
        Object.assign(this.config, updates);
        return this;
    }

    /**
     * 更新配置并保存
     * @param {Object} updates - 更新的配置
     * @returns {Promise<boolean>} 是否保存成功
     */
    async updateAndSave(updates) {
        this.update(updates);
        return await this.save();
    }

    /**
     * 重置为默认配置
     * @returns {Promise<boolean>} 是否保存成功
     */
    async reset() {
        this.config = { ...this.defaultConfig };
        return await this.save();
    }

    /**
     * 检查配置项是否存在
     * @param {string} key - 配置项键名
     * @returns {boolean} 是否存在
     */
    has(key) {
        return this.config.hasOwnProperty(key);
    }

    /**
     * 删除配置项
     * @param {string} key - 配置项键名
     * @returns {ConfigManager} 返回自身以支持链式调用
     */
    delete(key) {
        delete this.config[key];
        return this;
    }

    /**
     * 添加配置变化观察者
     * @param {Function} observer - 观察者函数
     * @returns {Function} 取消观察的函数
     */
    addObserver(observer) {
        if (typeof observer !== 'function') {
            throw new Error('观察者必须是函数');
        }
        this.observers.add(observer);
        
        // 返回取消观察的函数
        return () => {
            this.observers.delete(observer);
        };
    }

    /**
     * 移除配置变化观察者
     * @param {Function} observer - 观察者函数
     * @returns {ConfigManager} 返回自身以支持链式调用
     */
    removeObserver(observer) {
        this.observers.delete(observer);
        return this;
    }

    /**
     * 通知所有观察者
     * @param {Object} newConfig - 新配置
     */
    notifyObservers(newConfig) {
        for (const observer of this.observers) {
            try {
                observer(newConfig);
            } catch (error) {
                console.error('[ConfigManager] 观察者执行失败:', error);
            }
        }
    }

    /**
     * 获取配置差异
     * @param {Object} otherConfig - 另一个配置对象
     * @returns {Object} 差异对象
     */
    diff(otherConfig) {
        const changes = {};
        
        // 检查当前配置中不同的项
        for (const [key, value] of Object.entries(this.config)) {
            if (!otherConfig.hasOwnProperty(key) || otherConfig[key] !== value) {
                changes[key] = {
                    old: otherConfig[key],
                    new: value
                };
            }
        }
        
        // 检查新配置中多出的项
        for (const [key, value] of Object.entries(otherConfig)) {
            if (!this.config.hasOwnProperty(key)) {
                changes[key] = {
                    old: value,
                    new: undefined
                };
            }
        }
        
        return changes;
    }

    /**
     * 合并另一个配置管理器的配置
     * @param {ConfigManager} otherConfigManager - 另一个配置管理器
     * @returns {ConfigManager} 返回自身以支持链式调用
     */
    merge(otherConfigManager) {
        if (otherConfigManager && typeof otherConfigManager.getAll === 'function') {
            const otherConfig = otherConfigManager.getAll();
            this.update(otherConfig);
        }
        return this;
    }

    /**
     * 销毁配置管理器
     */
    destroy() {
        this.observers.clear();
        this.validators.clear();
        console.log(`[ConfigManager] ${this.moduleName} 已销毁`);
    }

    /**
     * 创建配置管理器的静态工厂方法
     * @param {Object} storage - 存储对象
     * @param {string} moduleName - 模块名称
     * @param {Object} defaultConfig - 默认配置
     * @returns {ConfigManager} 配置管理器实例
     */
    static create(storage, moduleName, defaultConfig) {
        return new ConfigManager(storage, moduleName, defaultConfig);
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigManager;
} else {
    window.ConfigManager = ConfigManager;
}

})();