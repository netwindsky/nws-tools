/**
 * NotificationModule.js - 通知管理模块
 * 提供统一的通知显示和管理功能
 */

(function() {
    'use strict';
    
    // 从全局模块系统获取ModuleBase
    let ModuleBase;
    if (window.NWSModules) {
        ModuleBase = window.NWSModules.get('ModuleBase');
    }

class NotificationModule extends ModuleBase {
    constructor(name, options = {}) {
        super(name, {
            version: '1.0.0',
            dependencies: [],
            defaultConfig: {
                defaultDuration: 3000,
                maxNotifications: 5,
                position: 'top-right', // top-right, top-left, bottom-right, bottom-left, center
                enableSound: false,
                enableAnimation: true,
                zIndex: 999999
            },
            ...options
        });

        this.notifications = new Map();
        this.notificationQueue = [];
        this.notificationId = 0;
        this.container = null;
    }

    async onInitialize() {
        this.createContainer();
        this.injectStyles();
    }

    async onDestroy() {
        this.clearAllNotifications();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
    }

    /**
     * 显示通知
     * @param {string} message 通知消息
     * @param {Object} options 通知选项
     * @returns {string} 通知ID
     */
    show(message, options = {}) {
        const notificationOptions = {
            type: 'info', // success, error, warning, info
            duration: this.config.defaultDuration,
            closable: true,
            persistent: false,
            icon: null,
            onClick: null,
            onClose: null,
            ...options
        };

        const notificationId = this.generateId();
        
        // 如果超过最大通知数量，移除最旧的通知
        if (this.notifications.size >= this.config.maxNotifications) {
            const oldestId = this.notifications.keys().next().value;
            this.hide(oldestId);
        }

        const notification = this.createNotification(notificationId, message, notificationOptions);
        this.notifications.set(notificationId, notification);
        
        this.container.appendChild(notification.element);
        
        // 触发动画
        if (this.config.enableAnimation) {
            requestAnimationFrame(() => {
                notification.element.classList.add('nws-notification-show');
            });
        }

        // 自动关闭
        if (!notificationOptions.persistent && notificationOptions.duration > 0) {
            notification.timer = setTimeout(() => {
                this.hide(notificationId);
            }, notificationOptions.duration);
        }

        this.emit('notificationShown', { id: notificationId, message, options: notificationOptions });
        
        return notificationId;
    }

    /**
     * 隐藏通知
     * @param {string} notificationId 通知ID
     */
    hide(notificationId) {
        const notification = this.notifications.get(notificationId);
        if (!notification) return;

        // 清除定时器
        if (notification.timer) {
            clearTimeout(notification.timer);
        }

        // 执行关闭回调
        if (notification.options.onClose) {
            notification.options.onClose(notificationId);
        }

        // 移除动画
        if (this.config.enableAnimation) {
            notification.element.classList.add('nws-notification-hide');
            setTimeout(() => {
                this.removeNotification(notificationId);
            }, 300);
        } else {
            this.removeNotification(notificationId);
        }

        this.emit('notificationHidden', { id: notificationId });
    }

    /**
     * 显示成功通知
     * @param {string} message 消息内容
     * @param {Object} options 选项
     * @returns {string} 通知ID
     */
    success(message, options = {}) {
        return this.show(message, { ...options, type: 'success' });
    }

    /**
     * 显示错误通知
     * @param {string} message 消息内容
     * @param {Object} options 选项
     * @returns {string} 通知ID
     */
    error(message, options = {}) {
        return this.show(message, { ...options, type: 'error', duration: 5000 });
    }

    /**
     * 显示警告通知
     * @param {string} message 消息内容
     * @param {Object} options 选项
     * @returns {string} 通知ID
     */
    warning(message, options = {}) {
        return this.show(message, { ...options, type: 'warning' });
    }

    /**
     * 显示信息通知
     * @param {string} message 消息内容
     * @param {Object} options 选项
     * @returns {string} 通知ID
     */
    info(message, options = {}) {
        return this.show(message, { ...options, type: 'info' });
    }

    /**
     * 清除所有通知
     */
    clearAllNotifications() {
        for (const notificationId of this.notifications.keys()) {
            this.hide(notificationId);
        }
    }

    /**
     * 创建通知容器
     */
    createContainer() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.className = 'nws-notification-container';
        this.container.setAttribute('data-position', this.config.position);
        
        document.body.appendChild(this.container);
    }

    /**
     * 创建通知元素
     * @param {string} id 通知ID
     * @param {string} message 消息内容
     * @param {Object} options 选项
     * @returns {Object} 通知对象
     */
    createNotification(id, message, options) {
        const element = document.createElement('div');
        element.className = `nws-notification nws-notification-${options.type}`;
        element.setAttribute('data-id', id);

        // 创建内容
        const content = document.createElement('div');
        content.className = 'nws-notification-content';

        // 图标
        if (options.icon || this.getDefaultIcon(options.type)) {
            const icon = document.createElement('div');
            icon.className = 'nws-notification-icon';
            icon.innerHTML = options.icon || this.getDefaultIcon(options.type);
            content.appendChild(icon);
        }

        // 消息
        const messageElement = document.createElement('div');
        messageElement.className = 'nws-notification-message';
        messageElement.textContent = message;
        content.appendChild(messageElement);

        // 关闭按钮
        if (options.closable) {
            const closeButton = document.createElement('button');
            closeButton.className = 'nws-notification-close';
            closeButton.innerHTML = '×';
            closeButton.onclick = () => this.hide(id);
            content.appendChild(closeButton);
        }

        element.appendChild(content);

        // 点击事件
        if (options.onClick) {
            element.style.cursor = 'pointer';
            element.onclick = () => options.onClick(id);
        }

        return {
            id,
            element,
            options,
            timer: null
        };
    }

    /**
     * 移除通知
     * @param {string} notificationId 通知ID
     */
    removeNotification(notificationId) {
        const notification = this.notifications.get(notificationId);
        if (!notification) return;

        if (notification.element.parentNode) {
            notification.element.parentNode.removeChild(notification.element);
        }

        this.notifications.delete(notificationId);
    }

    /**
     * 获取默认图标
     * @param {string} type 通知类型
     * @returns {string} 图标HTML
     */
    getDefaultIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    /**
     * 生成通知ID
     * @returns {string}
     */
    generateId() {
        return `notification_${++this.notificationId}_${Date.now()}`;
    }

    /**
     * 注入样式
     */
    injectStyles() {
        if (document.getElementById('nws-notification-styles')) return;

        const style = document.createElement('style');
        style.id = 'nws-notification-styles';
        style.textContent = `
            .nws-notification-container {
                position: fixed;
                z-index: ${this.config.zIndex};
                pointer-events: none;
                max-width: 400px;
                min-width: 300px;
            }

            .nws-notification-container[data-position="top-right"] {
                top: 20px;
                right: 20px;
            }

            .nws-notification-container[data-position="top-left"] {
                top: 20px;
                left: 20px;
            }

            .nws-notification-container[data-position="bottom-right"] {
                bottom: 20px;
                right: 20px;
            }

            .nws-notification-container[data-position="bottom-left"] {
                bottom: 20px;
                left: 20px;
            }

            .nws-notification-container[data-position="center"] {
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }

            .nws-notification {
                pointer-events: auto;
                margin-bottom: 10px;
                padding: 12px 16px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                line-height: 1.4;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
            }

            .nws-notification-show {
                opacity: 1 !important;
                transform: translateX(0) !important;
            }

            .nws-notification-hide {
                opacity: 0 !important;
                transform: translateX(100%) !important;
            }

            .nws-notification-success {
                background-color: #f0f9ff;
                border-left: 4px solid #10b981;
                color: #065f46;
            }

            .nws-notification-error {
                background-color: #fef2f2;
                border-left: 4px solid #ef4444;
                color: #991b1b;
            }

            .nws-notification-warning {
                background-color: #fffbeb;
                border-left: 4px solid #f59e0b;
                color: #92400e;
            }

            .nws-notification-info {
                background-color: #eff6ff;
                border-left: 4px solid #3b82f6;
                color: #1e40af;
            }

            .nws-notification-content {
                display: flex;
                align-items: flex-start;
                gap: 8px;
            }

            .nws-notification-icon {
                flex-shrink: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 16px;
            }

            .nws-notification-message {
                flex: 1;
                word-wrap: break-word;
            }

            .nws-notification-close {
                flex-shrink: 0;
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.6;
                transition: opacity 0.2s;
            }

            .nws-notification-close:hover {
                opacity: 1;
            }

            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * 更新配置
     * @param {Object} newConfig 新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        if (this.container) {
            this.container.setAttribute('data-position', this.config.position);
        }
        
        this.emit('configUpdated', this.config);
    }

    /**
     * 获取当前通知数量
     * @returns {number}
     */
    getNotificationCount() {
        return this.notifications.size;
    }

    /**
     * 获取所有通知ID
     * @returns {Array<string>}
     */
    getAllNotificationIds() {
        return Array.from(this.notifications.keys());
    }
}

    // 注册到全局模块系统
    if (window.NWSModules) {
        window.NWSModules.NotificationModule = NotificationModule;
    }
})();