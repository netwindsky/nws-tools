/**
 * PageManager.js - 全页翻译管理器
 * 负责页面 DOM 遍历、动态内容监听及全页翻译块的注入与管理
 */

(function() {
    'use strict';

    class PageManager {
        constructor(moduleInstance) {
            this.module = moduleInstance;
            
            if (window.NWSModules?.TranslationUtils) {
                this.utils = new window.NWSModules.TranslationUtils(() => this.module.config);
            } else {
                console.error('[PageManager] TranslationUtils missing');
                this.utils = {
                    normalizeText: t => t,
                    isSkippableElement: () => true,
                    shouldTranslateText: () => false,
                    isElementActuallyVisible: () => false
                };
            }
            
            this.view = this.module.view;
            
            this.observer = null;
            this.intersectionObserver = null;
            this.processedNodes = new WeakSet();
            this.pendingElements = new Set();
            this.processingTimer = null;
            this.isObserving = false;
            
            // SPA URL 监听
            this.lastUrl = location.href;
            this.urlCheckInterval = null;
        }

        /**
         * 启动全页翻译
         * @param {string} mode - 'bilingual' | 'replacement'
         */
        start(mode = 'bilingual') {
            if (this.isObserving) return;
            this.isObserving = true;
            this.processedNodes = new WeakSet();

            // 1. 启动 IntersectionObserver
            this.setupIntersectionObserver();

            // 2. 初始全量扫描
            this.processElements(document.body);

            // 3. 启动 MutationObserver 监听动态内容
            this.setupMutationObserver();

            // 4. 启动 SPA URL 监听
            this.startUrlCheck();

            // 5. 显示状态通知
            if (this.module.notification) {
                // 可选：通知用户翻译已开始
            }
        }

        /**
         * 停止全页翻译并清理
         */
        stop() {
            this.isObserving = false;
            
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            if (this.intersectionObserver) {
                this.intersectionObserver.disconnect();
                this.intersectionObserver = null;
            }
            if (this.processingTimer) {
                clearTimeout(this.processingTimer);
                this.processingTimer = null;
            }
            if (this.urlCheckInterval) {
                clearInterval(this.urlCheckInterval);
                this.urlCheckInterval = null;
            }
            
            this.pendingElements.clear();
            
            // 清理已注入的翻译块 (通过 View)
            this.view?.removeAllTranslationBlocks();
            
            // 清除已处理标记，以便下次重新开启时能重新翻译
            this.processedNodes = new WeakSet();
        }

        setupIntersectionObserver() {
            if (this.intersectionObserver) this.intersectionObserver.disconnect();
            
            this.intersectionObserver = new IntersectionObserver((entries) => {
                const visibleElements = [];
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        visibleElements.push(entry.target);
                        this.intersectionObserver.unobserve(entry.target);
                    }
                }
                if (visibleElements.length > 0) {
                    visibleElements.forEach(el => this.processElement(el));
                }
            }, {
                rootMargin: '200px 0px', // 提前 200px 加载
                threshold: 0.01
            });
        }

        setupMutationObserver() {
            if (this.observer) this.observer.disconnect();
            
            this.observer = new MutationObserver((mutations) => {
                if (!this.isObserving) return;
                
                let shouldProcess = false;
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === Node.ELEMENT_NODE && !this.utils.isSkippableElement(node)) {
                                this.pendingElements.add(node);
                                shouldProcess = true;
                            } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                                // 文本节点变动通常意味着父元素内容更新
                                if (node.parentElement && !this.utils.isSkippableElement(node.parentElement)) {
                                    this.pendingElements.add(node.parentElement);
                                    shouldProcess = true;
                                }
                            }
                        }
                    } else if (mutation.type === 'characterData') {
                         if (mutation.target.parentElement && !this.utils.isSkippableElement(mutation.target.parentElement)) {
                             this.pendingElements.add(mutation.target.parentElement);
                             shouldProcess = true;
                         }
                    }
                }

                if (shouldProcess) {
                    this.scheduleProcessing();
                }
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        scheduleProcessing() {
            if (this.processingTimer) clearTimeout(this.processingTimer);
            this.processingTimer = setTimeout(() => {
                this.processPendingElements();
            }, 1000); // 防抖 1秒
        }

        processPendingElements() {
            if (!this.isObserving) return;
            const elements = Array.from(this.pendingElements);
            this.pendingElements.clear();
            
            for (const el of elements) {
                // 检查是否仍在文档中
                if (document.body.contains(el)) {
                    this.processElements(el);
                }
            }
        }

        processElements(root) {
            if (!root || this.utils.isSkippableElement(root)) return;
            
            // 如果是大容器，遍历子节点
            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_ELEMENT,
                {
                    acceptNode: (node) => {
                        if (this.utils.isSkippableElement(node)) return NodeFilter.FILTER_REJECT;
                        // 如果元素本身是叶子节点容器（包含文本），或者是需要独立翻译的块
                        if (this.hasDirectText(node)) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        return NodeFilter.FILTER_SKIP; // 继续遍历子节点
                    }
                }
            );

            const nodesToProcess = [];
            // 检查根节点本身
            if (this.hasDirectText(root)) nodesToProcess.push(root);
            
            while (walker.nextNode()) {
                nodesToProcess.push(walker.currentNode);
            }

            nodesToProcess.forEach(node => {
                if (this.utils.isElementActuallyVisible(node)) {
                    // 加入视口观察，可见时才翻译
                    this.intersectionObserver.observe(node);
                }
            });
        }

        hasDirectText(element) {
            for (const child of element.childNodes) {
                if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                    return true;
                }
            }
            return false;
        }

        async processElement(element) {
            if (this.processedNodes.has(element)) return;
            this.processedNodes.add(element);

            // 获取文本节点项
            const textItems = this.getTextItems(element);
            if (!textItems.length) return;

            // 过滤已翻译的（避免重复）
            // 这里简单判断：如果元素内已经包含了 nws-translation-block，则不再处理
            if (element.querySelector('.nws-translation-block') || element.querySelector('.nws-translation-inline')) {
                return;
            }

            // 执行翻译
            const originalText = textItems.map(item => item.original).join('\n\n'); // 简单合并，或根据布局复杂处理
            // 注意：合并翻译可能会丢失对应关系，对于精细排版，建议逐个或按段落翻译。
            // 原始逻辑通常是按块翻译。这里为了简化，我们逐个文本节点处理或者按 Block 处理。
            // 为了效果最好，我们通常把一个 Block (如 p, div, h1) 内的所有文本合并翻译，然后展示在旁边或下方。

            // 修正：我们应该翻译整个元素的聚合文本
            const fullText = textItems.map(i => i.normalized).join('\n');
            if (!this.utils.shouldTranslateText(fullText)) return;

            // 显示 loading 占位 (可选)
            // this.view.showLoading(element);

            try {
                const translation = await this.module.translateText(fullText);
                if (translation && this.isObserving) {
                    const mode = this.module.config.translationMode || 'bilingual';
                    if (mode === 'bilingual') {
                        this.view.applyBilingualTranslation(element, translation);
                    } else {
                        // 替换模式比较复杂，需要替换 TextNode 内容，这里暂且只支持双语对照，
                        // 或者简单的文本替换。为了稳健性，先只支持双语对照注入。
                        // 如果需要替换模式，需实现 applyReplacementTranslation
                         this.view.applyBilingualTranslation(element, translation);
                    }
                }
            } catch (e) {
                console.warn('[PageManager] Translation failed for element:', element, e);
            }
        }

        getTextItems(element) {
            const items = [];
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                    if (this.utils.isSkippableElement(node.parentElement)) return NodeFilter.FILTER_REJECT;
                    return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            });

            while (walker.nextNode()) {
                const node = walker.currentNode;
                items.push({
                    node: node,
                    original: node.textContent,
                    normalized: this.utils.normalizeText(node.textContent)
                });
            }
            return items;
        }

        startUrlCheck() {
            if (this.urlCheckInterval) clearInterval(this.urlCheckInterval);
            this.urlCheckInterval = setInterval(() => {
                if (location.href !== this.lastUrl) {
                    this.lastUrl = location.href;
                    this.handleUrlChange();
                }
            }, 1000);
        }

        handleUrlChange() {
            // URL 变化，通常意味着页面内容重置
            // 重新扫描页面
            setTimeout(() => {
                if (this.isObserving) {
                    this.processElements(document.body);
                }
            }, 1500); // 等待新页面渲染
        }
    }

    if (!window.NWSModules) {
        window.NWSModules = {};
    }
    window.NWSModules.PageManager = PageManager;
})();