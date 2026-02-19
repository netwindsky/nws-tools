/**
 * toolsbar.js - 网页右侧悬浮工具栏
 * 提供批量下载图片、翻译网页、总结网页等功能
 * 重构版本：UI内容已分离到独立的CSS和HTML模板文件
 */

const domHelper = window.DOMHelper || window.NWSModules?.utils || {};
const sanitizeSelectorFn = typeof domHelper.sanitizeSelector === 'function' ? domHelper.sanitizeSelector : (selector) => selector;
const baseSafeQuerySelector = typeof domHelper.safeQuerySelector === 'function' ? domHelper.safeQuerySelector : null;
const baseSafeQuerySelectorAll = typeof domHelper.safeQuerySelectorAll === 'function' ? domHelper.safeQuerySelectorAll : null;

const toolbarSafeQuerySelector = (selector, context = document) => {
    if (!baseSafeQuerySelector) return null;
    return baseSafeQuerySelector(sanitizeSelectorFn(selector), context);
};

const toolbarSafeQuerySelectorAll = (selector, context = document) => {
    if (!baseSafeQuerySelectorAll) return [];
    return baseSafeQuerySelectorAll(sanitizeSelectorFn(selector), context);
};

const i18nService = window.I18nService || window.NWSModules?.get?.('I18nService');
const t = (key, placeholders, fallback = '') => {
    try {
        if (i18nService && typeof i18nService.t === 'function') {
            const value = i18nService.t(key, placeholders);
            if (value) return value;
        }
    } catch (error) {
        return fallback || key;
    }
    return fallback || key;
};

const icons = {
    error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
    success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    loading: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>`
};

// UI管理器
class ToolbarUIManager {
    constructor() {
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;
    }

    async waitForTemplateManager(timeout = 2000) {
        return Promise.resolve(false);
    }

    createToolbar() {
        return this.createFallbackToolbar();
    }

    createFallbackToolbar() {
        // 备用的工具栏创建
        const toolbar = document.createElement('div');
        toolbar.id = 'nws-toolbar';
        toolbar.className = 'nws-toolbar';
        
        // 主触发图标 (四个小方块组成的菜单图标)
        const triggerBtn = document.createElement('div');
        triggerBtn.className = 'nws-toolbar-trigger';
        triggerBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`;
        toolbar.appendChild(triggerBtn);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'nws-toolbar-buttons';
        
        const buttons = [
            { 
                action: 'batch-download', 
                icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`, 
                text: t('toolsbar_button_batch_download', null, '批量下载'), 
                class: 'nws-button-download' 
            },
            { 
                action: 'translate', 
                icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`, 
                text: t('toolsbar_button_translate', null, '翻译页面'), 
                class: 'nws-button-translate' 
            },
            { 
                action: 'summary', 
                icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>`, 
                text: t('toolsbar_button_summary', null, '页面总结'), 
                class: 'nws-button-summary' 
            },
            { 
                action: 'element-highlight', 
                icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>`, 
                text: t('toolsbar_button_highlight', null, '元素高亮'), 
                class: 'nws-button-highlight' 
            },
            { 
                action: 'settings', 
                icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`, 
                text: t('toolsbar_button_settings', null, '设置中心'), 
                class: 'nws-button-settings' 
            }
        ];
        
        buttons.forEach(btnConfig => {
            const button = document.createElement('button');
            button.className = `nws-toolbar-button ${btnConfig.class}`;
            button.dataset.action = btnConfig.action;
            button.dataset.tooltip = btnConfig.text;
            button.innerHTML = `
                <div class="nws-button-icon">${btnConfig.icon}</div>
            `;
            buttonContainer.appendChild(button);
        });
        
        toolbar.appendChild(buttonContainer);
        return toolbar;
    }

    createBatchDownloadModal(images) {
        const modal = document.createElement('div');
        modal.id = 'nws-batch-download-modal';
        modal.className = 'nws-batch-modal';
        
        modal.innerHTML = `
            <div class="nws-batch-modal-content">
                <div class="nws-modal-header">
                    <div class="nws-modal-title">
                        <div class="nws-title-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </div>
                        <div class="nws-title-text">
                            <span>${t('toolsbar_modal_batch_title', null, '批量下载图片')}</span>
                            <span class="nws-title-badge">${t('toolsbar_modal_batch_count', [images.length], `共 ${images.length} 张`)}</span>
                        </div>
                    </div>
                    <button class="nws-modal-close" data-action="close" title="${t('toolsbar_modal_close', null, '关闭')}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="nws-modal-controls">
                    <button class="nws-button nws-button-secondary" data-action="toggle-all">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                        <span>${t('toolsbar_modal_toggle_all', null, '全选 / 反选')}</span>
                    </button>
                    <div class="nws-spacer"></div>
                    <button class="nws-button nws-button-primary" data-action="start-download">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        <span>${t('toolsbar_modal_start_download', null, '开始下载')}</span>
                    </button>
                </div>
                <div class="nws-modal-body">
                    <div class="nws-image-grid" id="nws-image-grid"></div>
                </div>
            </div>
        `;

        const imageGrid = toolbarSafeQuerySelector('#nws-image-grid', modal);
        images.forEach((img, index) => {
            const src = img.src || img.dataset.src;
            const imageItem = document.createElement('div');
            imageItem.className = 'nws-image-item selected';
            imageItem.dataset.index = index;
            imageItem.dataset.src = src;
            imageItem.innerHTML = `
                <div class="nws-image-card">
                    <div class="nws-image-wrapper">
                        <img src="${src}" class="nws-image-thumbnail" alt="${t('toolsbar_image_alt_preview', null, '预览')}" loading="lazy">
                        <div class="nws-image-overlay">
                            <div class="nws-image-checkbox-custom">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                        </div>
                    </div>
                    <div class="nws-image-info">
                        <div class="nws-image-meta">
                            <span class="nws-image-size">${img.naturalWidth || '?'} × ${img.naturalHeight || '?'}</span>
                            <span class="nws-image-status pending">${t('toolsbar_status_pending', null, '等待下载')}</span>
                        </div>
                    </div>
                    <input type="checkbox" class="nws-image-checkbox" checked>
                </div>
            `;
            
            imageItem.addEventListener('click', (e) => {
                const checkbox = toolbarSafeQuerySelector('.nws-image-checkbox', imageItem);
                checkbox.checked = !checkbox.checked;
                imageItem.classList.toggle('selected', checkbox.checked);
            });
            
            imageGrid.appendChild(imageItem);
        });

        return modal;
    }

    createErrorNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'nws-error-notification';
        
        notification.innerHTML = `
            <span class="nws-error-icon">${icons.error}</span>
            <div class="nws-error-content">
                <div class="nws-error-title">${t('toolsbar_error_title', null, '错误')}</div>
                <div class="nws-error-message">${message}</div>
            </div>
            <button class="nws-close-btn" data-action="close">×</button>
        `;
        return notification;
    }

    createSuccessNotification(title, content) {
        const notification = document.createElement('div');
        notification.className = 'nws-success-notification';
        
        notification.innerHTML = `
            <div class="nws-notification-title">
                <span class="nws-notification-icon">${icons.success}</span>
                <span>${title}</span>
            </div>
            <div class="nws-notification-content">${content}</div>
        `;
        return notification;
    }

    createLoadingOverlay(message, icon = icons.loading) {
        const overlay = document.createElement('div');
        overlay.className = 'nws-loading-overlay';
        
        overlay.innerHTML = `
            <div class="nws-loading-content">
                <div class="nws-loading-icon">${icon}</div>
                <div class="nws-loading-message">${message}</div>
                <div class="nws-progress-container">
                    <div class="nws-progress-fill"></div>
                </div>
                <div class="nws-progress-text">${t('toolsbar_loading_preparing', null, '准备中...')}</div>
            </div>
        `;
        return overlay;
    }

    createModernModal(title, icon, content) {
        const modal = document.createElement('div');
        modal.className = 'nws-modern-modal';
        
        modal.innerHTML = `
            <div class="nws-modal-content">
                <div class="nws-modal-header">
                    <div class="nws-header-content">
                        <span class="nws-header-icon">${icon}</span>
                        <h2 class="nws-header-title">${title}</h2>
                    </div>
                    <button class="nws-close-btn" data-action="close">×</button>
                </div>
                <div class="nws-modal-body">
                    ${content}
                </div>
            </div>
        `;
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.dataset.action === 'close') {
                modal.remove();
            }
        });
        
        return modal;
    }
}

window.uiManager = new ToolbarUIManager();
const uiManager = window.uiManager;

function showErrorNotification(message) {
    const notification = uiManager.createErrorNotification(message);
    if (notification) {
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
        
        const closeBtn = toolbarSafeQuerySelector('.nws-close-btn', notification);
        if (closeBtn) {
            closeBtn.addEventListener('click', () => notification.remove());
        }
    }
}

function showSuccessNotification(title, content) {
    const notification = uiManager.createSuccessNotification(title, content);
    if (notification) {
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

function createLoadingOverlay(message, icon = icons.loading) {
    return uiManager.createLoadingOverlay(message, icon);
}

function createModernModal(title, icon, content) {
    return uiManager.createModernModal(title, icon, content);
}

async function isToolbarAllowed() {
    const chromeSettings = window.NWSModules?.ChromeSettingsModule;
    if (chromeSettings && typeof chromeSettings.isBlacklisted === 'function') {
        if (!chromeSettings.initialized && typeof chromeSettings.initialize === 'function') {
            await chromeSettings.initialize();
        }
        if (chromeSettings.isBlacklisted()) {
            //console.log('[Toolsbar] 当前网站在黑名单中，跳过工具栏加载');
            return false;
        }
    }
    return true;
}

async function initToolbar() {
    //console.log('[Toolsbar] 开始初始化工具栏');
    
    if (document.getElementById('nws-toolbar')) {
        return false;
    }
    const allowed = await isToolbarAllowed();
    if (!allowed) {
        return false;
    }
    
    try {
        await uiManager.init();
        
        const toolbar = uiManager.createToolbar();
        if (!toolbar) {
            console.error('[Toolsbar] 无法创建工具栏');
            return false;
        }
        
        toolbar.addEventListener('click', handleToolbarClick);
        
        document.body.appendChild(toolbar);
        applyToolbarFallbackPositioning(toolbar);
        //console.log('[Toolsbar] 工具栏初始化完成');
        return true;
    } catch (error) {
        console.error('[Toolsbar] 初始化失败:', error);
        return false;
    }
}

function applyToolbarFallbackPositioning(toolbar) {
    if (!toolbar || typeof window.getComputedStyle !== 'function') return;
    const computed = window.getComputedStyle(toolbar);
    const position = computed.position;
    const right = computed.right;
    const top = computed.top;
    if (position !== 'fixed' || right === 'auto' || top === 'auto') {
        toolbar.style.setProperty('position', 'fixed', 'important');
        toolbar.style.setProperty('right', '24px', 'important');
        toolbar.style.setProperty('top', '50%', 'important');
        toolbar.style.setProperty('transform', 'translateY(-50%)', 'important');
        toolbar.style.setProperty('z-index', '99999', 'important');
    }
}

function handleToolbarClick(event) {
    // 阻止事件冒泡，防止触发页面上其他元素的点击事件
    // 对工具栏内的所有点击都生效，不仅仅是按钮
    event.stopPropagation();

    const button = event.target.closest('.nws-toolbar-button');
    if (!button) return;
    
    event.preventDefault();
    
    const action = button.dataset.action;
    switch (action) {
        case 'batch-download':
            handleBatchDownload();
            break;
        case 'translate':
            handleTranslate();
            break;
        case 'summary':
            handleSummary();
            break;
        case 'element-highlight':
            handleElementHighlight();
            break;
        case 'settings':
            handleOpenSettings();
            break;
        default:
            console.warn('[Toolsbar] 未知的操作:', action);
    }
}

function handleBatchDownload() {
    //console.log('开始批量下载图片');
    batchDownloadImages();
}

async function handleElementHighlight() {
    //console.log('切换元素高亮功能');
    
    if (!window.NWSModules || !window.NWSModules.ElementHighlighterModule) {
        showErrorNotification(t('toolsbar_highlight_missing', null, '元素高亮模块未加载，请刷新页面重试'));
        return;
    }
    
    const highlighter = window.NWSModules.ElementHighlighterModule;
    const button = toolbarSafeQuerySelector('.nws-button-highlight');

    try {
        if (!highlighter.initialized && typeof highlighter.initialize === 'function') {
            const initSuccess = await highlighter.initialize();
            if (!initSuccess) {
                showErrorNotification(t('toolsbar_highlight_enable_failed', null, '元素高亮模块初始化失败'));
                return;
            }
        }

        const isCurrentlyEnabled = highlighter.enabled;
        //console.log("当前高亮状态 - enabled:", isCurrentlyEnabled);
        //console.log("当前高亮状态 - isActive:", highlighter.isActive);

        if (!isCurrentlyEnabled) {
            await highlighter.enable();
            if (button) {
                button.classList.add('active');
                const textElement = toolbarSafeQuerySelector('.nws-button-text', button);
                if (textElement) {
                    textElement.textContent = t('toolsbar_highlight_disable_label', null, '关闭高亮');
                }
            }
            
            showSuccessNotification(
                t('toolsbar_highlight_enabled_title', null, '元素高亮已启用'),
                t('toolsbar_highlight_enabled_detail', null, '• 鼠标悬停查看元素信息<br>• 右键显示操作菜单<br>• Ctrl+C 复制选择器<br>• Ctrl+Shift+C 复制样式')
            );
            
            //console.log('[ElementHighlight] 元素高亮功能已启用');
        } else {
            await highlighter.disable();
            if (button) {
                button.classList.remove('active');
                const textElement = toolbarSafeQuerySelector('.nws-button-text', button);
                if (textElement) {
                    textElement.textContent = t('toolsbar_highlight_enable_label', null, '元素高亮');
                }
            }
            
            showSuccessNotification(t('toolsbar_highlight_disabled_title', null, '元素高亮已禁用'), '');
            
            //console.log('[Toolsbar] 元素高亮功能已禁用');
        }
    } catch (error) {
        const message = error?.message || '未知错误';
        console.error('[ElementHighlight] 切换失败:', error);
        showErrorNotification(t('toolsbar_highlight_enable_failed', [message], `元素高亮切换失败: ${message}`));
    }
}

async function batchDownloadImages() {
    const images = toolbarSafeQuerySelectorAll('img');
    const validImages = Array.from(images).filter(img => {
        const src = img.src || img.dataset.src;
        return src && !src.startsWith('data:') && src.length > 10;
    });

    if (validImages.length === 0) {
        showErrorNotification(t('toolsbar_no_images', null, '未找到可下载的图片'));
        return;
    }

    const downloadModal = uiManager.createBatchDownloadModal(validImages);
    if (downloadModal) {
        setupModalEventListeners(downloadModal);
        document.body.appendChild(downloadModal);
    }
}

function setupModalEventListeners(modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    modal.addEventListener('click', (e) => {
        const button = e.target.closest('[data-action]');
        if (!button) return;
        
        const action = button.dataset.action;
        
        switch (action) {
            case 'close':
                modal.remove();
                break;
            case 'toggle-all':
                toggleAllImages(button);
                break;
            case 'start-download':
                startBatchDownload(button);
                break;
        }
    });
}

function toggleAllImages(button) {
    const modal = button.closest('.nws-batch-modal');
    if (!modal) return;
    const checkboxes = toolbarSafeQuerySelectorAll('.nws-image-checkbox', modal);
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
        const item = cb.closest('.nws-image-item');
        if (item) item.classList.toggle('selected', cb.checked);
    });
}

function startBatchDownload(button) {
    const modal = button.closest('.nws-batch-modal');
    if (!modal) return;
    
    const checkedItems = toolbarSafeQuerySelectorAll('.nws-image-checkbox:checked', modal);
    if (checkedItems.length === 0) {
        showErrorNotification(t('toolsbar_batch_select_one', null, '请至少选择一张图片'));
        return;
    }
    
    if (typeof window.startBatchDownloadImpl === 'function') {
        window.startBatchDownloadImpl(button);
    } else {
        console.error('[BatchDownload] 下载实现函数未找到');
    }
}

window.toggleAllImages = toggleAllImages;
window.startBatchDownload = startBatchDownload;

window.startBatchDownloadImpl = async function(button) {
    const modal = button.closest('.nws-batch-modal');
    const checkedItems = toolbarSafeQuerySelectorAll('.nws-image-checkbox:checked', modal);
    
    if (checkedItems.length === 0) {
        showErrorNotification(t('toolsbar_batch_select_one', null, '请至少选择一张图片'));
        return;
    }
    
    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = `
        <svg class="nws-animate-spin nws-inline-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
        ${t('toolsbar_batch_preparing', null, '正在准备...')}
    `;
    
    let completed = 0;
    const total = checkedItems.length;
    
    for (const checkbox of checkedItems) {
        const imageItem = checkbox.closest('.nws-image-item');
        const src = imageItem.dataset.src;
        const statusElement = toolbarSafeQuerySelector('.nws-image-status', imageItem);
        
        try {
            statusElement.textContent = t('toolsbar_status_downloading', null, '下载中...');
            statusElement.className = 'nws-image-status downloading';
            
            await downloadImage(src);
            
            statusElement.textContent = t('toolsbar_status_success', null, '已完成');
            statusElement.className = 'nws-image-status success';
            
        } catch (error) {
            console.error('[BatchDownload] 下载失败:', src, error);
            statusElement.textContent = t('toolsbar_status_failed', null, '失败');
            statusElement.className = 'nws-image-status error';
        }
        
        completed++;
        button.innerHTML = `
            <svg class="nws-animate-spin nws-inline-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
            ${t('toolsbar_batch_downloading_progress', [completed, total], `下载中 (${completed}/${total})`)}
        `;
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    button.disabled = false;
    button.innerHTML = `
        <svg class="nws-inline-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ${t('toolsbar_batch_complete', null, '下载完成')}
    `;
    button.classList.add('success');
    
    setTimeout(() => {
        button.innerHTML = originalHTML;
        button.classList.remove('success');
    }, 3000);
}

function cleanImageUrl(url) {
    if (!url) return url;
    
    try {
        let cleaned = url.split('@')[0];
        
        cleaned = cleaned.split('?')[0];
        
        const lastDotIndex = cleaned.lastIndexOf('.');
        if (lastDotIndex !== -1) {
            const afterDot = cleaned.substring(lastDotIndex + 1).toLowerCase();
            const commonExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'];
            
            for (const ext of commonExts) {
                if (afterDot.startsWith(ext + '!')) {
                    cleaned = cleaned.substring(0, cleaned.indexOf('!', lastDotIndex));
                    break;
                }
            }
        }
        
        return cleaned;
    } catch (e) {
        console.error('[CleanURL] 清理失败:', e);
        return url;
    }
}

async function downloadImage(imageUrl) {
    return new Promise((resolve, reject) => {
        const cleanedUrl = cleanImageUrl(imageUrl);
        //console.log('[BatchDownload] 开始下载图片:', { original: imageUrl, cleaned: cleanedUrl });
        
        const link = document.createElement('a');
        link.style.display = 'none';
        
        fetch(cleanedUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                link.href = url;
                
                let filename = 'image';
                try {
                    const urlObj = new URL(cleanedUrl);
                    const pathname = urlObj.pathname;
                    filename = pathname.split('/').pop() || 'image';
                } catch (e) {
                    filename = cleanedUrl.split('/').pop() || 'image';
                }
                
                if (!filename.includes('.')) {
                    const contentType = blob.type;
                    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
                        filename += '.jpg';
                    } else if (contentType.includes('png')) {
                        filename += '.png';
                    } else if (contentType.includes('webp')) {
                        filename += '.webp';
                    } else if (contentType.includes('gif')) {
                        filename += '.gif';
                    } else {
                        filename += '.jpg';
                    }
                }
                
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                //console.log('[BatchDownload] 图片下载完成:', filename);
                resolve(filename);
            })
            .catch(error => {
                console.error('[BatchDownload] 图片下载失败 (清理后):', error);
                try {
                    link.href = imageUrl;
                    link.download = 'image.jpg';
                    link.target = '_blank';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    resolve('image.jpg');
                } catch (fallbackError) {
                    reject(error);
                }
            });
    });
}

function createModernModal(title, icon, content, className = '') {
    return uiManager.createModernModal(title, icon, content);
}

function getTranslationModuleInstance() {
    const direct = window.NWSModules?.TranslationModule;
    if (direct && typeof direct.translatePage === 'function') {
        return direct;
    }
    if (window.NWSModules && typeof window.NWSModules.get === 'function') {
        const instance = window.NWSModules.get('TranslationModule');
        if (instance && typeof instance.translatePage === 'function') {
            return instance;
        }
    }
    if (window.NWSTools && typeof window.NWSTools.getModule === 'function') {
        const instance = window.NWSTools.getModule('TranslationModule');
        if (instance && typeof instance.translatePage === 'function') {
            return instance;
        }
    }
    return null;
}

function getSummaryModuleInstance() {
    const direct = window.NWSModules?.SummaryModule;
    if (direct && typeof direct.summarizePage === 'function') {
        return direct;
    }
    if (window.NWSModules && typeof window.NWSModules.get === 'function') {
        const instance = window.NWSModules.get('SummaryModule');
        if (instance && typeof instance.summarizePage === 'function') {
            return instance;
        }
    }
    if (window.NWSTools && typeof window.NWSTools.getModule === 'function') {
        const instance = window.NWSTools.getModule('SummaryModule');
        if (instance && typeof instance.summarizePage === 'function') {
            return instance;
        }
    }
    return null;
}

function openTranslationOptionsModal(translationModule) {
    const icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
    const content = `
            <div class="nws-translation-options">
                <div class="nws-translation-options-row">
                    <button class="nws-translation-option" data-mode="replace">${t('toolsbar_translate_mode_replace', null, '替换模式')}</button>
                    <button class="nws-translation-option" data-mode="bilingual">${t('toolsbar_translate_mode_bilingual', null, '对照模式')}</button>
                </div>
                <label class="nws-translation-toggle">
                    <input class="nws-translation-toggle-input" type="checkbox" />
                    <span>${t('toolsbar_translate_enable_selection', null, '启用划词翻译')}</span>
                </label>
                <label class="nws-translation-toggle">
                    <input class="nws-translation-lazy-toggle" type="checkbox" />
                    <span>${t('toolsbar_translate_enable_lazy', null, '启用懒翻译（视口优先）')}</span>
                </label>
                <div class="nws-translation-hint">${t('toolsbar_translate_hint', null, '翻译会优先处理当前视口内容，滚动页面继续翻译')}</div>
            </div>
    `;

    const modal = window.uiManager.createModernModal(t('toolsbar_translate_title', null, '页面翻译'), icon, content);
    document.body.appendChild(modal);

    const safeQuerySelector = window.DOMHelper?.safeQuerySelector || toolbarSafeQuerySelector;
    const safeQuerySelectorAll = window.DOMHelper?.safeQuerySelectorAll || toolbarSafeQuerySelectorAll;
    if (!safeQuerySelector || !safeQuerySelectorAll) return;

    const optionButtons = safeQuerySelectorAll('.nws-translation-option', modal);
    Array.from(optionButtons).forEach((button) => {
        button.addEventListener('click', async () => {
            const mode = button.dataset.mode;
            //console.log('[Toolsbar] 点击翻译模式按钮:', mode, '模块:', translationModule);
            modal.remove();
            await translationModule.translatePage(null, mode);
        });
    });

    const selectionToggle = safeQuerySelector('.nws-translation-toggle-input', modal);
    if (selectionToggle) {
        selectionToggle.checked = Boolean(translationModule.config?.enableSelectionTranslation);
        selectionToggle.addEventListener('change', async (event) => {
            await translationModule.setSelectionTranslationEnabled(event.target.checked);
        });
    }

    const lazyToggle = safeQuerySelector('.nws-translation-lazy-toggle', modal);
    if (lazyToggle) {
        lazyToggle.checked = Boolean(translationModule.config?.enableViewportTranslation);
        lazyToggle.addEventListener('change', async (event) => {
            await translationModule.setViewportTranslationEnabled(event.target.checked);
        });
    }
}

async function handleTranslate(options = {}) {
    //console.log('开始翻译页面');
    const translationModule = getTranslationModuleInstance();
    if (translationModule) {
        try {
            let translatedCount = null;
            // 检查是否应该停止翻译
            // 使用新属性 isPageTranslationActive (如果存在)，否则回退到 isActive (但 isActive 可能因划词翻译而为 true)
            const isRunning = translationModule.isPageTranslationActive !== undefined 
                ? translationModule.isPageTranslationActive 
                : translationModule.isActive;

            if (!options.mode && !options.directStart && isRunning && typeof translationModule.stopTranslation === 'function') {
                await translationModule.stopTranslation();
                showSuccessNotification(t('toolsbar_translate_disabled', null, '翻译已关闭'), '');
                return;
            }
            if (options.mode) {
                translatedCount = await translationModule.translatePage(null, options.mode);
            } else if (options.directStart) {
                translatedCount = await translationModule.translatePage();
            } else {
                const mode = translationModule.config?.translationMode || 'bilingual';
                translatedCount = await translationModule.translatePage(null, mode);
            }
            if (translatedCount === 0) {
                showErrorNotification(t('toolsbar_translate_empty', null, '未发现可翻译内容'));
            }
        } catch (error) {
            console.error('[Toolsbar] 翻译执行失败:', error);
            const rawMessage = error?.message || '';
            const localizedMessage = t(`toolsbar_translate_error_${rawMessage}`, null, rawMessage || t('toolsbar_translate_failed_default', null, '未知错误'));
            showErrorNotification(t('toolsbar_translate_failed', [localizedMessage], `翻译执行失败: ${localizedMessage}`));
        }
    } else {
        console.warn('[Toolsbar] 翻译模块未就绪:', translationModule);
        showErrorNotification(t('toolsbar_translate_not_ready', null, '翻译模块未就绪，请稍后再试或刷新页面'));
    }
}

function handleOpenSettings() {
    // 优先使用消息传递打开设置页面，这是最可靠的方式
    // 它可以处理扩展上下文失效、后台唤醒等情况
    if (chrome?.runtime?.sendMessage) {
        try {
            chrome.runtime.sendMessage({ action: 'openOptionsPage' }, (response) => {
                // 必须在回调中检查 lastError 以消除控制台错误 "Unchecked runtime.lastError"
                if (chrome.runtime.lastError) {
                    console.warn('[Toolsbar] 发送打开设置请求失败:', chrome.runtime.lastError.message);
                    // 如果消息发送失败（例如后台未响应），尝试直接打开URL
                    openSettingsByUrl();
                } else if (response && response.error) {
                     console.warn('[Toolsbar] 后台打开设置失败:', response.error);
                     openSettingsByUrl();
                }
            });
        } catch (error) {
            console.warn('[Toolsbar] 发送消息异常 (可能是上下文失效):', error);
            openSettingsByUrl();
        }
    } else {
        // 如果 runtime 不可用，直接尝试 URL
        openSettingsByUrl();
    }
}

function fallbackOpenSettings() {
    handleOpenSettings();
}

function openSettingsByUrl() {
    if (chrome?.runtime?.getURL) {
        try {
            const url = chrome.runtime.getURL('html/options.html');
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (e) {
            console.error('[Toolsbar] 无法构建设置页面 URL:', e);
        }
    }
}

async function handleSummary() {
    //console.log('开始生成页面总结');
    const summaryModule = getSummaryModuleInstance();
    if (summaryModule && typeof summaryModule.summarizePage === 'function') {
        try {
            await summaryModule.summarizePage();
        } catch (error) {
            console.error('[Toolsbar] 总结生成失败:', error);
            showErrorNotification(t('toolsbar_summary_failed', [error.message], `总结生成失败: ${error.message}`));
        }
    } else {
        console.warn('[Toolsbar] 总结模块未就绪:', summaryModule);
        showErrorNotification(t('toolsbar_summary_not_ready', null, '总结模块未就绪，请稍后再试或刷新页面'));
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    //console.log('[Toolsbar] 收到消息:', request);
    
    switch (request.type || request.command || request.action) {
        case 'requestSummary':
            handleSummaryRequest();
            break;
        case 'translatePage':
            handleTranslate({ mode: request.mode, directStart: Boolean(request.directStart) });
            break;
        case 'summarizePage':
            handleSummary();
            break;
        case 'downloadAllImages':
            handleBatchDownload();
            break;
        case 'toggleElementHighlight':
            handleElementHighlight();
            break;
        case 'toggleSidebar':
            if (window.NWSSidebarController) {
                window.NWSSidebarController.toggleSidebar();
                sendResponse({ success: true });
            } else {
                console.warn('[Toolsbar] SidebarController 不存在');
                sendResponse({ success: false, error: 'SidebarController 不存在' });
            }
            break;
        default:
            //console.log('[Toolsbar] 未处理的消息类型:', request.type || request.command || request.action);
            sendResponse({ success: false, error: '未支持的操作' });
    }
});

function updateToolbarSettings(settings) {
    //console.log('[Toolsbar] 更新设置:', settings);
    
    const toolbar = document.getElementById('nws-toolbar');
    if (!toolbar) {
        console.warn('[Toolsbar] 工具栏元素不存在');
        return;
    }
    
    if (settings.toolbarVisible !== undefined) {
        if (settings.toolbarVisible) {
            toolbar.style.setProperty('display', 'flex', 'important');
            //console.log('[Toolsbar] 工具栏已显示');
        } else {
            toolbar.style.setProperty('display', 'none', 'important');
            //console.log('[Toolsbar] 工具栏已隐藏');
        }
    }
    
    if (settings.featureToggles) {
        const downloadBtn = toolbarSafeQuerySelector('[data-action="batch-download"]', toolbar);
        if (downloadBtn) {
            downloadBtn.style.display = settings.featureToggles.download ? 'flex' : 'none';
        }
        
        const translateBtn = toolbarSafeQuerySelector('[data-action="translate"]', toolbar);
        if (translateBtn) {
            translateBtn.style.display = settings.featureToggles.translate ? 'flex' : 'none';
        }
        
        const summaryBtn = toolbarSafeQuerySelector('[data-action="summary"]', toolbar);
        if (summaryBtn) {
            summaryBtn.style.display = settings.featureToggles.summary ? 'flex' : 'none';
        }
        
        const highlightBtn = toolbarSafeQuerySelector('[data-action="element-highlight"]', toolbar);
        if (highlightBtn) {
            highlightBtn.style.display = settings.featureToggles.highlight ? 'flex' : 'none';
        }
        
        //console.log('[Toolsbar] 功能开关已更新');
    }
}

async function handleSummaryRequest() {
    try {
        const summaryModule = getSummaryModuleInstance();
        if (summaryModule && typeof summaryModule.summarizePage === 'function') {
            await summaryModule.summarizePage();
        } else {
            console.warn('[Toolsbar] SummaryModule 未就绪');
        }
    } catch (error) {
        console.error('[Toolsbar] 生成摘要失败:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    //console.log('[Toolsbar] DOM加载完成，准备初始化工具栏');
    initToolbar().then((created) => {
        if (created) {
            loadAndApplySettings();
        }
    });
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    //console.log('[Toolsbar] 页面已加载，直接初始化工具栏');
    initToolbar().then((created) => {
        if (created) {
            loadAndApplySettings();
        }
    });
}

async function loadAndApplySettings() {
    try {
        await new Promise(resolve => setTimeout(resolve, 100));
        const chromeSettings = window.NWSModules?.ChromeSettingsModule;
        if (!chromeSettings || typeof chromeSettings.getStorage !== 'function') {
            throw new Error('ChromeSettingsModule 未就绪');
        }
        const result = await chromeSettings.getStorage([
            'toolbarVisible', 
            'featureToggles'
        ]);
        
        updateToolbarSettings({
            toolbarVisible: result.toolbarVisible === undefined ? true : result.toolbarVisible,
            featureToggles: result.featureToggles || {
                download: true,
                translate: true,
                summary: true,
                highlight: true
            }
        });
    } catch (error) {
        console.warn('[Toolsbar] 加载设置失败:', error);
    }
}
