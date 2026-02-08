/**
 * TranslationModule.js - 页面翻译与摘要模块
 * 提供页面内容提取、智能翻译及 AI 摘要功能
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
                version: '1.0.0',
                dependencies: ['ChromeSettingsModule', 'NotificationModule'],
                defaultConfig: {
                    enabled: true,
                    targetLanguage: '中文',
                    ollamaEndpoint: 'http://localhost:11434/api/generate',
                    defaultModel: 'MedAIBase/Tencent-HY-MT1.5:1.8b',
                    maxChunkSize: 2000
                },
                ...options
            });
            this.configManager = null;
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
        }

        /**
         * 提取页面正文内容
         */
        extractPageContent() {
            const elementsToSkip = [
                'script', 'style', 'noscript', 'iframe', 'nav', 'footer',
                'header', '[role="banner"]', '[role="navigation"]', '[role="complementary"]',
                '.nws-toolbar', '.nws-sidebar', '.nws-modern-modal' // 排除插件自身的 DOM
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

        /**
         * 将文本切分为合适的大小
         */
        splitTextIntoChunks(text, maxChunkSize) {
            const size = maxChunkSize || this.config.maxChunkSize;
            const chunks = [];
            const sentences = text.split(/(?<=[.!?。！？])\s+/);
            let currentChunk = '';

            for (const sentence of sentences) {
                if ((currentChunk + sentence).length <= size) {
                    currentChunk += (currentChunk ? ' ' : '') + sentence;
                } else {
                    if (currentChunk) chunks.push(currentChunk);
                    currentChunk = sentence;
                }
            }

            if (currentChunk) chunks.push(currentChunk);
            return chunks;
        }

        /**
         * 调用 Ollama API
         */
        async callOllama(prompt, model) {
            const targetModel = model || this.config.defaultModel;
            const endpoint = this.config.ollamaEndpoint;
            
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: targetModel,
                        prompt: prompt,
                        stream: false
                    })
                });

                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                return data.response;
            } catch (error) {
                console.error('[TranslationModule] Ollama API 调用失败:', error);
                throw error;
            }
        }

        /**
         * 翻译整个页面
         */
        async translatePage(targetLang) {
            const lang = targetLang || this.config.targetLanguage;
            const loadingOverlay = window.uiManager.createLoadingOverlay(`正在翻译页面内容为 ${lang}...`, '🌐');
            document.body.appendChild(loadingOverlay);
            
            try {
                const content = this.extractPageContent();
                const chunks = this.splitTextIntoChunks(content);
                const translations = [];
                
                const progressBar = loadingOverlay.querySelector('.nws-progress-fill');
                const progressText = loadingOverlay.querySelector('.nws-progress-text');
                
                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    const prompt = `请将以下文本翻译成${lang}，仅返回翻译结果，不要包含任何解释：\n${chunk}`;
                    
                    const progress = ((i + 1) / chunks.length) * 100;
                    if (progressBar) progressBar.style.width = `${progress}%`;
                    if (progressText) progressText.textContent = `翻译进度: ${Math.round(progress)}% (${i + 1}/${chunks.length})`;
                    
                    const translation = await this.callOllama(prompt);
                    translations.push(translation);
                }
                
                loadingOverlay.remove();
                
                const translationOverlay = window.uiManager.createModernModal(
                    '页面翻译结果',
                    '🌐',
                    translations.map(text => `<div class="nws-translation-block">${text}</div>`).join('')
                );
                
                document.body.appendChild(translationOverlay);
                
            } catch (error) {
                loadingOverlay.remove();
                console.error('[TranslationModule] 翻译失败:', error);
                if (window.showErrorNotification) {
                    window.showErrorNotification('翻译失败，请检查 Ollama 服务是否正在运行');
                }
            }
        }

        /**
         * 生成页面摘要
         */
        async summarizePage() {
            const loadingOverlay = window.uiManager.createLoadingOverlay('正在生成页面摘要...', '📋');
            document.body.appendChild(loadingOverlay);
            
            try {
                const content = this.extractPageContent();
                const prompt = `请返回您反复阅读正文后精心写成的详尽摘要总结，并以\`\`\`\`\`\`作为标题开始。页面内容：\n${content}`;
                
                const progressBar = loadingOverlay.querySelector('.nws-progress-fill');
                const progressText = loadingOverlay.querySelector('.nws-progress-text');
                
                if (progressBar) progressBar.style.width = '30%';
                if (progressText) progressText.textContent = '正在分析页面内容...';
                
                const summary = await this.callOllama(prompt);
                
                if (progressBar) progressBar.style.width = '100%';
                if (progressText) progressText.textContent = '摘要生成完成！';
                
                setTimeout(() => {
                    loadingOverlay.remove();
                    
                    // 发送摘要到工具面板
                    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
                        chrome.runtime.sendMessage({ type: 'pageSummary', summary: summary }).catch(() => {});
                    }
                    
                    const summaryOverlay = window.uiManager.createModernModal(
                        '页面摘要',
                        '📋',
                        `<div class="nws-summary-content nws-markdown-content">${this.renderMarkdown(summary)}</div>`
                    );
                    
                    document.body.appendChild(summaryOverlay);
                }, 500);
                
            } catch (error) {
                loadingOverlay.remove();
                console.error('[TranslationModule] 生成摘要失败:', error);
                if (window.showErrorNotification) {
                    window.showErrorNotification('生成摘要失败，请检查 Ollama 服务是否正在运行');
                }
            }
        }

        /**
         * 渲染 Markdown
         */
        renderMarkdown(markdown) {
            let html = markdown
                .replace(/<thinking>([\s\S]*?)<\/thinking>/g, '<span class="nws-think-content">$1</span>');
            
            html = html
                .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                .replace(/^\s*[-*+]\s+(.*)$/gm, '<li>$1</li>')
                .replace(/((<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>')
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>');
            
            html = '<p>' + html + '</p>';
            return html.replace(/<p><\/p>/g, '')
                       .replace(/<p>(<h[1-6]>|<ul>|<pre>|<span class="nws-think-content">)/g, '$1')
                       .replace(/(<\/h[1-6]>|<\/ul>|<\/pre>|<\/span>)<\/p>/g, '$1');
        }
    }

    // 注册到全局模块系统
    if (window.NWSModules) {
        window.NWSModules.TranslationModule = TranslationModule;
    }
})();
