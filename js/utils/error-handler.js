/**
 * 全局错误处理器
 * 用于捕获和处理各种运行时错误，特别是CSS选择器相关的错误
 */

/**
 * 初始化全局错误处理器
 */
function initErrorHandler() {
    // 捕获未处理的错误
    window.addEventListener('error', (event) => {
        const error = event.error;
        const message = event.message;
        
        // 检查是否是CSS选择器相关的错误
        if (message && (
            message.includes('querySelectorAll') ||
            message.includes('querySelector') ||
            message.includes('not a valid selector')
        )) {
            console.warn('[Error Handler] CSS选择器错误被捕获:', {
                message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
            
            // 阻止错误冒泡到控制台
            event.preventDefault();
            return false;
        }
        
        // 检查是否是ES6模块相关的错误
        if (message && (
            message.includes('Cannot use import statement outside a module') ||
            message.includes('Unexpected token \'export\'') ||
            message.includes('import statement outside a module')
        )) {
            console.warn('[Error Handler] ES6模块错误被捕获:', {
                message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
            
            // 阻止错误冒泡到控制台
            event.preventDefault();
            return false;
        }
        
        // 其他错误正常处理
        console.error('[Error Handler] 未处理的错误:', {
            message,
            error,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    });
    
    // 捕获Promise rejection
    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        
        if (reason && reason.message) {
            // 检查是否是CSS选择器相关的错误
            if (reason.message.includes('not a valid selector') ||
                reason.message.includes('querySelectorAll') ||
                reason.message.includes('querySelector')) {
                console.warn('[Error Handler] Promise中的CSS选择器错误被捕获:', reason);
                event.preventDefault();
                return;
            }
        }
        
        console.error('[Error Handler] 未处理的Promise rejection:', reason);
    });
    
    console.log('[Error Handler] 全局错误处理器已初始化');
}

/**
 * 安全执行函数，捕获可能的错误
 * @param {Function} fn - 要执行的函数
 * @param {*} defaultValue - 出错时的默认返回值
 * @param {string} context - 执行上下文描述
 * @returns {*} 函数执行结果或默认值
 */
function safeExecute(fn, defaultValue = null, context = 'unknown') {
    try {
        return fn();
    } catch (error) {
        console.warn(`[Error Handler] ${context} 执行失败:`, error);
        return defaultValue;
    }
}

/**
 * 安全的异步函数执行
 * @param {Function} fn - 要执行的异步函数
 * @param {*} defaultValue - 出错时的默认返回值
 * @param {string} context - 执行上下文描述
 * @returns {Promise} Promise对象
 */
async function safeExecuteAsync(fn, defaultValue = null, context = 'unknown') {
    try {
        return await fn();
    } catch (error) {
        console.warn(`[Error Handler] ${context} 异步执行失败:`, error);
        return defaultValue;
    }
}

/**
 * 创建错误边界包装器
 * @param {Function} fn - 要包装的函数
 * @param {string} context - 上下文描述
 * @returns {Function} 包装后的函数
 */
function createErrorBoundary(fn, context = 'unknown') {
    return function(...args) {
        try {
            return fn.apply(this, args);
        } catch (error) {
            console.warn(`[Error Handler] ${context} 错误边界捕获错误:`, error);
            return null;
        }
    };
}

// 注册到全局模块系统
if (window.NWSModules) {
    window.NWSModules.ErrorHandler = {
        initErrorHandler,
        safeExecute,
        safeExecuteAsync,
        createErrorBoundary
    };
}