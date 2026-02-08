/**
 * SidebarModule.js - 侧边栏模块
 * 实现类似Kimi插件的右侧侧边栏功能
 */

(function() {
    'use strict';
    
    // 从全局模块系统获取ModuleBase
    let ModuleBase;
    if (window.NWSModules) {
        ModuleBase = window.NWSModules.get('ModuleBase');
    }

class SidebarModule extends ModuleBase {
    constructor(name, options = {}) {
        super(name, {
            version: '1.0.0',
            dependencies: ['ChromeSettingsModule'],
            defaultConfig: {
                enabled: true,
                width: 400,
                minWidth: 300,
                maxWidth: 600,
                position: 'right',
                zIndex: 999999,
                autoShow: false,
                animation: true,
                resizable: true
            },
            ...options
        });

        this.sidebar = null;
        this.isVisible = false;
        this.isExpanded = false;
        this.dragData = null;
        this.originalBodyPadding = null;
        this.view = null;
        this.expandedWidth = 800; // 展开时的宽度
    }

    async onInitialize() {
        // 使用安全的日志输出，避免 this.log 不存在的错误
        this.safeLog('log', '开始初始化SidebarModule');
        
        // 确保配置对象存在
        if (!this.config) {
            this.config = {};
        }
        
        // 合并默认配置
        this.config = { ...this.defaultConfig, ...this.config };
        
        // 验证和修复配置
        this.validateAndFixConfig();
        
        // 等待 SidebarView 加载
        await this.waitForSidebarView();
        
        // 创建侧边栏
        await this.createSidebar();
        
        // 注入样式
        this.injectStyles();
        
        // 设置事件监听器
        this.setupEventListeners();
        
        // 监听配置变化
        this.setupConfigListener();
        
        this.safeLog('log', 'SidebarModule初始化完成');
    }
    
    /**
     * 验证和修复配置
     */
    validateAndFixConfig() {
        // 确保配置对象存在
        if (!this.config) {
            this.config = {};
        }
        
        // 验证宽度配置
        if (this.config.width === undefined || isNaN(this.config.width) || this.config.width <= 0) {
            this.safeLog('warn', '配置中的width无效:', this.config.width, '重置为默认值: 400');
            this.config.width = 400;
        }
        
        if (this.config.minWidth === undefined || isNaN(this.config.minWidth) || this.config.minWidth <= 0) {
            this.safeLog('warn', '配置中的minWidth无效:', this.config.minWidth, '重置为默认值: 300');
            this.config.minWidth = 300;
        }
        
        if (this.config.maxWidth === undefined || isNaN(this.config.maxWidth) || this.config.maxWidth <= 0) {
            this.safeLog('warn', '配置中的maxWidth无效:', this.config.maxWidth, '重置为默认值: 600');
            this.config.maxWidth = 600;
        }
        
        // 确保宽度在合理范围内
        if (this.config.width < this.config.minWidth) {
            this.config.width = this.config.minWidth;
        } else if (this.config.width > this.config.maxWidth) {
            this.config.width = this.config.maxWidth;
        }
        
        this.safeLog('log', '配置验证完成 - 宽度:', this.config.width, '范围:', this.config.minWidth, '-', this.config.maxWidth);
    }

    /**
     * 等待 SidebarView 加载
     */
    async waitForSidebarView() {
        return new Promise((resolve) => {
            const checkView = () => {
                if (window.SidebarView) {
                    resolve();
                } else {
                    setTimeout(checkView, 100);
                }
            };
            checkView();
        });
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
                console[level](`[SidebarModule] ${message}`, ...args);
            }
        } catch (error) {
            // 忽略日志输出错误
        }
    }

    /**
     * 安全的事件发送函数
     * @param {string} eventName 事件名称
     * @param {...any} args 事件参数
     */
    safeEmit(eventName, ...args) {
        try {
            // 如果有 emit 方法，就使用它
            if (typeof this.emit === 'function') {
                this.emit(eventName, ...args);
            } else {
                // 否则使用自定义事件
                const event = new CustomEvent(`nws-${eventName}`, {
                    detail: args
                });
                document.dispatchEvent(event);
            }
        } catch (error) {
            this.safeLog('warn', '发送事件失败:', eventName, error);
        }
    }

    /**
     * 创建侧边栏
     */
    async createSidebar() {
        // 检查是否已存在
        if (this.sidebar) {
            this.sidebar.remove();
        }

        this.safeLog('log', '开始创建侧边栏DOM元素');

        // 创建主容器
        this.sidebar = document.createElement('div');
        this.sidebar.id = 'nws-sidebar';
        this.sidebar.className = 'nws-sidebar';
        
        // 强制设置初始动态样式
        this.sidebar.style.right = '-400px';
        this.sidebar.style.width = '400px';
        
        // 添加强制隐藏类和数据属性
        this.sidebar.classList.add('nws-force-hide');
        this.sidebar.setAttribute('data-force-visible', 'false');
        
        // 创建视图实例
        this.view = new window.SidebarView(this);
        
        // 创建各部分内容（异步）
        const resizeHandle = this.view.createResizeHandle();
        const header = this.view.createHeader();
        const content = await this.view.createContent(); // 等待异步创建
        const footer = this.view.createFooter();
        
        // 组装侧边栏
        this.sidebar.appendChild(resizeHandle);
        this.sidebar.appendChild(header);
        this.sidebar.appendChild(content);
        this.sidebar.appendChild(footer);
        
        // 设置初始样式
        this.updateSidebarStyles();
        
        // 添加到页面
        document.body.appendChild(this.sidebar);
        
        this.safeLog('log', '侧边栏DOM元素已创建并添加到页面');
        this.safeLog('log', '侧边栏初始位置:', this.sidebar.style.right, '宽度:', this.sidebar.style.width);
    }

    /**
     * 注入样式
     */
    injectStyles() {
        if (document.getElementById('nws-sidebar-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'nws-sidebar-styles';
        styles.textContent = `
            .nws-sidebar {
                all: initial !important; /* 彻底隔离原网页样式 */
                position: fixed !important;
                top: 0 !important;
                right: -400px !important;
                width: 400px !important;
                height: 100vh !important;
                background: #ffffff !important;
                border-left: 1px solid #e1e5e9 !important;
                box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1) !important;
                z-index: 999999 !important;
                display: flex !important;
                flex-direction: column !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
                transition: right 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1) !important;
                box-sizing: border-box !important;
                max-width: none !important;
                overflow: hidden !important;
            }

            .nws-sidebar * {
                box-sizing: border-box !important;
            }

            .nws-sidebar.visible {
                right: 0 !important;
            }
            
            /* 强制覆盖显示状态 */
            .nws-sidebar.nws-force-show {
                right: 0px !important;
                transform: translateX(0) !important;
            }
            
            /* 强制覆盖隐藏状态 */
            .nws-sidebar.nws-force-hide {
                right: -400px !important;
                transform: translateX(0) !important;
            }
            
            /* 动态调整宽度时使用的类 */
            .nws-sidebar.nws-custom-width {
                /* 宽度将通过 JavaScript 设置 */
            }
            
            /* 最高优先级的强制显示样式 */
            .nws-sidebar[data-force-visible="true"] {
                right: 0px !important;
                visibility: visible !important;
                display: flex !important;
            }
            
            /* 最高优先级的强制隐藏样式 */
            .nws-sidebar[data-force-visible="false"] {
                right: -400px !important;
            }
            
            /* 展开状态样式 */
            .nws-sidebar.expanded {
                width: 800px !important;
                max-width: 80vw !important;
            }
            
            .nws-sidebar.expanded.nws-force-show {
                right: 0px !important;
            }
            
            .nws-sidebar.expanded.nws-force-hide {
                right: -800px !important;
            }

            ${this.view ? this.view.getStyles() : ''}

            .nws-sidebar-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid #e1e5e9;
                background: #f8f9fa;
                min-height: 60px;
            }

            .nws-sidebar-title {
                display: flex;
                align-items: center;
                font-size: 16px;
                font-weight: 600;
                color: #2c3e50;
            }

            .nws-sidebar-icon {
                width: 20px;
                height: 20px;
                margin-right: 8px;
            }

            .nws-sidebar-controls {
                display: flex;
                gap: 8px;
            }

            .nws-sidebar-btn {
                width: 28px;
                height: 28px;
                border: none;
                background: transparent;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #6c757d;
                transition: all 0.2s ease;
            }

            .nws-sidebar-btn:hover {
                background: #e9ecef;
                color: #495057;
            }

            .nws-sidebar-btn svg {
                fill: currentColor;
            }

            .nws-sidebar-content {
                flex: 1;
                padding: 20px;
                overflow-y: auto;
                background: #ffffff;
            }

            .nws-sidebar-welcome h3 {
                margin: 0 0 8px 0;
                font-size: 20px;
                font-weight: 600;
                color: #2c3e50;
            }

            .nws-sidebar-welcome p {
                margin: 0 0 24px 0;
                color: #6c757d;
                line-height: 1.5;
            }

            .nws-sidebar-features {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .nws-feature-item {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 16px;
                background: #f8f9fa;
                border-radius: 8px;
                transition: all 0.2s ease;
            }

            .nws-feature-item:hover {
                background: #e9ecef;
            }

            .nws-feature-icon {
                font-size: 24px;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #ffffff;
                border-radius: 8px;
                flex-shrink: 0;
            }

            .nws-feature-text h4 {
                margin: 0 0 4px 0;
                font-size: 14px;
                font-weight: 600;
                color: #2c3e50;
            }

            .nws-feature-text p {
                margin: 0;
                font-size: 12px;
                color: #6c757d;
                line-height: 1.4;
            }

            .nws-sidebar-footer {
                padding: 16px 20px;
                border-top: 1px solid #e1e5e9;
                background: #f8f9fa;
            }

            .nws-sidebar-actions {
                display: flex;
                gap: 8px;
            }

            .nws-btn {
                flex: 1;
                padding: 8px 16px;
                border: 1px solid transparent;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s ease;
                text-decoration: none;
                display: inline-block;
            }

            .nws-btn-primary {
                background: #007bff;
                color: #ffffff;
                border-color: #007bff;
            }

            .nws-btn-primary:hover {
                background: #0056b3;
                border-color: #0056b3;
            }

            .nws-btn-secondary {
                background: #ffffff;
                color: #6c757d;
                border-color: #dee2e6;
            }

            .nws-btn-secondary:hover {
                background: #e9ecef;
                color: #495057;
            }

            /* 当侧边栏显示时，调整页面布局 */
            body.nws-sidebar-open {
                padding-right: 400px;
                transition: padding-right 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
            }
            
            body.nws-sidebar-open.nws-sidebar-expanded {
                padding-right: 800px;
            }

            /* 响应式设计 */
            @media (max-width: 768px) {
                .nws-sidebar {
                    width: 100vw;
                    right: -100vw;
                }
                
                .nws-sidebar.visible {
                    right: 0;
                }
                
                .nws-sidebar.expanded {
                    width: 100vw;
                }
                
                body.nws-sidebar-open,
                body.nws-sidebar-open.nws-sidebar-expanded {
                    padding-right: 0;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 头部控制按钮事件代理
        this.sidebar.addEventListener('click', (e) => {
            const button = e.target.closest('[data-action]');
            if (!button) return;
            
            const action = button.getAttribute('data-action');
            switch (action) {
                case 'close':
                    this.hide();
                    break;
                case 'minimize':
                    this.minimize();
                    break;
                case 'expand':
                    this.toggleExpanded();
                    break;
            }
        });

        // 设置按钮
        const settingsBtn = this.sidebar.querySelector('#nws-open-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettings());
        }

        // 功能面板按钮
        const featuresBtn = this.sidebar.querySelector('#nws-toggle-features');
        if (featuresBtn) {
            featuresBtn.addEventListener('click', () => this.toggleFeatures());
        }

        // 拖拽调整宽度
        this.setupResizeHandling();

        // 快捷键支持
        this.setupKeyboardShortcuts();
    }

    /**
     * 设置拖拽调整宽度功能
     */
    setupResizeHandling() {
        const resizeHandle = this.sidebar.querySelector('.nws-sidebar-resize-handle');
        
        resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            
            this.dragData = {
                startX: e.clientX,
                startWidth: this.sidebar.offsetWidth,
                isResizing: true
            };
            
            document.addEventListener('mousemove', this.handleResize.bind(this));
            document.addEventListener('mouseup', this.stopResize.bind(this));
            
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        });
    }

    /**
     * 处理拖拽调整宽度
     */
    handleResize(e) {
        if (!this.dragData || !this.dragData.isResizing) return;
        
        const deltaX = this.dragData.startX - e.clientX;
        const newWidth = Math.max(
            this.config.minWidth,
            Math.min(this.config.maxWidth, this.dragData.startWidth + deltaX)
        );
        
        this.config.width = newWidth;
        this.updateSidebarStyles();
        
        // 更新body的padding
        if (this.isVisible) {
            document.body.style.paddingRight = `${newWidth}px`;
        }
    }

    /**
     * 停止拖拽调整
     */
    stopResize() {
        if (this.dragData) {
            this.dragData.isResizing = false;
            this.dragData = null;
        }
        
        document.removeEventListener('mousemove', this.handleResize.bind(this));
        document.removeEventListener('mouseup', this.stopResize.bind(this));
        
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        // 保存宽度设置
        this.saveConfig();
    }

    /**
     * 设置键盘快捷键
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Alt + S 切换侧边栏
            if (e.altKey && e.key === 's') {
                e.preventDefault();
                this.toggle();
            }
            
            // ESC 关闭侧边栏
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    /**
     * 获取有效的配置宽度
     * @returns {number} 有效的宽度值
     */
    getValidWidth() {
        let width = this.config.width;
        
        // 检查是否为有效数字
        if (isNaN(width) || width <= 0) {
            this.safeLog('warn', '配置宽度无效:', width, '使用默认宽度: 400');
            width = 400;
            this.config.width = width; // 修复配置
        }
        
        // 确保在最小和最大值范围内
        const minWidth = this.config.minWidth || 300;
        const maxWidth = this.config.maxWidth || 600;
        
        if (width < minWidth) {
            width = minWidth;
            this.config.width = width;
        } else if (width > maxWidth) {
            width = maxWidth;
            this.config.width = width;
        }
        
        return width;
    }
    
    /**
     * 更新侧边栏样式
     */
    updateSidebarStyles() {
        if (!this.sidebar) return;
        
        // 获取有效宽度
        const validWidth = this.getValidWidth();
        
        // 设置宽度
        this.sidebar.style.setProperty('width', `${validWidth}px`, 'important');
        
        // 根据可见性设置位置
        const rightPosition = this.isVisible ? '0px' : `-${validWidth}px`;
        
        // 强制设置位置，确保样式生效
        this.sidebar.style.setProperty('right', rightPosition, 'important');
        
        // 更新强制隐藏/显示类的样式
        if (this.isVisible) {
            this.sidebar.classList.remove('nws-force-hide');
            this.sidebar.classList.add('nws-force-show');
        } else {
            this.sidebar.classList.remove('nws-force-show');
            this.sidebar.classList.add('nws-force-hide');
        }
        
        this.safeLog('log', '更新侧边栏样式 - 宽度:', validWidth, '位置:', rightPosition, '可见:', this.isVisible);
    }

    /**
     * 显示侧边栏
     */
    show() {
        if (this.isVisible) return;
        
        // 检查侧边栏 DOM 元素是否存在
        if (!this.sidebar) {
            this.safeLog('error', '侧边栏 DOM 元素不存在，无法显示');
            return;
        }
        
        this.safeLog('log', '正在显示侧边栏...');
        
        this.isVisible = true;
        
        // 使用多种方式确保侧边栏可见
        this.sidebar.classList.add('visible');
        this.sidebar.classList.add('nws-force-show');
        this.sidebar.classList.remove('nws-force-hide');
        this.sidebar.setAttribute('data-force-visible', 'true');
        
        // 强制设置位置确保可见，移除transition避免动画干扰
        this.sidebar.style.transition = 'none';
        this.sidebar.style.setProperty('right', '0px', 'important');
        this.sidebar.style.setProperty('display', 'flex', 'important');
        this.sidebar.style.setProperty('transform', 'translateX(0)', 'important');
        this.sidebar.style.setProperty('visibility', 'visible', 'important');
        
        // 恢复transition
        setTimeout(() => {
            if (this.sidebar) {
                this.sidebar.style.transition = 'right 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
            }
        }, 50);
        
        // 更新样式
        this.updateSidebarStyles();
        
        // 检查 document.body 是否存在
        if (document.body) {
            document.body.classList.add('nws-sidebar-open');
            
            // 调整页面布局
            this.originalBodyPadding = document.body.style.paddingRight;
            const validWidth = this.getValidWidth();
            document.body.style.paddingRight = `${validWidth}px`;
        }
        
        // 安全发送事件
        this.safeEmit('sidebar:show');
        this.safeLog('log', '侧边栏已显示，当前位置:', this.sidebar.style.right);
        
        // 调试信息：输出侧边栏的实际样式
        setTimeout(() => {
            const computedStyle = window.getComputedStyle(this.sidebar);
            this.safeLog('log', '侧边栏计算样式 - right:', computedStyle.right, 'display:', computedStyle.display, 'zIndex:', computedStyle.zIndex);
        }, 100);
    }

    /**
     * 隐藏侧边栏
     */
    hide() {
        if (!this.isVisible) return;
        
        // 检查侧边栏 DOM 元素是否存在
        if (!this.sidebar) {
            this.safeLog('error', '侧边栏 DOM 元素不存在，无法隐藏');
            return;
        }
        
        this.safeLog('log', '正在隐藏侧边栏...');
        
        this.isVisible = false;
        
        // 使用多种方式确保侧边栏隐藏
        this.sidebar.classList.remove('visible');
        this.sidebar.classList.remove('nws-force-show');
        this.sidebar.classList.add('nws-force-hide');
        this.sidebar.setAttribute('data-force-visible', 'false');
        
        // 强制设置位置确保隐藏，移除transition避免动画干扰
        this.sidebar.style.transition = 'none';
        const validWidth = this.getValidWidth();
        this.sidebar.style.setProperty('right', `-${validWidth}px`, 'important');
        this.sidebar.style.setProperty('transform', 'translateX(0)', 'important');
        
        // 恢复transition
        setTimeout(() => {
            if (this.sidebar) {
                this.sidebar.style.transition = 'right 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
            }
        }, 50);
        
        // 更新样式
        this.updateSidebarStyles();
        
        // 检查 document.body 是否存在
        if (document.body) {
            document.body.classList.remove('nws-sidebar-open');
            
            // 恢复页面布局
            document.body.style.paddingRight = this.originalBodyPadding || '';
        }
        
        // 安全发送事件
        this.safeEmit('sidebar:hide');
        this.safeLog('log', '侧边栏已隐藏，当前位置:', this.sidebar.style.right);
    }

    /**
     * 切换侧边栏显示状态
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * 切换侧边栏展开状态
     */
    toggleExpanded() {
        this.isExpanded = !this.isExpanded;
        
        if (this.isExpanded) {
            this.expand();
        } else {
            this.collapse();
        }
    }

    /**
     * 展开侧边栏
     */
    expand() {
        if (!this.sidebar) return;
        
        this.isExpanded = true;
        this.sidebar.classList.add('expanded');
        
        // 设置展开宽度
        const expandedWidth = Math.min(this.expandedWidth, window.innerWidth * 0.8);
        this.sidebar.style.setProperty('width', expandedWidth + 'px', 'important');
        
        // 更新body的padding
        if (this.isVisible && document.body) {
            document.body.classList.add('nws-sidebar-expanded');
            document.body.style.paddingRight = expandedWidth + 'px';
        }
        
        this.safeLog('log', '侧边栏已展开到宽度:', expandedWidth);
    }

    /**
     * 收缩侧边栏
     */
    collapse() {
        if (!this.sidebar) return;
        
        this.isExpanded = false;
        this.sidebar.classList.remove('expanded');
        
        // 恢复默认宽度
        const validWidth = this.getValidWidth();
        this.sidebar.style.setProperty('width', validWidth + 'px', 'important');
        
        // 更新body的padding
        if (this.isVisible && document.body) {
            document.body.classList.remove('nws-sidebar-expanded');
            document.body.style.paddingRight = validWidth + 'px';
        }
        
        this.safeLog('log', '侧边栏已收缩到宽度:', validWidth);
    }

    /**
     * 设置侧边栏宽度
     */
    setWidth(width) {
        // 验证和修正宽度值
        let newWidth = parseInt(width);
        if (isNaN(newWidth) || newWidth <= 0) {
            this.safeLog('warn', '设置的宽度无效:', width, '使用当前宽度');
            return;
        }
        
        const minWidth = this.config.minWidth || 300;
        const maxWidth = this.config.maxWidth || 600;
        newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        this.config.width = newWidth;
        
        if (!this.isExpanded && this.sidebar) {
            this.sidebar.style.setProperty('width', newWidth + 'px', 'important');
            
            // 更新隐藏位置
            if (!this.isVisible) {
                this.sidebar.style.setProperty('right', '-' + newWidth + 'px', 'important');
            }
            
            // 更新body padding
            if (this.isVisible && document.body) {
                document.body.style.paddingRight = newWidth + 'px';
            }
        }
        
        // 更新视图状态
        if (this.view && this.view.updateStatus) {
            this.view.updateStatus();
        }
        
        this.saveConfig();
        this.safeLog('log', '侧边栏宽度已设置为:', newWidth);
    }

    /**
     * 最小化侧边栏（临时隐藏）
     */
    minimize() {
        this.hide();
        this.showToggleButton();
    }

    /**
     * 显示切换按钮
     */
    showToggleButton() {
        let toggleBtn = document.getElementById('nws-sidebar-toggle');
        
        if (!toggleBtn) {
            toggleBtn = document.createElement('div');
            toggleBtn.id = 'nws-sidebar-toggle';
            toggleBtn.innerHTML = '<span style="font-size: 20px;">☰</span>';
            toggleBtn.style.cssText = 'position: fixed; top: 50%; right: 10px; width: 40px; height: 40px; background: #007bff; color: white; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); z-index: 999998; transition: all 0.2s ease; transform: translateY(-50%);';
            
            toggleBtn.addEventListener('click', () => {
                this.show();
                toggleBtn.remove();
            });
            
            document.body.appendChild(toggleBtn);
        }
    }

    /**
     * 打开设置页面
     */
    openSettings() {
        try {
            chrome.runtime.openOptionsPage();
        } catch (error) {
            this.safeLog('warn', '无法打开设置页面:', error);
        }
    }

    /**
     * 设置内容
     */
    setContent(content) {
        if (this.view) {
            this.view.setContent(content);
        }
    }

    /**
     * 添加内容
     */
    addContent(content, append = false) {
        if (this.view) {
            this.view.addContent(content, append);
        }
    }

    /**
     * 监听配置变化
     */
    setupConfigListener() {
        // 监听存储变化
        if (chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (changes.sidebarConfig) {
                    this.config = { ...this.config, ...changes.sidebarConfig.newValue };
                    this.updateSidebarStyles();
                }
            });
        }
    }

    /**
     * 保存配置
     */
    async saveConfig() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                await chrome.storage.sync.set({ sidebarConfig: this.config });
            }
        } catch (error) {
            this.safeLog('warn', '保存配置失败:', error);
        }
    }

    /**
     * 销毁侧边栏
     */
    async onDestroy() {
        try {
            this.hide();
            
            if (this.sidebar && this.sidebar.parentNode) {
                this.sidebar.parentNode.removeChild(this.sidebar);
            }
            
            const styles = document.getElementById('nws-sidebar-styles');
            if (styles && styles.parentNode) {
                styles.parentNode.removeChild(styles);
            }
            
            const toggleBtn = document.getElementById('nws-sidebar-toggle');
            if (toggleBtn && toggleBtn.parentNode) {
                toggleBtn.parentNode.removeChild(toggleBtn);
            }
            
            this.safeLog('log', 'SidebarModule已销毁');
        } catch (error) {
            this.safeLog('error', '销毁SidebarModule时出错:', error);
        }
    }

    // API方法
    isOpen() {
        return this.isVisible;
    }

    getWidth() {
        return this.getValidWidth();
    }
    
    // 添加静态方法以便更容易获取类构造函数
    static getClass() {
        return SidebarModule;
    }
}

    // 注册到全局模块系统
    if (typeof window.NWSModules !== 'undefined') {
        window.NWSModules.SidebarModule = SidebarModule;
        // 添加一个获取类的方法
        window.NWSModules.SidebarModuleClass = SidebarModule;
        // 如果有模块管理器，注册模块
        if (window.NWSModules.register && typeof window.NWSModules.register === 'function') {
            window.NWSModules.register('SidebarModule', SidebarModule);
        }
    } else {
        // 如果 NWSModules 不存在，创建它
        window.NWSModules = window.NWSModules || {};
        window.NWSModules.SidebarModule = SidebarModule;
        // 添加一个获取类的方法
        window.NWSModules.SidebarModuleClass = SidebarModule;
    }

    // 也暴露到全局作用域
    window.SidebarModule = SidebarModule;
    // 添加一个获取类的方法
    window.SidebarModuleClass = SidebarModule;
})();