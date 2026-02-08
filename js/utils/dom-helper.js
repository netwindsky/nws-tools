/**
 * DOM操作辅助工具
 * 提供安全的DOM查询方法，避免无效CSS选择器导致的错误
 */

/**
 * 安全的querySelector包装函数
 * @param {string} selector - CSS选择器
 * @param {Element|Document} context - 查询上下文，默认为document
 * @returns {Element|null} 匹配的元素或null
 */
function safeQuerySelector(selector, context = document) {
    try {
        // 检查选择器是否包含可能导致错误的字符
        if (typeof selector !== 'string' || !selector.trim()) {
            console.warn('[DOM Helper] 无效的选择器:', selector);
            return null;
        }
        
        // 尝试执行查询
        return context.querySelector(selector);
    } catch (error) {
        console.warn('[DOM Helper] querySelector失败:', {
            selector,
            error: error.message
        });
        return null;
    }
}

/**
 * 安全的querySelectorAll包装函数
 * @param {string} selector - CSS选择器
 * @param {Element|Document} context - 查询上下文，默认为document
 * @returns {NodeList|Array} 匹配的元素列表
 */
function safeQuerySelectorAll(selector, context = document) {
    try {
        // 检查选择器是否包含可能导致错误的字符
        if (typeof selector !== 'string' || !selector.trim()) {
            console.warn('[DOM Helper] 无效的选择器:', selector);
            return [];
        }
        
        // 尝试执行查询
        return context.querySelectorAll(selector);
    } catch (error) {
        console.warn('[DOM Helper] querySelectorAll失败:', {
            selector,
            error: error.message
        });
        return [];
    }
}

/**
 * 清理CSS选择器，移除可能导致错误的字符
 * @param {string} selector - 原始选择器
 * @returns {string} 清理后的选择器
 */
function sanitizeSelector(selector) {
    if (typeof selector !== 'string') {
        return '';
    }
    
    // 移除或转义可能导致问题的字符
    return selector
        // 移除感叹号（CSS中不应该出现）
        .replace(/!/g, '')
        // 处理方括号属性选择器中的引号嵌套问题 (例如 [style="...\"Segoe UI\"..."])
        .replace(/\[([^\]]+)\]/g, (match, p1) => {
            if (p1.includes('="') || p1.includes("='")) {
                const parts = p1.split(/=(['"])/);
                if (parts.length >= 3) {
                    const attr = parts[0];
                    const quote = parts[1];
                    let value = parts.slice(2).join('=');
                    // 移除末尾匹配的引号
                    if (value.endsWith(quote)) {
                        value = value.slice(0, -1);
                    }
                    // 移除内部所有同类型的引号，避免语法错误
                    const cleanedValue = value.replace(new RegExp(quote, 'g'), '');
                    return `[${attr}=${quote}${cleanedValue}${quote}]`;
                }
            }
            return match;
        })
        // 移除连续的点号
        .replace(/\.{2,}/g, '.')
        // 确保选择器不以特殊字符开头
        .replace(/^[^a-zA-Z#.\[:]/, '');
}

/**
 * 检查选择器是否有效
 * @param {string} selector - CSS选择器
 * @returns {boolean} 是否有效
 */
function isValidSelector(selector) {
    try {
        document.querySelector(selector);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * 获取元素的安全选择器
 * @param {Element} element - DOM元素
 * @returns {string} 安全的选择器字符串
 */
function getSafeSelector(element) {
    if (!element || !element.tagName) {
        return '';
    }
    
    const tagName = element.tagName.toLowerCase();
    
    // 优先使用ID
    if (element.id && /^[a-zA-Z][\w-]*$/.test(element.id)) {
        return `#${element.id}`;
    }
    
    // 使用类名（过滤掉包含特殊字符的类名）
    if (element.className) {
        const validClasses = element.className
            .split(/\s+/)
            .filter(cls => /^[a-zA-Z][\w-]*$/.test(cls))
            .slice(0, 3); // 最多使用3个类名
        
        if (validClasses.length > 0) {
            return `${tagName}.${validClasses.join('.')}`;
        }
    }
    
    // 使用标签名和位置
    const parent = element.parentElement;
    if (parent) {
        const siblings = Array.from(parent.children).filter(el => el.tagName === element.tagName);
        const index = siblings.indexOf(element);
        if (siblings.length > 1) {
            return `${tagName}:nth-of-type(${index + 1})`;
        }
    }
    
    return tagName;
}

// 注册工具函数到全局模块系统
if (window.NWSModules) {
    window.NWSModules.utils = {
        safeQuerySelector,
        safeQuerySelectorAll,
        sanitizeSelector,
        isValidSelector,
        getSafeSelector,
        safeAddEventListener: function(element, event, handler, options) {
            if (element && typeof element.addEventListener === 'function') {
                element.addEventListener(event, handler, options);
            }
        },
        safeRemoveEventListener: function(element, event, handler, options) {
            if (element && typeof element.removeEventListener === 'function') {
                element.removeEventListener(event, handler, options);
            }
        }
    };
}

// 也将工具函数直接暴露到全局作用域
window.DOMHelper = {
    safeQuerySelector,
    safeQuerySelectorAll,
    sanitizeSelector,
    isValidSelector,
    getSafeSelector
};