/**
 * TranslationModule.js - 页面翻译与摘要模块
 * 提供页面内容提取、智能翻译及 AI 摘要功能
 * 
 * 重构说明：
 * - 核心逻辑已拆分为 SelectionManager (划词翻译) 和 PageManager (全页翻译)
 * - 本模块保留作为 Facade，负责配置管理、服务协调及缓存队列控制
 */

(function() {
    'use strict';
    
    let ModuleBase;
    if (window.NWSModules) {
        ModuleBase = window.NWSModules.get('ModuleBase');
    }
    
    class TranslationModule extends ModuleBase {
        constructor(name, options = {}) {
            super(name, {
                version: '1.1.0',
                dependencies: ['ChromeSettingsModule', 'NotificationModule'],
                enabled: true,
                defaultConfig: {
                    enabled: false,
                    enablePageTranslation: false, // 新增：独立的全页翻译开关
                    targetLanguage: '中文',
                    ollamaEndpoint: 'http://localhost:11434/v1/chat/completions',
                    defaultModel: 'MedAIBase/Tencent-HY-MT1.5:7b',
                    maxChunkSize: 2000,
                    translationMode: 'bilingual',
                    enableSelectionTranslation: true,
                    enableViewportTranslation: true,
                    concurrentLimit: 1,
                    viewportMargin: '120px',
                    minTextLength: 2
                },
                ...options
            });
            
            this.configManager = null;
            this.styleManager = window.styleManager || window.StyleManager?.getInstance?.() || null;
            
            // 缓存与队列系统
            this.queue = [];
            this.activeRequests = 0;
            this.translationCache = new Map();
            this.cacheKey = 'nws_translation_cache';
            this.CACHE_LIMIT = 5000;
            this.storage = null;
            this.saveCacheTimer = null;
            
            // 子管理器
            this.selectionManager = null;
            this.pageManager = null;
            
            this.isActive = false;
            this.isCoolingDown = false;
        }

        async onInitialize() {
            this.chromeSettings = window.NWSModules?.ChromeSettingsModule;
            this.notification = window.NWSModules?.NotificationModule;

            // 0. 初始化 Utils
            if (window.NWSModules.TranslationUtils) {
                this.utils = new window.NWSModules.TranslationUtils(() => this.config);
            }

            // 1. 初始化配置管理
            const ConfigManager = window.ConfigManager;
            this.configManager = new ConfigManager(
                this.chromeSettings,
                this.name,
                this.defaultConfig
            );

            this.config = await this.configManager.load();
            
            // 兼容性迁移：如果 enablePageTranslation 未定义，则继承 enabled 的状态
            if (this.config.enablePageTranslation === undefined) {
                const shouldEnablePage = this.config.enabled;
                // 更新配置，同时确保 enabled 为 true (如果划词翻译开启)
                await this.configManager.updateAndSave({ 
                    enablePageTranslation: shouldEnablePage,
                    enabled: shouldEnablePage || this.config.enableSelectionTranslation
                });
            } else {
                // 确保主开关 enabled 正确反映子功能状态
                if ((this.config.enablePageTranslation || this.config.enableSelectionTranslation) && !this.config.enabled) {
                    await this.configManager.updateAndSave({ enabled: true });
                }
            }
            
            // 自动迁移旧的 API 接口
            if (this.config.ollamaEndpoint === 'http://localhost:11434/api/generate') {
                this.config.ollamaEndpoint = 'http://localhost:11434/v1/chat/completions';
                await this.configManager.updateAndSave({ ollamaEndpoint: this.config.ollamaEndpoint });
            }

            // 监听配置变化
            this.configManager.addObserver((newConfig) => {
                this.config = newConfig;
                this.handleConfigChange();
            });

            // 2. 初始化服务层
            const TranslationService = window.NWSModules?.TranslationService || window.NWSModules?.get?.('TranslationService');
            if (TranslationService) {
                this.service = new TranslationService({
                    getConfig: () => this.config,
                    translateText: (text) => this.translateText(text) // 循环依赖：服务可能会调用 Module 的缓存逻辑？通常 Service 是纯 API
                });
            }
            
            // 3. 初始化存储服务 (用于缓存)
            // StorageService 不存在，使用 ChromeSettingsModule 代理
            if (this.chromeSettings) {
                this.storage = {
                    get: (keys) => this.chromeSettings.getStorage(keys, 'local'),
                    set: (items) => this.chromeSettings.setStorage(items, 'local')
                };
            } else {
                console.warn('[TranslationModule] ChromeSettingsModule unavailable, cache disabled');
                this.storage = null;
            }

            // 4. 初始化视图
            this.initView();

            // 5. 初始化子管理器
            if (window.NWSModules.SelectionManager) {
                this.selectionManager = new window.NWSModules.SelectionManager(this);
            }
            if (window.NWSModules.PageManager) {
                this.pageManager = new window.NWSModules.PageManager(this);
            }

            // 6. 加载缓存
            await this.loadCache();

            // 7. 恢复状态
            // 只要 config.enabled 为 true (代表模块整体启用)，或者 enableSelectionTranslation 为 true，就尝试激活
            // 确保即使 enabled 被误关，只要划词翻译开启，也能拉起模块
            if (this.config.enabled || this.config.enableSelectionTranslation) {
                if (!this.config.enabled) {
                    // 修正数据不一致：如果划词开启但总开关关闭，强制开启总开关
                    // 避免下次加载时 enabled=false 导致模块不初始化
                    await this.configManager.updateAndSave({ enabled: true });
                }
                await this.onEnable();
            }
        }

        initView() {
            if (this.view) return;
            const TranslationView = window.NWSModules?.TranslationView || window.NWSModules?.get?.('TranslationView');
            if (TranslationView) {
                this.view = new TranslationView({
                    name: this.name,
                    getConfig: () => this.config,
                    isActive: () => this.isActive,
                    // View 不再直接负责翻译逻辑，这些回调可能主要被子 Manager 使用
                    // 或者 View 内部还有些遗留调用
                    translateText: (text) => this.translateText(text),
                    styleManager: this.styleManager
                });
                this.view.injectStyles();
            }
        }

        async onEnable() {
            this.isActive = true;
            
            // 1. 启动划词翻译
            if (this.config.enableSelectionTranslation) {
                this.selectionManager?.enable();
            } else {
                this.selectionManager?.disable();
            }

            // 2. 启动全页翻译 (如果启用)
            if (this.config.enablePageTranslation) {
                this.pageManager?.start(this.config.translationMode || 'bilingual');
            }
        }

        async onDisable() {
            this.isActive = false;
            
            // 持久化禁用状态
            if (this.configManager) {
                await this.configManager.updateAndSave({ enabled: false });
            }

            // 停止子模块
            this.selectionManager?.disable();
            this.pageManager?.stop();
            
            // 清理缓存
            this.clearTranslationArtifacts();
        }

        onDestroy() {
            this.onDisable();
            this.configManager?.destroy();
            // 保存未写入的缓存
            this.saveCache();
        }

        handleConfigChange() {
            if (!this.isActive) return;

            // 实时响应配置变化
            if (this.config.enableSelectionTranslation) {
                this.selectionManager?.enable();
            } else {
                this.selectionManager?.disable();
            }

            if (this.config.enablePageTranslation) {
                this.pageManager?.start(this.config.translationMode);
            } else {
                this.pageManager?.stop();
            }
        }

        // ==================== 外部 API (供 Toolsbar 等调用) ====================

    /**
     * 启动/触发页面翻译
     * @param {Node} targetNode - (已废弃) 目标节点，现统一由 PageManager 处理
     * @param {string} mode - 翻译模式 'bilingual' | 'replace'
     */
    async translatePage(targetNode = null, mode = 'bilingual') {
        // 确保模块已初始化
        if (!this.initialized) {
            //console.log('[TranslationModule] 尚未初始化，尝试自动初始化...');
            const success = await this.initialize();
            if (!success) {
                console.error('[TranslationModule] 自动初始化失败');
                return 0;
            }
        }

        if (!this.pageManager) {
            // 尝试兜底创建
            if (window.NWSModules?.PageManager) {
                this.pageManager = new window.NWSModules.PageManager(this);
            } else {
                console.error('[TranslationModule] PageManager 未就绪');
                return 0;
            }
        }
        
        // 更新配置中的模式
        if (mode && mode !== this.config.translationMode) {
            await this.configManager.updateAndSave({ 
                translationMode: mode, 
                enablePageTranslation: true,
                enabled: true 
            });
        } else if (!this.config.enablePageTranslation || !this.config.enabled) {
             await this.configManager.updateAndSave({ 
                 enablePageTranslation: true,
                 enabled: true
             });
        }

        // 确保模块已激活
        if (!this.isActive) {
            await this.onEnable();
        } else {
            // 如果已经激活，手动触发 PageManager
            this.pageManager.start(mode || this.config.translationMode);
        }
        
        return 1; // 返回伪计数，表示已启动
    }

    get isPageTranslationActive() {
        return this.isActive && this.config.enablePageTranslation && this.pageManager && this.pageManager.isObserving;
    }

    /**
     * 停止翻译 (仅停止页面翻译)
     */
    async stopTranslation() {
        // 仅关闭全页翻译开关
        const updates = { enablePageTranslation: false };
        
        // 只有当划词翻译也关闭时，才彻底禁用模块
        // 注意：这里必须明确检查，不能假设 enabled 状态
        if (!this.config.enableSelectionTranslation) {
            updates.enabled = false;
        } else {
            // 确保 enabled 保持开启，以支持划词翻译
            updates.enabled = true;
        }
        
        await this.configManager.updateAndSave(updates);
        
        if (this.pageManager) {
            this.pageManager.stop();
        }

        // 只有当真正要彻底禁用时才调用 onDisable
        if (updates.enabled === false) {
             await this.onDisable();
        }
    }

    /**
     * 设置视口懒加载翻译
     */
    async setViewportTranslationEnabled(enabled) {
        await this.configManager.updateAndSave({ enableViewportTranslation: enabled });
        // PageManager 会自动读取新配置，无需手动重启，但可能需要触发一次扫描?
        // PageManager 内部通过 TranslationUtils 获取配置，所以是实时的
    }

    /**
     * 设置划词翻译
     */
    async setSelectionTranslationEnabled(enabled) {
        await this.configManager.updateAndSave({ enableSelectionTranslation: enabled });
        if (enabled) {
            this.selectionManager?.enable();
        } else {
            this.selectionManager?.disable();
        }
    }

    // ==================== 翻译核心逻辑 (缓存 & 队列) ====================

        async translateText(text) {
            let normalized = text;
            let placeholders = [];

            if (this.utils) {
                normalized = this.utils.normalizeText(text);
                const protectedData = this.utils.replaceTagsWithPlaceholders(normalized);
                normalized = protectedData.text;
                placeholders = protectedData.placeholders;
            } else {
                normalized = text ? text.replace(/\s+/g, ' ').trim() : '';
            }

            if (!normalized) return '';

            const rawResult = await this.enqueueTranslation(normalized);
            
            if (this.utils && placeholders.length > 0) {
                return this.utils.restorePlaceholders(rawResult, placeholders);
            }
            return rawResult;
        }

        enqueueTranslation(text) {
            if (this.translationCache.has(text)) {
                const result = this.translationCache.get(text);
                this.translationCache.delete(text);
                this.translationCache.set(text, result);
                return Promise.resolve(result);
            }

            return new Promise((resolve, reject) => {
                this.queue.push({ text, resolve, reject });
                this.processQueue();
            });
        }

        processQueue() {
            const limit = Math.max(1, this.config.concurrentLimit || 1);
            if (!this.queue.length) return;

            while (this.activeRequests < limit && this.queue.length > 0) {
                const task = this.queue.shift();
                this.activeRequests += 1;

                this.translateTextRequest(task.text)
                    .then((result) => {
                        this.activeRequests = Math.max(0, this.activeRequests - 1);
                        this.updateCache(task.text, result);
                        task.resolve(result);
                        this.processQueue();
                    })
                    .catch((error) => {
                        this.activeRequests = Math.max(0, this.activeRequests - 1);
                        console.error('[TranslationModule] Translation failed:', error);
                        task.reject(error);
                        this.processQueue();
                    });
            }
        }

        async translateTextRequest(text) {
            if (!this.service) throw new Error('TranslationService not initialized');
            return await this.service.translateTextRequest(text);
        }

        // ==================== 缓存管理 ====================

        async loadCache() {
            if (!this.storage) return;
            try {
                const result = await this.storage.get(this.cacheKey);
                if (result && result[this.cacheKey]) {
                    this.translationCache = new Map(result[this.cacheKey]);
                }
            } catch (e) {
                console.error('[TranslationModule] Load cache failed:', e);
            }
        }

        saveCache() {
            if (!this.storage) return;
            try {
                const entries = Array.from(this.translationCache.entries());
                this.storage.set({ [this.cacheKey]: entries });
            } catch (e) {
                console.error('[TranslationModule] Save cache failed:', e);
            }
        }

        updateCache(text, result) {
            if (this.translationCache.has(text)) this.translationCache.delete(text);
            this.translationCache.set(text, result);
            
            if (this.translationCache.size > this.CACHE_LIMIT) {
                const firstKey = this.translationCache.keys().next().value;
                this.translationCache.delete(firstKey);
            }
            
            if (this.saveCacheTimer) clearTimeout(this.saveCacheTimer);
            this.saveCacheTimer = setTimeout(() => this.saveCache(), 2000);
        }

        // ==================== 辅助方法 ====================

        clearTranslationArtifacts() {
            // 主要由 PageManager 清理，这里作为备份入口
            this.pageManager?.stop();
            this.selectionManager?.disable();
            this.view?.removeAllTranslationBlocks?.();
            this.view?.hideTooltip?.();
        }

        // 供 Toolbar 调用的入口
        async handleTranslate() {
            // 防抖
            if (this.isCoolingDown) return;
            this.isCoolingDown = true;
            setTimeout(() => this.isCoolingDown = false, 500);

            // 切换状态
            const newEnabled = !this.config.enablePageTranslation;
            const updates = {
                enablePageTranslation: newEnabled,
                enabled: newEnabled || this.config.enableSelectionTranslation
            };
            await this.configManager.updateAndSave(updates);

            // 状态变化会触发 handleConfigChange，从而调用 onEnable/onDisable -> PageManager.start/stop
            // 所以这里不需要手动调用
            if (newEnabled) {
                this.notification?.show('已开启网页翻译');
            } else {
                this.notification?.show('已关闭网页翻译');
            }
        }
    }

    if (window.NWSModules) {
        window.NWSModules.TranslationModule = TranslationModule;
        window.NWSModules.register('TranslationModule', TranslationModule);
    }
})();
