
/**
 * toolsbar.js - 网页右侧悬浮工具栏
 * 提供批量下载图片、翻译网页、总结网页等功能
 * 重构版本：UI内容已分离到独立的CSS和HTML模板文件
 */

// 使用全局DOM工具函数，避免重复声明
const toolbarSafeQuerySelector = window.DOMHelper?.safeQuerySelector || ((selector) => {
    try {
        return document.querySelector(selector);
    } catch (e) {
        console.warn('querySelector 失败:', selector, e);
        return null;
    }
});

const toolbarSafeQuerySelectorAll = window.DOMHelper?.safeQuerySelectorAll || ((selector) => {
    try {
        return document.querySelectorAll(selector);
    } catch (e) {
        console.warn('querySelectorAll 失败:', selector, e);
        return [];
    }
});

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
                text: '批量下载', 
                class: 'nws-button-download' 
            },
            { 
                action: 'translate', 
                icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`, 
                text: '翻译页面', 
                class: 'nws-button-translate' 
            },
            { 
                action: 'summary', 
                icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>`, 
                text: '页面总结', 
                class: 'nws-button-summary' 
            },
            { 
                action: 'element-highlight', 
                icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>`, 
                text: '元素高亮', 
                class: 'nws-button-highlight' 
            },
            { 
                action: 'settings', 
                icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`, 
                text: '设置中心', 
                class: 'nws-button-settings' 
            }
        ];
        
        buttons.forEach(btnConfig => {
            const button = document.createElement('button');
            button.className = `nws-toolbar-button ${btnConfig.class}`;
            button.dataset.action = btnConfig.action;
            button.dataset.tooltip = btnConfig.text; // 设置提示文字
            button.innerHTML = `
                <div class="nws-button-icon">${btnConfig.icon}</div>
            `;
            buttonContainer.appendChild(button);
        });
        
        toolbar.appendChild(buttonContainer);
        return toolbar;
    }

    createBatchDownloadModal(images) {
        // 创建批量下载模态框
        const modal = document.createElement('div');
        modal.id = 'nws-batch-download-modal';
        modal.className = 'nws-batch-modal';
        
        // 使用 all: initial 隔离外部样式，并恢复内部盒模型
        modal.style.cssText = 'all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; box-sizing: border-box; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10001; display: flex; align-items: center; justify-content: center;';

        modal.innerHTML = `
            <div class="nws-batch-modal-content">
                <div class="nws-modal-header">
                    <div class="nws-modal-title">
                        <div class="nws-title-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </div>
                        <div class="nws-title-text">
                            <span>批量下载图片</span>
                            <span class="nws-title-badge">共 ${images.length} 张</span>
                        </div>
                    </div>
                    <button class="nws-modal-close" data-action="close" title="关闭">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="nws-modal-controls">
                    <button class="nws-button nws-button-secondary" data-action="toggle-all">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                        <span>全选 / 反选</span>
                    </button>
                    <div style="flex: 1;"></div>
                    <button class="nws-button nws-button-primary" data-action="start-download">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        <span>开始下载</span>
                    </button>
                </div>
                <div class="nws-modal-body">
                    <div class="nws-image-grid" id="nws-image-grid"></div>
                </div>
            </div>
        `;

        const imageGrid = modal.querySelector('#nws-image-grid');
        images.forEach((img, index) => {
            const src = img.src || img.dataset.src;
            const imageItem = document.createElement('div');
            imageItem.className = 'nws-image-item selected';
            imageItem.dataset.index = index;
            imageItem.dataset.src = src;
            imageItem.innerHTML = `
                <div class="nws-image-card">
                    <div class="nws-image-wrapper">
                        <img src="${src}" class="nws-image-thumbnail" alt="预览" loading="lazy">
                        <div class="nws-image-overlay">
                            <div class="nws-image-checkbox-custom">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                        </div>
                    </div>
                    <div class="nws-image-info">
                        <div class="nws-image-meta">
                            <span class="nws-image-size">${img.naturalWidth || '?'} × ${img.naturalHeight || '?'}</span>
                            <span class="nws-image-status pending">等待下载</span>
                        </div>
                    </div>
                    <input type="checkbox" class="nws-image-checkbox" checked style="display: none;">
                </div>
            `;
            
            // 点击图片项切换选中状态
            imageItem.addEventListener('click', (e) => {
                const checkbox = imageItem.querySelector('.nws-image-checkbox');
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
        // 使用 all: initial 隔离并应用基本样式
        notification.style.cssText = 'all: initial; position: fixed; top: 20px; right: 20px; background: #fff8f8; border-left: 4px solid #dc3545; border-radius: 8px; padding: 12px 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); z-index: 10002; display: flex; align-items: center; gap: 12px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 350px; animation: nws-slideInFromRight 0.3s ease-out;';
        
        notification.innerHTML = `
            <span class="nws-error-icon" style="font-size: 20px;">⚠️</span>
            <div class="nws-error-content" style="flex: 1;">
                <div class="nws-error-title" style="font-weight: 700; color: #dc3545; font-size: 14px; margin-bottom: 2px;">错误</div>
                <div class="nws-error-message" style="color: #666; font-size: 13px; line-height: 1.4;">${message}</div>
            </div>
            <button class="nws-close-btn" data-action="close" style="background: none; border: none; color: #999; cursor: pointer; font-size: 18px; padding: 4px;">×</button>
        `;
        return notification;
    }

    createSuccessNotification(title, content) {
        const notification = document.createElement('div');
        notification.className = 'nws-success-notification';
        notification.style.cssText = 'all: initial; position: fixed; top: 20px; right: 20px; background: #f8fff9; border-left: 4px solid #28a745; border-radius: 8px; padding: 12px 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); z-index: 10002; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 350px; animation: nws-slideInFromRight 0.3s ease-out;';
        
        notification.innerHTML = `
            <div class="nws-notification-title" style="font-weight: 700; color: #28a745; font-size: 14px; margin-bottom: 4px;">🎯 ${title}</div>
            <div class="nws-notification-content" style="color: #666; font-size: 13px; line-height: 1.4;">${content}</div>
        `;
        return notification;
    }

    createLoadingOverlay(message, icon = '⏳') {
        const overlay = document.createElement('div');
        overlay.className = 'nws-loading-overlay';
        overlay.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px); z-index: 10003; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
        
        overlay.innerHTML = `
            <div class="nws-loading-content" style="background: #1a1f2c; padding: 30px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; gap: 16px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); min-width: 280px;">
                <div class="nws-loading-icon" style="font-size: 40px; animation: nws-spin 2s linear infinite;">${icon}</div>
                <div class="nws-loading-message" style="color: white; font-size: 16px; font-weight: 500;">${message}</div>
                <div class="nws-progress-container" style="width: 100%; height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; overflow: hidden; margin-top: 8px;">
                    <div class="nws-progress-fill" style="width: 0%; height: 100%; background: #7e57c2; transition: width 0.3s ease;"></div>
                </div>
                <div class="nws-progress-text" style="color: rgba(255, 255, 255, 0.5); font-size: 12px;">准备中...</div>
            </div>
        `;
        return overlay;
    }

    createModernModal(title, icon, content) {
        const modal = document.createElement('div');
        modal.className = 'nws-modern-modal';
        modal.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(5, 8, 12, 0.72); backdrop-filter: blur(10px); z-index: 10004; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
        
        modal.innerHTML = `
            <div class="nws-modal-content" style="background: var(--panel); width: 92%; max-width: 920px; max-height: 85vh; border-radius: 18px; border: 1px solid var(--border); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; overflow: hidden; animation: nws-slide-up 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);">
                <div class="nws-modal-header" style="padding: 20px 28px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%);">
                    <div class="nws-header-content" style="display: flex; align-items: center; gap: 12px;">
                        <span class="nws-header-icon" style="font-size: 22px;">${icon}</span>
                        <h2 class="nws-header-title" style="margin: 0; font-size: 18px; font-weight: 600; color: var(--text); letter-spacing: 0.2px;">${title}</h2>
                    </div>
                    <button class="nws-close-btn" data-action="close" style="background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 22px; padding: 6px; border-radius: 10px;">×</button>
                </div>
                <div class="nws-modal-body" style="padding: 24px 28px 28px; overflow-y: auto; color: var(--text); line-height: 1.7; font-size: 15px; background: var(--panel);">
                    ${content}
                </div>
            </div>
        `;
        
        // 添加关闭事件
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.dataset.action === 'close') {
                modal.remove();
            }
        });
        
        return modal;
    }
}

// 创建全局UI管理器实例
window.uiManager = new ToolbarUIManager();
const uiManager = window.uiManager;

// 通知显示函数
function showErrorNotification(message) {
    const notification = uiManager.createErrorNotification(message);
    if (notification) {
        document.body.appendChild(notification);
        
        // 5秒后自动消失
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
        
        // 添加关闭按钮事件
        const closeBtn = notification.querySelector('.nws-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => notification.remove());
        }
    }
}

function showSuccessNotification(title, content) {
    const notification = uiManager.createSuccessNotification(title, content);
    if (notification) {
        document.body.appendChild(notification);
        
        // 5秒后自动消失
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

function createLoadingOverlay(message, icon = '⏳') {
    return uiManager.createLoadingOverlay(message, icon);
}

function createModernModal(title, icon, content) {
    return uiManager.createModernModal(title, icon, content);
}

// 初始化工具栏
async function initToolbar() {
    console.log('[Toolsbar] 开始初始化工具栏');
    
    // 检查是否已存在工具栏
    if (document.getElementById('nws-toolbar')) {
        return;
    }
    
    try {
        // 初始化UI管理器
        await uiManager.init();
        
        // 创建工具栏
        const toolbar = uiManager.createToolbar();
        if (!toolbar) {
            console.error('[Toolsbar] 无法创建工具栏');
            return;
        }
        
        // 添加事件监听器
        toolbar.addEventListener('click', handleToolbarClick);
        
        // 添加工具栏到页面
        document.body.appendChild(toolbar);
        console.log('[Toolsbar] 工具栏初始化完成');
        
    } catch (error) {
        console.error('[Toolsbar] 初始化失败:', error);
    }
}

// 工具栏点击事件处理
function handleToolbarClick(event) {
    const button = event.target.closest('.nws-toolbar-button');
    if (!button) return;
    
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

// 批量下载图片处理函数
function handleBatchDownload() {
    console.log('开始批量下载图片');
    batchDownloadImages();
}

// 元素高亮处理函数
function handleElementHighlight() {
    console.log('切换元素高亮功能');
    
    // 检查ElementHighlighterModule是否可用
    if (!window.NWSModules || !window.NWSModules.ElementHighlighterModule) {
        showErrorNotification('元素高亮模块未加载，请刷新页面重试');
        return;
    }
    
    const highlighter = window.NWSModules.ElementHighlighterModule;
    const button = document.querySelector('.nws-button-highlight');
    
    // 使用ElementHighlighterModule的enabled状态来判断
    const isCurrentlyEnabled = highlighter.enabled;
    console.log("当前高亮状态 - enabled:", isCurrentlyEnabled);
    console.log("当前高亮状态 - isActive:", highlighter.isActive);
    
    if (!isCurrentlyEnabled) {
        // 启用高亮功能
        console.log(highlighter)
        highlighter.enable().then(() => {
            if (button) {
                button.classList.add('active');
                const textElement = button.querySelector('.nws-button-text');
                if (textElement) {
                    textElement.textContent = '关闭高亮';
                }
            }
            
            // 显示使用提示
            showSuccessNotification('元素高亮已启用', '• 鼠标悬停查看元素信息<br>• 右键显示操作菜单<br>• Ctrl+C 复制选择器<br>• Ctrl+Shift+C 复制样式');
            
            console.log('[ElementHighlight] 元素高亮功能已启用');
        }).catch(error => {
            console.error('[ElementHighlight] 启用失败:', error);
            showErrorNotification('启用元素高亮功能失败: ' + error.message);
        });
    } else {
        // 禁用高亮功能
        highlighter.disable().then(() => {
            if (button) {
                button.classList.remove('active');
                const textElement = button.querySelector('.nws-button-text');
                if (textElement) {
                    textElement.textContent = '元素高亮';
                }
            }
            
            // 显示禁用提示
            showSuccessNotification('元素高亮已禁用', '');
            
            console.log('[Toolsbar] 元素高亮功能已禁用');
        }).catch(error => {
            console.error('[ElementHighlight] 禁用失败:', error);
            showErrorNotification('禁用元素高亮功能失败: ' + error.message);
        });
    }
}

async function batchDownloadImages() {
    const images = document.querySelectorAll('img');
    const validImages = Array.from(images).filter(img => {
        const src = img.src || img.dataset.src;
        return src && !src.startsWith('data:') && src.length > 10;
    });

    if (validImages.length === 0) {
        showErrorNotification('未找到可下载的图片');
        return;
    }

    // 创建批量下载界面
    const downloadModal = uiManager.createBatchDownloadModal(validImages);
    if (downloadModal) {
        // 添加事件监听器
        setupModalEventListeners(downloadModal);
        document.body.appendChild(downloadModal);
    }
}

// 设置模态框事件监听器
function setupModalEventListeners(modal) {
    // 点击背景关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // 按钮事件
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

// 全选/取消功能
function toggleAllImages(button) {
    const modal = button.closest('.nws-batch-modal');
    if (!modal) return;
    const checkboxes = modal.querySelectorAll('.nws-image-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
        const item = cb.closest('.nws-image-item');
        if (item) item.classList.toggle('selected', cb.checked);
    });
}

// 开始批量下载按钮点击处理
function startBatchDownload(button) {
    const modal = button.closest('.nws-batch-modal');
    if (!modal) return;
    
    const checkedItems = modal.querySelectorAll('.nws-image-checkbox:checked');
    if (checkedItems.length === 0) {
        showErrorNotification('请至少选择一张图片');
        return;
    }
    
    // 调用实际的下载逻辑
    if (typeof startBatchDownloadImpl === 'function') {
        startBatchDownloadImpl(button);
    } else {
        console.error('[BatchDownload] 下载实现函数未找到');
    }
}

// 全局暴露
window.toggleAllImages = toggleAllImages;
window.startBatchDownload = startBatchDownload;

// 批量下载实现函数
window.startBatchDownloadImpl = async function(button) {
    const modal = button.closest('.nws-batch-modal');
    const checkedItems = modal.querySelectorAll('.nws-image-checkbox:checked');
    
    if (checkedItems.length === 0) {
        showErrorNotification('请至少选择一张图片');
        return;
    }
    
    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = `
        <svg class="nws-animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
        正在准备...
    `;
    
    let completed = 0;
    const total = checkedItems.length;
    
    for (const checkbox of checkedItems) {
        const imageItem = checkbox.closest('.nws-image-item');
        const src = imageItem.dataset.src;
        const statusElement = imageItem.querySelector('.nws-image-status');
        
        try {
            statusElement.textContent = '下载中...';
            statusElement.className = 'nws-image-status downloading';
            
            await downloadImage(src);
            
            statusElement.textContent = '已完成';
            statusElement.className = 'nws-image-status success';
            
        } catch (error) {
            console.error('[BatchDownload] 下载失败:', src, error);
            statusElement.textContent = '失败';
            statusElement.className = 'nws-image-status error';
        }
        
        completed++;
        button.innerHTML = `
            <svg class="nws-animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
            下载中 (${completed}/${total})
        `;
        
        // 延迟避免浏览器压力
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    button.disabled = false;
    button.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
        下载完成
    `;
    button.classList.add('success');
    
    // 3秒后恢复按钮状态
    setTimeout(() => {
        button.innerHTML = originalHTML;
        button.classList.remove('success');
    }, 3000);
}

/**
 * 清理图片 URL，移除 CDN 处理参数（如 @, ?, ! 后缀）
 * @param {string} url 原始 URL
 * @returns {string} 清理后的 URL
 */
function cleanImageUrl(url) {
    if (!url) return url;
    
    try {
        // 1. 处理 @ 符号后的图片处理参数 (常用于 Bilibili, 阿里云 OSS 等)
        let cleaned = url.split('@')[0];
        
        // 2. 处理 ? 后的查询参数
        cleaned = cleaned.split('?')[0];
        
        // 3. 处理 ! 后的样式参数 (常用于又拍云等)
        // 只有当 ! 出现在常见的图片扩展名之后时才切除
        const lastDotIndex = cleaned.lastIndexOf('.');
        if (lastDotIndex !== -1) {
            const afterDot = cleaned.substring(lastDotIndex + 1).toLowerCase();
            // 常见的图片扩展名列表
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

// 下载图片到本地
async function downloadImage(imageUrl) {
    return new Promise((resolve, reject) => {
        // 清理 URL 移除多余参数
        const cleanedUrl = cleanImageUrl(imageUrl);
        console.log('[BatchDownload] 开始下载图片:', { original: imageUrl, cleaned: cleanedUrl });
        
        // 创建一个临时的a标签用于下载
        const link = document.createElement('a');
        link.style.display = 'none';
        
        // 处理跨域图片下载
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
                
                // 从清理后的 URL 中提取文件名
                let filename = 'image';
                try {
                    const urlObj = new URL(cleanedUrl);
                    const pathname = urlObj.pathname;
                    filename = pathname.split('/').pop() || 'image';
                } catch (e) {
                    // 如果 URL 解析失败，从字符串中提取
                    filename = cleanedUrl.split('/').pop() || 'image';
                }
                
                // 确保文件有扩展名
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
                        filename += '.jpg'; // 默认扩展名
                    }
                }
                
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                console.log('[BatchDownload] 图片下载完成:', filename);
                resolve(filename);
            })
            .catch(error => {
                console.error('[BatchDownload] 图片下载失败 (清理后):', error);
                // 如果清理后的 URL 下载失败，尝试使用原始 URL 下载（最后的回退方案）
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

// 添加CSS动画
if (!document.getElementById('modern-ui-styles')) {
    const styles = document.createElement('style');
    styles.id = 'modern-ui-styles';
    styles.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideIn {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        .nws-translation-block {
            background: var(--panel-lighter);
            padding: 18px 20px;
            border-radius: 12px;
            margin-bottom: 16px;
            border: 1px solid var(--border);
            border-left: 4px solid var(--accent);
            color: var(--text);
            box-shadow: var(--shadow-sm);
            line-height: 1.75;
        }
        
        .nws-summary-content {
            background: var(--panel-lighter);
            padding: 22px 24px;
            border-radius: 14px;
            border: 1px solid var(--border);
            border-left: 4px solid var(--accent);
            font-size: 16px;
            line-height: 1.85;
            color: var(--text);
            box-shadow: var(--shadow-sm);
        }

        .nws-translation-options {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .nws-translation-options-row {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
        }

        .nws-translation-option {
            background: var(--panel);
            border: 1px solid var(--border);
            color: var(--text);
            padding: 12px 14px;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.2px;
        }

        .nws-translation-option:hover {
            background: var(--panel-lighter);
            border-color: var(--accent);
            transform: translateY(-1px);
        }

        .nws-translation-toggle {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border-radius: 10px;
            border: 1px solid var(--border);
            background: rgba(255, 255, 255, 0.02);
            color: var(--text);
            font-size: 14px;
        }

        .nws-translation-toggle input {
            accent-color: var(--accent);
        }

        .nws-translation-hint {
            color: var(--text-dim);
            font-size: 13px;
            line-height: 1.5;
        }

        .nws-modern-modal .nws-close-btn:hover {
            background: rgba(255, 255, 255, 0.06);
            color: var(--text);
        }
        
        /* 思考内容样式 - 仅针对思考标签 */
        .nws-think-content {
            font-style: italic !important;
            text-decoration: underline !important;
            font-size: 8px !important;
            color: #dc3545 !important;
            display: block;
            margin: 8px 0;
            padding: 4px 8px;
            background: rgba(220, 53, 69, 0.1);
            border-left: 2px solid #dc3545;
            border-radius: 4px;
            font-family: inherit;
            line-height: 1.4;
        }
    `;
    document.head.appendChild(styles);
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
                <button class="nws-translation-option" data-mode="replace">替换模式</button>
                <button class="nws-translation-option" data-mode="bilingual">对照模式</button>
            </div>
            <label class="nws-translation-toggle">
                <input class="nws-translation-toggle-input" type="checkbox" />
                <span>启用划词翻译</span>
            </label>
            <label class="nws-translation-toggle">
                <input class="nws-translation-lazy-toggle" type="checkbox" />
                <span>启用懒翻译（视口优先）</span>
            </label>
            <div class="nws-translation-hint">翻译会优先处理当前视口内容，滚动页面继续翻译</div>
        </div>
    `;

    const modal = window.uiManager.createModernModal('页面翻译', icon, content);
    document.body.appendChild(modal);

    const safeQuerySelector = window.DOMHelper?.safeQuerySelector || toolbarSafeQuerySelector;
    const safeQuerySelectorAll = window.DOMHelper?.safeQuerySelectorAll || toolbarSafeQuerySelectorAll;
    if (!safeQuerySelector || !safeQuerySelectorAll) return;

    const optionButtons = safeQuerySelectorAll('.nws-translation-option', modal);
    Array.from(optionButtons).forEach((button) => {
        button.addEventListener('click', async () => {
            const mode = button.dataset.mode;
            console.log('[Toolsbar] 点击翻译模式按钮:', mode, '模块:', translationModule);
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

// 翻译页面处理函数
async function handleTranslate(options = {}) {
    console.log('开始翻译页面');
    const translationModule = getTranslationModuleInstance();
    if (translationModule) {
        try {
            if (options.mode) {
                await translationModule.translatePage(null, options.mode);
                return;
            }
            if (options.directStart) {
                await translationModule.translatePage();
                return;
            }
            const mode = translationModule.config?.translationMode || 'bilingual';
            await translationModule.translatePage(null, mode);
        } catch (error) {
            console.error('[Toolsbar] 翻译执行失败:', error);
            showErrorNotification('翻译执行失败: ' + error.message);
        }
    } else {
        console.warn('[Toolsbar] 翻译模块未就绪:', translationModule);
        showErrorNotification('翻译模块未就绪，请稍后再试或刷新页面');
    }
}

function handleOpenSettings() {
    try {
        if (chrome?.runtime?.openOptionsPage) {
            chrome.runtime.openOptionsPage();
            return;
        }
        if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ action: 'openOptionsPage' }, () => {});
            return;
        } else if (chrome?.runtime?.getURL) {
            const url = chrome.runtime.getURL('html/options.html');
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    } catch (error) {
        console.warn('[Toolsbar] 无法打开设置页面:', error);
    }
}

// 总结页面处理函数
async function handleSummary() {
    console.log('开始生成页面总结');
    const summaryModule = getSummaryModuleInstance();
    if (summaryModule && typeof summaryModule.summarizePage === 'function') {
        try {
            await summaryModule.summarizePage();
        } catch (error) {
            console.error('[Toolsbar] 总结生成失败:', error);
            showErrorNotification('总结生成失败: ' + error.message);
        }
    } else {
        console.warn('[Toolsbar] 总结模块未就绪:', summaryModule);
        showErrorNotification('总结模块未就绪，请稍后再试或刷新页面');
    }
}

// 监听来自其他扩展组件的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Toolsbar] 收到消息:', request);
    
    switch (request.type || request.command || request.action) {
        case 'requestSummary':
            // 工具面板请求页面摘要
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
            // 侧边栏切换消息，转发给SidebarController
            if (window.NWSSidebarController) {
                window.NWSSidebarController.toggleSidebar();
                sendResponse({ success: true });
            } else {
                console.warn('[Toolsbar] SidebarController 不存在');
                sendResponse({ success: false, error: 'SidebarController 不存在' });
            }
            break;
        default:
            console.log('[Toolsbar] 未处理的消息类型:', request.type || request.command || request.action);
            sendResponse({ success: false, error: '未支持的操作' });
    }
});

// 更新工具栏设置
function updateToolbarSettings(settings) {
    console.log('[Toolsbar] 更新设置:', settings);
    
    // 获取工具栏元素
    const toolbar = document.getElementById('nws-toolbar');
    if (!toolbar) {
        console.warn('[Toolsbar] 工具栏元素不存在');
        return;
    }
    
    // 更新工具栏显示状态
    if (settings.toolbarVisible !== undefined) {
        if (settings.toolbarVisible) {
            toolbar.style.setProperty('display', 'flex', 'important');
            console.log('[Toolsbar] 工具栏已显示');
        } else {
            toolbar.style.setProperty('display', 'none', 'important');
            console.log('[Toolsbar] 工具栏已隐藏');
        }
    }
    
    // 更新功能开关（可以通过CSS类或直接移除/添加按钮来实现）
    if (settings.featureToggles) {
        // 批量下载按钮
        const downloadBtn = toolbar.querySelector('[data-action="batch-download"]');
        if (downloadBtn) {
            downloadBtn.style.display = settings.featureToggles.download ? 'flex' : 'none';
        }
        
        // 翻译按钮
        const translateBtn = toolbar.querySelector('[data-action="translate"]');
        if (translateBtn) {
            translateBtn.style.display = settings.featureToggles.translate ? 'flex' : 'none';
        }
        
        // 总结按钮
        const summaryBtn = toolbar.querySelector('[data-action="summary"]');
        if (summaryBtn) {
            summaryBtn.style.display = settings.featureToggles.summary ? 'flex' : 'none';
        }
        
        // 高亮按钮
        const highlightBtn = toolbar.querySelector('[data-action="element-highlight"]');
        if (highlightBtn) {
            highlightBtn.style.display = settings.featureToggles.highlight ? 'flex' : 'none';
        }
        
        console.log('[Toolsbar] 功能开关已更新');
    }
}

// 处理摘要请求
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

// 在页面加载完成后初始化工具栏
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Toolsbar] DOM加载完成，准备初始化工具栏');
    initToolbar().then(() => {
        // 工具栏初始化完成后，加载并应用设置
        loadAndApplySettings();
    });
});

// 添加备用初始化方法
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('[Toolsbar] 页面已加载，直接初始化工具栏');
    initToolbar().then(() => {
        // 工具栏初始化完成后，加载并应用设置
        loadAndApplySettings();
    });
}

// 加载并应用设置
async function loadAndApplySettings() {
    try {
        // 等待一段时间确保Chrome API可用
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const result = await chrome.storage.sync.get([
            'toolbarVisible', 
            'featureToggles'
        ]);
        
        // 应用设置
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
