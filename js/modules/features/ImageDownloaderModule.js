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
    
    // 从全局模块系统获取工具函数
    let safeQuerySelector, safeQuerySelectorAll, safeAddEventListener, safeRemoveEventListener;
    if (window.NWSModules && window.NWSModules.utils) {
        ({ safeQuerySelector, safeQuerySelectorAll, safeAddEventListener, safeRemoveEventListener } = window.NWSModules.utils);
    }

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
        this.downloadButtons = new Map();
        this.observer = null;
        this.downloadCounter = 0;
    }

    async onInitialize() {
        // 检查依赖模块
        this.chromeSettings = window.NWSModules?.ChromeSettingsModule;
        this.notification = window.NWSModules?.NotificationModule;

        if (!this.chromeSettings) {
            throw new Error('ChromeSettingsModule 依赖未找到');
        }

        // 注入样式
        this.injectStyles();

        // 初始化图片处理
        if (this.config.enabled) {
            await this.initializeImageProcessing();
        }

        // 监听配置变化
        this.on('configChanged', this.handleConfigChange.bind(this));
    }

    async onDestroy() {
        this.removeAllDownloadButtons();
        this.stopImageObserver();
        this.removeStyles();
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
        const images = safeQuerySelectorAll('img');
        
        for (const img of images) {
            if (!this.processedImages.has(img)) {
                await this.processImage(img);
            }
        }
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
        
        // 插入容器
        img.parentNode.insertBefore(container, img);
        container.appendChild(img);
        
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
        button.innerHTML = this.getDownloadIcon();
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
        const imagesToDownload = images || Array.from(safeQuerySelectorAll('img')).filter(img => 
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
                                const images = safeQuerySelectorAll('img', node);
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
     * @param {Object} newConfig 新配置
     */
    async handleConfigChange(newConfig) {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };

        // 如果启用状态改变
        if (oldConfig.enabled !== this.config.enabled) {
            if (this.config.enabled) {
                await this.enable();
            } else {
                await this.disable();
            }
        }

        // 如果按钮位置改变，重新创建按钮
        if (oldConfig.buttonPosition !== this.config.buttonPosition) {
            this.removeAllDownloadButtons();
            if (this.config.enabled) {
                await this.processExistingImages();
            }
        }

        // 如果自动检测设置改变
        if (oldConfig.autoDetect !== this.config.autoDetect) {
            if (this.config.autoDetect) {
                this.startImageObserver();
            } else {
                this.stopImageObserver();
            }
        }
    }

    /**
     * 获取下载图标
     * @returns {string}
     */
    getDownloadIcon() {
        return `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
        `;
    }

    /**
     * 注入样式
     */
    injectStyles() {
        if (document.getElementById('nws-image-downloader-styles')) return;

        const style = document.createElement('style');
        style.id = 'nws-image-downloader-styles';
        style.textContent = `
            .nws-image-container {
                position: relative;
                display: inline-block;
            }

            .nws-download-button {
                position: absolute;
                background-color: rgba(0, 0, 0, 0.7);
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                display: none;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                z-index: 1000;
                transition: all 0.2s ease;
            }

            .nws-download-button:hover {
                background-color: rgba(0, 0, 0, 0.9);
                transform: scale(1.1);
            }

            .nws-download-button-top-right {
                top: 5px;
                right: 5px;
            }

            .nws-download-button-top-left {
                top: 5px;
                left: 5px;
            }

            .nws-download-button-bottom-right {
                bottom: 5px;
                right: 5px;
            }

            .nws-download-button-bottom-left {
                bottom: 5px;
                left: 5px;
            }

            .nws-image-container:hover .nws-download-button {
                display: flex !important;
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * 移除样式
     */
    removeStyles() {
        const style = document.getElementById('nws-image-downloader-styles');
        if (style) {
            style.parentNode.removeChild(style);
        }
    }

    /**
     * 获取处理的图片数量
     * @returns {number}
     */
    getProcessedImageCount() {
        return this.downloadButtons.size;
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