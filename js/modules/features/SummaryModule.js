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

        /**
         * 调用 Ollama API 发送请求 (使用 OpenAI 兼容的 chat/completions 接口)
         * @param {Array} messages - 消息列表
         * @param {string} [model] - 指定模型
         * @returns {Promise<string>}
         */
        async callOllama(messages, model) {
            const targetModel = model || this.config.defaultModel;
            const endpoint = this.config.ollamaEndpoint;
            
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: targetModel,
                        messages: messages,
                        stream: false,
                        temperature: 0.7
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error?.message || response.statusText}`);
                }
                const data = await response.json();
                
                if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                    return data.choices[0].message.content;
                }
                
                if (data.response) {
                    return data.response;
                }

                throw new Error('API 返回格式不正确');
            } catch (error) {
                console.error('[SummaryModule] Ollama API 调用失败:', error);
                throw error;
            }
        }

        async summarizePage() {
            const loadingOverlay = window.uiManager.createLoadingOverlay('正在生成页面摘要...', '📋');
            document.body.appendChild(loadingOverlay);

            const safeQuerySelector = window.DOMHelper?.safeQuerySelector;
            const progressBar = safeQuerySelector ? safeQuerySelector('.nws-progress-fill', loadingOverlay) : null;
            const progressText = safeQuerySelector ? safeQuerySelector('.nws-progress-text', loadingOverlay) : null;
            
            try {
                const content = this.extractPageContent();
                const lang = this.config.targetLanguage || '中文';
                
                const systemPrompt = `你是一位专业的内容分析专家。请根据提供的网页内容，生成一份详尽、专业且结构清晰的总结报告。

要求如下：
1. **语言**：使用${lang}。
2. **结构化输出**：
   - **【标题】**：为内容起一个简洁且具概括性的标题，并以 \`# \` 开头。
   - **【核心摘要】**：用 100-200 字高度概括全文的核心内容和背景。
   - **【关键要素】**：
     - **时间/地点**：明确提到的关键时间节点和地理位置。
     - **主要人物/机构**：涉及的核心人物、组织、公司或政府部门。
   - **【详细内容】**：使用 Markdown 列表分章节详述：
     - 事件的发展脉络或逻辑架构。
     - 核心数据、关键证据或重要论点。
     - 相关的背景信息。
   - **【深度洞察】**：分析该内容的影响力、潜在风险、行业意义或未来趋势。
   - **【总结评价】**：一句话总结全文的最终价值或结论。
3. **格式规范**：必须使用标准的 Markdown 语法（标题、粗体、列表、代码块等），确保排版精美。
4. **风格**：客观严谨，不遗漏重要细节，同时保持逻辑通顺。`;

                const userPrompt = `页面内容如下：\n${content}`;

                if (progressBar) progressBar.style.width = '30%';
                if (progressText) progressText.textContent = '正在分析页面内容...';

                const messages = [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ];

                const summary = await this.callOllama(messages);

                if (progressBar) progressBar.style.width = '100%';
                if (progressText) progressText.textContent = '摘要生成完成！';

                setTimeout(() => {
                    loadingOverlay.remove();

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
                console.error('[SummaryModule] 生成摘要失败:', error);
                if (window.showErrorNotification) {
                    window.showErrorNotification('生成摘要失败，请检查 Ollama 服务是否正在运行');
                }
            }
        }

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

    if (window.NWSModules) {
        window.NWSModules.SummaryModule = SummaryModule;
    }
})();
