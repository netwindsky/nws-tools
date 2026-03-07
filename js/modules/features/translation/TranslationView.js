(function() {
    'use strict';

    class TranslationView {
        constructor(options = {}) {
            this.name = options.name || 'TranslationModule';
            this.getConfig = typeof options.getConfig === 'function' ? options.getConfig : () => ({});
            this.isActive = typeof options.isActive === 'function' ? options.isActive : () => false;
            this.shouldTranslateText = typeof options.shouldTranslateText === 'function' ? options.shouldTranslateText : () => false;
            this.translateText = typeof options.translateText === 'function' ? options.translateText : async () => '';
            this.safeAddEventListener = options.safeAddEventListener || window.NWSModules?.utils?.safeAddEventListener || ((element, event, handler, options) => {
                if (element && typeof element.addEventListener === 'function') {
                    element.addEventListener(event, handler, options);
                }
            });
            this.safeRemoveEventListener = options.safeRemoveEventListener || window.NWSModules?.utils?.safeRemoveEventListener || ((element, event, handler, options) => {
                if (element && typeof element.removeEventListener === 'function') {
                    element.removeEventListener(event, handler, options);
                }
            });
            this.styleManager = options.styleManager || window.styleManager || window.StyleManager?.getInstance?.() || null;
            this.selectionListener = null;
            this.tooltip = null;
            this.tooltipTimer = null;
            this.tooltipOutsideListener = null;
            this.blockNodeCache = new WeakMap();
            this.currentOriginalText = '';
            this.currentTranslatedText = '';
        }

        // 简单的 Markdown 转 HTML 转换器
        parseMarkdown(text) {
            if (!text) return '';
            let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            html = html.split(/\n\n+/).map(para => {
                let lines = para.split(/\n/);
                return lines.map(line => {
                    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                    line = line.replace(/__(.+?)__/g, '<strong>$1</strong>');
                    line = line.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
                    line = line.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>');
                    line = line.replace(/`([^`]+)`/g, '<code>$1</code>');
                    line = line.replace(/^(\s*)([-*+])\s+/, '$1<li>');
                    return line;
                }).join('<br>');
            }).join('</p><p>');
            html = html.replace(/(<\/li>)<br>(<li>)/g, '$1$2');
            html = html.replace(/(<li>.*?<\/li>)/g, '<ul>$1</ul>');
            if (html) html = '<p>' + html + '</p>';
            return html;
        }

        injectStyles() {
            if (!this.styleManager) return;
            const css = `
                .nws-translation-tooltip {
                    all: initial;
                    position: absolute;
                    z-index: 10005;
                    max-width: 360px;
                    padding: 14px 18px;
                    padding-right: 32px;
                    padding-top: 34px;
                    border-radius: 10px;
                    border: 1px solid var(--nws-border, rgba(255, 255, 255, 0.12));
                    background: var(--nws-panel, #1b2233);
                    color: var(--nws-text, #e6ecff);
                    font-size: 13px;
                    line-height: 1.45;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
                    white-space: pre-wrap;
                }
                
                .nws-translation-copy-container {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1;
                }
                
                .nws-translation-copy-btn {
                    all: initial;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    color: rgba(255, 255, 255, 0.5);
                    backdrop-filter: blur(4px);
                }
                
                .nws-translation-copy-btn:hover {
                    background: rgba(255, 255, 255, 0.08);
                    border-color: rgba(255, 255, 255, 0.25);
                    color: rgba(255, 255, 255, 0.9);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                }
                
                .nws-translation-copy-btn:active {
                    transform: translateY(0);
                    background: rgba(255, 255, 255, 0.05);
                }
                
                .nws-translation-copy-btn.success {
                    color: #4ade80;
                    border-color: rgba(74, 222, 128, 0.4);
                    background: rgba(74, 222, 128, 0.08);
                }
                
                .nws-translation-tooltip-content {
                    display: block;
                    width: 100%;
                    height: 100%;
                }
                
                .nws-copy-toast {
                    all: initial;
                    position: fixed;
                    bottom: 24px;
                    left: 50%;
                    transform: translateX(-50%) translateY(20px);
                    background: rgba(30, 30, 40, 0.95);
                    backdrop-filter: blur(12px);
                    color: rgba(255, 255, 255, 0.95);
                    padding: 10px 16px;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    font-size: 13px;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    z-index: 100000;
                    opacity: 0;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    pointer-events: none;
                }
                
                .nws-copy-toast svg {
                    color: #4ade80;
                    flex-shrink: 0;
                }
                
                .nws-copy-toast-show {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
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
                    padding: 3px 16px;
                    color: #888;
                    font-size: 0.95em;
                    line-height: 1.6;
                    white-space: pre-wrap;
                }

                .nws-translation-style {
                    display: block !important;
                    position: relative !important;
                    z-index: 0;
                    width: 100% !important;
                    min-width: 100% !important;
                    box-sizing: border-box;
                    margin: 8px 0;
                    padding: 8px 12px;
                    white-space: pre-wrap;
                    background-color: transparent;
                    box-shadow: 0 0 15px rgba(0, 0, 0, 0.5); 
                    border-radius: 4px;
                    line-height: 1.45;
                    flex-basis: 100% !important;
                    flex-grow: 1 !important;
                    clear: both !important;
                    float: none !important;
                }

                .nws-translation-paragraph {
                    margin: 0 0 8px 0;
                    line-height: 1.6;
                    color: var(--nws-text-dim, #888);
                    font-size: 1em;
                }

                .nws-translation-paragraph:last-child {
                    margin-bottom: 0;
                }

                /* 双语包裹器：强制上下布局 */
                .nws-bilingual-wrapper {
                    display: grid !important;
                    grid-template-columns: 1fr !important;
                    grid-template-rows: auto auto !important;
                    gap: 8px !important;
                    margin: 8px 0 !important;
                    width: 100% !important;
                }
                
                /* 表格单元格内的译文样式 */
                td .nws-translation-style,
                th .nws-translation-style {
                    display: block !important;
                    margin-top: 8px !important;
                    padding: 8px 0 !important;
                    border-top: 1px solid rgba(0, 0, 0, 0.1) !important;
                    width: 100% !important;
                    background-color: rgba(0, 0, 0, 0.03) !important;
                    border-radius: 4px !important;
                    font-size: 0.95em !important;
                    color: #333 !important;
                    box-shadow: none !important;
                }
                
                /* 保持单元格布局 */
                td.nws-translation-style,
                th.nws-translation-style {
                    display: table-cell !important;
                }
            `;
            this.styleManager.inject(this.name, css, `nws-style-${this.name}`, { replace: true, priority: 'normal' });
        }

        enableSelectionTranslation() {
            if (this.selectionListener) return;
            this.selectionListener = this.handleSelectionMouseUp.bind(this);
            this.safeAddEventListener(document, 'mouseup', this.selectionListener, true);
        }

        disableSelectionTranslation() {
            if (!this.selectionListener) return;
            this.safeRemoveEventListener(document, 'mouseup', this.selectionListener, true);
            this.selectionListener = null;
        }

        handleSelectionMouseUp(event) {
            const config = this.getConfig ? this.getConfig() : {};
            if (!this.isActive() || !config.enableSelectionTranslation) return;
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
                    const displayResult = result ? result.replace(/\s*%%\s*/g, '\n\n') : '翻译结果为空';
                    this.updateTooltip(displayResult);
                })
                .catch(() => {
                    this.updateTooltip('翻译失败，请稍后重试');
                });
        }

        showTooltip(x, y, text, originalText = '') {
            if (!this.tooltip) {
                this.tooltip = document.createElement('div');
                this.tooltip.className = 'nws-translation-tooltip';
                
                // 创建复制按钮容器
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'nws-translation-copy-container';
                
                // 创建精致的复制按钮（方形圆角）
                const copyButton = document.createElement('button');
                copyButton.className = 'nws-translation-copy-btn';
                copyButton.title = '复制原文和译文';
                copyButton.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                `;
                copyButton.onclick = (e) => {
                    e.stopPropagation();
                    this.copyTranslationResult();
                };
                
                buttonContainer.appendChild(copyButton);
                
                // 创建内容容器
                const contentDiv = document.createElement('div');
                contentDiv.className = 'nws-translation-tooltip-content';
                
                this.tooltip.appendChild(buttonContainer);
                this.tooltip.appendChild(contentDiv);
                
                document.body.appendChild(this.tooltip);
            }
            
            const contentDiv = this.tooltip.querySelector('.nws-translation-tooltip-content');
            if (contentDiv) {
                contentDiv.innerHTML = this.parseMarkdown(text);
            }
            
            // 存储原文和译文
            this.currentOriginalText = originalText;
            this.currentTranslatedText = text;
            
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

        updateTooltip(text, originalText = '') {
            if (!this.tooltip) return;
            const contentDiv = this.tooltip.querySelector('.nws-translation-tooltip-content');
            if (contentDiv) {
                contentDiv.innerHTML = this.parseMarkdown(text);
            }
            
            // 更新存储的原文和译文
            if (originalText) {
                this.currentOriginalText = originalText;
            }
            this.currentTranslatedText = text;
        }
        
        isTooltipVisible() {
            return this.tooltip && this.tooltip.style.display === 'block';
        }
        
        copyTranslationResult() {
            if (!this.currentOriginalText || !this.currentTranslatedText) return;
            
            // 格式化复制内容：原文 + 译文
            const copyContent = `原文：${this.currentOriginalText}\n\n译文：${this.currentTranslatedText}`;
            
            navigator.clipboard.writeText(copyContent).then(() => {
                const copyButton = this.tooltip?.querySelector('.nws-translation-copy-btn');
                if (copyButton) {
                    // 添加成功状态样式
                    copyButton.classList.add('success');
                    
                    // 改变图标为对勾
                    copyButton.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    `;
                    
                    // 显示"已复制"提示
                    this.showCopySuccessToast();
                    
                    // 1.5 秒后恢复
                    setTimeout(() => {
                        copyButton.classList.remove('success');
                        copyButton.innerHTML = `
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        `;
                    }, 1500);
                }
            }).catch(err => {
                console.error('[TranslationView] 复制失败:', err);
            });
        }
        
        showCopySuccessToast() {
            // 创建优雅的提示
            const toast = document.createElement('div');
            toast.className = 'nws-copy-toast';
            toast.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>已复制</span>
            `;
            
            document.body.appendChild(toast);
            
            // 动画显示
            requestAnimationFrame(() => {
                toast.classList.add('nws-copy-toast-show');
            });
            
            // 2 秒后移除
            setTimeout(() => {
                toast.classList.remove('nws-copy-toast-show');
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }, 2000);
        }

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

        clampTooltipPosition(x, y) {
            const padding = 12;
            const maxX = window.scrollX + window.innerWidth - padding;
            const maxY = window.scrollY + window.innerHeight - padding;
            return {
                x: Math.min(x, maxX),
                y: Math.min(y, maxY)
            };
        }

        isNwsElement(element) {
            if (!element || typeof element.closest !== 'function') return false;
            const sanitizeSelector = window.DOMHelper?.sanitizeSelector || ((selector) => selector);
            const selector = sanitizeSelector('.nws-toolbar, .nws-sidebar, .nws-modern-modal, .nws-translation-tooltip');
            if (!selector) return false;
            return Boolean(element.closest(selector));
        }

        applyReplaceTranslation(textItems, translations) {
            if (!textItems.length) return;
            this.removeTranslationBlock(textItems[0].node.parentElement);

            textItems.forEach((item, index) => {
                const translated = translations[index] ? translations[index].trim() : '';
                item.node.nodeValue = translated || item.original;
            });
        }

        async applyReplaceTranslationHtml(payload, translatedText, retryCount = 0) {
            if (!payload || !payload.textItems || !payload.textItems.length) return;
            // 检查翻译结果是否符合目标语言
            const config = this.getConfig();
            const targetLang = config.targetLanguage || '中文';
            const isLanguageValid = this.checkLanguage(translatedText, targetLang);

            // //console.log('fuck:>applyReplaceTranslationHtml', payload);
            // //console.log('fuck:>translatedText', translatedText);
            // //console.log('fuck:>---------------------------------------------------------------------');

            
            if (!isLanguageValid) {
                if (retryCount < 1) {
                    //console.log(`[TranslationView] Translation failed language check (${targetLang}). Retrying... (Attempt ${retryCount + 1})`);
                    try {
                        const newTranslation = await this.translateText(payload.text);
                        // 递归调用，增加重试计数
                        await this.applyReplaceTranslationHtml(payload, newTranslation, retryCount + 1);
                        return;
                    } catch (e) {
                        console.error('[TranslationView] Retry translation failed:', e);
                    }
                } else {
                    console.warn('[TranslationView] Translation still invalid after retry. Applying as is.');
                }
            }

            this.removeTranslationBlock(payload.textItems[0].node.parentElement);
            const segments = this.extractReplaceSegments(translatedText || '');
            payload.textItems.forEach((item, index) => {
                const key = String(index);
                const translated = segments.has(key) ? segments.get(key) : '';
                const cleaned = this.normalizeText(this.unescapeHtml(translated || ''));
                item.node.nodeValue = cleaned || item.original;
            });
        }

        checkLanguage(text, targetLang) {
            if (!text) return false;
            // 移除 HTML 标签干扰
            const cleanText = text.replace(/<[^>]+>/g, '').trim();
            if (!cleanText) return false; // 如果只剩下空字符串，视为无效

            if (targetLang === '中文' || targetLang === 'Chinese') {
                // 只要包含至少一个中文字符，就认为是有效的（宽松检查）
                return /[\u4e00-\u9fa5]/.test(cleanText);
            }
            if (targetLang === 'English' || targetLang === '英文') {
                // 检查是否包含拉丁字母
                return /[a-zA-Z]/.test(cleanText);
            }
            // 其他语言暂默认通过
            return true;
        }

        applyBilingualTranslation(element, translatedText) {
            if (!element) return;
            if (!translatedText) return;
            this.removeTranslationBlock(element);

            let computedStyle = null;
            try {
                computedStyle = window.getComputedStyle(element);
            } catch (e) {
                computedStyle = null;
            }

            const paragraphs = this.splitTranslatedResult(translatedText);
            
            // 检查是否是表格单元格
            const isTableCell = element.tagName === 'TD' || element.tagName === 'TH';
            
            // 检查是否已经有译文
            const existingTranslation = element.querySelector('.nws-translation-style');
            if (existingTranslation) {
                existingTranslation.remove();
            }
            
            // 创建译文容器
            const block = document.createElement('div');
            block.className = 'nws-translation-style';
            
            paragraphs.forEach((para) => {
                const line = para.trim();
                if (!line) return;
                // 表格单元格使用 span，其他元素保持原有标签
                const tagName = isTableCell ? 'span' : element.tagName;
                const p = document.createElement(tagName);
                if (computedStyle) {
                    p.style.color = computedStyle.color || '';
                    p.style.fontSize = computedStyle.fontSize || '';
                    p.style.fontFamily = computedStyle.fontFamily || '';
                    p.style.fontWeight = computedStyle.fontWeight || '';
                    p.style.fontStyle = computedStyle.fontStyle || '';
                    p.style.lineHeight = computedStyle.lineHeight || '';
                    p.style.letterSpacing = computedStyle.letterSpacing || '';
                }
                p.textContent = line;
                block.appendChild(p);
            });

            if (isTableCell) {
                // 表格单元格：直接追加译文，不包裹原文
                element.appendChild(block);
                this.blockNodeCache.set(element, block);
            } else {
                // 非表格元素：使用 wrapper 包裹
                let wrapper = element.closest('.nws-bilingual-wrapper');
                
                if (!wrapper) {
                    // 创建 wrapper
                    wrapper = document.createElement('div');
                    wrapper.className = 'nws-bilingual-wrapper';
                    
                    // 插入 wrapper 替换原文
                    if (element.parentNode) {
                        element.parentNode.insertBefore(wrapper, element);
                        wrapper.appendChild(element);  // 移动原文到 wrapper
                    }
                }
                
                // 添加到 wrapper
                wrapper.appendChild(block);
                this.blockNodeCache.set(element, wrapper);
            }
        }

        applyBilingualTranslationHtml(element, translatedText) {
            if (!element) return;
            if (!translatedText) return;
            this.removeTranslationBlock(element);
            const paragraphs = this.splitTranslatedResult(translatedText);
            
            // 检查是否已经在 wrapper 中
            let wrapper = element.closest('.nws-bilingual-wrapper');
            
            if (!wrapper) {
                // 创建 wrapper
                wrapper = document.createElement('div');
                wrapper.className = 'nws-bilingual-wrapper';
                
                // 插入 wrapper 替换原文
                if (element.parentNode) {
                    element.parentNode.insertBefore(wrapper, element);
                    wrapper.appendChild(element);  // 移动原文到 wrapper
                }
            }
            
            // 创建译文容器
            const block = document.createElement('div');
            block.className = 'nws-translation-style';
            
            let computedStyle = null;
            try {
                computedStyle = window.getComputedStyle(element);
            } catch (e) {
                computedStyle = null;
            }

            paragraphs.forEach((para) => {
                const line = para.trim();
                if (!line) return;
                const p = document.createElement(element.tagName);
                p.className = 'nws-translation-paragraph';
                if (computedStyle) {
                    p.style.color = computedStyle.color || '';
                    p.style.fontSize = computedStyle.fontSize || '';
                    p.style.fontFamily = computedStyle.fontFamily || '';
                    p.style.fontWeight = computedStyle.fontWeight || '';
                    p.style.fontStyle = computedStyle.fontStyle || '';
                    p.style.lineHeight = computedStyle.lineHeight || '';
                    p.style.letterSpacing = computedStyle.letterSpacing || '';
                }
                
                p.innerHTML = line;
                block.appendChild(p);
            });
            
            // 添加到 wrapper
            wrapper.appendChild(block);
            this.blockNodeCache.set(element, wrapper);
        }

        removeTranslationBlock(element) {
            if (!element) return;
            const cached = this.blockNodeCache.get(element);
            if (cached && cached.parentNode) {
                // 如果缓存的是 wrapper，需要还原原文
                if (cached.classList.contains('nws-bilingual-wrapper')) {
                    const originalElement = cached.querySelector(':scope > *:first-child');
                    if (originalElement && cached.parentNode) {
                        cached.parentNode.insertBefore(originalElement, cached);
                        cached.parentNode.removeChild(cached);
                    }
                } else {
                    cached.parentNode.removeChild(cached);
                }
            }
            this.blockNodeCache.delete(element);
            
            // 兼容旧的直接插入方式（没有 wrapper）
            const nextSibling = element.nextSibling;
            if (nextSibling && nextSibling.classList) {
                if (nextSibling.classList.contains('nws-translation-block') || nextSibling.classList.contains('nws-translation-style')) {
                    nextSibling.parentNode.removeChild(nextSibling);
                }
            }
        }

        removeAllTranslationBlocks() {
            const blocks = document.querySelectorAll('.nws-translation-block, .nws-translation-style');
            blocks.forEach(block => {
                if (block.parentNode) {
                    block.parentNode.removeChild(block);
                }
            });
            this.blockNodeCache = new WeakMap();
        }

        splitTranslatedResult(text) {
            if (!text) return [];
            if (text.includes('%%')) {
                return text.split(/\s*%%\s*/);
            }
            return [text];
        }

        extractReplaceSegments(translatedText) {
            if (!translatedText) return new Map();
            const results = new Map();
            // 极度宽松匹配：
            // 1. id\s*=\s* 允许等号周围空格
            // 2. ["']?(\d+) 允许有无引号
            // 3. [^>]* 忽略 ID 后面直到 > 的所有内容（包括关闭引号缺失的情况）
            const regex = /<nws-text\s+id\s*=\s*["']?(\d+)[^>]*>([\s\S]*?)<\/nws-text>/gi;
            
            let match;
            while ((match = regex.exec(translatedText))) {
                results.set(match[1], match[2]);
            }
            
            //console.log(`[TranslationView] Extracted ${results.size} segments from text.`);
            if (results.size === 0 && translatedText.includes('<nws-text')) {
                console.warn('[TranslationView] Failed to extract segments despite presence of <nws-text> tags. Raw text:', translatedText);
            }
            
            return results;
        }

        normalizeText(text) {
            return text.replace(/\s+/g, ' ').trim();
        }

        unescapeHtml(text) {
            if (!text) return '';
            return text
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&');
        }

        destroy() {
            this.disableSelectionTranslation();
            this.hideTooltip();
            if (this.tooltip && this.tooltip.parentNode) {
                this.tooltip.parentNode.removeChild(this.tooltip);
            }
            if (this.styleManager) {
                this.styleManager.removeModuleStyles(this.name);
            }
        }
    }

    if (window.NWSModules) {
        window.NWSModules.TranslationView = TranslationView;
    }
})();
