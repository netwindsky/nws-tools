(function() {
    'use strict';
    
    let ModuleBase;
    if (window.NWSModules) {
        ModuleBase = window.NWSModules.get('ModuleBase');
    }
    
    class SummaryModule extends ModuleBase {
        constructor(name, options = {}) {
            super(name, {
                version: '1.0.0',
                dependencies: ['ChromeSettingsModule', 'NotificationModule'],
                defaultConfig: {
                    enabled: true,
                    targetLanguage: '中文',
                    ollamaEndpoint: 'http://localhost:11434/v1/chat/completions',
                    defaultModel: 'qwen3:14b'
                },
                ...options
            });
            this.configManager = null;
            this.view = null;
            this.service = null;
        }

        async onInitialize() {
            this.chromeSettings = window.NWSModules?.ChromeSettingsModule;
            this.notification = window.NWSModules?.NotificationModule;

            const ConfigManager = window.ConfigManager;
            this.configManager = new ConfigManager(
                this.chromeSettings,
                this.name,
                this.defaultConfig
            );

            this.config = await this.configManager.load();

            // 自动迁移旧的 API 接口到新的 OpenAI 兼容接口
            if (this.config.ollamaEndpoint === 'http://localhost:11434/api/generate') {
                this.config.ollamaEndpoint = 'http://localhost:11434/v1/chat/completions';
                await this.configManager.updateAndSave({ ollamaEndpoint: this.config.ollamaEndpoint });
            }
            const SummaryService = window.NWSModules?.SummaryService || window.NWSModules?.get?.('SummaryService');
            if (SummaryService) {
                this.service = new SummaryService({
                    getConfig: () => this.config
                });
            }
            const SummaryView = window.NWSModules?.SummaryView || window.NWSModules?.get?.('SummaryView');
            if (SummaryView) {
                this.view = new SummaryView({
                    uiManager: window.uiManager,
                    safeQuerySelector: window.DOMHelper?.safeQuerySelector
                });
            }
        }

        extractPageContent() {
            const elementsToSkip = [
                'script', 'style', 'noscript', 'iframe', 'nav', 'footer',
                'header', '[role="banner"]', '[role="navigation"]', '[role="complementary"]',
                '.nws-toolbar', '.nws-sidebar', '.nws-modern-modal'
            ];

            const content = [];
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function(node) {
                        if (node.parentElement && 
                            elementsToSkip.some(selector => 
                                node.parentElement.closest(selector))) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                    }
                }
            );

            while (walker.nextNode()) {
                content.push(walker.currentNode.textContent.trim());
            }

            return content.join(' ').replace(/\s+/g, ' ').trim();
        }

        async summarizePage() {
            const loadingState = this.view?.createLoadingOverlay('正在生成页面摘要...', '📋');
            
            try {
                const content = this.extractPageContent();
                if (loadingState) {
                    this.view.updateProgress(loadingState, '30%', '正在分析页面内容...');
                }
                const summary = this.service ? await this.service.summarizeContent(content) : '';
                if (loadingState) {
                    this.view.updateProgress(loadingState, '100%', '摘要生成完成！');
                }

                setTimeout(() => {
                    this.view?.removeLoadingOverlay(loadingState);

                    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
                        chrome.runtime.sendMessage({ type: 'pageSummary', summary: summary }).catch(() => {});
                    }

                    this.view?.showSummary(summary);
                }, 500);
                
            } catch (error) {
                this.view?.removeLoadingOverlay(loadingState);
                console.error('[SummaryModule] 生成摘要失败:', error);
                if (window.showErrorNotification) {
                    window.showErrorNotification('生成摘要失败，请检查 Ollama 服务是否正在运行');
                }
            }
        }
    }

    if (window.NWSModules) {
        window.NWSModules.SummaryModule = SummaryModule;
    }
})();
