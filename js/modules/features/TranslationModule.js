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
        /**
         * 构造函数
         * @param {string} name - 模块名称
         * @param {Object} options - 配置选项
         */
        constructor(name, options = {}) {
            super(name, {
                version: '1.0.0',
                dependencies: ['ChromeSettingsModule', 'NotificationModule'],
                defaultConfig: {
                    enabled: true,
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
            this.queue = [];
            this.activeRequests = 0;
            this.observer = null;
            this.pendingElements = new Map();
            this.selectionListener = null;
            this.tooltip = null;
            this.tooltipTimer = null;
            this.tooltipOutsideListener = null;
            this.isActive = false;
            this.textNodeCache = new WeakMap();
            this.blockNodeCache = new WeakMap();
            this.safeQuerySelector = window.DOMHelper?.safeQuerySelector || window.NWSModules?.utils?.safeQuerySelector;
            this.safeQuerySelectorAll = window.DOMHelper?.safeQuerySelectorAll || window.NWSModules?.utils?.safeQuerySelectorAll;
            this.safeAddEventListener = window.NWSModules?.utils?.safeAddEventListener || ((element, event, handler, options) => {
                if (element && typeof element.addEventListener === 'function') {
                    element.addEventListener(event, handler, options);
                }
            });
            this.safeRemoveEventListener = window.NWSModules?.utils?.safeRemoveEventListener || ((element, event, handler, options) => {
                if (element && typeof element.removeEventListener === 'function') {
                    element.removeEventListener(event, handler, options);
                }
            });
        }

        /**
         * 模块初始化生命周期
         */
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

            this.configManager.addObserver((newConfig) => {
                this.config = newConfig;
                this.handleConfigChange();
            });
            this.injectStyles();
            if (this.config.enabled) {
                await this.onEnable();
            }
        }

        /**
         * 提取页面纯文本内容（用于摘要）
         * @returns {string} 提取的页面纯文本内容
         */
        extractPageContent() {
            const elementsToSkip = [
                'script', 'style', 'noscript', 'iframe', 'nav', 'footer',
                'header', '[role="banner"]', '[role="navigation"]', '[role="complementary"]',
                '.nws-toolbar', '.nws-sidebar', '.nws-modern-modal' // 排除插件自身的 DOM
            ];
            const sanitizeSelector = window.DOMHelper?.sanitizeSelector || ((selector) => selector);
            const skipSelectors = elementsToSkip.map((selector) => sanitizeSelector(selector)).filter(Boolean);

            const content = [];
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        const parent = node.parentElement;
                        if (!parent) return NodeFilter.FILTER_REJECT;
                        if (skipSelectors.some(selector => parent.closest(selector))) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        if (this.isSkippableElement(parent)) return NodeFilter.FILTER_REJECT;
                        if (!this.isElementActuallyVisible(parent)) return NodeFilter.FILTER_REJECT;
                        return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                    }
                }
            );

            while (walker.nextNode()) {
                content.push(walker.currentNode.textContent.trim());
            }
            //console.log('extractPageContent::>>>', content.join(' '));
            return content.join(' ').replace(/\s+/g, ' ').trim();
        }

        /**
         * 将长文本拆分为块，以适应 LLM 上下文限制
         * @param {string} text - 待拆分的文本
         * @param {number} [maxChunkSize] - 每个块的最大长度
         * @returns {string[]} 拆分后的文本块数组
         */
        splitTextIntoChunks(text, maxChunkSize) {
            const size = maxChunkSize || this.config.maxChunkSize;
            const chunks = [];
            let sentences = [];
            if (typeof Intl !== 'undefined' && Intl.Segmenter) {
                const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
                sentences = Array.from(segmenter.segment(text)).map((seg) => seg.segment);
            } else {
                sentences = text.split(/(?<=[.!?。！？])\s+/);
            }
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
         * 调用 Ollama API 发送请求 (使用 OpenAI 兼容的 chat/completions 接口)
         * @param {Array} messages - 消息列表 [{role: 'system', content: '...'}, {role: 'user', content: '...'}]
         * @param {string} [model] - 指定模型，否则使用默认模型
         * @returns {Promise<string>} 返回的 AI 响应文本内容
         */
        async callOllama(messages, model) {
            const targetModel = model || this.config.defaultModel;
            const endpoint = this.config.ollamaEndpoint;
            
            try {
                //console.log('[TranslationModule] 发送翻译请求:', { endpoint, model: targetModel, messageCount: Array.isArray(messages) ? messages.length : 0 });
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: targetModel,
                        messages: messages,
                        stream: false,
                        temperature: 0.3 // 降低随机性，保证翻译稳定性
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error?.message || response.statusText}`);
                }
                const data = await response.json();
                //console.log('[TranslationModule] 翻译响应解析完成:', { hasChoices: Boolean(data.choices && data.choices.length), hasResponse: Boolean(data.response) });
                
                // 处理 OpenAI 兼容格式的选择
                if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                    return data.choices[0].message.content;
                }
                
                // 兼容 Ollama 原生响应格式（如果用户还没切换 endpoint 但逻辑已变）
                if (data.response) {
                    return data.response;
                }

                throw new Error('API 返回格式不正确');
            } catch (error) {
                //console.error('[TranslationModule] Ollama API 调用失败:', error);
                throw error;
            }
        }

        /**
         * 模块启用生命周期
         */
        async onEnable() {
            this.isActive = true;
            if (this.config.enableSelectionTranslation) {
                this.enableSelectionTranslation();
            }
        }

        /**
         * 模块禁用生命周期
         */
        async onDisable() {
            this.isActive = false;
            this.disableSelectionTranslation();
            this.stopObservation();
            this.hideTooltip();
        }

        /**
         * 模块销毁生命周期
         */
        async onDestroy() {
            await this.onDisable();
            this.queue = [];
            this.activeRequests = 0;
            this.pendingElements.clear();
            if (this.tooltip && this.tooltip.parentNode) {
                this.tooltip.parentNode.removeChild(this.tooltip);
            }
            if (this.styleManager) {
                this.styleManager.removeModuleStyles(this.name);
            }
        }

        /**
         * 注入模块所需的 CSS 样式
         */
        injectStyles() {
            if (!this.styleManager) return;
            const css = `
                .nws-translation-tooltip {
                    all: initial;
                    position: absolute;
                    z-index: 10005;
                    max-width: 360px;
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
                    background: var(--panel, #1b2233);
                    color: var(--text, #e6ecff);
                    font-size: 13px;
                    line-height: 1.45;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
                }

                .nws-translation-inline {
                    display: inline;
                    margin-left: 8px;
                    color: #888;
                    font-size: 0.95em;
                }

                .nws-translation-block {
                    display: block;
                    margin: 8px 0 12px;
                    padding: 2px 0;
                    color: #888;
                    font-size: 0.95em;
                    line-height: 1.6;
                    white-space: pre-wrap;
                }

                .nws-translation-style{
                    display: block;
                    margin: 15px 0;
                    padding: 8px 12px;
                    #font-style: italic;
                    #text-decoration: underline dashed red 1px;
                    white-space: pre-wrap;
                    #border: 1px dashed rgba(255, 152, 0, 0.3);
                    #background: rgba(255, 255, 255, 0.05);
                    box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
                    border-radius: 4px;
                    line-height: 1.45;
                }
            `;
            this.styleManager.inject(this.name, css, `nws-style-${this.name}`, { replace: true, priority: 'normal' });
        }

        /**
         * 处理配置项变更后的逻辑更新
         */
        handleConfigChange() {
            if (this.isActive) {
                if (this.config.enableSelectionTranslation) {
                    this.enableSelectionTranslation();
                } else {
                    this.disableSelectionTranslation();
                }
            }
        }

        /**
         * 切换划词翻译功能的启用状态
         * @param {boolean} enabled - 是否启用
         */
        async setSelectionTranslationEnabled(enabled) {
            this.config.enableSelectionTranslation = Boolean(enabled);
            if (this.configManager) {
                await this.configManager.updateAndSave({ enableSelectionTranslation: this.config.enableSelectionTranslation });
            }
            this.handleConfigChange();
        }

        /**
         * 切换视口内自动翻译功能的启用状态
         * @param {boolean} enabled - 是否启用
         */
        async setViewportTranslationEnabled(enabled) {
            this.config.enableViewportTranslation = Boolean(enabled);
            if (this.configManager) {
                await this.configManager.updateAndSave({ enableViewportTranslation: this.config.enableViewportTranslation });
            }
        }

        /**
         * 启用划词翻译监听器
         */
        enableSelectionTranslation() {
            if (this.selectionListener) return;
            this.selectionListener = this.handleSelectionMouseUp.bind(this);
            this.safeAddEventListener(document, 'mouseup', this.selectionListener, true);
        }

        /**
         * 禁用并移除划词翻译监听器
         */
        disableSelectionTranslation() {
            if (!this.selectionListener) return;
            this.safeRemoveEventListener(document, 'mouseup', this.selectionListener, true);
            this.selectionListener = null;
        }

        /**
         * 处理 mouseup 事件以获取划词内容
         * @param {MouseEvent} event - 鼠标事件对象
         */
        handleSelectionMouseUp(event) {
            if (!this.isActive || !this.config.enableSelectionTranslation) return;
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) return;
            const text = selection.toString().trim();
            if (!this.shouldTranslateText(text)) return;
            const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            if (!range) return;
            const rect = range.getBoundingClientRect();
            if (!rect || rect.width === 0 || rect.height === 0) return;
            if (this.isNwsElement(event.target)) return;

            const position = this.clampTooltipPosition(
                rect.left + window.scrollX,
                rect.bottom + window.scrollY + 8
            );
            this.showTooltip(position.x, position.y, '正在翻译...');

            this.translateText(text)
                .then((result) => {
                    this.updateTooltip(result || '翻译结果为空');
                })
                .catch(() => {
                    this.updateTooltip('翻译失败，请稍后重试');
                });
        }

        /**
         * 显示划词翻译提示框
         * @param {number} x - 提示框相对于页面的横坐标
         * @param {number} y - 提示框相对于页面的纵坐标
         * @param {string} text - 初始文本内容
         */
        showTooltip(x, y, text) {
            if (!this.tooltip) {
                this.tooltip = document.createElement('div');
                this.tooltip.className = 'nws-translation-tooltip';
                document.body.appendChild(this.tooltip);
            }
            this.tooltip.textContent = text;
            this.tooltip.style.left = `${x}px`;
            this.tooltip.style.top = `${y}px`;
            this.tooltip.style.display = 'block';

            if (this.tooltipTimer) {
                clearTimeout(this.tooltipTimer);
            }
            this.tooltipTimer = null;
            if (!this.tooltipOutsideListener) {
                this.tooltipOutsideListener = (event) => {
                    if (!this.tooltip || this.tooltip.style.display === 'none') return;
                    if (this.tooltip.contains(event.target)) return;
                    this.hideTooltip();
                };
                this.safeAddEventListener(document, 'mousedown', this.tooltipOutsideListener, true);
            }
        }

        /**
         * 更新提示框中的文本
         * @param {string} text - 新的文本内容
         */
        updateTooltip(text) {
            if (!this.tooltip) return;
            this.tooltip.textContent = text;
        }

        /**
         * 隐藏划词翻译提示框
         */
        hideTooltip() {
            if (this.tooltipTimer) {
                clearTimeout(this.tooltipTimer);
                this.tooltipTimer = null;
            }
            if (this.tooltip) {
                this.tooltip.style.display = 'none';
            }
            if (this.tooltipOutsideListener) {
                this.safeRemoveEventListener(document, 'mousedown', this.tooltipOutsideListener, true);
                this.tooltipOutsideListener = null;
            }
        }

        /**
         * 限制提示框位置，确保不超出当前视口范围
         * @param {number} x - 原始横坐标
         * @param {number} y - 原始纵坐标
         * @returns {{x: number, y: number}} 修正后的坐标
         */
        clampTooltipPosition(x, y) {
            const padding = 12;
            const maxX = window.scrollX + window.innerWidth - padding;
            const maxY = window.scrollY + window.innerHeight - padding;
            return {
                x: Math.min(x, maxX),
                y: Math.min(y, maxY)
            };
        }

        /**
         * 检查元素是否属于插件自身的 UI
         * @param {Element} element - 要检查的 DOM 元素
         * @returns {boolean} 是否为插件元素
         */
        isNwsElement(element) {
            if (!element || typeof element.closest !== 'function') return false;
            const sanitizeSelector = window.DOMHelper?.sanitizeSelector || ((selector) => selector);
            const selector = sanitizeSelector('.nws-toolbar, .nws-sidebar, .nws-modern-modal, .nws-translation-tooltip');
            if (!selector) return false;
            return Boolean(element.closest(selector));
        }

        /**
         * 判断文本是否应该被翻译（过滤短文本、全数字/符号、或已是目标语言的内容）
         * @param {string} text - 要检查的文本内容
         * @returns {boolean} 是否符合翻译条件
         */
        shouldTranslateText(text) {
            // 如果文本为空，直接返回 false
            if (!text) return false;
            // 规范化文本内容（移除多余空格等）
            const normalized = this.normalizeText(text);
            // 如果规范化后的文本长度小于配置的最小翻译长度，则不翻译
            if (normalized.length < this.config.minTextLength) return false;
            // 如果文本仅由数字、标点符号或特殊字符组成，则不翻译
            if (/^[\d\W_]+$/.test(normalized)) return false;

            // 获取目标语言配置，默认为“中文”
            const lang = this.config.targetLanguage || '中文';
            // 判断目标语言是否为中文
            const isTargetChinese = /中文|Chinese/i.test(lang);
            // 如果目标语言是中文，则检查原文中中文所占比例
            if (isTargetChinese) {
                // 统计文本中的中文字符数量
                const chineseChars = (normalized.match(/[\u4e00-\u9fa5]/g) || []).length;
                // 如果中文比例超过 50%，认为已经是中文内容，无需翻译
                if (chineseChars / normalized.length > 0.5) return false;
            }
            // 满足以上所有条件，则认为该文本需要翻译
            return true;
        }

        /**
         * 规范化文本，移除多余空格
         * @param {string} text - 原始文本
         * @returns {string} 处理后的文本
         */
        normalizeText(text) {
            return text.replace(/\s+/g, ' ').trim();
        }

        /**
         * 获取页面中所有符合翻译条件的块级元素
         * @returns {Element[]} 待翻译的元素数组
         */
        getTranslatableElements() {
            const allowedTags = new Set(['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TD', 'TH', 'DIV', 'ARTICLE', 'SECTION', 'MAIN', 'ASIDE', 'FIGCAPTION', 'BLOCKQUOTE', 'ADDRESS', 'DL', 'DT', 'DD', 'CAPTION']);
            const elements = [];
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_ELEMENT,
                {

                    acceptNode: (node) => {
                        const tagName = node && node.tagName ? node.tagName : 'UNKNOWN';
                        console.log("tag:",tagName,node)
                        if (!(node instanceof Element)) {
                            console.log('[TranslationModule] 过滤: 非元素节点');
                            return NodeFilter.FILTER_REJECT;
                        }
                        if (!allowedTags.has(node.tagName)) {
                            console.log('[TranslationModule] 过滤: 标签不在白名单');
                            return NodeFilter.FILTER_SKIP;
                        }
                        if (this.isSkippableElement(node)) {
                            console.log('[TranslationModule] 过滤: 命中跳过规则');
                            return NodeFilter.FILTER_REJECT;
                        }
                        if (!this.isElementActuallyVisible(node)) {
                            console.log('[TranslationModule] 过滤: 不可见元素');
                            return NodeFilter.FILTER_REJECT;
                        }
                        if (this.hasTooManyLinks(node)) {
                            console.log('[TranslationModule] 过滤: 链接过多');
                            return NodeFilter.FILTER_REJECT;
                        }
                        const text = this.normalizeText(node.textContent || '');
                        if (!this.shouldTranslateText(text)) {
                            console.log('[TranslationModule] 过滤: 文本不满足翻译条件');
                            return NodeFilter.FILTER_REJECT;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
            );
            

            while (walker.nextNode()) {
                elements.push(walker.currentNode);
            }

            if (!elements.length) {
                const fallback = this.collectElementsFromTextNodes();
                //console.log('[TranslationModule] 未找到可翻译元素，使用文本节点回溯:', fallback.length);
                return fallback;
            }

            const candidateSet = new Set(elements);
            const ancestorSet = new Set();
            elements.forEach((element) => {
                let parent = element.parentElement;
                while (parent && parent !== document.body) {
                    if (candidateSet.has(parent)) {
                        ancestorSet.add(parent);
                    }
                    parent = parent.parentElement;
                }
            });

            const leafElements = elements.filter((element) => !ancestorSet.has(element));

            leafElements.forEach((element) => {
                const tagName = element && element.tagName ? element.tagName : 'UNKNOWN';
                const text = this.normalizeText(element.textContent || '');
                //console.log('[TranslationModule] 通过: 进入翻译队列', { tag: tagName, text }, element);
            });

            if (!leafElements.length) {
                const fallback = this.collectElementsFromTextNodes();
                //console.log('[TranslationModule] 顶层元素为空，使用文本节点回溯:', fallback.length);
                return fallback;
            }

            return leafElements;
        }

        collectElementsFromTextNodes() {
            const nodes = this.getTextNodes(document.body);
            if (!nodes.length) return [];
            const seen = new Set();
            const elements = [];
            nodes.forEach((node) => {
                const root = this.findTranslationRoot(node.parentElement);
                if (!root || seen.has(root)) return;
                if (this.hasTooManyLinks(root)) return;
                const text = this.normalizeText(root.textContent || '');
                if (!this.shouldTranslateText(text)) return;
                seen.add(root);
                elements.push(root);
            });
            return elements;
        }

        findTranslationRoot(element) {
            if (!element) return null;
            let current = element;
            let candidate = null;
            while (current && current instanceof Element) {
                if (current.tagName === 'BODY') break;
                if (this.isSkippableElement(current)) break;
                if (!this.isElementActuallyVisible(current)) break;
                const style = window.getComputedStyle?.(current);
                const display = style ? style.display : '';
                if (display && (display === 'block' || display === 'list-item' || display === 'table' || display === 'table-cell' || display === 'flex' || display === 'grid' || display === 'flow-root')) {
                    candidate = current;
                }
                current = current.parentElement;
            }
            return candidate || element;
        }

        hasTooManyLinks(element) {
            const safeQuerySelectorAll = this.safeQuerySelectorAll;
            if (!safeQuerySelectorAll) return false;
            const links = safeQuerySelectorAll('a', element);
            if (!links || links.length === 0) return false;

            // 如果链接包含大量文本（比如文章块中的链接），不应被视为“过多链接”
            const text = this.normalizeText(element.textContent || '');
            if (!text) return true;

            // 检查链接文本占总文本的比例
            let linkTextLength = 0;
            links.forEach(a => {
                linkTextLength += (a.textContent || '').trim().length;
            });

            const linkTextRatio = linkTextLength / text.length;
            
            // 只有当链接数量多且链接文本占据绝大部分比例时，才认为是导航块/广告块
            // 比例 > 0.8 且链接数 >= 10，或者全是链接（ratio > 0.95）
            if (linkTextRatio > 0.8 && links.length >= 10) return true;
            if (linkTextRatio > 0.95) return true;

            return false;
        }

        buildPlaceholderText(element) {
            const placeholders = [];
            let index = 0;
            const inlineTags = new Set([
                'A', 'SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL', 'INS', 'SMALL',
                'SUP', 'SUB', 'MARK', 'Q', 'CITE', 'ABBR', 'DFN', 'KBD', 'SAMP', 'VAR'
            ]);
            const walk = (node) => {
                if (!node) return '';
                if (node.nodeType === Node.TEXT_NODE) {
                    return node.nodeValue || '';
                }
                if (node.nodeType !== Node.ELEMENT_NODE) return '';
                const tag = node.tagName;
                if (tag === 'BR') return '\n';
                if (this.isSkippableElement(node)) return '';
                if (inlineTags.has(tag)) {
                    const id = index++;
                    const clone = node.cloneNode(false);
                    const outer = clone.outerHTML || '';
                    const closeTag = `</${tag.toLowerCase()}>`;
                    const openTag = outer.endsWith(closeTag) ? outer.slice(0, -closeTag.length) : outer;
                    const openToken = `[[[nws-tag-${id}-open]]]`;
                    const closeToken = `[[[nws-tag-${id}-close]]]`;
                    placeholders.push({ openToken, closeToken, openTag, closeTag });
                    let content = '';
                    for (const child of Array.from(node.childNodes)) {
                        content += walk(child);
                    }
                    return `${openToken}${content}${closeToken}`;
                }
                let content = '';
                for (const child of Array.from(node.childNodes)) {
                    content += walk(child);
                }
                return content;
            };
            const text = walk(element);
            return { text, placeholders };
        }

        escapeHtml(text) {
            if (!text) return '';
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        unescapeHtml(text) {
            if (!text) return '';
            return text
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&');
        }

        buildReplacePayload(element, textItems) {
            const placeholders = [];
            const inlineTags = new Set([
                'A', 'SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL', 'INS', 'SMALL',
                'SUP', 'SUB', 'MARK', 'Q', 'CITE', 'ABBR', 'DFN', 'KBD', 'SAMP', 'VAR'
            ]);
            const nodeMap = new Map();
            let index = 0;
            textItems.forEach((item) => {
                nodeMap.set(item.node, String(index));
                index += 1;
            });
            const walk = (node) => {
                if (!node) return '';
                if (node.nodeType === Node.TEXT_NODE) {
                    if (!nodeMap.has(node)) return '';
                    const id = nodeMap.get(node);
                    const text = this.escapeHtml(node.nodeValue || '');
                    return `<nws-text id="${id}">${text}</nws-text>`;
                }
                if (node.nodeType !== Node.ELEMENT_NODE) return '';
                const tag = node.tagName;
                if (tag === 'BR') return '<br>';
                if (this.isSkippableElement(node)) return '';
                if (inlineTags.has(tag)) {
                    const clone = node.cloneNode(false);
                    const outer = clone.outerHTML || '';
                    const closeTag = `</${tag.toLowerCase()}>`;
                    const openTag = outer.endsWith(closeTag) ? outer.slice(0, -closeTag.length) : outer;
                    let content = '';
                    for (const child of Array.from(node.childNodes)) {
                        content += walk(child);
                    }
                    return `${openTag}${content}${closeTag}`;
                }
                let content = '';
                for (const child of Array.from(node.childNodes)) {
                    content += walk(child);
                }
                return content;
            };
            const text = walk(element);
            return { text, textItems };
        }

        extractReplaceSegments(translatedText) {
            if (!translatedText) return new Map();
            const results = new Map();
            const regex = /<nws-text\s+id="(\d+)">([\s\S]*?)<\/nws-text>/gi;
            let match;
            while ((match = regex.exec(translatedText))) {
                results.set(match[1], match[2]);
            }
            return results;
        }

        restorePlaceholders(text, placeholders) {
            if (!text || !placeholders || placeholders.length === 0) return text;
            let output = text;
            for (const item of placeholders) {
                output = output.split(item.openToken).join(item.openTag);
                output = output.split(item.closeToken).join(item.closeTag);
            }
            return output;
        }

        /**
         * 判断元素是否应该跳过（如脚本、样式、侧边栏等）
         * @param {Element} element - 待检查的 DOM 元素
         * @returns {boolean} 是否跳过
         */
        isSkippableElement(element) {
            if (!element || typeof element.closest !== 'function') return true;
            const skipSelectors = [
                'script', 'style', 'noscript', 'iframe', 'nav', 'footer',
                'header', '[role="banner"]', '[role="navigation"]', '[role="complementary"]',
                '.nws-toolbar', '.nws-sidebar', '.nws-modern-modal',
                'pre', 'code', 'svg', 'img', 'textarea', 'input', 'select', 'option', 'button', 'canvas', 'video', 'audio'
            ];
            const sanitizeSelector = window.DOMHelper?.sanitizeSelector || ((selector) => selector);
            for (const selector of skipSelectors) {
                const safeSelector = sanitizeSelector(selector);
                if (!safeSelector) continue;
                if (element.closest(safeSelector)) return true;
            }
            if (element.className && typeof element.className === 'string' && element.className.includes('nws-')) {
                return true;
            }
            if (element.getAttribute('aria-hidden') === 'true' || element.hasAttribute('hidden') || element.hasAttribute('inert')) {
                return true;
            }
            if (element.isContentEditable) return true;
            if (element.classList && (element.classList.contains('notranslate') || element.classList.contains('no-translate') || element.classList.contains('hidden'))) {
                return true;
            }
            return false;
        }

        isElementActuallyVisible(element) {
            if (!element) return false;
            let current = element;
            let allowNoBox = false;
            while (current && current instanceof Element) {
                if (current.getAttribute('aria-hidden') === 'true' || current.hasAttribute('hidden') || current.hasAttribute('inert')) {
                    return false;
                }
                if (current.classList && (current.classList.contains('hidden') || current.classList.contains('sr-only') || current.classList.contains('visually-hidden'))) {
                    return false;
                }
                const style = window.getComputedStyle?.(current);
                if (style) {
                    if (style.display === 'none' || style.visibility === 'hidden') return false;
                    if (parseFloat(style.opacity || '1') === 0) return false;
                    if (style.display === 'contents') allowNoBox = true;
                }
                current = current.parentElement;
            }
            if (allowNoBox) {
                const text = element.textContent || '';
                if (text.trim()) return true;
            }
            const rect = element.getBoundingClientRect?.();
            if (rect && (rect.width > 0 || rect.height > 0)) return true;
            const rects = element.getClientRects?.();
            if (rects && rects.length) {
                for (const item of rects) {
                    if (item.width > 0 || item.height > 0) return true;
                }
            }
            const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
            );
            if (walker.nextNode()) {
                const range = document.createRange();
                range.selectNodeContents(walker.currentNode);
                const textRect = range.getBoundingClientRect();
                if (textRect && (textRect.width > 0 || textRect.height > 0)) return true;
            }
            return false;
        }

        isElementInViewport(element) {
            const rect = element.getBoundingClientRect?.();
            if (!rect) return false;
            const marginStr = this.config.viewportMargin || '0px';
            const margin = parseInt(String(marginStr).replace(/px$/i, ''), 10) || 0;
            const vw = window.innerWidth || document.documentElement.clientWidth || 0;
            const vh = window.innerHeight || document.documentElement.clientHeight || 0;
            return rect.bottom >= -margin &&
                   rect.right >= -margin &&
                   rect.top <= vh + margin &&
                   rect.left <= vw + margin;
        }

        /**
         * 执行全页翻译（对外公开接口）
         * @param {string} [targetLang] - 目标语言
         * @param {string} [mode] - 翻译模式（'replace' 或 'bilingual'）
         */
        async translatePage(targetLang, mode) {
            //console.log('[TranslationModule] translatePage触发:', { targetLang, mode });
            await this.ensureModuleActive();
            const lang = targetLang || this.config.targetLanguage;
            if (lang !== this.config.targetLanguage) {
                this.config.targetLanguage = lang;
            }
            await this.startFullPageTranslate(mode || this.config.translationMode);
        }

        async ensureModuleActive() {
            if (this.isActive) return;
            this.enabled = true;
            this.isActive = true;
            if (this.configManager) {
                await this.configManager.updateAndSave({ enabled: true });
            }
            //console.log('[TranslationModule] 模块已自动激活');
            if (this.config.enableSelectionTranslation) {
                this.enableSelectionTranslation();
            }
        }

        /**
         * 开始全页翻译流程
         * @param {string} mode - 翻译模式
         */
        async startFullPageTranslate(mode) {
            if (!this.isActive) {
                await this.ensureModuleActive();
            }
            const targetMode = mode || this.config.translationMode || 'bilingual';
            this.config.translationMode = targetMode;
            if (this.configManager) {
                await this.configManager.updateAndSave({ translationMode: targetMode });
            }

            this.stopObservation();
            this.pendingElements.clear();

            const elements = this.getTranslatableElements();
            //console.log('[TranslationModule] 待翻译元素数量:', elements.length, '模式:', targetMode);
            if (!elements.length) return;

            if (this.config.enableViewportTranslation && typeof IntersectionObserver !== 'undefined') {
                this.observer = new IntersectionObserver((entries) => {
                    entries.forEach((entry) => {
                        if (!entry.isIntersecting) return;
                        const element = entry.target;
                        this.observer.unobserve(element);
                        this.translateElement(element, targetMode);
                    });
                }, { rootMargin: this.config.viewportMargin || '120px', threshold: 0.05 });

                elements.forEach((element) => {
                    if (this.isElementInViewport(element)) {
                        this.translateElement(element, targetMode);
                        return;
                    }
                    this.pendingElements.set(element, true);
                    this.observer.observe(element);
                });
            } else {
                for (const element of elements) {
                    await this.translateElement(element, targetMode);
                }
            }
        }

        /**
         * 停止视口观察器
         */
        stopObservation() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
        }

        /**
         * 翻译单个 DOM 元素的内容
         * @param {Element} element - 待翻译的元素
         * @param {string} mode - 翻译模式
         */
        async translateElement(element, mode) {
            if (!element || !this.isActive) {
                //console.log('[TranslationModule] translateElement跳过:', { hasElement: Boolean(element), isActive: this.isActive });
                return;
            }
            if (element.getAttribute('data-nws-translation-status') === 'translating') {
                //console.log('[TranslationModule] translateElement跳过: 正在翻译');
                return;
            }
            const lastMode = element.getAttribute('data-nws-translation-mode');
            if (element.getAttribute('data-nws-translation-status') === 'translated' && lastMode === mode) {
                //console.log('[TranslationModule] translateElement跳过: 已翻译且模式相同');
                return;
            }

            const textItems = this.getTextItems(element);

            if (!textItems.length) {
                //console.log('[TranslationModule] translateElement跳过: 无可翻译文本');
                return;
            }

            element.setAttribute('data-nws-translation-status', 'translating');
            element.setAttribute('data-nws-translation-mode', mode);

            try {
                if (mode === 'replace') {
                    const payload = this.buildReplacePayload(element, textItems);
                    const translated = await this.translateText(payload.text);
                    this.applyReplaceTranslationHtml(payload, translated);
                } else {
                    const placeholderPayload = this.buildPlaceholderText(element);
                    const combinedText = placeholderPayload.text || textItems.map((item) => item.normalized).join('\n%%\n');
                    const translated = await this.translateText(combinedText);
                    const restored = this.restorePlaceholders(translated, placeholderPayload.placeholders);
                    this.applyBilingualTranslationHtml(element, restored);
                }
                element.setAttribute('data-nws-translation-status', 'translated');
            } catch (error) {
                //console.error('[TranslationModule] translateElement翻译失败:', error);
                element.setAttribute('data-nws-translation-status', 'error');
            }
        }

        /**
         * 应用替换模式的翻译结果（修改原有文本节点）
         * @param {Object[]} textItems - 原始文本项信息
         * @param {string[]} translations - 对应的翻译文本
         */
        applyReplaceTranslation(textItems, translations) {
            if (!textItems.length) return;
            this.removeTranslationBlock(textItems[0].node.parentElement);

            textItems.forEach((item, index) => {
                const translated = translations[index] ? translations[index].trim() : '';
                item.node.nodeValue = translated || item.original;
            });
        }

        applyReplaceTranslationHtml(payload, translatedText) {
            if (!payload || !payload.textItems || !payload.textItems.length) return;
            this.removeTranslationBlock(payload.textItems[0].node.parentElement);
            const segments = this.extractReplaceSegments(translatedText || '');
            payload.textItems.forEach((item, index) => {
                const key = String(index);
                const translated = segments.has(key) ? segments.get(key) : '';
                const cleaned = this.normalizeText(this.unescapeHtml(translated || ''));
                item.node.nodeValue = cleaned || item.original;
            });
        }

        /**
         * 应用对照（双语）模式的翻译结果（在元素下方插入新块）
         * @param {Element} element - 原始元素
         * @param {string} translatedText - 翻译文本内容
         */
        applyBilingualTranslation(element, translatedText) {
            // 打印调试日志，记录当前操作的元素和接收到的翻译文本
            //console.log('applyBilingualTranslation::>>>', element, translatedText);
            // 如果元素不存在，直接返回
            if (!element) return;
            // 如果翻译文本为空，直接返回
            if (!translatedText) return;
            // 在插入新翻译前，先移除该元素已有的翻译块，防止重复
            this.removeTranslationBlock(element);

            // 将翻译结果按行或段落拆分（处理 AI 返回的多行内容）
            const paragraphs = this.splitTranslatedResult(translatedText);
            // 创建一个新的 div 容器作为翻译内容的载体
            const block = document.createElement('div');
            // 设置类名，以便应用预定义的灰色、无背景样式
            block.className = 'nws-translation-block';
            // 设置自定义属性，标识这是一个翻译块
            block.setAttribute('data-nws-translation-role', 'block');
            // 遍历拆分后的每一段文本
            paragraphs.forEach((para) => {
                // 去除两端空格
                const line = para.trim();
                // 如果是空行则跳过
                if (!line) return;
                // 创建 p 标签包裹每一行翻译
                const p = document.createElement('p');
                // 使用 textContent 安全地设置文本内容，防止 XSS
                p.textContent = line;
                // 将 p 标签添加到容器中
                block.appendChild(p);
            });

            // 如果源元素有父节点，则执行插入操作
            if (element.parentNode) {
                // 打印调试日志，查看元素及其下一个兄弟节点的状态
                //console.log('applyBilingualTranslationHtml::>>>', element, element.nextSibling);
                // 将翻译块插入到源元素的紧随其后位置
                element.parentNode.insertBefore(block, element.nextSibling);
                // 将源元素与翻译块的对应关系存入缓存，方便后续管理（如清理）
                this.blockNodeCache.set(element, block);
            }
        }

        /**
         * 应用对照（双语）模式的翻译结果，支持 HTML 格式（在元素下方插入新块）
         * @param {Element} element - 原始 DOM 元素
         * @param {string} translatedText - 翻译后的文本内容（可能包含 HTML 标签）
         */
        applyBilingualTranslationHtml(element, translatedText) {
            // 如果目标元素不存在，直接退出
            if (!element) return;
            // 如果没有翻译后的文本，直接退出
            if (!translatedText) return;
            // 插入新翻译前，先移除该元素已有的旧翻译块，防止内容重叠
            this.removeTranslationBlock(element);
            // 将翻译后的文本按段落逻辑进行拆分
            const paragraphs = this.splitTranslatedResult(translatedText);
            // 创建一个新的 div 容器用于承载对照翻译内容
            const block = document.createElement('div');
            // 设置预定义的灰色无背景样式类名
            block.className = 'nws-translation-style';
            // 标记该 DOM 节点的角色为翻译块，便于后续识别和管理
            //block.setAttribute('data-nws-translation-role', 'block');
            // 遍历所有拆分出来的段落内容
            paragraphs.forEach((para) => {
                // 清除段落文本的首尾多余空格
                const line = para.trim();
                // 如果该行为空，则跳过不处理
                if (!line) return;
                // 创建一个 p 标签用于显示单段翻译文本
                const p = document.createElement('p');
                // 使用 innerHTML 插入文本，支持保留翻译中可能含有的简单 HTML 格式
                p.innerHTML = line;
                // 将处理好的段落添加到主容器块中
                block.appendChild(p);
            });
            // 确保源元素仍在 DOM 树中
            if (element.parentNode || element.parentElement) {
                try {
                    // 优先尝试作为兄弟节点插入（对照模式标准逻辑）
                    const parent = element.parentNode || element.parentElement;
                    parent.insertBefore(block, element.nextSibling);
                } catch (e) {
                    // 如果作为兄弟插入失败（例如 element 是 fragment 根部或其他特殊情况），
                    // 则尝试作为子节点追加到末尾，确保翻译内容能够显示
                    //console.warn('[TranslationModule] 尝试作为兄弟节点插入失败，改用 appendChild:', e);
                    element.appendChild(block);
                }
                // 将源元素与新生成的翻译块建立映射关系并存入缓存
                this.blockNodeCache.set(element, block);
            }
        }

        /**
         * 移除已有的翻译块
         * @param {Element} element - 关联翻译块的原始元素
         */
        removeTranslationBlock(element) {
            if (!element) return;
            const cached = this.blockNodeCache.get(element);
            if (cached && cached.parentNode) {
                cached.parentNode.removeChild(cached);
            }
            this.blockNodeCache.delete(element);
            if (element.nextSibling && element.nextSibling.classList && element.nextSibling.classList.contains('nws-translation-block')) {
                element.nextSibling.parentNode.removeChild(element.nextSibling);
            }
        }

        /**
         * 获取元素下所有包含实际内容的文本节点
         * @param {Element} element - 目标元素
         * @returns {Text[]} 文本节点数组
         */
        getTextNodes(element) {
            const nodes = [];
            if (!element) return nodes;
            const stats = { total: 0, empty: 0, noParent: 0, skippable: 0, hidden: 0, inBlock: 0, inInline: 0, accepted: 0 };
            const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        stats.total += 1;
                        if (!node.nodeValue || !node.nodeValue.trim()) {
                            stats.empty += 1;
                            return NodeFilter.FILTER_REJECT;
                        }
                        const parent = node.parentElement;
                        if (!parent) {
                            stats.noParent += 1;
                            return NodeFilter.FILTER_REJECT;
                        }
                        if (this.isSkippableElement(parent)) {
                            stats.skippable += 1;
                            return NodeFilter.FILTER_REJECT;
                        }
                        if (!this.isElementActuallyVisible(parent)) {
                            stats.hidden += 1;
                            return NodeFilter.FILTER_REJECT;
                        }
                        if (parent.closest && parent.closest('.nws-translation-block')) {
                            stats.inBlock += 1;
                            return NodeFilter.FILTER_REJECT;
                        }
                        if (parent.closest && parent.closest('.nws-translation-inline')) {
                            stats.inInline += 1;
                            return NodeFilter.FILTER_REJECT;
                        }
                        stats.accepted += 1;
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
            );
            while (walker.nextNode()) {
                nodes.push(walker.currentNode);
            }
            if (!nodes.length) {
                //console.log('[TranslationModule] 文本节点过滤统计:', stats);
            }
            return nodes;
        }

        /**
         * 获取待翻译的文本项数组及其原始状态
         * @param {Element} element - 目标元素
         * @returns {Object[]} 文本项信息对象数组
         */
        getTextItems(element) {
            const textNodes = this.getTextNodes(element);
            if (!textNodes.length) return [];
            return textNodes
                .map((node) => {
                    if (!this.textNodeCache.has(node)) {
                        this.textNodeCache.set(node, node.nodeValue || '');
                    }
                    const original = this.textNodeCache.get(node) || '';
                    const normalized = this.normalizeText(original);
                    return { node, original, normalized };
                })
                .filter((item) => this.shouldTranslateText(item.normalized));
        }

        /**
         * 对单个文本块进行翻译（入队逻辑）
         * @param {string} text - 待翻译文本
         * @returns {Promise<string>} 翻译结果
         */
        async translateText(text) {
            const normalized = this.normalizeText(text);
            if (!normalized) {
                //console.log('[TranslationModule] translateText跳过: 空文本');
                return '';
            }
            return await this.enqueueTranslation(normalized);
        }

        /**
         * 将翻译任务加入并发限制队列
         * @param {string} text - 待翻译文本
         * @returns {Promise<string>}
         */
        enqueueTranslation(text) {
            // 返回一个 Promise 对象，以便外部可以使用 await 或 .then() 获取翻译结果
            return new Promise((resolve, reject) => {
                // 输出入队日志，记录待翻译文本以及 Promise 的回调函数
                //console.log('[TranslationModule] 入队翻译任务:', text, resolve, reject);
                // 将翻译任务（文本及回调）推入处理队列中
                this.queue.push({ text, resolve, reject });
                // 立即尝试触发队列处理逻辑
                this.processQueue();
            });
        }

        /**
         * 处理翻译队列，维护并发请求限制
         */
        processQueue() {
            // 获取并发限制数量，确保至少为 1
            const limit = Math.max(1, this.config.concurrentLimit || 1);
            // 如果队列为空，输出调试日志
            if (!this.queue.length) {
                //console.log('[TranslationModule] 翻译队列为空');
            }
            // 当当前活动请求数小于限制且队列中还有任务时，继续循环处理
            while (this.activeRequests < limit && this.queue.length > 0) {
                // 从队列头部取出第一个待处理任务
                const task = this.queue.shift();
                // 增加活动请求计数
                this.activeRequests += 1;
                // 输出当前处理状态日志
                //console.log('[TranslationModule] 处理翻译任务:', { active: this.activeRequests, remaining: this.queue.length, text: task.text });
                // 调用底层的翻译请求方法
                this.translateTextRequest(task.text)
                    .then((result) => {
                        // 请求成功后，减少活动请求计数
                        this.activeRequests -= 1;
                        // 完成 Promise，返回结果
                        task.resolve(result);
                        // 递归调用以处理队列中的下一个任务
                        this.processQueue();
                    })
                    .catch((error) => {
                        // 请求失败后，减少活动请求计数
                        this.activeRequests -= 1;
                        // 输出错误日志
                        //console.error('[TranslationModule] 翻译任务失败:', error);
                        // 拒绝 Promise，返回错误信息
                        task.reject(error);
                        // 即使失败也继续处理队列中的剩余任务
                        this.processQueue();
                    });
            }
        }

        /**
         * 执行单次翻译请求（处理分块和 AI 交互）
         * @param {string} text - 待翻译文本
         * @returns {Promise<string>} 拼接后的翻译结果
         */
        async translateTextRequest(text) {
            const chunks = this.splitTextIntoChunks(text, this.config.maxChunkSize);
            const results = [];
            const lang = this.config.targetLanguage || '中文';
            //console.log('[TranslationModule] translateTextRequest开始:', { chunks: chunks.length, lang });
            for (const chunk of chunks) {
                const messages = this.buildTranslationMessages(chunk, lang);
                const result = await this.callOllama(messages);
                results.push(this.cleanTranslationResult(result));
            }
            //console.log('[TranslationModule] translateTextRequest完成:', { results: results });
            return results.join(' ');
        }

        /**
         * 清理翻译结果中的多余标签和空白字符
         * @param {string} text - 原始翻译文本
         * @returns {string} 清理后的文本
         */
        cleanTranslationResult(text) {
            // 如果文本为空，直接返回空字符串
            if (!text) return '';
            
            // 将输入转换为字符串
            let cleaned = String(text);
            
            // 1. 处理 <text>...</text> 包裹的情况：提取标签中间的内容
            const tagMatch = cleaned.match(/<text>([\s\S]*?)<\/text>/i);
            if (tagMatch) {
                cleaned = tagMatch[1];
            } else {
                // 2. 如果没有成对包裹，则直接全局替换移除所有 <text> 或 </text> 标签
                cleaned = cleaned.replace(/<\/?text>/gi, '');
            }

            // 3. 移除 Markdown 代码块标记（如 ``` 或 ```json），防止 UI 显示异常
            cleaned = cleaned.replace(/```[a-z]*\n?|```/gi, '');

            // 4. 统一换行符：将 \r\n 和 \r 替换为 \n，并去除首尾空白
            cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
            
            // 返回处理后的干净文本
            return cleaned;
        }

        async translateTextBatch(texts) {
            if (!Array.isArray(texts) || texts.length === 0) return [];
            const lang = this.config.targetLanguage || '中文';
            const systemPrompt = `You are a professional ${lang} translator engine.
You will receive a JSON array of strings.
Translate each string into ${lang}.
IMPORTANT rules:
1. Return ONLY a JSON array of strings.
2. Maintain the exact same order and number of elements.
3. Do not merge or split sentences.
4. Preserve inline formatting intent; do not add "%%".
5. Do not translate code fragments or variable names.`;
            const userPrompt = JSON.stringify(texts);
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ];
            const raw = await this.callOllama(messages);
            const parsed = this.parseJsonArrayFromModel(raw);
            if (parsed && Array.isArray(parsed) && parsed.length === texts.length) {
                return parsed;
            }
            const fallbacks = await Promise.all(texts.map((text) => this.translateText(text)));
            //console.log('[TranslationModule] translateTextBatch 回退结果:', fallbacks );
            return fallbacks;
        }

        parseJsonArrayFromModel(text) {
            if (!text) return null;
            // 先使用统一的清理逻辑（移除 <text> 标签、代码块标记、回车符等）
            const cleaned = this.cleanTranslationResult(text);
            try {
                const arr = JSON.parse(cleaned);
                return Array.isArray(arr) ? arr : null;
            } catch (e) {
                //console.error('[TranslationModule] JSON 解析失败:', { error: e.message, text: cleaned });
                return null;
            }
        }

        /**
         * 构建翻译专用的 AI 消息列表 (OpenAI 格式)
         * @param {string} text - 待翻译文本
         * @param {string} lang - 目标语言
         * @returns {Array} 消息列表
         */
        buildTranslationMessages(text, lang) {
            const prepared = this.prepareTextForPrompt(text);
            const outputMode = prepared.hasMulti ? 'multi' : 'single';
            
            const systemPrompt = `You are a professional ${lang} native translator.
Translate ONLY the text between <text> and </text>.
Do NOT translate or repeat any instruction outside <text>.

Rules:
1. Output only the translated text.
2. Keep the same number of paragraphs and formatting.
3. Preserve HTML tags and keep them in correct positions.
4. Keep proper nouns, code, and non-translatable content unchanged.
5. If input contains "%%", use "%%" as paragraph separators in output; otherwise do not add "%%".

Output:
- single paragraph → output translation only
- multi paragraph → use "%%" between paragraphs

Mode: ${outputMode}`;

            const userPrompt = `<text>
${prepared.text}
</text>`;

            return [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ];
        }

        /**
         * 为提示词准备文本，处理段落分隔符
         * @param {string} text - 原始文本
         * @returns {Object} 包含处理后的文本和是否多段标志
         */
        prepareTextForPrompt(text) {
            const normalized = (text || '').replace(/\r\n/g, '\n').trim();
            const hasSeparator = normalized.includes('%%');
            const hasParagraphs = /\n{2,}/.test(normalized);
            if (hasSeparator) {
                return { text: normalized, hasMulti: true };
            }
            if (hasParagraphs) {
                return { text: normalized.replace(/\n{2,}/g, '\n%%\n'), hasMulti: true };
            }
            return { text: normalized, hasMulti: false };
        }

        /**
         * 将包含分隔符的翻译结果拆分为段落数组
         * @param {string} text - 翻译响应文本
         * @returns {string[]} 拆分后的段落数组
         */
        splitTranslatedResult(text) {
            if (!text) return [];
            if (text.includes('%%')) {
                return text.split(/\s*%%\s*/);
            }
            return [text];
        }

        /**
         * 将翻译结果中的分隔符转换为换行符
         * @param {string} text - 翻译响应文本
         * @returns {string} 换行后的翻译文本
         */
        convertTranslationSeparators(text) {
            if (!text) return '';
            if (text.includes('%%')) {
                return text.split(/\s*%%\s*/).join('\n');
            }
            return text;
        }

    }

    // 注册到全局模块系统
    if (window.NWSModules) {
        window.NWSModules.TranslationModule = TranslationModule;
    }
})();
