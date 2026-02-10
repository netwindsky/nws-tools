/**
 * TranslationUtils.js - 翻译模块公共工具库
 * 提供文本判定、元素检查等无状态辅助函数
 */

(function() {
    'use strict';

    class TranslationUtils {
        constructor(configProvider = {}) {
            this.configProvider = configProvider;
            this.safeQuerySelector = window.DOMHelper?.safeQuerySelector || ((s) => document.querySelector(s));
        }

        get config() {
            return typeof this.configProvider === 'function' ? this.configProvider() : this.configProvider;
        }

        setConfig(configProvider) {
            this.configProvider = configProvider;
        }

        /**
         * 规范化文本，移除多余空格
         * @param {string} text - 原始文本
         * @returns {string} 处理后的文本
         */
        normalizeText(text) {
            return text ? text.replace(/\s+/g, ' ').trim() : '';
        }

        /**
         * 判断文本是否应该被翻译
         * @param {string} text - 要检查的文本内容
         * @returns {boolean} 是否符合翻译条件
         */
        shouldTranslateText(text) {
            if (!text) return false;
            const normalized = this.normalizeText(text);
            
            // 检查最小长度
            const minLength = this.config.minTextLength || 2;
            if (normalized.length < minLength) return false;

            // 过滤纯数字/符号
            if (/^[\d\W_]+$/.test(normalized)) return false;

            // 过滤 URL/链接
            const urlRegex = /^(?:https?:\/\/|ftp:\/\/|www\.)[^\s]+$|^(?:[\w-]+\.)+[a-z]{2,}(?:\/[^\s]*)?$/i;
            if (urlRegex.test(normalized)) return false;

            // 过滤邮箱
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;

            // 检查目标语言是否为中文，避免重复翻译中文内容
            const lang = this.config.targetLanguage || '中文';
            const isTargetChinese = /中文|Chinese/i.test(lang);
            if (isTargetChinese) {
                const chineseChars = (normalized.match(/[\u4e00-\u9fa5]/g) || []).length;
                if (chineseChars / normalized.length > 0.5) return false;
            }

            return true;
        }

        /**
         * 判断元素是否应该跳过（如脚本、样式、侧边栏等）
         * @param {Element} element - 待检查的 DOM 元素
         * @returns {boolean} 是否跳过
         */
        isSkippableElement(element) {
            if (!element || typeof element.closest !== 'function') return true;
            
            // 基础跳过标签
            const skipTags = new Set([
                'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'NAV', 'FOOTER', 'HEADER', 
                'PRE', 'CODE', 'SVG', 'IMG', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 
                'BUTTON', 'CANVAS', 'VIDEO', 'AUDIO'
            ]);
            
            if (skipTags.has(element.tagName)) return true;

            // 选择器跳过列表
            const skipSelectors = [
                '[role="banner"]', '[role="navigation"]', '[role="complementary"]',
                '.nws-toolbar', '.nws-sidebar', '.nws-modern-modal',
                '.nws-translation-tooltip'
            ];
            
            const sanitizeSelector = window.DOMHelper?.sanitizeSelector || ((selector) => selector);
            for (const selector of skipSelectors) {
                const safeSelector = sanitizeSelector(selector);
                if (safeSelector && element.closest(safeSelector)) return true;
            }

            // 检查 class
            if (element.className && typeof element.className === 'string' && element.className.includes('nws-')) {
                // 排除 nws-translation-block 等自身注入的元素
                if (!element.classList.contains('nws-translation-paragraph')) {
                    return true;
                }
            }

            // 属性检查
            if (element.getAttribute('aria-hidden') === 'true' || 
                element.hasAttribute('hidden') || 
                element.hasAttribute('inert') ||
                element.isContentEditable) {
                return true;
            }

            // 特殊类名检查
            if (element.classList && (
                element.classList.contains('notranslate') || 
                element.classList.contains('no-translate') || 
                element.classList.contains('hidden') ||
                element.classList.contains('nws-translation-style')
            )) {
                return true;
            }

            return false;
        }

        /**
         * 检查元素是否真实可见
         * @param {Element} element 
         * @returns {boolean}
         */
        isElementActuallyVisible(element) {
            if (!element) return false;
            
            // 1. 属性检查
            if (element.getAttribute('aria-hidden') === 'true' || 
                element.hasAttribute('hidden') || 
                element.hasAttribute('inert')) {
                return false;
            }

            // 2. Class 检查
            if (element.classList && (
                element.classList.contains('hidden') || 
                element.classList.contains('sr-only') || 
                element.classList.contains('visually-hidden')
            )) {
                return false;
            }

            // 3. Computed Style 检查
            let allowNoBox = false;
            try {
                const style = window.getComputedStyle(element);
                if (style.display === 'none' || style.visibility === 'hidden') return false;
                if (parseFloat(style.opacity || '1') === 0) return false;
                if (style.display === 'contents') allowNoBox = true;
            } catch (e) {
                // 忽略跨域 iframe 等导致的错误
            }

            // 4. 尺寸检查
            if (allowNoBox) {
                return !!(element.textContent || '').trim();
            }
            
            const rect = element.getBoundingClientRect?.();
            if (rect && (rect.width > 0 || rect.height > 0)) return true;
            
            // 5. ClientRects 兜底
            const rects = element.getClientRects?.();
            if (rects && rects.length) {
                for (const item of rects) {
                    if (item.width > 0 || item.height > 0) return true;
                }
            }

            // 6. 文本节点可见性兜底
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                    return (node.nodeValue && node.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            });
            if (walker.nextNode()) {
                const range = document.createRange();
                range.selectNodeContents(walker.currentNode);
                const textRect = range.getBoundingClientRect();
                if (textRect && (textRect.width > 0 || textRect.height > 0)) return true;
            }

            return false;
        }

        /**
         * 检查翻译结果是否有效（语言检查）
         * @param {string} text - 翻译后的文本
         * @param {string} targetLang - 目标语言
         * @returns {boolean}
         */
        checkLanguage(text, targetLang) {
            if (!text) return false;
            const cleanText = text.replace(/<[^>]+>/g, '').trim();
            if (!cleanText) return false;

            if (targetLang === '中文' || targetLang === 'Chinese') {
                return /[\u4e00-\u9fa5]/.test(cleanText);
            }
            if (targetLang === 'English' || targetLang === '英文') {
                return /[a-zA-Z]/.test(cleanText);
            }
            return true;
        }

        /**
         * 将文本中的特殊标签替换为占位符
         * @param {string} text 
         * @returns {{text: string, placeholders: Array}}
         */
        replaceTagsWithPlaceholders(text) {
            if (!text) return { text: '', placeholders: [] };
            
            const placeholders = [];
            let newText = text;
            let idCounter = 0;

            // 1. 保护 HTML 标签 (如果存在)
            // 注意：PageManager 传递的是 textContent，通常没有 HTML 标签，
            // 但为了通用性（如 SelectionManager 选中文本可能包含标签字符串），我们进行保护
            newText = newText.replace(/<[^>]+>/g, (match) => {
                const id = idCounter++;
                const openToken = `[[nws-tag-${id}-open]]`;
                const closeToken = `[[nws-tag-${id}-close]]`; // 这里其实只需要一个 token 占位
                
                // 为了适配 restorePlaceholders 的逻辑 (它处理 open/close 对，也处理单个 token)
                // 我们这里把 match 当作 openTag，closeTag 为空
                placeholders.push({
                    openToken: openToken,
                    closeToken: closeToken, // 预留，虽然不用
                    openTag: match,
                    closeTag: ''
                });
                
                return openToken;
            });

            return { text: newText, placeholders };
        }
        
        /**
         * 还原被 LLM 破坏的占位符标签
         */
        restorePlaceholders(text, placeholders) {
            if (!text || !placeholders || placeholders.length === 0) return text;
            let output = text;
            for (const item of placeholders) {
                // 从 token 中提取 ID
                const idMatch = item.openToken.match(/nws-tag-(\d+)-open/);
                const id = idMatch ? idMatch[1] : null;

                if (id !== null) {
                    // 构建极度宽容的正则
                    const openRegex = new RegExp(`[\\[\\{]{2,3}\\s*nws-tag-${id}-open\\s*[\\]\\}]{2,3}`, 'gi');
                    const closeRegex = new RegExp(`[\\[\\{]{2,3}\\s*nws-tag-${id}-close\\s*[\\]\\}]{2,3}`, 'gi');
                    
                    output = output.replace(openRegex, () => item.openTag);
                    output = output.replace(closeRegex, () => item.closeTag);
                } else {
                    const openRegex = new RegExp(item.openToken.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g');
                    const closeRegex = new RegExp(item.closeToken.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g');
                    output = output.replace(openRegex, () => item.openTag);
                    output = output.replace(closeRegex, () => item.closeTag);
                }
            }
            
            output = output.replace(/[\\[\\{]{2,3}\s*nws-tag-\d+-(open|close)\s*[\\]\\}]{2,3}/gi, '');
            return output;
        }
    }

    if (!window.NWSModules) {
        window.NWSModules = {};
    }
    window.NWSModules.TranslationUtils = TranslationUtils;
})();