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
                    defaultModel: 'MedAIBase/Tencent-HY-MT1.5:1.8b',
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
            this.isActive = false;
            this.textNodeCache = new WeakMap();
            this.view = null;
            this.service = null;
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
            const TranslationService = window.NWSModules?.TranslationService || window.NWSModules?.get?.('TranslationService');
            if (TranslationService) {
                this.service = new TranslationService({
                    getConfig: () => this.config,
                    translateText: (text) => this.translateText(text)
                });
            }
            const TranslationView = window.NWSModules?.TranslationView || window.NWSModules?.get?.('TranslationView');
            if (TranslationView) {
                this.view = new TranslationView({
                    name: this.name,
                    getConfig: () => this.config,
                    isActive: () => this.isActive,
                    shouldTranslateText: (text) => this.shouldTranslateText(text),
                    translateText: (text) => this.translateText(text),
                    safeAddEventListener: this.safeAddEventListener,
                    safeRemoveEventListener: this.safeRemoveEventListener,
                    styleManager: this.styleManager
                });
                this.view.injectStyles();
            }
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
         * 模块启用生命周期
         */
        async onEnable() {
            this.isActive = true;
            if (this.config.enableSelectionTranslation) {
                this.view?.enableSelectionTranslation();
            }
        }

        /**
         * 模块禁用生命周期
         */
        async onDisable() {
            this.isActive = false;
            this.view?.disableSelectionTranslation();
            this.stopObservation();
            this.view?.hideTooltip();
        }

        /**
         * 模块销毁生命周期
         */
        async onDestroy() {
            await this.onDisable();
            this.queue = [];
            this.activeRequests = 0;
            this.pendingElements.clear();
            this.view?.destroy();
        }

        /**
         * 处理配置项变更后的逻辑更新
         */
        handleConfigChange() {
            if (this.isActive) {
                if (this.config.enableSelectionTranslation) {
                    this.view?.enableSelectionTranslation();
                } else {
                    this.view?.disableSelectionTranslation();
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
                this.view?.enableSelectionTranslation();
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
                    this.view?.applyReplaceTranslationHtml(payload, translated);
                } else {
                    const placeholderPayload = this.buildPlaceholderText(element);
                    const combinedText = placeholderPayload.text || textItems.map((item) => item.normalized).join('\n%%\n');
                    const translated = await this.translateText(combinedText);
                    const restored = this.restorePlaceholders(translated, placeholderPayload.placeholders);
                    this.view?.applyBilingualTranslationHtml(element, restored);
                }
                element.setAttribute('data-nws-translation-status', 'translated');
            } catch (error) {
                //console.error('[TranslationModule] translateElement翻译失败:', error);
                element.setAttribute('data-nws-translation-status', 'error');
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
            if (!this.service || typeof this.service.translateTextRequest !== 'function') {
                throw new Error('TranslationService 未初始化');
            }
            return await this.service.translateTextRequest(text);
        }

        async translateTextBatch(texts) {
            if (!this.service || typeof this.service.translateTextBatch !== 'function') {
                return [];
            }
            return await this.service.translateTextBatch(texts);
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
