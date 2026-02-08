// 导入配置管理器
// 使用全局对象替代ES6模块导入
const ConfigManager = window.ConfigManager || {
    getConfig: async () => ({}),
    setConfig: async () => false,
    getAllConfig: async () => ({})
};

const { safeQuerySelector, safeQuerySelectorAll } = window.DOMHelper || {
    safeQuerySelector: (selector) => document.querySelector(selector),
    safeQuerySelectorAll: (selector) => document.querySelectorAll(selector)
};

// 保存设置
async function saveSettings(key, value) {
    const success = await ConfigManager.setConfig(key, value);
    if (success) {
        showNotification('设置已保存');
    }
}

// 加载设置
async function loadSettings(key, callback) {
    const value = await ConfigManager.getConfig(key);
    if (value) {
        callback(value);
    }
}

// 显示通知
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 10px 20px;
        background-color: #4CAF50;
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: fadeOut 2s forwards;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        document.body.removeChild(notification);
    }, 2000);
}

// 用户管理设置
document.getElementById('save-user').addEventListener('click', () => {
    const userData = {
        username: document.getElementById('username').value,
        email: document.getElementById('email').value
    };
    saveSettings('userData', userData);
});

// 大模型设置
document.getElementById('save-model').addEventListener('click', () => {
    const modelSettings = {
        apiUrl: document.getElementById('model-api-url').value,
        apiKey: document.getElementById('model-api-key').value,
        model: document.getElementById('model-selection').value
    };
    saveSettings('modelSettings', modelSettings);
});

// 翻译设置
document.getElementById('save-translation').addEventListener('click', () => {
    const translationSettings = {
        defaultLanguage: document.getElementById('default-language').value,
        service: document.getElementById('translation-service').value
    };
    saveSettings('translationSettings', translationSettings);
});

// 内容管理设置
document.getElementById('save-content').addEventListener('click', () => {
    const contentSettings = {
        rules: document.getElementById('content-rules').value,
        autoSaveInterval: document.getElementById('auto-save-interval').value
    };
    saveSettings('contentSettings', contentSettings);
});

// 快捷键设置
document.getElementById('save-shortcuts').addEventListener('click', () => {
    const shortcutSettings = {
        copySelector: document.getElementById('shortcut-copy-selector').value,
        copyStyle: document.getElementById('shortcut-copy-style').value
    };
    saveSettings('shortcutSettings', shortcutSettings);
});

// 功能开关设置
document.getElementById('save-toggles').addEventListener('click', () => {
    const toggleSettings = {
        elementHighlighter: document.getElementById('toggle-element-highlighter').checked,
        imageDownloader: document.getElementById('toggle-image-downloader').checked,
        translation: document.getElementById('toggle-translation').checked,
        elementActions: document.getElementById('toggle-element-actions').checked
    };
    saveSettings('toggleSettings', toggleSettings);
});

// 提交反馈
document.getElementById('submit-feedback').addEventListener('click', () => {
    const feedback = document.getElementById('feedback-content').value;
    if (feedback.trim()) {
        // 这里可以添加发送反馈到服务器的逻辑
        showNotification('感谢您的反馈！');
        document.getElementById('feedback-content').value = '';
    } else {
        showNotification('请输入反馈内容');
    }
});

// 页面加载时加载所有设置
// 初始化标签页切换功能
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化Bootstrap标签页
    const triggerTabList = [].slice.call(safeQuerySelectorAll('.nav-link'));
    triggerTabList.forEach(triggerEl => {
        new bootstrap.Tab(triggerEl);
    });

    // 加载保存的设置
    await loadSavedSettings();
});

// 加载所有保存的设置
async function loadSavedSettings() {
    // 获取所有配置
    const config = await ConfigManager.getAllConfig();

    // 初始化默认配置
    if (!config.toggleSettings) {
        config.toggleSettings = {
            elementHighlighter: true,
            imageDownloader: true,
            translation: true,
            elementActions: true
        };
        await ConfigManager.setConfig('toggleSettings', config.toggleSettings);
    }

    // 加载功能开关设置
    document.getElementById('toggle-element-highlighter').checked = config.toggleSettings.elementHighlighter;
    document.getElementById('toggle-element-actions').checked = config.toggleSettings.elementActions;
    document.getElementById('toggle-image-downloader').checked = config.toggleSettings.imageDownloader;
    document.getElementById('toggle-translation').checked = config.toggleSettings.translation;

    // 加载用户数据
    document.getElementById('username').value = config.userData.username;
    document.getElementById('email').value = config.userData.email;

    // 加载大模型设置
    document.getElementById('model-api-url').value = config.modelSettings.apiUrl;
    document.getElementById('model-api-key').value = config.modelSettings.apiKey;
    document.getElementById('model-selection').value = config.modelSettings.model;

    // 加载翻译设置
    document.getElementById('default-language').value = config.translationSettings.defaultLanguage;
    document.getElementById('translation-service').value = config.translationSettings.service;

    // 加载内容管理设置
    document.getElementById('content-rules').value = config.contentSettings.rules;
    document.getElementById('auto-save-interval').value = config.contentSettings.autoSaveInterval;

    // 加载快捷键设置
    document.getElementById('shortcut-copy-selector').value = config.shortcutSettings.copySelector;
    document.getElementById('shortcut-copy-style').value = config.shortcutSettings.copyStyle;

    // 加载功能开关设置
    document.getElementById('toggle-element-highlighter').checked = config.toggleSettings.elementHighlighter;
    document.getElementById('toggle-element-actions').checked = config.toggleSettings.elementActions;
    document.getElementById('toggle-image-downloader').checked = config.toggleSettings.imageDownloader;
    document.getElementById('toggle-translation').checked = config.toggleSettings.translation;

}

