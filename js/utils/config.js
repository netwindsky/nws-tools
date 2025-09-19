/**
 * config.js - 统一的配置管理模块
 * 用于管理所有功能的开关状态和配置信息
 */

class ConfigManager {
    // 防抖定时器
    static debounceTimers = new Map();
    // 待写入的配置缓存
    static pendingWrites = new Map();
    
    static DEFAULT_CONFIG = {
        // 用户设置
        userData: {
            username: '',
            email: ''
        },
        // 大模型设置
        modelSettings: {
            apiUrl: '',
            apiKey: '',
            model: 'deepseek'
        },
        // 翻译设置
        translationSettings: {
            defaultLanguage: 'zh',
            service: 'local'
        },
        // 内容管理设置
        contentSettings: {
            rules: '',
            autoSaveInterval: 5
        },
        // 快捷键设置
        shortcutSettings: {
            copySelector: 'Alt + C',
            copyStyle: 'Alt + S'
        },
        // 功能开关设置
        toggleSettings: {
            elementHighlighter: true,
            imageDownloader: true,
            translation: false
        }
    };

    static async getConfig(key) {
        try {
            const result = await chrome.storage.sync.get(key);
            return result[key] || this.DEFAULT_CONFIG[key];
        } catch (error) {
            console.error('获取配置失败:', error);
            return this.DEFAULT_CONFIG[key];
        }
    }

    static async setConfig(key, value, immediate = false) {
        if (immediate) {
            // 立即写入
            try {
                await chrome.storage.sync.set({ [key]: value });
                this.notifyConfigChange(key, value);
                return true;
            } catch (error) {
                console.error('保存配置失败:', error);
                return false;
            }
        } else {
            // 防抖写入
            return this.debouncedSetConfig(key, value);
        }
    }

    static debouncedSetConfig(key, value, delay = 1000) {
        return new Promise((resolve) => {
            // 清除之前的定时器
            if (this.debounceTimers.has(key)) {
                clearTimeout(this.debounceTimers.get(key));
            }

            // 缓存待写入的值
            this.pendingWrites.set(key, value);

            // 设置新的定时器
            const timer = setTimeout(async () => {
                try {
                    const pendingValue = this.pendingWrites.get(key);
                    await chrome.storage.sync.set({ [key]: pendingValue });
                    this.notifyConfigChange(key, pendingValue);
                    this.pendingWrites.delete(key);
                    this.debounceTimers.delete(key);
                    resolve(true);
                } catch (error) {
                    console.error('保存配置失败:', error);
                    this.pendingWrites.delete(key);
                    this.debounceTimers.delete(key);
                    resolve(false);
                }
            }, delay);

            this.debounceTimers.set(key, timer);
        });
    }

    // 批量设置配置，避免频率限制
    static async setBatchConfig(configs) {
        try {
            await chrome.storage.sync.set(configs);
            // 通知所有配置更改
            Object.entries(configs).forEach(([key, value]) => {
                this.notifyConfigChange(key, value);
            });
            return true;
        } catch (error) {
            console.error('批量保存配置失败:', error);
            // 如果批量失败，尝试逐个保存（带延迟）
            return await this.setBatchConfigWithDelay(configs);
        }
    }

    static async setBatchConfigWithDelay(configs) {
        const entries = Object.entries(configs);
        let successCount = 0;
        
        for (let i = 0; i < entries.length; i++) {
            const [key, value] = entries[i];
            try {
                await this.setConfig(key, value, true);
                successCount++;
                // 添加延迟避免频率限制
                if (i < entries.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            } catch (error) {
                console.error(`保存配置 ${key} 失败:`, error);
            }
        }
        
        return successCount === entries.length;
    }

    static async getAllConfig() {
        try {
            const result = await chrome.storage.sync.get(null);
            return { ...this.DEFAULT_CONFIG, ...result };
        } catch (error) {
            console.error('获取所有配置失败:', error);
            return this.DEFAULT_CONFIG;
        }
    }

    static notifyConfigChange(key, value) {
        // 通知所有标签页配置已更改
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'configChanged',
                    key: key,
                    value: value
                }).catch(() => {
                    // 忽略不支持消息的标签页
                });
            });
        });
    }

    static async initialize() {
        try {
            const config = await this.getAllConfig();
            
            // 批量准备所有配置更新
            const updates = {
                userData: { ...this.DEFAULT_CONFIG.userData, ...config.userData },
                modelSettings: { ...this.DEFAULT_CONFIG.modelSettings, ...config.modelSettings },
                translationSettings: { ...this.DEFAULT_CONFIG.translationSettings, ...config.translationSettings },
                contentSettings: { ...this.DEFAULT_CONFIG.contentSettings, ...config.contentSettings },
                shortcutSettings: { ...this.DEFAULT_CONFIG.shortcutSettings, ...config.shortcutSettings },
                toggleSettings: { ...this.DEFAULT_CONFIG.toggleSettings, ...config.toggleSettings }
            };

            // 批量写入所有配置，避免频率限制
            await chrome.storage.sync.set(updates);
            
            // 通知配置更改
            Object.entries(updates).forEach(([key, value]) => {
                this.notifyConfigChange(key, value);
            });
            
            console.log('配置初始化完成');
        } catch (error) {
            console.error('配置初始化失败:', error);
            // 如果批量写入失败，尝试逐个写入（带延迟）
            await this.initializeWithDelay();
        }
    }

    static async initializeWithDelay() {
        const config = await this.getAllConfig();
        const configKeys = ['userData', 'modelSettings', 'translationSettings', 'contentSettings', 'shortcutSettings', 'toggleSettings'];
        
        for (let i = 0; i < configKeys.length; i++) {
            const key = configKeys[i];
            const value = { ...this.DEFAULT_CONFIG[key], ...config[key] };
            
            try {
                await this.setConfig(key, value, true); // 立即写入
                // 添加延迟避免频率限制
                if (i < configKeys.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (error) {
                console.error(`初始化配置 ${key} 失败:`, error);
            }
        }
    }
}

// 初始化配置
ConfigManager.initialize();

// 注册配置管理器到全局模块系统
if (window.NWSModules) {
    window.NWSModules.ConfigManager = ConfigManager;
}