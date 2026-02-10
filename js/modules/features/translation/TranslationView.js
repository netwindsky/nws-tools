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
        }

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
                    border: 1px solid var(--nws-border, rgba(255, 255, 255, 0.12));
                    background: var(--nws-panel, #1b2233);
                    color: var(--nws-text, #e6ecff);
                    font-size: 13px;
                    line-height: 1.45;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
                    white-space: pre-wrap;
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

                .nws-translation-style {
                    display: block;
                    position: static;
                    z-index: 0;
                    width: 100%;
                    min-width: 100%;
                    box-sizing: border-box;
                    margin: 8px 0;
                    padding: 8px 12px;
                    white-space: pre-wrap;
                    background-color: transparent;
                    box-shadow: 0 0 15px rgba(0, 0, 0, 0.3);
                    border-radius: 4px;
                    line-height: 1.45;
                    flex: 0 0 100%;
                    max-width: 100%;
                    align-self: stretch;
                    clear: both;
                    float: none;
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

        updateTooltip(text) {
            if (!this.tooltip) return;
            this.tooltip.textContent = text;
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
            const block = document.createElement('div');
            block.className = 'nws-translation-block';
            block.setAttribute('data-nws-translation-role', 'block');
            paragraphs.forEach((para) => {
                const line = para.trim();
                if (!line) return;
                ////console.log('fuck:>>>执行我了', element);
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
                p.textContent = line;
                block.appendChild(p);
            });

            if (element.parentNode) {
                element.parentNode.insertBefore(block, element.nextSibling);
                this.blockNodeCache.set(element, block);
            }
        }

        applyBilingualTranslationHtml(element, translatedText) {
            if (!element) return;
            if (!translatedText) return;
            this.removeTranslationBlock(element);
            const paragraphs = this.splitTranslatedResult(translatedText);
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
            if (element.parentNode || element.parentElement) {
                try {
                    const parent = element.parentNode || element.parentElement;
                    parent.insertBefore(block, element.nextSibling);
                } catch (e) {
                    element.appendChild(block);
                }
                this.blockNodeCache.set(element, block);
            }
        }

        removeTranslationBlock(element) {
            if (!element) return;
            const cached = this.blockNodeCache.get(element);
            if (cached && cached.parentNode) {
                cached.parentNode.removeChild(cached);
            }
            this.blockNodeCache.delete(element);
            
            // 检查下一个兄弟节点是否是翻译块（兼容旧的 nws-translation-block 和新的 nws-translation-style）
            const nextSibling = element.nextSibling;
            if (nextSibling && nextSibling.classList) {
                if (nextSibling.classList.contains('nws-translation-block') || nextSibling.classList.contains('nws-translation-style')) {
                    nextSibling.parentNode.removeChild(nextSibling);
                }
            }
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
