/**
 * modules-loader.js - 模块加载系统
 * 为Chrome扩展content scripts提供类似ES6模块的功能
 * 解决"Cannot use import statement outside a module"错误
 */

let exportVars, importVarsFrom;
{
  const modules = {};
  exportVars = varsObj => ({
    from(nameSpace) {
      modules[nameSpace] || (modules[nameSpace] = {});
      for (let [k,v] of Object.entries(varsObj)) {
        modules[nameSpace][k] = v;
      }
    }
  });
  importVarsFrom = nameSpace => modules[nameSpace] || {};
}

// 全局模块注册器
window.NWSModules = {
  register: (name, moduleFactory) => {
    exportVars({ [name]: moduleFactory }).from('nws-modules');
  },
  get: (name) => {
    const modules = importVarsFrom('nws-modules');
    return modules ? modules[name] : undefined;
  },
  // 工具函数
  utils: {
    safeQuerySelector: (selector, context = document) => {
      try {
        return context.querySelector(selector);
      } catch (error) {
        console.warn('Invalid selector:', selector, error);
        return null;
      }
    },
    safeQuerySelectorAll: (selector, context = document) => {
      try {
        return context.querySelectorAll(selector);
      } catch (error) {
        console.warn('Invalid selector:', selector, error);
        return [];
      }
    }
  }
};

console.log('NWS模块加载系统已初始化');