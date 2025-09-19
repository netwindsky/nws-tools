/**
 * ModuleManager.js - 模块管理器
 * 负责模块的注册、加载、启用/禁用和生命周期管理
 */

class ModuleManager {
    constructor() {
        this.modules = new Map();
        this.loadOrder = [];
        this.initialized = false;
        
        // 全局模块注册表
        if (!window.NWSModules) {
            window.NWSModules = {};
        }
    }

    /**
     * 注册模块
     * @param {string} name 模块名称
     * @param {ModuleBase} moduleClass 模块类
     * @param {Object} options 模块选项
     */
    register(name, moduleClass, options = {}) {
        if (this.modules.has(name)) {
            console.warn(`[ModuleManager] 模块 ${name} 已存在，将被覆盖`);
        }

        const moduleInstance = new moduleClass(name, options);
        this.modules.set(name, moduleInstance);
        window.NWSModules[name] = moduleInstance;
        
        console.log(`[ModuleManager] 模块 ${name} 注册成功`);
        return moduleInstance;
    }

    /**
     * 获取模块
     * @param {string} name 模块名称
     * @returns {ModuleBase|null}
     */
    getModule(name) {
        return this.modules.get(name) || null;
    }

    /**
     * 获取所有模块
     * @returns {Map}
     */
    getAllModules() {
        return new Map(this.modules);
    }

    /**
     * 初始化所有模块
     */
    async initializeAll() {
        if (this.initialized) {
            console.warn('[ModuleManager] 模块管理器已初始化');
            return;
        }

        console.log('[ModuleManager] 开始初始化所有模块');
        
        // 计算加载顺序（基于依赖关系）
        this.calculateLoadOrder();
        
        // 按顺序初始化模块
        for (const moduleName of this.loadOrder) {
            const module = this.modules.get(moduleName);
            if (module && module.enabled) {
                try {
                    await module.initialize();
                } catch (error) {
                    console.error(`[ModuleManager] 模块 ${moduleName} 初始化失败:`, error);
                }
            }
        }
        
        this.initialized = true;
        console.log('[ModuleManager] 所有模块初始化完成');
    }

    /**
     * 销毁所有模块
     */
    async destroyAll() {
        console.log('[ModuleManager] 开始销毁所有模块');
        
        // 按相反顺序销毁模块
        const reverseOrder = [...this.loadOrder].reverse();
        
        for (const moduleName of reverseOrder) {
            const module = this.modules.get(moduleName);
            if (module && module.initialized) {
                try {
                    await module.destroy();
                } catch (error) {
                    console.error(`[ModuleManager] 模块 ${moduleName} 销毁失败:`, error);
                }
            }
        }
        
        this.initialized = false;
        console.log('[ModuleManager] 所有模块销毁完成');
    }

    /**
     * 启用模块
     * @param {string} name 模块名称
     */
    async enableModule(name) {
        const module = this.modules.get(name);
        if (!module) {
            console.error(`[ModuleManager] 模块 ${name} 不存在`);
            return false;
        }

        try {
            if (!module.initialized) {
                await module.initialize();
            }
            await module.enable();
            console.log(`[ModuleManager] 模块 ${name} 启用成功`);
            return true;
        } catch (error) {
            console.error(`[ModuleManager] 模块 ${name} 启用失败:`, error);
            return false;
        }
    }

    /**
     * 禁用模块
     * @param {string} name 模块名称
     */
    async disableModule(name) {
        const module = this.modules.get(name);
        if (!module) {
            console.error(`[ModuleManager] 模块 ${name} 不存在`);
            return false;
        }

        try {
            await module.disable();
            console.log(`[ModuleManager] 模块 ${name} 禁用成功`);
            return true;
        } catch (error) {
            console.error(`[ModuleManager] 模块 ${name} 禁用失败:`, error);
            return false;
        }
    }

    /**
     * 重新加载模块
     * @param {string} name 模块名称
     */
    async reloadModule(name) {
        const module = this.modules.get(name);
        if (!module) {
            console.error(`[ModuleManager] 模块 ${name} 不存在`);
            return false;
        }

        try {
            if (module.initialized) {
                await module.destroy();
            }
            await module.initialize();
            console.log(`[ModuleManager] 模块 ${name} 重新加载成功`);
            return true;
        } catch (error) {
            console.error(`[ModuleManager] 模块 ${name} 重新加载失败:`, error);
            return false;
        }
    }

    /**
     * 计算模块加载顺序（拓扑排序）
     */
    calculateLoadOrder() {
        const visited = new Set();
        const visiting = new Set();
        const order = [];

        const visit = (moduleName) => {
            if (visiting.has(moduleName)) {
                throw new Error(`检测到循环依赖: ${moduleName}`);
            }
            
            if (visited.has(moduleName)) {
                return;
            }

            visiting.add(moduleName);
            
            const module = this.modules.get(moduleName);
            if (module && module.dependencies) {
                for (const dep of module.dependencies) {
                    if (this.modules.has(dep)) {
                        visit(dep);
                    }
                }
            }
            
            visiting.delete(moduleName);
            visited.add(moduleName);
            order.push(moduleName);
        };

        for (const moduleName of this.modules.keys()) {
            if (!visited.has(moduleName)) {
                visit(moduleName);
            }
        }

        this.loadOrder = order;
        console.log('[ModuleManager] 模块加载顺序:', order);
    }

    /**
     * 获取模块状态信息
     */
    getModulesStatus() {
        const status = {};
        for (const [name, module] of this.modules) {
            status[name] = module.getInfo();
        }
        return status;
    }

    /**
     * 监听Chrome存储变化，自动启用/禁用模块
     */
    setupStorageListener() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.onChanged.addListener(async (changes, namespace) => {
                if (namespace === 'sync') {
                    for (const [key, change] of Object.entries(changes)) {
                        const module = this.modules.get(key);
                        if (module && change.newValue && typeof change.newValue === 'object') {
                            // 更新模块配置
                            module.config = { ...module.config, ...change.newValue };
                            module.emit('configChanged', module.config);
                            
                            // 如果启用状态发生变化
                            if (change.newValue.enabled !== undefined) {
                                if (change.newValue.enabled && !module.enabled) {
                                    await this.enableModule(key);
                                } else if (!change.newValue.enabled && module.enabled) {
                                    await this.disableModule(key);
                                }
                            }
                        }
                    }
                }
            });
        }
    }
}

// 创建全局模块管理器实例
const moduleManager = new ModuleManager();

// 注册到全局模块系统
if (window.NWSModules) {
    window.NWSModules.ModuleManager = moduleManager;
}