/**
 * ImageDownloaderModule.js - 图片下载模块
 * 提供批量图片下载功能，支持多种图片格式和下载策略
 */

 (function() {
    'use strict';
    
    // 从全局模块系统获取ModuleBase
    let ModuleBase;
    if (window.NWSModules) {
        ModuleBase = window.NWSModules.get('ModuleBase');
    }
    
    // 获取工具类
    const ConfigManager = window.ConfigManager;
    const StyleManager = window.StyleManager;
    
    // 从全局模块系统获取工具函数，使用别名避免冲突
    const imageSafeQuerySelector = window.DOMHelper?.safeQuerySelector || window.NWSModules?.utils?.safeQuerySelector;
    const imageSafeQuerySelectorAll = window.DOMHelper?.safeQuerySelectorAll || window.NWSModules?.utils?.safeQuerySelectorAll;
    const imageSafeAddEventListener = window.NWSModules?.utils?.safeAddEventListener;
    const imageSafeRemoveEventListener = window.NWSModules?.utils?.safeRemoveEventListener;

class ImageDownloaderModule extends ModuleBase {
    constructor(name, options = {}) {
        super(name, {
            version: '1.0.0',
            dependencies: ['ChromeSettingsModule', 'NotificationModule'],
            defaultConfig: {
                enabled: true,
                minImageSize: 50, // 最小图片尺寸
                showDownloadButton: true,
                buttonPosition: 'top-right', // top-right, top-left, bottom-right, bottom-left
                autoDetect: true, // 自动检测新图片
                supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
                downloadPath: '', // 下载路径
                filenameTemplate: '{index}_{timestamp}_{original}' // 文件名模板
            },
            ...options
        });

        this.processedImages = new WeakSet();
        this.downloadButtons = new WeakMap();
        this.observer = null;
        this.downloadCounter = 0;
        this.configManager = null;
    }

    async onInitialize() {
        // 检查依赖模块
        this.chromeSettings = window.NWSModules?.ChromeSettingsModule;
        this.notification = window.NWSModules?.NotificationModule;

        if (!this.chromeSettings) {
            throw new Error('ChromeSettingsModule 依赖未找到');
        }

        // 初始化配置管理器
        this.configManager = new ConfigManager(
            this.chromeSettings,
            this.name,
            this.defaultConfig
        );

        // 添加配置验证器
        this.configManager
            .addValidator('enabled', v => typeof v === 'boolean')
            .addValidator('minImageSize', v => v > 0 && v <= 1000)
            .addValidator('showDownloadButton', v => typeof v === 'boolean')
            .addValidator('buttonPosition', v => ['top-right', 'top-left', 'bottom-right', 'bottom-left'].includes(v))
            .addValidator('autoDetect', v => typeof v === 'boolean')
            .addValidator('supportedFormats', v => Array.isArray(v) && v.length > 0)
            .addValidator('filenameTemplate', v => typeof v === 'string' && v.length > 0);

        // 加载配置
        this.config = await this.configManager.load();

        // 初始化图片处理
        if (this.config.enabled) {
            await this.initializeImageProcessing();
        }

        // 监听配置变化
        this.configManager.addObserver((newConfig) => {
            this.config = newConfig;
            this.handleConfigChange();
        });
    }

    async onDestroy() {
        try {
            // 停止图片观察器
            this.stopImageObserver();
            
            // 移除所有下载按钮
            this.removeAllDownloadButtons();
            
            // 销毁配置管理器
            if (this.configManager) {
                this.configManager.destroy();
            }
            
            // 清理其他引用
            this.processedImages = new WeakSet();
            this.downloadButtons = new WeakMap();
            
            console.log('[ImageDownloader] 模块已销毁');
        } catch (error) {
            console.error('[ImageDownloader] 销毁模块时出错:', error);
        }
    }

    async onEnable() {
        await this.initializeImageProcessing();
    }

    async onDisable() {
        this.removeAllDownloadButtons();
        this.stopImageObserver();
    }

    /**
     * 初始化图片处理
     */
    async initializeImageProcessing() {
        // 处理现有图片
        await this.processExistingImages();

        // 启动图片观察器
        if (this.config.autoDetect) {
            this.startImageObserver();
        }
    }

    /**
     * 处理现有图片
     */
    async processExistingImages() {
        const images = imageSafeQuerySelectorAll ? imageSafeQuerySelectorAll('img') : document.querySelectorAll('img');
        const unprocessedImages = Array.from(images).filter(img => !this.processedImages.has(img));
        
        if (unprocessedImages.length === 0) return;
        
        await Promise.allSettled(
            unprocessedImages.map(img => this.processImage(img))
        );
    }

    /**
     * 处理单个图片
     * @param {HTMLImageElement} img 图片元素
     */
    async processImage(img) {
        if (this.processedImages.has(img)) return;

        // 等待图片加载完成
        if (!img.complete) {
            await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
                // 设置超时避免无限等待
                setTimeout(resolve, 5000);
            });
        }

        // 检查图片是否符合条件
        if (!this.shouldProcessImage(img)) {
            return;
        }

        // 标记为已处理
        this.processedImages.add(img);

        // 添加下载按钮
        if (this.config.showDownloadButton) {
            this.addDownloadButton(img);
        }

        this.emit('imageProcessed', { img });
    }

    /**
     * 检查图片是否应该处理
     * @param {HTMLImageElement} img 图片元素
     * @returns {boolean}
     */
    shouldProcessImage(img) {
        // 检查图片尺寸
        const rect = img.getBoundingClientRect();
        if (rect.width < this.config.minImageSize || rect.height < this.config.minImageSize) {
            return false;
        }

        // 检查图片格式
        const src = img.src || img.dataset.src || '';
        if (!src) return false;

        const extension = this.getImageExtension(src);
        if (extension && !this.config.supportedFormats.includes(extension.toLowerCase())) {
            return false;
        }

        // 检查是否已经有下载按钮
        if (this.downloadButtons.has(img)) {
            return false;
        }

        return true;
    }

    /**
     * 添加下载按钮
     * @param {HTMLImageElement} img 图片元素
     */
    addDownloadButton(img) {
        // 创建容器
        const container = this.createImageContainer(img);
        
        // 创建下载按钮
        const button = this.createDownloadButton(img);
        
        // 添加到容器
        container.appendChild(button);
        
        // 保存引用
        this.downloadButtons.set(img, { container, button });

        // 添加事件监听
        this.setupImageEvents(img, container, button);
    }

    /**
     * 创建图片容器
     * @param {HTMLImageElement} img 图片元素
     * @returns {HTMLElement}
     */
    createImageContainer(img) {
        // 检查是否已经有容器
        if (img.parentNode && img.parentNode.classList.contains('nws-image-container')) {
            return img.parentNode;
        }

        const container = document.createElement('div');
        container.className = 'nws-image-container';
        
        // 获取图片的计算样式
        const style = window.getComputedStyle(img);
        const rect = img.getBoundingClientRect();
        
        // 1. 处理定位
        if (style.position !== 'static') {
            container.style.position = style.position;
            container.style.top = style.top;
            container.style.right = style.right;
            container.style.bottom = style.bottom;
            container.style.left = style.left;
            container.style.zIndex = style.zIndex;
            container.style.transform = style.transform;
        }

        // 2. 处理显示模式
        if (style.display === 'block') {
            container.style.display = 'block';
        } else {
            container.style.display = 'inline-block';
        }
        container.style.verticalAlign = style.verticalAlign;

        // 3. 处理浮动和边距
        container.style.float = style.float;
        container.style.margin = style.margin;
        
        // 4. 处理尺寸 (核心修复：确保容器有明确的宽高)
        // 使用 getBoundingClientRect 获取精确的渲染尺寸
        let width = rect.width || img.offsetWidth;
        let height = rect.height || img.offsetHeight;
        
        // 如果无法获取当前尺寸，尝试使用自然尺寸或样式尺寸
        if (!width || width === 0) {
            width = img.naturalWidth || (style.width !== 'auto' ? style.width : null);
        }
        if (!height || height === 0) {
            height = img.naturalHeight || (style.height !== 'auto' ? style.height : null);
        }
        
        if (width) {
            container.style.width = typeof width === 'number' ? `${width}px` : width;
        } else if (style.width === '100%' || style.maxWidth === '100%') {
            container.style.width = '100%';
        }
        
        if (height) {
            container.style.height = typeof height === 'number' ? `${height}px` : height;
        }
        
        // 5. 复制其他影响布局的属性
        container.style.maxWidth = style.maxWidth;
        container.style.maxHeight = style.maxHeight;
        container.style.flex = style.flex;
        container.style.gridArea = style.gridArea;
        container.style.objectFit = style.objectFit;

        // 插入容器
        img.parentNode.insertBefore(container, img);
        container.appendChild(img);
        
        // 重置图片样式以填满容器
        img.style.position = 'static';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.margin = '0';
        img.style.padding = '0';
        img.style.border = 'none';
        
        return container;
    }

    /**
     * 创建下载按钮
     * @param {HTMLImageElement} img 图片元素
     * @returns {HTMLElement}
     */
    createDownloadButton(img) {
        const button = document.createElement('button');
        button.className = `nws-download-button nws-download-button-${this.config.buttonPosition}`;
        button.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
        `;
        button.title = '下载图片';
        
        // 点击事件
        button.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.downloadImage(img);
        };

        return button;
    }

    /**
     * 设置图片事件
     * @param {HTMLImageElement} img 图片元素
     * @param {HTMLElement} container 容器元素
     * @param {HTMLElement} button 按钮元素
     */
    setupImageEvents(img, container, button) {
        // 鼠标悬停显示/隐藏按钮
        container.addEventListener('mouseenter', () => {
            button.style.display = 'flex';
        });

        container.addEventListener('mouseleave', () => {
            button.style.display = 'none';
        });

        // 图片加载错误处理
        img.addEventListener('error', () => {
            this.removeDownloadButton(img);
        });
    }

    /**
     * 下载图片
     * @param {HTMLImageElement} img 图片元素
     */
    async downloadImage(img) {
        try {
            const src = img.src || img.dataset.src;
            if (!src) {
                throw new Error('图片源地址不存在');
            }

            // 生成文件名
            const filename = this.generateFilename(img, src);
            
            // 使用Chrome下载API
            if (this.chromeSettings) {
                const downloadId = await this.chromeSettings.downloadFile({
                    url: src,
                    filename: filename,
                    saveAs: false
                });

                this.emit('imageDownloaded', { img, src, filename, downloadId });
                
                if (this.notification) {
                    this.notification.success(`图片下载开始: ${filename}`);
                }
            } else {
                // 降级到传统下载方式
                this.fallbackDownload(src, filename);
            }

        } catch (error) {
            console.error('[ImageDownloader] 下载图片失败:', error);
            
            if (this.notification) {
                this.notification.error(`图片下载失败: ${error.message}`);
            }
            
            this.emit('downloadError', { img, error });
        }
    }

    /**
     * 降级下载方式
     * @param {string} src 图片地址
     * @param {string} filename 文件名
     */
    fallbackDownload(src, filename) {
        const link = document.createElement('a');
        link.href = src;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * 批量下载图片
     * @param {Array<HTMLImageElement>} images 图片数组
     */
    async batchDownload(images = null) {
        const imagesToDownload = images || Array.from(imageSafeQuerySelectorAll('img')).filter(img => 
            this.processedImages.has(img) && this.shouldProcessImage(img)
        );

        if (imagesToDownload.length === 0) {
            if (this.notification) {
                this.notification.warning('没有找到可下载的图片');
            }
            return;
        }

        if (this.notification) {
            this.notification.info(`开始批量下载 ${imagesToDownload.length} 张图片`);
        }

        let successCount = 0;
        let errorCount = 0;

        for (const img of imagesToDownload) {
            try {
                await this.downloadImage(img);
                successCount++;
                
                // 添加延迟避免过快下载
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                errorCount++;
                console.error('[ImageDownloader] 批量下载失败:', error);
            }
        }

        if (this.notification) {
            this.notification.success(`批量下载完成: 成功 ${successCount} 张，失败 ${errorCount} 张`);
        }

        this.emit('batchDownloadCompleted', { total: imagesToDownload.length, success: successCount, error: errorCount });
    }

    /**
     * 生成文件名
     * @param {HTMLImageElement} img 图片元素
     * @param {string} src 图片地址
     * @returns {string}
     */
    generateFilename(img, src) {
        const url = new URL(src, window.location.href);
        const pathname = url.pathname;
        const originalName = pathname.split('/').pop() || 'image';
        const extension = this.getImageExtension(src) || 'jpg';
        const timestamp = Date.now();
        const index = ++this.downloadCounter;

        // 使用模板生成文件名
        let filename = this.config.filenameTemplate
            .replace('{index}', index.toString().padStart(3, '0'))
            .replace('{timestamp}', timestamp.toString())
            .replace('{original}', originalName.replace(/\.[^/.]+$/, ''))
            .replace('{extension}', extension);

        // 确保有扩展名
        if (!filename.includes('.')) {
            filename += '.' + extension;
        }

        return filename;
    }

    /**
     * 获取图片扩展名
     * @param {string} src 图片地址
     * @returns {string|null}
     */
    getImageExtension(src) {
        try {
            const url = new URL(src, window.location.href);
            const pathname = url.pathname;
            const match = pathname.match(/\.([^.]+)$/);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }

    /**
     * 移除下载按钮
     * @param {HTMLImageElement} img 图片元素
     */
    removeDownloadButton(img) {
        const buttonData = this.downloadButtons.get(img);
        if (!buttonData) return;

        const { container, button } = buttonData;
        
        // 移除按钮
        if (button.parentNode) {
            button.parentNode.removeChild(button);
        }

        // 如果容器只有图片，则移除容器
        if (container.children.length === 1 && container.children[0] === img) {
            container.parentNode.insertBefore(img, container);
            container.parentNode.removeChild(container);
        }

        this.downloadButtons.delete(img);
    }

    /**
     * 移除所有下载按钮
     */
    removeAllDownloadButtons() {
        for (const img of this.downloadButtons.keys()) {
            this.removeDownloadButton(img);
        }
        this.downloadButtons = new WeakMap();
    }

    /**
     * 启动图片观察器
     */
    startImageObserver() {
        if (this.observer) return;

        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // 检查新添加的图片
                            if (node.tagName === 'IMG') {
                                this.processImage(node);
                            } else {
                                // 检查子元素中的图片
                                const images = imageSafeQuerySelectorAll('img', node);
                                for (const img of images) {
                                    this.processImage(img);
                                }
                            }
                        }
                    }
                }
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * 停止图片观察器
     */
    stopImageObserver() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    /**
     * 处理配置变化
     */
    async handleConfigChange() {
        if (!this.configManager) return;

        try {
            // 如果启用状态改变
            if (this.config.enabled) {
                await this.enable();
            } else {
                await this.disable();
            }
        } catch (error) {
            console.error('[ImageDownloader] 配置变更处理失败:', error);
        }
    }

    /**
     * 更新配置
     * @param {Object} newConfig 新配置
     * @returns {Promise<boolean>} 是否更新成功
     */
    async updateConfig(newConfig) {
        if (!this.configManager) return false;

        try {
            return await this.configManager.updateAndSave(newConfig);
        } catch (error) {
            console.error('[ImageDownloader] 更新配置失败:', error);
            return false;
        }
    }

    /**
     * 重置配置
     * @returns {Promise<boolean>} 是否重置成功
     */
    async resetConfig() {
        if (!this.configManager) return false;

        try {
            return await this.configManager.reset();
        } catch (error) {
            console.error('[ImageDownloader] 重置配置失败:', error);
            return false;
        }
    }

    /**
     * 获取下载图标
     * @returns {string}
     */
    getDownloadIcon() {
        return '⬇';
    }

    /**
     * 获取处理的图片数量
     * @returns {number}
     */
    getProcessedImageCount() {
        return Array.from(this.downloadButtons.keys()).length;
    }

    /**
     * 获取所有可下载的图片
     * @returns {Array<HTMLImageElement>}
     */
    getAllDownloadableImages() {
        return Array.from(this.downloadButtons.keys());
    }
}

    // 注册到全局模块系统
    if (window.NWSModules) {
        window.NWSModules.ImageDownloaderModule = ImageDownloaderModule;
    }
})();