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
                    ollamaEndpoint: 'http://localhost:8080/v1/chat/completions',
                    defaultModel: 'qwen3.5-9b-ud-q4'
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
            // 防止重复调用
            if (this.isSummarizing) {
                console.log('[SummaryModule] 正在生成摘要中，跳过重复请求');
                return;
            }
            this.isSummarizing = true;
            
            const loadingState = this.view?.createLoadingOverlay('正在生成页面摘要...', '📋');
            
            try {
                // 首先打开 Chrome Side Panel
                await this.openSidePanel();
                
                const content = this.extractPageContent();
                if (loadingState) {
                    this.view.updateProgress(loadingState, '30%', '正在分析页面内容...');
                }
                
                // 使用流式模式生成摘要
                let fullSummary = '';
                const onStream = (chunk, fullContent) => {
                    fullSummary = fullContent;
                    // 实时发送流式内容到 Side Panel
                    this.sendStreamToSidePanel(chunk, fullContent, false);
                };
                
                const summary = this.service ? await this.service.summarizeContent(content, onStream) : '';
                
                if (loadingState) {
                    this.view.updateProgress(loadingState, '100%', '摘要生成完成！');
                }

                setTimeout(() => {
                    this.view?.removeLoadingOverlay(loadingState);

                    // 发送最终完成消息
                    this.sendStreamToSidePanel('', summary, true);
                    this.isSummarizing = false;
                }, 500);
                
            } catch (error) {
                this.isSummarizing = false;
                this.view?.removeLoadingOverlay(loadingState);
                console.error('[SummaryModule] 生成摘要失败:', error);
                
                // 构建详细错误信息
                let errorMessage = '生成摘要失败';
                if (error.message) {
                    if (error.message.includes('fetch')) {
                        errorMessage = '无法连接到 Ollama 服务\n\n请检查：\n1. Ollama 是否已启动（在终端运行 `ollama serve`）\n2. 端点地址是否正确（当前：' + (this.config?.ollamaEndpoint || 'http://localhost:11434/v1/chat/completions') + '）\n3. 防火墙是否阻止了连接';
                    } else if (error.message.includes('404')) {
                        errorMessage = 'Ollama 模型未找到\n\n请检查：\n1. 模型是否已下载（运行 `ollama list` 查看）\n2. 模型名称是否正确（当前：' + (this.config?.defaultModel || 'deepseek-r1:14b') + '）\n3. 运行 `ollama pull ' + (this.config?.defaultModel || 'deepseek-r1:14b') + '` 下载模型';
                    } else if (error.message.includes('500')) {
                        errorMessage = 'Ollama 服务内部错误\n\n可能原因：\n1. 模型加载失败，请重启 Ollama\n2. 内存不足，请关闭其他程序\n3. 模型文件损坏，请重新下载模型';
                    } else {
                        errorMessage = '生成摘要失败：' + error.message;
                    }
                }
                
                // 发送错误信息到 Side Panel
                this.sendSummaryToSidePanel('## ❌ 错误\n\n' + errorMessage + '\n\n---\n\n**调试信息：**\n- 错误类型：' + error.name + '\n- 错误详情：' + error.message);
                
                if (window.showErrorNotification) {
                    window.showErrorNotification('生成摘要失败，请查看 Side Panel 中的详细错误信息');
                }
            }
        }

        async openSidePanel() {
            return new Promise((resolve, reject) => {
                if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
                    chrome.runtime.sendMessage({ action: 'openSidePanel' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('[SummaryModule] 打开 Side Panel 失败:', chrome.runtime.lastError);
                            reject(chrome.runtime.lastError);
                        } else if (response && response.success) {
                            resolve();
                        } else {
                            reject(new Error('打开 Side Panel 失败'));
                        }
                    });
                } else {
                    reject(new Error('Chrome runtime 不可用'));
                }
            });
        }

        sendSummaryToSidePanel(summary) {
            const message = {
                type: 'pageSummary',
                summary: summary
            };

            console.log('[SummaryModule] 开始发送摘要到 Side Panel');

            const trySendMessage = (retries = 3) => {
                if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
                    console.log('[SummaryModule] 尝试发送消息，剩余重试次数:', retries);
                    
                    // 通过 background script 转发消息到 Side Panel
                    chrome.runtime.sendMessage({
                        action: 'forwardToSidePanel',
                        data: message
                    }, (response) => {
                        console.log('[SummaryModule] 消息响应:', response, chrome.runtime.lastError);
                        
                        if (chrome.runtime.lastError) {
                            console.log('[SummaryModule] 发送消息失败，重试中...', chrome.runtime.lastError.message);
                            if (retries > 0) {
                                setTimeout(() => trySendMessage(retries - 1), 500);
                            }
                        } else {
                            console.log('[SummaryModule] 摘要已发送到 Side Panel');
                        }
                    });
                } else {
                    console.log('[SummaryModule] Chrome runtime 不可用');
                }
            };

            // 延迟发送，确保 Side Panel 已加载
            setTimeout(() => trySendMessage(), 1000);
        }

        sendStreamToSidePanel(chunk, fullContent, isDone) {
            const message = {
                type: 'pageSummaryStream',
                chunk: chunk,
                fullContent: fullContent,
                isDone: isDone
            };

            // 直接发送，不重试，因为流式消息会频繁发送
            if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
                chrome.runtime.sendMessage({
                    action: 'forwardToSidePanel',
                    data: message
                }).catch(() => {});
            }
        }
    }

    if (window.NWSModules) {
        window.NWSModules.SummaryModule = SummaryModule;
    }
})();
