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
            if (!text) return '';
            // 保留段落分隔符（换行），只合并行内多余空格
            return text
                .replace(/\r\n/g, '\n')
                .split('\n')
                .map(line => line.replace(/\s+/g, ' ').trim())
                .filter(line => line.length > 0)
                .join('\n');
        }

        /**
         * 判断文本是否应该被翻译（用于页面翻译）
         * 核心逻辑：
         * 1. 优先过滤技术内容（文件名、URL、邮箱、路径、代码等）
         * 2. 过滤无意义内容（符号、乱码等）
         * 3. 英文：只翻译完整句子/短语（2 个单词以上），不翻译单个单词
         * 4. 中文/日文/韩文：按字符数和意义判断
         * @param {string} text - 要检查的文本内容
         * @returns {boolean} 是否符合翻译条件
         */
        shouldTranslateText(text) {
            return this._shouldTranslateTextForPage(text);
        }

        /**
         * 页面翻译：使用严格的过滤规则
         * 过滤文件名、URL、邮箱、代码、无意义内容等
         * @param {string} text - 要检查的文本内容
         * @returns {boolean} 是否符合翻译条件
         */
        _shouldTranslateTextForPage(text) {
            console.log('[TranslationUtils] _shouldTranslateTextForPage 输入:', text);
            if (!text) {
                console.log('[TranslationUtils] 文本为空');
                return false;
            }
            const normalized = this.normalizeText(text);
            console.log('[TranslationUtils] 规范化后:', normalized);
            
            // === 第一步：优先过滤技术内容（最重要）===
            
            // 1. 过滤 URL/链接（包括带描述的 URL，如 "Free-Deompiler.com website"）
            if (this.isURLWithDescription(normalized)) {
                console.log('[TranslationUtils] 是 URL 或包含 URL');
                return false;
            }

            // 2. 过滤邮箱
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
                console.log('[TranslationUtils] 是邮箱');
                return false;
            }

            // 3. 过滤文件名（包括各种扩展名）
            if (this.isFileName(normalized)) {
                console.log('[TranslationUtils] 是文件名');
                return false;
            }

            // 4. 过滤路径
            if (this.isPath(normalized)) {
                console.log('[TranslationUtils] 是路径');
                return false;
            }

            // 5. 过滤代码标识符
            if (this.isCodeIdentifier(normalized)) {
                console.log('[TranslationUtils] 是代码标识符');
                return false;
            }

            // 6. 过滤命令
            if (this.isCommand(normalized)) {
                console.log('[TranslationUtils] 是命令');
                return false;
            }

            // === 第二步：过滤无意义内容 ===
            
            if (this.isMeaninglessContent(normalized)) {
                console.log('[TranslationUtils] 检测到无意义内容');
                return false;
            }

            // === 第三步：语言相关判断 ===

            // 检查是否包含英文单词
            const englishWords = normalized.match(/[a-zA-Z]+/g);
            
            // 如果是纯英文内容（没有中文/日文/韩文）
            const hasCJK = /[\u4e00-\u9fa5\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(normalized);
            if (!hasCJK && englishWords) {
                // 纯英文内容：检查单词数
                const wordCount = englishWords.length;
                console.log('[TranslationUtils] 纯英文内容，单词数:', wordCount);
                
                // 只翻译 2 个单词以上的短语或句子
                if (wordCount < 2) {
                    console.log('[TranslationUtils] 单个英文单词，不翻译');
                    return false;
                }
                
                // 2 个单词以上，需要翻译
                console.log('[TranslationUtils] 英文短语/句子，需要翻译');
                return true;
            }

            // 包含中文/日文/韩文的内容
            // 检查最小长度
            const minLength = this.config?.minTextLength || 2;
            console.log('[TranslationUtils] 最小长度:', minLength, '实际长度:', normalized.length);
            if (normalized.length < minLength) {
                console.log('[TranslationUtils] 长度不足');
                return false;
            }

            // 过滤纯数字/符号
            try {
                const hasLetters = /\p{L}/u.test(normalized);
                const onlyDigitsAndPunctuation = /^[\d\s\p{P}\p{S}]+$/u.test(normalized);
                if (!hasLetters || onlyDigitsAndPunctuation) {
                    console.log('[TranslationUtils] 纯数字/符号');
                    return false;
                }
            } catch (e) {
                const hasBasicLetters = /[a-zA-Z]/.test(normalized);
                if (!hasBasicLetters && !hasCJK) {
                    console.log('[TranslationUtils] 纯数字/符号（回退检测）');
                    return false;
                }
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
                
                // 统计各类字符数量
                const chineseChars = (normalized.match(/[\u4e00-\u9fa5]/g) || []).length;
                
                // 统计英文单词数（而不是字母数）
                // 匹配连续的英文字母作为一个单词
                const englishWords = (normalized.match(/[a-zA-Z]+/g) || []).length;
                
                const totalChars = normalized.length;
                
                console.log('[TranslationUtils] 汉字数量:', chineseChars, '英文单词数:', englishWords, '总长度:', totalChars);
                
                // 计算有效单位（汉字数 + 英文单词数），刨除符号和数字
                const validUnits = chineseChars + englishWords;
                
                // 如果主要是汉字（汉字占有效单位的比例超过 70%），则不翻译
                if (validUnits > 0) {
                    const chineseRatio = chineseChars / validUnits;
                    console.log('[TranslationUtils] 汉字占有效单位比例:', chineseRatio);
                    
                    if (chineseRatio > 0.7) {
                        console.log('[TranslationUtils] 主要是中文内容，不翻译，返回 false');
                        return false;
                    }
                }
            }

            console.log('[TranslationUtils] 默认返回 true');
            return true;
        }

        /**
         * 划词翻译：使用宽松的过滤规则
         * 尊重用户选择，只过滤明显的无意义内容
         * 不过滤文件名、URL、代码等（用户可能就想翻译这些）
         * @param {string} text - 要检查的文本内容
         * @returns {boolean} 是否符合翻译条件
         */
        shouldTranslateSelectedText(text) {
            console.log('[TranslationUtils] shouldTranslateSelectedText 输入:', text);
            if (!text) {
                console.log('[TranslationUtils] 文本为空');
                return false;
            }
            const normalized = this.normalizeText(text);
            console.log('[TranslationUtils] 规范化后:', normalized);
            
            // 只过滤明显的无意义内容
            if (this.isMeaninglessContent(normalized)) {
                console.log('[TranslationUtils] 检测到无意义内容');
                return false;
            }
            
            // 检查最小长度（划词翻译可以容忍更短的内容）
            const minLength = this.config?.minTextLength || 1;
            console.log('[TranslationUtils] 最小长度:', minLength, '实际长度:', normalized.length);
            if (normalized.length < minLength) {
                console.log('[TranslationUtils] 长度不足');
                return false;
            }
            
            // 划词翻译：尊重用户选择，只要不是无意义内容就翻译
            console.log('[TranslationUtils] 用户选择的内容，翻译');
            return true;
        }

        /**
         * 检测是否为无意义内容
         * 核心逻辑：基于字符类型和模式识别，而非简单的字符数
         * @param {string} text - 规范化后的文本
         * @returns {boolean} 是否为无意义内容
         */
        isMeaninglessContent(text) {
            if (!text || text.length < 2) return true;
            
            const len = text.length;
            
            // 1. 检测纯符号组合（如 "@#$%^&*", "!!!", "..."）
            // 这是最重要的过滤，直接拦截无意义符号
            const hasAnyLetterOrCJK = /[a-zA-Z\u4e00-\u9fa5\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(text);
            if (!hasAnyLetterOrCJK) {
                console.log('[TranslationUtils] 纯符号，无实际字母或表意文字');
                return true;
            }
            
            // 2. 【移除】错误的重复字符检测
            // 正常的英文/中文文本本来就会有字符重复，不应该过滤
            // 这个检测只针对 "aaaaaa" 这种恶意重复，在第 5 步处理
            
            // 3. 检测乱码特征（特殊字符超过 50%）
            const specialCharCount = (text.match(/[^a-zA-Z\u4e00-\u9fa5\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\s]/g) || []).length;
            if (specialCharCount / len > 0.5) {
                console.log('[TranslationUtils] 特殊字符过多');
                return true;
            }
            
            // 4. 检测无意义短语模式
            const meaninglessPatterns = [
                /^\.{3,}$/,                    // 连续省略号
                /^\*{3,}$/,                    // 连续星号
                /^-{3,}$/,                     // 连续横线
                /^_{3,}$/,                     // 连续下划线
                /^!{3,}$/,                     // 连续感叹号
                /^\?{3,}$/,                    // 连续问号
                /^(click|tap|touch)\s+(here|this)$/i,
                /^(read|see|view)\s+more$/i,
                /^(learn|find)\s+more$/i
            ];
            
            for (const pattern of meaninglessPatterns) {
                if (pattern.test(text)) {
                    console.log('[TranslationUtils] 匹配无意义模式:', pattern);
                    return true;
                }
            }
            
            // 5. 检测单一字符恶意重复（如 "aaaaaa", "啊啊啊啊啊"）
            // 只针对短文本（< 20 字符），长文本不适用此规则
            if (len < 20) {
                const charCount = {};
                for (const char of text.replace(/\s/g, '')) {
                    charCount[char] = (charCount[char] || 0) + 1;
                }
                const maxCharCount = Math.max(...Object.values(charCount));
                const totalNonSpaceChars = text.replace(/\s/g, '').length;
                // 如果某个字符重复超过 5 次，且占总字符的 80% 以上
                if (maxCharCount > 5 && maxCharCount / totalNonSpaceChars > 0.8) {
                    console.log('[TranslationUtils] 单一字符重复');
                    return true;
                }
            }
            
            return false;
        }

        /**
         * 检测是否为文件名
         * @param {string} text - 文本
         * @returns {boolean} 是否为文件名
         */
        isFileName(text) {
            // 1. 匹配带扩展名的文件名：README.md, build.xml, worldmonitor.app
            const fileNameRegex = /^[\w\-_.]+(\.[a-zA-Z]{2,})$/;
            
            // 2. 匹配没有扩展名但像文件的：Dockerfile, Makefile, CHANGELOG
            const noExtensionRegex = /^(Dockerfile|Makefile|LICENSE|README|CHANGELOG|CONTRIBUTING|TRANSLATIONS|build|pom|settings|gradle|webpack|vite|tsconfig|jsconfig|babel|eslint|prettier|stylelint)$/i;
            
            // 3. 匹配文件夹命名模式：nsis_locales, cicd_scripts (下划线 + 复数形式)
            const folderPatternRegex = /^[a-z]+_[a-z]+s$/i;
            
            return fileNameRegex.test(text) || 
                   noExtensionRegex.test(text) ||
                   folderPatternRegex.test(text);
        }

        /**
         * 检测是否为 URL（包括带描述的 URL）
         * @param {string} text - 文本
         * @returns {boolean} 是否为 URL 或包含 URL
         */
        isURLWithDescription(text) {
            // 1. 完整 URL：https://example.com, http://localhost:3000
            const fullURLRegex = /^https?:\/\/[^\s]+$/i;
            
            // 2. 简写 URL：www.example.com
            const wwwURLRegex = /^www\.[^\s]+$/i;
            
            // 3. 域名 + 常见后缀：Free-Deompiler.com website, example.com page
            // 只匹配短语（2-3 个单词），不匹配长句子
            const domainWithDescRegex = /^[\w\-]+\.[a-z]{2,}\s+(website|page|site|home|docs|api|app|blog|shop|store|cloud|portal|platform|service|system)$/i;
            
            // 4. 纯域名（带常见 TLD）- 只匹配纯域名，不匹配包含域名的句子
            const pureDomainRegex = /^[\w\-]+\.(com|org|net|io|cn|edu|gov|mil|info|biz|me|co|tv|cc|xyz|top|vip|app|dev|cloud|ai|tech)$/i;
            
            // 5. 检查是否只是简单提及域名（域名 + 少量描述，总单词数 <= 3）
            // 这样长句子即使包含域名也会被翻译
            const hasDomain = /[\w\-]+\.[a-z]{2,}/i.test(text);
            if (hasDomain) {
                const wordCount = text.split(/\s+/).length;
                // 如果单词数超过 3 个，说明是句子，应该翻译，不认为是 URL
                if (wordCount > 3) {
                    return false;
                }
            }
            
            return fullURLRegex.test(text) || 
                   wwwURLRegex.test(text) ||
                   domainWithDescRegex.test(text) ||
                   pureDomainRegex.test(text);
        }

        /**
         * 检测是否为代码标识符（驼峰命名、下划线命名等）
         * @param {string} text - 文本
         * @returns {boolean} 是否为代码标识符
         */
        isCodeIdentifier(text) {
            // 驼峰命名：shouldTranslateText, TranslationUtils, k2Fsa
            const camelCaseRegex = /^[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*$/;
            // 帕斯卡命名：TranslationUtils, PageManager, K2Fsa
            const pascalCaseRegex = /^[A-Z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*$/;
            // 下划线命名：is_meaningless_content, build_translation_messages, k2_fsa
            const snakeCaseRegex = /^[a-z0-9]+(_[a-z0-9]+)+$/i;
            // 短横线命名：translation-utils, page-manager, k2-fsa, sherpa-onnx
            const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)+$/i;
            // 常量命名：MAX_CHUNK_SIZE, API_ENDPOINT
            const constantCaseRegex = /^[A-Z]+(_[A-Z]+)+$/;
            
            // 全小写复合词（长度 > 10，可能是多个单词组合）：modelcontextprotocol, typescriptlanguage
            // 检测是否包含多个英文单词的拼接（通过大小写变化或长度判断）
            const longLowercaseRegex = /^[a-z]{10,}$/;
            
            return camelCaseRegex.test(text) || 
                   pascalCaseRegex.test(text) || 
                   snakeCaseRegex.test(text) || 
                   kebabCaseRegex.test(text) ||
                   constantCaseRegex.test(text) ||
                   longLowercaseRegex.test(text);
        }

        /**
         * 检测是否为路径
         * @param {string} text - 文本
         * @returns {boolean} 是否为路径
         */
        isPath(text) {
            // Unix 路径：/usr/bin, /home/user
            const unixPathRegex = /^\/[\w\-./]+$/;
            // Windows 路径：C:\Windows, D:\Program Files
            const windowsPathRegex = /^[A-Z]:\\[\\ \w\-.\-]+$/i;
            // 相对路径：./src, ../config
            const relativePathRegex = /^\.\.?\/[\w\-./]+$/;
            
            // 检测包含路径分隔符的组合：modelcontextprotocol / inspector
            // 这种格式常见于面包屑导航、层级显示
            const breadcrumbRegex = /^[\w\-./]+\s*\/\s*[\w\-./]+$/;
            
            return unixPathRegex.test(text) || 
                   windowsPathRegex.test(text) || 
                   relativePathRegex.test(text) ||
                   breadcrumbRegex.test(text);
        }

        /**
         * 检测是否为命令/终端指令
         * @param {string} text - 文本
         * @returns {boolean} 是否为命令
         */
        isCommand(text) {
            // 常见命令开头
            const commandPatterns = [
                /^npm\s+\w+/,           // npm install, npm run build
                /^yarn\s+\w+/,          // yarn add, yarn run
                /^pnpm\s+\w+/,          // pnpm install
                /^git\s+\w+/,           // git commit, git push
                /^docker\s+\w+/,        // docker run, docker build
                /^node\s+/,             // node app.js
                /^python[3]?\s+/,       // python script.py
                /^pip[3]?\s+\w+/,       // pip install
                /^cargo\s+\w+/,         // cargo build
                /^go\s+\w+/,            // go run
                /^make(\s+|$)/,         // make, make build
                /^webpack(\s+|$)/,      // webpack
                /^vite(\s+|$)/,         // vite
                /^eslint(\s+|$)/,       // eslint
                /^prettier(\s+|$)/,     // prettier
                /^ls(\s+|$)/,           // ls
                /^cd\s+/,               // cd /home
                /^mkdir\s+/,            // mkdir dir
                /^rm\s+/,               // rm -rf
                /^cp\s+/,               // cp file1 file2
                /^mv\s+/                // mv file1 file2
            ];
            
            return commandPatterns.some(pattern => pattern.test(text));
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