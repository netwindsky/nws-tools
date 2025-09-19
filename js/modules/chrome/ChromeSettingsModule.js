/**
 * ChromeSettingsModule.js - Chrome设置管理模块
 * 封装Chrome存储、权限、标签页等API的统一接口
 */

(function() {
    'use strict';
    
    // 从全局模块系统获取ModuleBase
    let ModuleBase;
    if (window.NWSModules) {
        ModuleBase = window.NWSModules.get('ModuleBase');
    }

class ChromeSettingsModule extends ModuleBase {
    constructor(name, options = {}) {
        super(name, {
            version: '1.0.0',
            dependencies: [],
            defaultConfig: {
                autoSync: true,
                storageQuota: 102400, // 100KB
                syncInterval: 5000 // 5秒
            },
            ...options
        });

        this.storageCache = new Map();
        this.syncTimer = null;
    }

    async onInitialize() {
        // 检查Chrome API可用性
        if (typeof chrome === 'undefined') {
            throw new Error('Chrome API 不可用');
        }

        // 检查扩展上下文是否有效
        if (!this.isExtensionContextValid()) {
            console.warn('[ChromeSettings] 扩展上下文无效，跳过初始化');
            return;
        }

        try {
            // 初始化存储缓存
            await this.loadAllSettings();
            
            // 设置存储监听器
            this.setupStorageListener();
            
            // 启动自动同步
            if (this.config.autoSync) {
                this.startAutoSync();
            }
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.warn('[ChromeSettings] 扩展上下文已失效，模块将不可用');
                return;
            }
            throw error;
        }
    }

    /**
     * 检查扩展上下文是否有效
     */
    isExtensionContextValid() {
        try {
            // 尝试访问chrome.runtime.id来检查上下文是否有效
            return chrome.runtime && chrome.runtime.id;
        } catch (error) {
            return false;
        }
    }

    async onDestroy() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
        this.storageCache.clear();
    }

    /**
     * 获取存储数据
     * @param {string|Array|Object} keys 要获取的键
     * @param {string} area 存储区域 'sync' | 'local' | 'managed'
     * @returns {Promise<Object>}
     */
    async getStorage(keys, area = 'sync') {
        try {
            // 检查扩展上下文是否有效
            if (!this.isExtensionContextValid()) {
                console.warn('[ChromeSettings] 扩展上下文无效，无法获取存储数据');
                return {};
            }

            const storage = chrome.storage[area];
            if (!storage) {
                throw new Error(`存储区域 ${area} 不支持`);
            }

            const result = await storage.get(keys);
            
            // 更新缓存
            if (typeof keys === 'string') {
                this.storageCache.set(keys, result[keys]);
            } else if (Array.isArray(keys)) {
                keys.forEach(key => {
                    this.storageCache.set(key, result[key]);
                });
            } else if (typeof keys === 'object') {
                Object.keys(keys).forEach(key => {
                    this.storageCache.set(key, result[key] || keys[key]);
                });
            }

            return result;
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.warn('[ChromeSettings] 扩展上下文已失效，无法获取存储数据');
                return {};
            }
            console.error('[ChromeSettings] 获取存储数据失败:', error);
            throw error;
        }
    }

    /**
     * 设置存储数据
     * @param {Object} items 要设置的数据
     * @param {string} area 存储区域
     * @returns {Promise<boolean>}
     */
    async setStorage(items, area = 'sync') {
        try {
            // 检查扩展上下文是否有效
            if (!this.isExtensionContextValid()) {
                console.warn('[ChromeSettings] 扩展上下文无效，无法设置存储数据');
                return false;
            }

            const storage = chrome.storage[area];
            if (!storage) {
                throw new Error(`存储区域 ${area} 不支持`);
            }

            await storage.set(items);
            
            // 更新缓存
            Object.entries(items).forEach(([key, value]) => {
                this.storageCache.set(key, value);
            });

            this.emit('storageChanged', { items, area });
            return true;
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.warn('[ChromeSettings] 扩展上下文已失效，无法设置存储数据');
                return false;
            }
            console.error('[ChromeSettings] 设置存储数据失败:', error);
            return false;
        }
    }

    /**
     * 删除存储数据
     * @param {string|Array} keys 要删除的键
     * @param {string} area 存储区域
     * @returns {Promise<boolean>}
     */
    async removeStorage(keys, area = 'sync') {
        try {
            // 检查扩展上下文是否有效
            if (!this.isExtensionContextValid()) {
                console.warn('[ChromeSettings] 扩展上下文无效，无法删除存储数据');
                return false;
            }

            const storage = chrome.storage[area];
            if (!storage) {
                throw new Error(`存储区域 ${area} 不支持`);
            }

            await storage.remove(keys);
            
            // 更新缓存
            const keysArray = Array.isArray(keys) ? keys : [keys];
            keysArray.forEach(key => {
                this.storageCache.delete(key);
            });

            this.emit('storageRemoved', { keys, area });
            return true;
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.warn('[ChromeSettings] 扩展上下文已失效，无法删除存储数据');
                return false;
            }
            console.error('[ChromeSettings] 删除存储数据失败:', error);
            return false;
        }
    }

    /**
     * 清空存储数据
     * @param {string} area 存储区域
     * @returns {Promise<boolean>}
     */
    async clearStorage(area = 'sync') {
        try {
            const storage = chrome.storage[area];
            if (!storage) {
                throw new Error(`存储区域 ${area} 不支持`);
            }

            await storage.clear();
            this.storageCache.clear();
            
            this.emit('storageCleared', { area });
            return true;
        } catch (error) {
            console.error('[ChromeSettings] 清空存储数据失败:', error);
            return false;
        }
    }

    /**
     * 获取存储使用情况
     * @param {string} area 存储区域
     * @returns {Promise<Object>}
     */
    async getStorageUsage(area = 'sync') {
        try {
            const storage = chrome.storage[area];
            if (!storage || !storage.getBytesInUse) {
                return { used: 0, quota: 0, available: 0 };
            }

            const used = await storage.getBytesInUse();
            const quota = storage.QUOTA_BYTES || this.config.storageQuota;
            const available = quota - used;

            return { used, quota, available };
        } catch (error) {
            console.error('[ChromeSettings] 获取存储使用情况失败:', error);
            return { used: 0, quota: 0, available: 0 };
        }
    }

    /**
     * 获取当前活动标签页
     * @returns {Promise<Object>}
     */
    async getCurrentTab() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            return tabs[0] || null;
        } catch (error) {
            console.error('[ChromeSettings] 获取当前标签页失败:', error);
            return null;
        }
    }

    /**
     * 向内容脚本发送消息
     * @param {number} tabId 标签页ID
     * @param {Object} message 消息内容
     * @returns {Promise<any>}
     */
    async sendMessageToTab(tabId, message) {
        try {
            return await chrome.tabs.sendMessage(tabId, message);
        } catch (error) {
            console.error('[ChromeSettings] 发送消息到标签页失败:', error);
            throw error;
        }
    }

    /**
     * 向后台脚本发送消息
     * @param {Object} message 消息内容
     * @returns {Promise<any>}
     */
    async sendMessageToBackground(message) {
        try {
            return await chrome.runtime.sendMessage(message);
        } catch (error) {
            console.error('[ChromeSettings] 发送消息到后台失败:', error);
            throw error;
        }
    }

    /**
     * 检查权限
     * @param {Object} permissions 权限对象
     * @returns {Promise<boolean>}
     */
    async checkPermissions(permissions) {
        try {
            return await chrome.permissions.contains(permissions);
        } catch (error) {
            console.error('[ChromeSettings] 检查权限失败:', error);
            return false;
        }
    }

    /**
     * 请求权限
     * @param {Object} permissions 权限对象
     * @returns {Promise<boolean>}
     */
    async requestPermissions(permissions) {
        try {
            return await chrome.permissions.request(permissions);
        } catch (error) {
            console.error('[ChromeSettings] 请求权限失败:', error);
            return false;
        }
    }

    /**
     * 创建右键菜单
     * @param {Object} menuItem 菜单项配置
     * @returns {Promise<string>}
     */
    async createContextMenu(menuItem) {
        try {
            return new Promise((resolve, reject) => {
                chrome.contextMenus.create(menuItem, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(menuItem.id);
                    }
                });
            });
        } catch (error) {
            console.error('[ChromeSettings] 创建右键菜单失败:', error);
            throw error;
        }
    }

    /**
     * 移除右键菜单
     * @param {string} menuItemId 菜单项ID
     * @returns {Promise<boolean>}
     */
    async removeContextMenu(menuItemId) {
        try {
            return new Promise((resolve) => {
                chrome.contextMenus.remove(menuItemId, () => {
                    resolve(!chrome.runtime.lastError);
                });
            });
        } catch (error) {
            console.error('[ChromeSettings] 移除右键菜单失败:', error);
            return false;
        }
    }

    /**
     * 下载文件
     * @param {Object} downloadOptions 下载选项
     * @returns {Promise<number>}
     */
    async downloadFile(downloadOptions) {
        try {
            return await chrome.downloads.download(downloadOptions);
        } catch (error) {
            console.error('[ChromeSettings] 下载文件失败:', error);
            throw error;
        }
    }

    /**
     * 加载所有设置到缓存
     */
    async loadAllSettings() {
        try {
            // 检查扩展上下文是否有效
            if (!this.isExtensionContextValid()) {
                console.warn('[ChromeSettings] 扩展上下文无效，跳过加载设置');
                return;
            }

            const syncData = await chrome.storage.sync.get(null);
            Object.entries(syncData).forEach(([key, value]) => {
                this.storageCache.set(key, value);
            });
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.warn('[ChromeSettings] 扩展上下文已失效，无法加载设置');
                return;
            }
            console.error('[ChromeSettings] 加载设置到缓存失败:', error);
        }
    }

    /**
     * 设置存储监听器
     */
    setupStorageListener() {
        try {
            // 检查扩展上下文是否有效
            if (!this.isExtensionContextValid()) {
                console.warn('[ChromeSettings] 扩展上下文无效，跳过设置存储监听器');
                return;
            }

            chrome.storage.onChanged.addListener((changes, namespace) => {
                // 更新缓存
                Object.entries(changes).forEach(([key, change]) => {
                    if (change.newValue !== undefined) {
                        this.storageCache.set(key, change.newValue);
                    } else {
                        this.storageCache.delete(key);
                    }
                });

                this.emit('storageChanged', { changes, namespace });
            });
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.warn('[ChromeSettings] 扩展上下文已失效，无法设置存储监听器');
                return;
            }
            console.error('[ChromeSettings] 设置存储监听器失败:', error);
        }
    }

    /**
     * 启动自动同步
     */
    startAutoSync() {
        // 检查扩展上下文是否有效
        if (!this.isExtensionContextValid()) {
            console.warn('[ChromeSettings] 扩展上下文无效，跳过启动自动同步');
            return;
        }

        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }

        this.syncTimer = setInterval(async () => {
            try {
                // 在每次同步前检查上下文是否仍然有效
                if (!this.isExtensionContextValid()) {
                    console.warn('[ChromeSettings] 扩展上下文已失效，停止自动同步');
                    this.stopAutoSync();
                    return;
                }

                await this.loadAllSettings();
                this.emit('autoSyncCompleted');
            } catch (error) {
                if (error.message.includes('Extension context invalidated')) {
                    console.warn('[ChromeSettings] 扩展上下文已失效，停止自动同步');
                    this.stopAutoSync();
                    return;
                }
                console.error('[ChromeSettings] 自动同步失败:', error);
            }
        }, this.config.syncInterval);
    }

    /**
     * 停止自动同步
     */
    stopAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }

    /**
     * 从缓存获取数据
     * @param {string} key 键名
     * @returns {any}
     */
    getCached(key) {
        return this.storageCache.get(key);
    }

    /**
     * 获取所有缓存数据
     * @returns {Object}
     */
    getAllCached() {
        const result = {};
        this.storageCache.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }
}

    // 注册到全局模块系统
    if (window.NWSModules) {
        window.NWSModules.ChromeSettingsModule = ChromeSettingsModule;
    }
})();