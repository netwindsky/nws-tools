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
    // 从全局模块系统获取工具函数，使用别名避免冲突
    const imageSafeQuerySelectorAll = window.DOMHelper?.safeQuerySelectorAll || window.NWSModules?.utils?.safeQuerySelectorAll;

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
        this.observer = null;
        this.configManager = null;
        this.view = null;
        this.service = null;
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
        const ImageDownloaderService = window.NWSModules?.ImageDownloaderService || window.NWSModules?.get?.('ImageDownloaderService');
        if (ImageDownloaderService) {
            this.service = new ImageDownloaderService({
                getConfig: () => this.config,
                chromeSettings: this.chromeSettings,
                notification: this.notification,
                emit: (...args) => this.emit(...args)
            });
        }
        const ImageDownloaderView = window.NWSModules?.ImageDownloaderView || window.NWSModules?.get?.('ImageDownloaderView');
        if (ImageDownloaderView) {
            this.view = new ImageDownloaderView({
                getConfig: () => this.config,
                onDownload: (img) => this.downloadImage(img),
                safeQuerySelectorAll: imageSafeQuerySelectorAll
            });
        }

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
            this.view = null;
            this.service = null;
            
            //console.log('[ImageDownloader] 模块已销毁');
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

        const extension = this.service ? this.service.getImageExtension(src) : null;
        if (extension && !this.config.supportedFormats.includes(extension.toLowerCase())) {
            return false;
        }

        // 检查是否已经有下载按钮
        if (this.view && this.view.hasDownloadButton(img)) {
            return false;
        }

        return true;
    }

    /**
     * 添加下载按钮
     * @param {HTMLImageElement} img 图片元素
     */
    addDownloadButton(img) {
        if (this.view) {
            this.view.addDownloadButton(img);
        }
    }

    /**
     * 下载图片
     * @param {HTMLImageElement} img 图片元素
     */
    async downloadImage(img) {
        if (this.service) {
            await this.service.downloadImage(img);
        }
    }

    /**
     * 批量下载图片
     * @param {Array<HTMLImageElement>} images 图片数组
     */
    async batchDownload(images = null) {
        const imagesToDownload = images || (this.view ? this.view.getAllImages(document) : Array.from(imageSafeQuerySelectorAll('img'))).filter(img => 
            this.processedImages.has(img) && this.shouldProcessImage(img)
        );
        if (this.service) {
            await this.service.batchDownload(imagesToDownload);
        }
    }

    /**
     * 移除下载按钮
     * @param {HTMLImageElement} img 图片元素
     */
    removeDownloadButton(img) {
        if (this.view) {
            this.view.removeDownloadButton(img);
        }
    }

    /**
     * 移除所有下载按钮
     */
    removeAllDownloadButtons() {
        if (this.view) {
            this.view.removeAllDownloadButtons();
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
        return this.view ? this.view.getDownloadButtonsCount() : 0;
    }

    /**
     * 获取所有可下载的图片
     * @returns {Array<HTMLImageElement>}
     */
    getAllDownloadableImages() {
        return this.view ? this.view.getAllDownloadableImages() : [];
    }
}

    // 注册到全局模块系统
    if (window.NWSModules) {
        window.NWSModules.ImageDownloaderModule = ImageDownloaderModule;
    }
})();
