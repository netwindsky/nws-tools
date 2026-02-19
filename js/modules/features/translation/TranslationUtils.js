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
            console.log('[TranslationUtils] shouldTranslateText 输入:', text);
            if (!text) {
                console.log('[TranslationUtils] 文本为空');
                return false;
            }
            const normalized = this.normalizeText(text);
            console.log('[TranslationUtils] 规范化后:', normalized);
            
            // 检查最小长度
            const minLength = this.config?.minTextLength || 2;
            console.log('[TranslationUtils] 最小长度:', minLength, '实际长度:', normalized.length);
            if (normalized.length < minLength) {
                console.log('[TranslationUtils] 长度不足');
                return false;
            }

            // 过滤纯数字/符号
            // 使用 Unicode 属性转义来检测所有语言的字母（包括中文、日文、韩文、阿拉伯文、泰文、缅甸文等）
            try {
                // 检测是否包含任何字母字符（L = Letter，包括大写、小写、标题case）
                const hasLetters = /\p{L}/u.test(normalized);
                // 检测是否只有数字和标点符号
                const onlyDigitsAndPunctuation = /^[\d\s\p{P}\p{S}]+$/u.test(normalized);
                if (!hasLetters || onlyDigitsAndPunctuation) {
                    console.log('[TranslationUtils] 纯数字/符号');
                    return false;
                }
            } catch (e) {
                // 如果浏览器不支持 Unicode 属性转义，回退到基础检测
                const hasBasicLetters = /[a-zA-Z]/.test(normalized);
                const hasCJK = /[\u4e00-\u9fa5\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(normalized);
                if (!hasBasicLetters && !hasCJK) {
                    console.log('[TranslationUtils] 纯数字/符号（回退检测）');
                    return false;
                }
            }

            // 过滤 URL/链接
            const urlRegex = /^(?:https?:\/\/|ftp:\/\/|www\.)[^\s]+$|^(?:[\w-]+\.)+[a-z]{2,}(?:\/[^\s]*)?$/i;
            if (urlRegex.test(normalized)) {
                console.log('[TranslationUtils] 是URL');
                return false;
            }

            // 过滤邮箱
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
                console.log('[TranslationUtils] 是邮箱');
                return false;
            }

            // 检查目标语言是否为中文，避免重复翻译中文内容
            const lang = this.config?.targetLanguage || '中文';
            const isTargetChinese = /中文|Chinese/i.test(lang);
            console.log('[TranslationUtils] 目标语言:', lang, 'isTargetChinese:', isTargetChinese);
            if (isTargetChinese) {
                // 首先检查是否包含日文假名（平假名或片假名）
                // 平假名：\u3040-\u309F，片假名：\u30A0-\u30FF，全角片假名扩展：\u31F0-\u31FF
                const japaneseKana = (normalized.match(/[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF]/g) || []).length;
                console.log('[TranslationUtils] 日文假名数量:', japaneseKana);
                if (japaneseKana > 0) {
                    // 包含日文假名，需要翻译
                    console.log('[TranslationUtils] 包含日文假名，返回 true');
                    return true;
                }
                
                // 检查是否包含韩文
                // 韩文音节：\uAC00-\uD7AF，韩文字母：\u1100-\u11FF，韩文兼容字母：\u3130-\u318F
                const koreanChars = (normalized.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g) || []).length;
                console.log('[TranslationUtils] 韩文字符数量:', koreanChars);
                if (koreanChars > 0) {
                    // 包含韩文，需要翻译
                    console.log('[TranslationUtils] 包含韩文，返回 true');
                    return true;
                }
                
                // 纯汉字检查：只有当汉字比例很高且没有其他亚洲文字时才跳过
                const chineseChars = (normalized.match(/[\u4e00-\u9fa5]/g) || []).length;
                const chineseRatio = chineseChars / normalized.length;
                console.log('[TranslationUtils] 汉字数量:', chineseChars, '比例:', chineseRatio);
                if (chineseRatio > 0.7) {
                    console.log('[TranslationUtils] 汉字比例过高，返回 false');
                    return false;
                }
            }

            console.log('[TranslationUtils] 默认返回 true');
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
                try {
                    const safeSelector = sanitizeSelector(selector);
                    if (safeSelector && element.closest(safeSelector)) return true;
                } catch (e) {
                    // 忽略无效选择器错误
                }
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