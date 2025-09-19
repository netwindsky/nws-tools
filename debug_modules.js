/**
 * debug_modules.js - 模块调试脚本
 * 用于测试ES6模块导入错误修复后的功能
 */

// 等待模块加载完成
setTimeout(() => {
    console.log('=== NWS Tools 模块调试信息 ===');
    
    // 检查全局模块系统
    if (window.NWSModules) {
        console.log('✅ 全局模块系统已加载');
        console.log('📦 已注册的模块:', Object.keys(window.NWSModules.get ? {} : {}));
        
        // 检查各个模块
        const moduleManager = window.NWSModules.get('ModuleManager');
        const errorHandler = window.NWSModules.get('ErrorHandler');
        
        if (moduleManager) {
            console.log('✅ ModuleManager 已加载');
            console.log('📊 模块状态:', moduleManager.getModulesStatus());
        } else {
            console.log('❌ ModuleManager 未找到');
        }
        
        if (errorHandler) {
            console.log('✅ ErrorHandler 已加载');
        } else {
            console.log('❌ ErrorHandler 未找到');
        }
        
        // 检查工具函数
        if (window.NWSModules.utils) {
            console.log('✅ 工具函数已加载');
            console.log('🔧 可用工具:', Object.keys(window.NWSModules.utils));
        } else {
            console.log('❌ 工具函数未找到');
        }
        
    } else {
        console.log('❌ 全局模块系统未初始化');
    }
    
    // 检查页面元素
    const images = document.querySelectorAll('img');
    console.log(`🖼️ 页面图片数量: ${images.length}`);
    
    // 检查是否有语法错误
    console.log('🔍 检查控制台是否还有"Cannot use import statement outside a module"错误');
    
    console.log('=== 调试信息结束 ===');
}, 2000);