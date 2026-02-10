/**
 * StyleManager.js - 样式管理器
 * 统一管理CSS样式的注入、更新和清理
 */

(function() {
    'use strict';

/**
 * 样式管理器
 * 统一管理CSS样式的注入、更新和清理
 */
class StyleManager {
    constructor() {
        this.styles = new Map(); // 存储样式元素
        this.injectedStyles = new Set(); // 已注入的样式ID
        this.styleData = new Map(); // 存储原始样式数据
        this.observers = new Set(); // 样式变化观察者
        
        // 全局样式缓存
        this.globalCache = new Map();
        
        //console.log('[StyleManager] 样式管理器初始化完成');
    }

    /**
     * 注入样式
     * @param {string} moduleName - 模块名称
     * @param {string} css - CSS内容
     * @param {string} id - 自定义样式ID（可选）
     * @param {Object} options - 选项
     * @returns {string} 样式ID
     */
    inject(moduleName, css, id = null, options = {}) {
        const {
            replace = false, // 是否替换现有样式
            cache = true, // 是否缓存
            priority = 'normal', // 优先级: high, normal, low
            media = 'all' // 媒体查询
        } = options;

        const styleId = id || `nws-style-${moduleName}`;
        
        // 检查是否已存在
        if (!replace && this.injectedStyles.has(styleId)) {
            console.warn(`[StyleManager] 样式 ${styleId} 已存在，跳过注入`);
            return styleId;
        }

        try {
            // 移除现有样式（如果存在）
            if (this.styles.has(styleId)) {
                this.remove(styleId);
            }

            // 创建样式元素
            const style = this.createStyleElement(styleId, css, moduleName, priority, media);
            
            // 按优先级插入
            this.insertStyleByPriority(style, priority);
            
            // 记录信息
            this.injectedStyles.add(styleId);
            this.styles.set(styleId, style);
            
            if (cache) {
                this.styleData.set(styleId, {
                    moduleName,
                    css,
                    id,
                    options,
                    injectedAt: Date.now()
                });
            }

            //console.log(`[StyleManager] 样式 ${styleId} 注入成功`);
            
            // 通知观察者
            this.notifyObservers({
                type: 'inject',
                styleId,
                moduleName,
                css,
                options
            });
            
            return styleId;
        } catch (error) {
            console.error(`[StyleManager] 样式 ${styleId} 注入失败:`, error);
            throw error;
        }
    }

    /**
     * 创建样式元素
     * @param {string} id - 样式ID
     * @param {string} css - CSS内容
     * @param {string} moduleName - 模块名称
     * @param {string} priority - 优先级
     * @param {string} media - 媒体查询
     * @returns {HTMLStyleElement} 样式元素
     */
    createStyleElement(id, css, moduleName, priority, media) {
        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        style.setAttribute('data-module', moduleName);
        style.setAttribute('data-priority', priority);
        style.setAttribute('data-injected-at', Date.now().toString());
        
        if (media !== 'all') {
            style.setAttribute('media', media);
        }

        // 添加样式属性用于调试
        style.setAttribute('title', `${moduleName} Styles`);
        style.classList.add('nws-style');

        return style;
    }

    /**
     * 按优先级插入样式
     * @param {HTMLStyleElement} style - 样式元素
     * @param {string} priority - 优先级
     */
    insertStyleByPriority(style, priority) {
        const existingStyles = document.head.querySelectorAll('style.nws-style');
        
        if (existingStyles.length === 0) {
            document.head.appendChild(style);
            return;
        }

        // 按优先级查找插入位置
        let insertAfter = null;
        
        for (const existingStyle of existingStyles) {
            const existingPriority = existingStyle.getAttribute('data-priority') || 'normal';
            
            if (this.comparePriority(priority, existingPriority) > 0) {
                insertAfter = existingStyle;
            }
        }

        if (insertAfter) {
            insertAfter.parentNode.insertBefore(style, insertAfter.nextSibling);
        } else {
            document.head.insertBefore(style, existingStyles[0]);
        }
    }

    /**
     * 比较优先级
     * @param {string} priority1 - 优先级1
     * @param {string} priority2 - 优先级2
     * @returns {number} 比较结果
     */
    comparePriority(priority1, priority2) {
        const priorityOrder = { 'high': 2, 'normal': 1, 'low': 0 };
        return priorityOrder[priority1] - priorityOrder[priority2];
    }

    /**
     * 更新样式
     * @param {string} styleId - 样式ID
     * @param {string} css - 新的CSS内容
     * @returns {boolean} 是否更新成功
     */
    update(styleId, css) {
        const style = this.styles.get(styleId);
        
        if (!style) {
            console.warn(`[StyleManager] 样式 ${styleId} 不存在，无法更新`);
            return false;
        }

        try {
            style.textContent = css;
            
            // 更新缓存数据
            if (this.styleData.has(styleId)) {
                const data = this.styleData.get(styleId);
                data.css = css;
                data.updatedAt = Date.now();
            }

            //console.log(`[StyleManager] 样式 ${styleId} 更新成功`);
            
            // 通知观察者
            this.notifyObservers({
                type: 'update',
                styleId,
                css
            });
            
            return true;
        } catch (error) {
            console.error(`[StyleManager] 样式 ${styleId} 更新失败:`, error);
            return false;
        }
    }

    /**
     * 移除样式
     * @param {string} styleId - 样式ID
     * @returns {boolean} 是否移除成功
     */
    remove(styleId) {
        const style = this.styles.get(styleId);
        
        if (style && style.parentNode) {
            style.parentNode.removeChild(style);
        }
        
        this.styles.delete(styleId);
        this.injectedStyles.delete(styleId);
        this.styleData.delete(styleId);

        //console.log(`[StyleManager] 样式 ${styleId} 移除成功`);
        
        // 通知观察者
        this.notifyObservers({
            type: 'remove',
            styleId
        });
        
        return true;
    }

    /**
     * 移除模块的所有样式
     * @param {string} moduleName - 模块名称
     * @returns {number} 移除的样式数量
     */
    removeModuleStyles(moduleName) {
        const moduleStyles = Array.from(this.styles.values())
            .filter(style => style.getAttribute('data-module') === moduleName);
        
        const removedCount = moduleStyles.length;
        
        moduleStyles.forEach(style => {
            const styleId = style.id;
            this.remove(styleId);
        });
        
        //console.log(`[StyleManager] 模块 ${moduleName} 的 ${removedCount} 个样式已移除`);
        return removedCount;
    }

    /**
     * 检查样式是否已注入
     * @param {string} styleId - 样式ID
     * @returns {boolean} 是否已注入
     */
    has(styleId) {
        return this.injectedStyles.has(styleId);
    }

    /**
     * 获取样式元素
     * @param {string} styleId - 样式ID
     * @returns {HTMLStyleElement|null} 样式元素
     */
    get(styleId) {
        return this.styles.get(styleId) || null;
    }

    /**
     * 获取样式的CSS内容
     * @param {string} styleId - 样式ID
     * @returns {string|null} CSS内容
     */
    getCSS(styleId) {
        const style = this.get(styleId);
        return style ? style.textContent : null;
    }

    /**
     * 获取模块的所有样式
     * @param {string} moduleName - 模块名称
     * @returns {Array} 样式元素数组
     */
    getModuleStyles(moduleName) {
        return Array.from(this.styles.values())
            .filter(style => style.getAttribute('data-module') === moduleName);
    }

    /**
     * 获取所有已注入的样式
     * @returns {Array} 样式元素数组
     */
    getAll() {
        return Array.from(this.styles.values());
    }

    /**
     * 获取所有样式ID
     * @returns {Array} 样式ID数组
     */
    getAllIds() {
        return Array.from(this.injectedStyles);
    }

    /**
     * 清理所有样式
     * @returns {number} 清理的样式数量
     */
    clear() {
        const count = this.styles.size;
        
        this.styles.forEach(style => {
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        });
        
        this.styles.clear();
        this.injectedStyles.clear();
        this.styleData.clear();
        
        //console.log(`[StyleManager] 所有样式已清理，共 ${count} 个`);
        
        // 通知观察者
        this.notifyObservers({
            type: 'clear',
            count
        });
        
        return count;
    }

    /**
     * 添加样式变化观察者
     * @param {Function} observer - 观察者函数
     * @returns {Function} 取消观察的函数
     */
    addObserver(observer) {
        if (typeof observer !== 'function') {
            throw new Error('观察者必须是函数');
        }
        this.observers.add(observer);
        
        return () => {
            this.observers.delete(observer);
        };
    }

    /**
     * 移除样式变化观察者
     * @param {Function} observer - 观察者函数
     * @returns {StyleManager} 返回自身以支持链式调用
     */
    removeObserver(observer) {
        this.observers.delete(observer);
        return this;
    }

    /**
     * 通知所有观察者
     * @param {Object} event - 事件对象
     */
    notifyObservers(event) {
        for (const observer of this.observers) {
            try {
                observer(event);
            } catch (error) {
                console.error('[StyleManager] 观察者执行失败:', error);
            }
        }
    }

    /**
     * 启用/禁用样式
     * @param {string} styleId - 样式ID
     * @param {boolean} enabled - 是否启用
     * @returns {boolean} 是否操作成功
     */
    toggle(styleId, enabled) {
        const style = this.get(styleId);
        
        if (!style) {
            console.warn(`[StyleManager] 样式 ${styleId} 不存在`);
            return false;
        }

        style.disabled = !enabled;
        
        //console.log(`[StyleManager] 样式 ${styleId} 已${enabled ? '启用' : '禁用'}`);
        
        // 通知观察者
        this.notifyObservers({
            type: 'toggle',
            styleId,
            enabled
        });
        
        return true;
    }

    /**
     * 获取样式统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        const moduleStats = {};
        
        for (const [styleId, style] of this.styles) {
            const moduleName = style.getAttribute('data-module');
            if (!moduleStats[moduleName]) {
                moduleStats[moduleName] = {
                    count: 0,
                    totalSize: 0,
                    styles: []
                };
            }
            
            const cssSize = style.textContent.length;
            moduleStats[moduleName].count++;
            moduleStats[moduleName].totalSize += cssSize;
            moduleStats[moduleName].styles.push({
                id: styleId,
                size: cssSize,
                priority: style.getAttribute('data-priority')
            });
        }

        return {
            totalStyles: this.styles.size,
            totalSize: Array.from(this.styles.values())
                .reduce((sum, style) => sum + style.textContent.length, 0),
            moduleStats
        };
    }

    /**
     * 导出所有样式
     * @returns {Object} 导出的样式数据
     */
    export() {
        const exported = {};
        
        for (const [styleId, data] of this.styleData) {
            exported[styleId] = {
                ...data,
                css: data.css
            };
        }
        
        return exported;
    }

    /**
     * 导入样式数据
     * @param {Object} styleData - 样式数据
     * @param {Object} options - 导入选项
     * @returns {number} 导入的样式数量
     */
    import(styleData, options = {}) {
        const { replace = false } = options;
        let count = 0;
        
        for (const [styleId, data] of Object.entries(styleData)) {
            try {
                this.inject(
                    data.moduleName,
                    data.css,
                    data.id,
                    { ...data.options, replace }
                );
                count++;
            } catch (error) {
                console.error(`[StyleManager] 导入样式 ${styleId} 失败:`, error);
            }
        }
        
        //console.log(`[StyleManager] 导入完成，共 ${count} 个样式`);
        return count;
    }

    /**
     * 销毁样式管理器
     */
    destroy() {
        this.clear();
        this.observers.clear();
        this.globalCache.clear();
        
        //console.log('[StyleManager] 样式管理器已销毁');
    }

    /**
     * 获取样式管理器单例
     * @returns {StyleManager} 样式管理器实例
     */
    static getInstance() {
        if (!window.styleManager) {
            window.styleManager = new StyleManager();
        }
        return window.styleManager;
    }
}

// 创建全局单例
const styleManager = new StyleManager();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StyleManager;
} else {
    window.StyleManager = StyleManager;
    window.styleManager = styleManager;
}

})();