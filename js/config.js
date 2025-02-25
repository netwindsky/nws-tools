/**
 * config.js - 统一的配置管理模块
 * 用于管理所有功能的开关状态和配置信息
 */

class ConfigManager {
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
            imageDownloader: false,
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

    static async setConfig(key, value) {
        try {
            await chrome.storage.sync.set({ [key]: value });
            // 发送配置更改事件
            this.notifyConfigChange(key, value);
            return true;
        } catch (error) {
            console.error('保存配置失败:', error);
            return false;
        }
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
        const config = await this.getAllConfig();
        // 确保所有默认配置项都存在
        await this.setConfig('userData', { ...this.DEFAULT_CONFIG.userData, ...config.userData });
        await this.setConfig('modelSettings', { ...this.DEFAULT_CONFIG.modelSettings, ...config.modelSettings });
        await this.setConfig('translationSettings', { ...this.DEFAULT_CONFIG.translationSettings, ...config.translationSettings });
        await this.setConfig('contentSettings', { ...this.DEFAULT_CONFIG.contentSettings, ...config.contentSettings });
        await this.setConfig('shortcutSettings', { ...this.DEFAULT_CONFIG.shortcutSettings, ...config.shortcutSettings });
        await this.setConfig('toggleSettings', { ...this.DEFAULT_CONFIG.toggleSettings, ...config.toggleSettings });
    }
}

// 初始化配置
ConfigManager.initialize();

// 导出配置管理器
export default ConfigManager;