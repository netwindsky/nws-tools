/**
/**
 * SidebarView.js - 侧边栏视图模块
 * 负责侧边栏的内容渲染和UI组件
 * 使用HTML模板系统进行内容管理
 */

(function() {
    'use strict';

class SidebarView {
    constructor(sidebar) {
        this.sidebar = sidebar;
        this.contentContainer = null;
        this.headerContainer = null;
        this.footerContainer = null;
        this.resizeHandle = null;
        this.currentView = 'welcome'; // 'welcome', 'features', 'custom'
        this.isAutoWidth = false;
        this.lastManualWidth = null;
    }

    /**
     * 等待初始化 (保持兼容性)
     */
    async waitForTemplateManager() {
        return Promise.resolve();
    }

    /**
     * 创建侧边栏头部
     */
    createHeader() {
        this.headerContainer = document.createElement('div');
        this.headerContainer.className = 'nws-sidebar-header';
        
        // 检查图标是否可用，如果不可用则使用emoji替代
        let iconHtml;
        try {
            iconHtml = `<img src="${chrome.runtime.getURL('icons/icon16.png')}" alt="NWS" class="nws-sidebar-icon">`;
        } catch (error) {
            console.warn('[SidebarView] 无法加载图标，使用emoji替代:', error);
            iconHtml = `<span class="nws-sidebar-icon">🔧</span>`;
        }
        
        this.headerContainer.innerHTML = `
            <div class="nws-sidebar-title">
                ${iconHtml}
                <span>NWS工具箱</span>
            </div>
            <div class="nws-sidebar-controls">
                <button class="nws-sidebar-btn nws-sidebar-expand" title="展开" data-action="expand">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                    </svg>
                </button>
                <button class="nws-sidebar-btn nws-sidebar-minimize" title="最小化" data-action="minimize">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M19 13H5v-2h14v2z"/>
                    </svg>
                </button>
                <button class="nws-sidebar-btn nws-sidebar-close" title="关闭" data-action="close">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
        `;

        return this.headerContainer;
    }

    /**
     * 创建侧边栏内容区域
     */
    async createContent() {
        // 等待模板管理器
        await this.waitForTemplateManager();
        
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'nws-sidebar-content';
        
        // 使用模板创建内容
        await this.loadTemplateContent();
        
        return this.contentContainer;
    }
    
    /**
     * 加载内容
     */
    async loadTemplateContent() {
        console.log('[SidebarView] 使用内置模板加载内容');
        this.loadFallbackContent();
    }
    
    /**
     * 获取模板数据
     */
    getTemplateData() {
        return {
            title: 'NWS工具箱',
            description: '这是一个功能强大的网页工具集合',
            currentWidth: this.sidebar.config.width,
            currentStatus: this.sidebar.isVisible ? '显示' : '隐藏',
            expandStatus: this.sidebar.isExpanded ? '已展开' : '正常',
            moduleCount: this.getModuleCount(),
            minWidth: this.sidebar.config.minWidth,
            maxWidth: this.sidebar.config.maxWidth
        };
    }
    
    /**
     * 获取模块数量
     */
    getModuleCount() {
        if (window.NWSModules && typeof window.NWSModules === 'object') {
            return Object.keys(window.NWSModules).length;
        }
        return 0;
    }

    /**
     * 创建侧边栏底部
     */
    createFooter() {
        this.footerContainer = document.createElement('div');
        this.footerContainer.className = 'nws-sidebar-footer';
        this.footerContainer.innerHTML = `
            <div class="nws-sidebar-actions">
                <button class="nws-btn nws-btn-primary" id="nws-open-settings">设置</button>
                <button class="nws-btn nws-btn-secondary" id="nws-toggle-features">功能面板</button>
            </div>
        `;
        return this.footerContainer;
    }

    /**
     * 创建拖拽调整手柄
     */
    createResizeHandle() {
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.className = 'nws-sidebar-resize-handle';
        this.resizeHandle.innerHTML = `
            <div class="nws-resize-indicator">
                <div class="nws-resize-line"></div>
                <div class="nws-resize-line"></div>
                <div class="nws-resize-line"></div>
            </div>
        `;
        return this.resizeHandle;
    }

    /**
     * 加载默认内容（备用方案）
     */
    loadFallbackContent() {
        this.contentContainer.innerHTML = `
            <div class="nws-sidebar-main">
                <div class="nws-sidebar-section">
                    <h3>🚀 核心功能</h3>
                    <div class="nws-feature-grid">
                        <div class="nws-feature-item" data-feature="ElementHighlighterModule">
                            <div class="nws-feature-icon">🎯</div>
                            <div class="nws-feature-text">
                                <h4>元素高亮</h4>
                                <p>智能识别页面元素</p>
                            </div>
                        </div>
                        <div class="nws-feature-item" data-feature="ImageDownloaderModule">
                            <div class="nws-feature-icon">📥</div>
                            <div class="nws-feature-text">
                                <h4>图片下载</h4>
                                <p>批量提取页面图片</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="nws-sidebar-section">
                    <h3>⚙️ 功能开关</h3>
                    <div class="nws-toggle-list">
                        <div class="nws-toggle-item">
                            <span>启用元素高亮</span>
                            <label class="nws-switch">
                                <input type="checkbox" id="toggle-highlighter">
                                <span class="nws-slider"></span>
                            </label>
                        </div>
                        <div class="nws-toggle-item">
                            <span>启用图片下载</span>
                            <label class="nws-switch">
                                <input type="checkbox" id="toggle-downloader">
                                <span class="nws-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="nws-sidebar-section">
                    <h3>📏 侧边栏设置</h3>
                    <div class="nws-setting-item">
                        <div class="nws-setting-label">
                            <span>宽度调节</span>
                            <span id="width-display">${this.sidebar.config.width}px</span>
                        </div>
                        <input type="range" id="width-slider" min="${this.sidebar.config.minWidth}" max="${this.sidebar.config.maxWidth}" value="${this.sidebar.config.width}" class="nws-range">
                    </div>
                    <div class="nws-button-group">
                        <button class="nws-btn nws-btn-sm" id="reset-width">重置宽度</button>
                        <button class="nws-btn nws-btn-sm" id="expand-width">全屏展示</button>
                    </div>
                </div>

                <div class="nws-sidebar-section">
                    <h3>🛠️ 系统工具</h3>
                    <div class="nws-button-grid">
                        <button class="nws-btn nws-btn-outline" id="refresh-content">刷新内容</button>
                        <button class="nws-btn nws-btn-outline" id="clear-cache">清除缓存</button>
                        <button class="nws-btn nws-btn-outline" id="debug-info">调试信息</button>
                    </div>
                </div>
            </div>
        `;
        
        // 重新设置事件监听，因为内容被替换了
        this.setupTemplateEventListeners();
    }
    
    /**
     * 设置模板事件监听
     */
    setupTemplateEventListeners() {
        if (!this.contentContainer) return;
        
        // 功能卡片点击事件
        const featureItems = this.contentContainer.querySelectorAll('.nws-feature-item');
        featureItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const feature = item.getAttribute('data-feature');
                this.handleFeatureClick(feature, e);
            });
        });
        
        // 返回按钮
        const backButton = this.contentContainer.querySelector('#back-to-home');
        if (backButton) {
            backButton.addEventListener('click', () => this.showWelcomeView());
        }
        
        // 宽度滑块
        const widthSlider = this.contentContainer.querySelector('#width-slider');
        const widthDisplay = this.contentContainer.querySelector('#width-display');
        if (widthSlider && widthDisplay) {
            widthSlider.addEventListener('input', (e) => {
                const newWidth = parseInt(e.target.value);
                this.updateWidth(newWidth);
                widthDisplay.textContent = newWidth + 'px';
                this.isAutoWidth = false;
            });
        }
        
        // 控制按钮事件
        this.setupControlButtons();
        
        // 功能开关
        this.setupFeatureToggles();
    }
    
    /**
     * 设置控制按钮事件
     */
    setupControlButtons() {
        const buttons = {
            'reset-width': () => this.resetWidth(),
            'expand-width': () => this.expandToMaxWidth(),
            'auto-width': () => this.toggleAutoWidth(),
            'refresh-content': () => this.refreshContent(),
            'clear-cache': () => this.clearCache(),
            'debug-info': () => this.showDebugInfo()
        };
        
        Object.entries(buttons).forEach(([id, handler]) => {
            const button = this.contentContainer.querySelector(`#${id}`);
            if (button) {
                button.addEventListener('click', handler);
            }
        });
    }
    
    /**
     * 设置功能开关
     */
    setupFeatureToggles() {
        const toggles = {
            'toggle-highlighter': 'ElementHighlighterModule',
            'toggle-downloader': 'ImageDownloaderModule',
            'toggle-translation': 'TranslationModule'
        };
        
        Object.entries(toggles).forEach(([id, moduleName]) => {
            const toggle = this.contentContainer.querySelector(`#${id}`);
            if (toggle) {
                // 设置初始状态
                const isActive = this.isModuleActive(moduleName);
                toggle.checked = isActive;
                
                // 设置事件监听
                toggle.addEventListener('change', (e) => {
                    this.handleFeatureToggle(moduleName, e.target.checked);
                });
            }
        });
    }

    /**
     * 加载自适应样式
     */
    loadAdaptiveStyles() {
        // 检查样式是否已加载
        if (document.getElementById('nws-sidebar-adaptive-styles')) return;
        
        const link = document.createElement('link');
        link.id = 'nws-sidebar-adaptive-styles';
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('css/sidebar-content.css');
        document.head.appendChild(link);
    }
    
    /**
     * 处理功能点击
     */
    handleFeatureClick(feature, event) {
        console.log(`[SidebarView] 点击功能: ${feature}`);
        
        switch (feature) {
            case 'element-highlight':
                this.toggleElementHighlight();
                break;
            case 'image-download':
                this.triggerImageDownload();
                break;
            case 'page-tools':
                this.showPageTools();
                break;
            case 'sidebar-controls':
                this.showFeaturesView();
                break;
            default:
                console.warn(`[SidebarView] 未知功能: ${feature}`);
        }
    }
    
    /**
     * 显示欢迎视图
     */
    showWelcomeView() {
        this.currentView = 'welcome';
        this.switchView('welcome-content', 'features-content', 'custom-content');
    }
    
    /**
     * 显示功能视图
     */
    showFeaturesView() {
        this.currentView = 'features';
        this.switchView('features-content', 'welcome-content', 'custom-content');
    }
    
    /**
     * 显示自定义内容
     */
    showCustomContent(content) {
        this.currentView = 'custom';
        const customContainer = this.contentContainer.querySelector('#custom-content');
        if (customContainer) {
            customContainer.innerHTML = content;
        }
        this.switchView('custom-content', 'welcome-content', 'features-content');
    }
    
    /**
     * 切换视图
     */
    switchView(showId, ...hideIds) {
        const showElement = this.contentContainer.querySelector(`#${showId}`);
        if (showElement) {
            showElement.style.display = 'block';
        }
        
        hideIds.forEach(hideId => {
            const hideElement = this.contentContainer.querySelector(`#${hideId}`);
            if (hideElement) {
                hideElement.style.display = 'none';
            }
        });
    }
    
    /**
     * 更新宽度
     */
    updateWidth(newWidth) {
        if (this.sidebar && this.sidebar.setWidth) {
            this.sidebar.setWidth(newWidth);
            this.updateWidthDisplay(newWidth);
        }
    }
    
    /**
     * 更新宽度显示
     */
    updateWidthDisplay(width) {
        const displays = this.contentContainer.querySelectorAll('#current-width, #width-display');
        displays.forEach(display => {
            if (display) {
                display.textContent = width + 'px';
            }
        });
        
        const slider = this.contentContainer.querySelector('#width-slider');
        if (slider) {
            slider.value = width;
        }
    }
    
    /**
     * 重置宽度
     */
    resetWidth() {
        const defaultWidth = 400;
        this.updateWidth(defaultWidth);
        this.isAutoWidth = false;
        this.lastManualWidth = defaultWidth;
    }
    
    /**
     * 展开到最大宽度
     */
    expandToMaxWidth() {
        const maxWidth = this.sidebar.config.maxWidth;
        this.updateWidth(maxWidth);
        this.isAutoWidth = false;
        this.lastManualWidth = maxWidth;
    }
    
    /**
     * 切换自动宽度
     */
    toggleAutoWidth() {
        this.isAutoWidth = !this.isAutoWidth;
        
        const autoButton = this.contentContainer.querySelector('#auto-width');
        if (autoButton) {
            if (this.isAutoWidth) {
                autoButton.textContent = '取消自动';
                autoButton.style.background = '#ffc107';
                this.lastManualWidth = this.sidebar.config.width;
                this.startAutoWidthAdjustment();
            } else {
                autoButton.textContent = '自动调节';
                autoButton.style.background = '';
                this.stopAutoWidthAdjustment();
                if (this.lastManualWidth) {
                    this.updateWidth(this.lastManualWidth);
                }
            }
        }
    }
    
    /**
     * 开始自动宽度调节
     */
    startAutoWidthAdjustment() {
        this.autoWidthInterval = setInterval(() => {
            if (!this.isAutoWidth) return;
            
            const optimalWidth = this.calculateOptimalWidth();
            if (optimalWidth !== this.sidebar.config.width) {
                this.updateWidth(optimalWidth);
            }
        }, 1000);
    }
    
    /**
     * 停止自动宽度调节
     */
    stopAutoWidthAdjustment() {
        if (this.autoWidthInterval) {
            clearInterval(this.autoWidthInterval);
            this.autoWidthInterval = null;
        }
    }
    
    /**
     * 计算最优宽度
     */
    calculateOptimalWidth() {
        const viewport = window.innerWidth;
        const minWidth = this.sidebar.config.minWidth;
        const maxWidth = this.sidebar.config.maxWidth;
        
        // 根据视口宽度计算最优宽度
        let optimalWidth;
        if (viewport <= 768) {
            optimalWidth = Math.min(viewport * 0.9, maxWidth);
        } else if (viewport <= 1024) {
            optimalWidth = Math.min(viewport * 0.4, maxWidth);
        } else {
            optimalWidth = Math.min(viewport * 0.3, maxWidth);
        }
        
        return Math.max(minWidth, Math.min(maxWidth, Math.round(optimalWidth)));
    }

    /**
     * 设置功能面板事件监听
     */
    setupFeaturesPanel() {
        // 宽度滑块控制
        const widthSlider = this.contentContainer.querySelector('#width-slider');
        const widthDisplay = this.contentContainer.querySelector('#width-display');
        
        if (widthSlider && widthDisplay) {
            widthSlider.addEventListener('input', (e) => {
                const newWidth = parseInt(e.target.value);
                widthDisplay.textContent = `${newWidth}px`;
                this.sidebar.setWidth(newWidth);
            });
        }

        // 重置宽度按钮
        const resetBtn = this.contentContainer.querySelector('#reset-width');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                const defaultWidth = 400;
                this.sidebar.setWidth(defaultWidth);
                if (widthSlider) widthSlider.value = defaultWidth;
                if (widthDisplay) widthDisplay.textContent = `${defaultWidth}px`;
            });
        }

        // 展开到最大按钮
        const expandBtn = this.contentContainer.querySelector('#expand-width');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => {
                const maxWidth = this.sidebar.config.maxWidth;
                this.sidebar.setWidth(maxWidth);
                if (widthSlider) widthSlider.value = maxWidth;
                if (widthDisplay) widthDisplay.textContent = `${maxWidth}px`;
            });
        }

        // 返回按钮
        const backBtn = this.contentContainer.querySelector('#back-to-home');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.loadWelcomeContent());
        }
    }

    /**
     * 更新状态显示
     */
    updateStatus() {
        const statusElement = document.getElementById('current-status');
        const widthElement = document.getElementById('current-width');
        
        if (statusElement) {
            statusElement.textContent = this.sidebar.isVisible ? '显示' : '隐藏';
        }
        
        if (widthElement) {
            widthElement.textContent = `${this.sidebar.config.width}px`;
        }
    }

    /**
     * 设置自定义内容
     */
    setContent(content) {
        if (this.contentContainer) {
            this.contentContainer.innerHTML = content;
        }
    }

    /**
     * 添加内容
     */
    addContent(content, append = false) {
        if (this.contentContainer) {
            if (append) {
                this.contentContainer.appendChild(content);
            } else {
                this.contentContainer.innerHTML = '';
                this.contentContainer.appendChild(content);
            }
        }
    }

    /**
     * 获取样式定义
     */
    getStyles() {
        return `
            /* 侧边栏拖拽手柄增强样式 */
            .nws-sidebar-resize-handle {
                position: absolute;
                left: -8px;
                top: 0;
                width: 8px;
                height: 100%;
                cursor: ew-resize;
                background: transparent;
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }

            .nws-sidebar-resize-handle:hover {
                background: rgba(0, 123, 255, 0.1);
                border-left: 2px solid #007bff;
            }

            .nws-resize-indicator {
                display: flex;
                flex-direction: column;
                gap: 2px;
                opacity: 0;
                transition: opacity 0.2s ease;
            }

            .nws-sidebar-resize-handle:hover .nws-resize-indicator {
                opacity: 1;
            }

            .nws-resize-line {
                width: 2px;
                height: 6px;
                background: #007bff;
                border-radius: 1px;
            }

            /* 展开按钮样式 */
            .nws-sidebar-expand {
                position: relative;
            }

            .nws-sidebar.expanded .nws-sidebar-expand svg {
                transform: rotate(45deg);
            }

            /* 功能面板样式增强 */
            .nws-features-panel {
                padding: 0;
            }

            .nws-features-panel h3 {
                margin: 0 0 20px 0;
                padding-bottom: 10px;
                border-bottom: 2px solid #007bff;
                color: #2c3e50;
            }

            .nws-feature-controls {
                margin-bottom: 25px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 8px;
            }

            .nws-feature-control {
                margin-bottom: 12px;
            }

            .nws-feature-control label {
                display: flex;
                align-items: center;
                cursor: pointer;
                font-size: 14px;
                color: #495057;
            }

            .nws-feature-control input[type="checkbox"] {
                margin-right: 8px;
                width: 16px;
                height: 16px;
            }

            .nws-size-controls {
                margin-bottom: 25px;
                padding: 15px;
                background: #e7f3ff;
                border-radius: 8px;
                border: 1px solid #b8daff;
            }

            .nws-size-controls h4 {
                margin: 0 0 15px 0;
                color: #0056b3;
                font-size: 16px;
            }

            .nws-size-control {
                margin-bottom: 15px;
            }

            .nws-size-control label {
                display: block;
                margin-bottom: 8px;
                font-size: 14px;
                color: #495057;
                font-weight: 500;
            }

            .nws-slider {
                width: 100%;
                height: 6px;
                border-radius: 3px;
                background: #dee2e6;
                outline: none;
                opacity: 0.7;
                transition: opacity 0.2s ease;
            }

            .nws-slider:hover {
                opacity: 1;
            }

            .nws-slider::-webkit-slider-thumb {
                appearance: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #007bff;
                cursor: pointer;
                border: 2px solid #ffffff;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .nws-slider::-moz-range-thumb {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #007bff;
                cursor: pointer;
                border: 2px solid #ffffff;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .nws-size-buttons {
                display: flex;
                gap: 8px;
                margin-top: 10px;
            }

            .nws-btn-sm {
                padding: 6px 12px;
                font-size: 12px;
                flex: 1;
            }

            /* 状态显示样式 */
            .nws-sidebar-stats {
                margin-top: 20px;
                padding: 15px;
                background: #f1f8ff;
                border-radius: 8px;
                border: 1px solid #c6e2ff;
            }

            .nws-stat-item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                font-size: 14px;
            }

            .nws-stat-label {
                color: #6c757d;
                font-weight: 500;
            }

            .nws-stat-value {
                color: #007bff;
                font-weight: 600;
            }

            /* 侧边栏展开状态样式 */
            .nws-sidebar.expanded {
                max-width: 80vw;
            }

            .nws-sidebar.expanded .nws-sidebar-content {
                padding: 30px;
            }

            .nws-sidebar.expanded .nws-sidebar-features {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
            }

            /* 响应式调整 */
            @media (max-width: 1200px) {
                .nws-sidebar.expanded {
                    max-width: 90vw;
                }
            }

            @media (max-width: 768px) {
                .nws-sidebar.expanded {
                    max-width: 100vw;
                }
                
                .nws-sidebar.expanded .nws-sidebar-content {
                    padding: 20px;
                }
            }
        `;
    }
    
    /**
     * 刷新内容
     */
    refreshContent() {
        console.log('[SidebarView] 刷新内容');
        this.loadTemplateContent();
    }
    
    /**
     * 清除缓存
     */
    clearCache() {
        if (this.templateManager) {
            this.templateManager.clearCache();
            console.log('[SidebarView] 缓存已清除');
        }
    }
    
    /**
     * 显示调试信息
     */
    showDebugInfo() {
        const debugInfo = {
            currentView: this.currentView,
            isAutoWidth: this.isAutoWidth,
            sidebarWidth: this.sidebar.config.width,
            sidebarVisible: this.sidebar.isVisible,
            sidebarExpanded: this.sidebar.isExpanded,
            viewportWidth: window.innerWidth,
            moduleCount: this.getModuleCount()
        };
        
        const debugContent = `
            <h3>调试信息</h3>
            <pre>${JSON.stringify(debugInfo, null, 2)}</pre>
            <button class="nws-btn nws-btn-primary" onclick="this.closest('#custom-content').style.display='none'; document.querySelector('#welcome-content').style.display='block'">返回</button>
        `;
        
        this.showCustomContent(debugContent);
    }
    
    /**
     * 切换元素高亮
     */
    toggleElementHighlight() {
        if (window.NWSModules && window.NWSModules.ElementHighlighterModule) {
            const highlighter = window.NWSModules.ElementHighlighterModule;
            if (highlighter.enabled) {
                highlighter.disable();
            } else {
                highlighter.enable();
            }
        }
    }
    
    /**
     * 触发图片下载
     */
    triggerImageDownload() {
        // 发送消息给工具栏
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ action: 'downloadAllImages' });
        }
    }
    
    /**
     * 显示页面工具
     */
    showPageTools() {
        const toolsContent = `
            <h3>🔧 页面工具</h3>
            <div class="nws-tool-buttons">
                <button class="nws-btn nws-btn-primary" onclick="chrome.runtime.sendMessage({action: 'translatePage'})">🌐 翻译页面</button>
                <button class="nws-btn nws-btn-primary" onclick="chrome.runtime.sendMessage({action: 'summarizePage'})">📋 页面摘要</button>
                <button class="nws-btn nws-btn-secondary" onclick="window.print()">🖨️ 打印页面</button>
            </div>
            <button class="nws-btn nws-btn-back" onclick="this.closest('#custom-content').style.display='none'; document.querySelector('#welcome-content').style.display='block'">← 返回</button>
        `;
        
        this.showCustomContent(toolsContent);
    }
    
    /**
     * 检查模块是否激活
     */
    isModuleActive(moduleName) {
        if (window.NWSModules && window.NWSModules[moduleName]) {
            const module = window.NWSModules[moduleName];
            return module.enabled || module.isActive || false;
        }
        return false;
    }
    
    /**
     * 处理功能开关
     */
    handleFeatureToggle(moduleName, enabled) {
        console.log(`[SidebarView] 切换功能: ${moduleName}, 启用: ${enabled}`);
        
        if (window.NWSModules && window.NWSModules[moduleName]) {
            const module = window.NWSModules[moduleName];
            if (enabled) {
                if (module.enable) module.enable();
                else if (module.activate) module.activate();
            } else {
                if (module.disable) module.disable();
                else if (module.deactivate) module.deactivate();
            }
        }
    }

    /**
     * 销毁方法
     */
    destroy() {
        this.stopAutoWidthAdjustment();
        
        // 移除样式
        const styleElement = document.getElementById('nws-sidebar-adaptive-styles');
        if (styleElement) {
            styleElement.remove();
        }
        
        // 清理引用
        this.contentContainer = null;
        this.headerContainer = null;
        this.footerContainer = null;
        this.resizeHandle = null;
        this.templateManager = null;
    }
}

    // 注册到全局作用域
    window.SidebarView = SidebarView;

})();