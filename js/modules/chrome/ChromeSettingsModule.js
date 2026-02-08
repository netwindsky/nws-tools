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
        this.contextValid = true; // 跟踪上下文状态
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5; // 增加重连次数
        this.reconnectDelay = 1000; // 减少初始延迟到1秒
        this.lastSuccessfulOperation = Date.now(); // 记录最后一次成功操作
        this.gracefulShutdown = false; // 标记是否是优雅关闭
        this.reconnectTimer = null;
        this.recoveryTimer = null;
        this.contextInvalidHandled = false;
    }

    async onInitialize() {
        this.safeLog('log', '开始初始化ChromeSettingsModule');
        
        // 检查Chrome API可用性
        if (typeof chrome === 'undefined') {
            throw new Error('Chrome API 不可用');
        }

        // 检查扩展上下文是否有效
        if (!this.isExtensionContextValid()) {
            this.safeLog('warn', '扩展上下文无效，进入降级模式');
            this.enterDegradedMode();
            return;
        }

        try {
            this.contextValid = true;
            this.contextInvalidHandled = false;
            
            // 初始化存储缓存
            await this.loadAllSettings();
            
            // 设置存储监听器
            this.setupStorageListener();
            
            // 启动自动同步
            if (this.config.autoSync) {
                this.startAutoSync();
            }
            
            this.safeLog('log', 'ChromeSettingsModule初始化完成');
        } catch (error) {
            if (this.isContextInvalidatedError(error)) {
                this.safeLog('warn', '初始化时扩展上下文已失效，进入降级模式');
                this.enterDegradedMode();
                return;
            }
            this.safeLog('error', 'ChromeSettingsModule初始化失败:', error);
            throw error;
        }
    }

    /**
     * 检查扩展上下文是否有效
     */
    isExtensionContextValid() {
        try {
            // 基础检查：chrome API是否存在
            if (typeof chrome === 'undefined' || !chrome || !chrome.runtime) {
                return false;
            }
            
            // 检查runtime.id是否存在且不为undefined
            if (!chrome.runtime.id) {
                return false;
            }
            
            // 检查关键 API是否可用
            if (!chrome.storage || !chrome.storage.sync || !chrome.storage.local) {
                return false;
            }
            
            // 尝试一个简单的API调用来验证上下文
            try {
                // 这是一个轻量级的测试调用
                chrome.runtime.getManifest();
            } catch (e) {
                // 如果连manifest都无法获取，说明上下文严重损坏
                return false;
            }
            
            return true;
        } catch (error) {
            // 捕获任何访问chrome API时的异常
            this.safeLog('debug', '扩展上下文检查异常:', error.message);
            return false;
        }
    }

    /**
     * 安全的Chrome API调用封装
     * @param {Function} apiCall API调用函数
     * @param {*} fallbackValue 失败时的默认返回值
     * @returns {Promise<*>}
     */
    async safeApiCall(apiCall, fallbackValue = null) {
        try {
            // 在调用API前检查上下文
            if (!this.isExtensionContextValid()) {
                this.safeLog('warn', '扩展上下文无效，返回默认值');
                return fallbackValue;
            }
            
            const result = await apiCall();
            
            // 更新成功操作时间
            this.lastSuccessfulOperation = Date.now();
            
            return result;
        } catch (error) {
            if (this.isContextInvalidatedError(error)) {
                this.safeLog('warn', '扩展上下文已失效，返回默认值');
                return fallbackValue;
            }
            throw error; // 重新抛出非上下文相关的错误
        }
    }
    
    /**
     * 检查是否为上下文失效错误
     * @param {Error} error 错误对象
     * @returns {boolean}
     */
    isContextInvalidatedError(error) {
        if (!error) {
            return false;
        }
        
        const errorMessage = error.message || error.toString() || '';
        const contextErrorMessages = [
            'Extension context invalidated',
            'The extension context is invalid', 
            'Cannot access a chrome extension context',
            'chrome.runtime is undefined',
            'chrome is not defined',
            'Cannot access chrome',
            'Receiving end does not exist',
            'Message port closed before a response was received',
            'Could not establish connection',
            'Chrome extension context is invalid',
            'Extension context no longer valid',
            'Invalid extension context',
            'Extension has been unloaded',
            'Extension context has been invalidated',
            'Cannot access a chrome extension api',
            'chrome-extension:// protocol access denied'
        ];
        
        return contextErrorMessages.some(msg => 
            errorMessage.toLowerCase().includes(msg.toLowerCase())
        );
    }

    async onDestroy() {
        this.safeLog('log', '开始销毁ChromeSettingsModule');
        
        // 标记为优雅关闭，阻止重连尝试
        this.gracefulShutdown = true;
        
        // 停止自动同步
        this.stopAutoSync();
        this.stopRecoveryCheck();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        // 清空缓存
        this.storageCache.clear();
        
        this.safeLog('log', 'ChromeSettingsModule销毁完成');
    }

    /**
     * 获取存储数据
     * @param {string|Array|Object} keys 要获取的键
     * @param {string} area 存储区域 'sync' | 'local' | 'managed'
     * @returns {Promise<Object>}
     */
    async getStorage(keys, area = 'sync') {
        return await this.safeApiCall(async () => {
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
        }, {});
    }

    /**
     * 设置存储数据
     * @param {Object} items 要设置的数据
     * @param {string} area 存储区域
     * @returns {Promise<boolean>}
     */
    async setStorage(items, area = 'sync') {
        return await this.safeApiCall(async () => {
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
        }, false);
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
            // 在content script中，需要通过消息传递与background script通信
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'download',
                    options: downloadOptions
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('[ChromeSettings] 消息发送失败:', chrome.runtime.lastError);
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    
                    if (response && response.success) {
                        resolve(response.downloadId);
                    } else {
                        const error = new Error(response ? response.error : '下载请求失败');
                        console.error('[ChromeSettings] 下载文件失败:', error);
                        reject(error);
                    }
                });
            });
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
                this.safeLog('warn', '扩展上下文无效，无法加载设置');
                return;
            }

            await this.safeApiCall(async () => {
                const syncData = await chrome.storage.sync.get(null);
                Object.entries(syncData).forEach(([key, value]) => {
                    this.storageCache.set(key, value);
                });
                
                this.safeLog('debug', `加载了 ${Object.keys(syncData).length} 个设置到缓存`);
                
                // 更新最后成功操作时间
                this.lastSuccessfulOperation = Date.now();
            });
        } catch (error) {
            this.safeLog('error', '加载设置到缓存失败:', error);
            
            // 如果是上下文失效错误，进入降级模式
            if (this.isContextInvalidatedError(error)) {
                this.contextValid = false;
                this.attemptReconnect();
            }
            
            throw error;
        }
    }

    /**
     * 设置存储监听器
     */
    setupStorageListener() {
        try {
            // 检查扩展上下文是否有效
            if (!this.isExtensionContextValid()) {
                this.safeLog('warn', '扩展上下文无效，无法设置存储监听器');
                return;
            }
            
            // 使用安全的API调用
            this.safeApiCall(() => {
                if (chrome.storage && chrome.storage.onChanged) {
                    chrome.storage.onChanged.addListener((changes, namespace) => {
                        try {
                            // 更新缓存
                            Object.entries(changes).forEach(([key, change]) => {
                                if (change.newValue !== undefined) {
                                    this.storageCache.set(key, change.newValue);
                                } else {
                                    this.storageCache.delete(key);
                                }
                            });

                            this.emit('storageChanged', { changes, namespace });
                        } catch (error) {
                            this.safeLog('error', '处理存储变化事件失败:', error);
                        }
                    });
                    
                    this.safeLog('log', '存储监听器设置成功');
                } else {
                    this.safeLog('warn', 'chrome.storage.onChanged 不可用');
                }
            }).catch(error => {
                this.safeLog('error', '设置存储监听器失败:', error);
            });
        } catch (error) {
            this.safeLog('error', '设置存储监听器异常:', error);
        }
    }

    /**
     * 启动自动同步
     */
    startAutoSync() {
        if (!this.isExtensionContextValid()) {
            this.handleContextInvalidation('扩展上下文无效，跳过启动自动同步');
            return;
        }

        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }

        this.syncTimer = setInterval(async () => {
            // 在每次同步前检查上下文是否仍然有效
            if (!this.isExtensionContextValid()) {
                this.handleContextInvalidation('扩展上下文已失效，停止自动同步');
                return;
            }

            this.contextValid = true;
            this.contextInvalidHandled = false;
            this.reconnectAttempts = 0; // 重置重连计数器
            
            try {
                await this.loadAllSettings();
                this.emit('autoSyncCompleted');
            } catch (error) {
                if (this.isContextInvalidatedError(error)) {
                    this.handleContextInvalidation('扩展上下文已失效，停止自动同步');
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

    handleContextInvalidation(message) {
        if (this.gracefulShutdown) return;
        if (this.contextInvalidHandled) return;
        this.contextInvalidHandled = true;
        this.contextValid = false;
        this.stopAutoSync();
        this.safeLog('warn', message);
        this.attemptReconnect();
    }

    /**
     * 尝试重新连接扩展上下文
     */
    attemptReconnect() {
        // 如果是优雅关闭，不再尝试重连
        if (this.gracefulShutdown) {
            this.safeLog('info', '模块已优雅关闭，不再尝试重连');
            return;
        }
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.safeLog('warn', `超过最大重连次数 (${this.maxReconnectAttempts})，进入降级模式`);
            this.enterDegradedMode();
            return;
        }

        this.reconnectAttempts++;
        this.safeLog('log', `尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        // 使用指数退辰，但有最大限制
        const delay = Math.min(
            this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1),
            10000 // 最大延迟10秒
        );

        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.gracefulShutdown) {
                return; // 如果在等待期间被关闭，直接返回
            }
            
            if (this.isExtensionContextValid()) {
                this.safeLog('log', '重连成功，恢复正常操作');
                this.contextValid = true;
                this.reconnectAttempts = 0;
                this.contextInvalidHandled = false;
                this.lastSuccessfulOperation = Date.now();
                this.emit('contextRestored'); // 通知其他模块上下文已恢复
                
                // 重新启动自动同步
                if (this.config.autoSync && !this.syncTimer) {
                    this.startAutoSync();
                }
                
                // 尝试重新加载设置
                this.loadAllSettings().catch(error => {
                    this.safeLog('warn', '重连后加载设置失败:', error.message);
                });
                this.stopRecoveryCheck();
            } else {
                this.attemptReconnect(); // 继续尝试
            }
        }, delay);
    }
    
    /**
     * 进入降级模式（只使用缓存）
     */
    enterDegradedMode() {
        this.contextValid = false;
        this.stopAutoSync();
        this.emit('contextLost'); // 通知其他模块上下文已失效
        
        this.safeLog('warn', '进入降级模式，仅使用本地缓存');
        
        // 在降级模式下，定期检查是否可以恢复
        this.startRecoveryCheck();
    }
    
    /**
     * 开始恢复检查（在降级模式下使用）
     */
    startRecoveryCheck() {
        // 每30秒检查一次是否可以恢复
        if (this.recoveryTimer) return;
        this.recoveryTimer = setInterval(() => {
            if (this.gracefulShutdown) {
                this.stopRecoveryCheck();
                return;
            }
            
            if (this.isExtensionContextValid()) {
                this.stopRecoveryCheck();
                this.safeLog('log', '检测到扩展上下文恢复，退出降级模式');
                
                // 重置状态
                this.contextValid = true;
                this.reconnectAttempts = 0;
                this.contextInvalidHandled = false;
                this.lastSuccessfulOperation = Date.now();
                
                // 重新启动服务
                if (this.config.autoSync) {
                    this.startAutoSync();
                }
                
                this.emit('contextRestored');
            }
        }, 30000); // 30秒检查一次
    }

    stopRecoveryCheck() {
        if (this.recoveryTimer) {
            clearInterval(this.recoveryTimer);
            this.recoveryTimer = null;
        }
    }

    /**
     * 获取上下文状态
     * @returns {boolean}
     */
    isContextValid() {
        return this.contextValid && this.isExtensionContextValid();
    }

    /**
     * 安全的日志输出函数
     * @param {string} level 日志级别
     * @param {string} message 日志消息
     * @param {...any} args 额外参数
     */
    safeLog(level, message, ...args) {
        try {
            if (console && console[level]) {
                console[level](`[ChromeSettings] ${message}`, ...args);
            }
        } catch (error) {
            // 忽略日志输出错误
        }
    }

    /**
     * 获取模块状态信息
     * @returns {Object}
     */
    getStatus() {
        return {
            contextValid: this.contextValid,
            extensionContextValid: this.isExtensionContextValid(),
            cacheSize: this.storageCache.size,
            autoSyncEnabled: !!this.syncTimer,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            lastSuccessfulOperation: new Date(this.lastSuccessfulOperation).toLocaleString(),
            gracefulShutdown: this.gracefulShutdown,
            timeSinceLastSuccess: Date.now() - this.lastSuccessfulOperation
        };
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
