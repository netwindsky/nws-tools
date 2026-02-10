# NWS Tools 快速开始指南

## 简介

NWS Tools 是一个模块化的Chrome扩展开发框架，提供了统一的模块接口和丰富的功能模块。本指南将帮助您快速上手使用。

## 快速开始

### 1. 基本使用

扩展加载后，所有模块会自动初始化并可通过全局对象访问：

```javascript
// 等待应用初始化完成
document.addEventListener('nws:initialized', () => {
    //console.log('NWS Tools 已准备就绪');
    
    // 访问模块
    const notification = window.NWSModules.NotificationModule;
    const imageDownloader = window.NWSModules.ImageDownloaderModule;
    const highlighter = window.NWSModules.ElementHighlighterModule;
    
    // 使用通知模块
    notification.success('欢迎使用 NWS Tools！');
});
```

### 2. 常用功能示例

#### 显示通知

```javascript
const notification = window.NWSModules.NotificationModule;

// 成功通知
notification.success('操作成功！');

// 错误通知
notification.error('操作失败，请重试');

// 自定义通知
notification.show('自定义消息', 'info', {
    duration: 3000,
    position: 'top-right'
});
```

#### 图片下载

```javascript
const imageDownloader = window.NWSModules.ImageDownloaderModule;

// 为页面所有图片添加下载按钮
imageDownloader.processImages();

// 下载特定图片
const img = document.querySelector('img');
await imageDownloader.downloadImage(img);

// 批量下载
imageDownloader.selectAllImages();
const selected = imageDownloader.getSelectedImages();
await imageDownloader.downloadMultipleImages(selected);
```

#### 元素高亮

```javascript
const highlighter = window.NWSModules.ElementHighlighterModule;

// 启用高亮功能（默认已启用）
await highlighter.enable();

// 监听高亮事件
highlighter.on('elementHighlighted', (data) => {
    //console.log('当前高亮元素:', data.element);
});

// 复制选择器
await highlighter.copySelector();

// 保存为Markdown
await highlighter.saveAsMD();
```

#### Chrome API操作

```javascript
const chromeSettings = window.NWSModules.ChromeSettingsModule;

// 存储数据
await chromeSettings.setStorage({
    userSettings: { theme: 'dark' }
});

// 读取数据
const data = await chromeSettings.getStorage(['userSettings']);

// 下载文件
await chromeSettings.downloadFile({
    url: 'https://example.com/file.pdf',
    filename: 'document.pdf'
});
```

## 开发自定义模块

### 1. 创建模块类

```javascript
import ModuleBase from './modules/core/ModuleBase.js';

class MyCustomModule extends ModuleBase {
    constructor(name, options = {}) {
        super(name, {
            version: '1.0.0',
            dependencies: ['NotificationModule'], // 声明依赖
            defaultConfig: {
                enabled: true,
                customSetting: 'default'
            },
            ...options
        });
    }

    async onInitialize() {
        // 模块初始化逻辑
        //console.log(`${this.name} 初始化完成`);
        
        // 获取依赖模块
        this.notification = window.NWSModules.NotificationModule;
        
        // 设置事件监听
        this.setupEventListeners();
    }

    async onDestroy() {
        // 清理资源
        this.removeEventListeners();
        //console.log(`${this.name} 已销毁`);
    }

    async onEnable() {
        // 启用模块时的逻辑
        this.notification?.success(`${this.name} 已启用`);
    }

    async onDisable() {
        // 禁用模块时的逻辑
        this.notification?.info(`${this.name} 已禁用`);
    }

    // 自定义方法
    doSomething() {
        //console.log('执行自定义功能');
        this.emit('customAction', { data: 'value' });
    }

    setupEventListeners() {
        // 设置事件监听器
    }

    removeEventListeners() {
        // 移除事件监听器
    }
}

export default MyCustomModule;
```

### 2. 注册模块

在 `main.js` 中注册您的自定义模块：

```javascript
import MyCustomModule from './modules/custom/MyCustomModule.js';

class NWSTools {
    async registerModules() {
        // 注册内置模块
        this.moduleManager.register('ChromeSettingsModule', ChromeSettingsModule);
        this.moduleManager.register('NotificationModule', NotificationModule);
        
        // 注册自定义模块
        this.moduleManager.register('MyCustomModule', MyCustomModule, {
            customSetting: 'customValue'
        });
    }
}
```

### 3. 使用自定义模块

```javascript
// 获取自定义模块
const myModule = window.NWSModules.MyCustomModule;

// 监听自定义事件
myModule.on('customAction', (data) => {
    //console.log('自定义事件触发:', data);
});

// 调用自定义方法
myModule.doSomething();

// 更新配置
myModule.updateConfig({
    customSetting: 'newValue'
});
```

## 配置管理

### 1. 模块配置

每个模块都有自己的配置，可以通过以下方式管理：

```javascript
const module = window.NWSModules.SomeModule;

// 获取当前配置
const config = module.getConfig();
//console.log(config);

// 更新配置
module.updateConfig({
    enabled: false,
    customOption: 'newValue'
});

// 监听配置变化
module.on('configUpdated', (newConfig) => {
    //console.log('配置已更新:', newConfig);
});
```

### 2. 全局配置

使用Chrome存储API管理全局配置：

```javascript
const chromeSettings = window.NWSModules.ChromeSettingsModule;

// 保存全局配置
await chromeSettings.setStorage({
    globalSettings: {
        theme: 'dark',
        language: 'zh-CN',
        autoSave: true
    }
});

// 读取全局配置
const { globalSettings } = await chromeSettings.getStorage(['globalSettings']);
```

## 事件系统

### 1. 模块事件

```javascript
const module = window.NWSModules.SomeModule;

// 监听事件
module.on('eventName', (data) => {
    //console.log('事件数据:', data);
});

// 一次性监听
module.once('eventName', (data) => {
    //console.log('只触发一次');
});

// 移除监听
const handler = (data) => //console.log(data);
module.on('eventName', handler);
module.off('eventName', handler);
```

### 2. 应用级事件

```javascript
// 监听应用事件
document.addEventListener('nws:initialized', () => {
    //console.log('应用初始化完成');
});

document.addEventListener('nws:moduleEnabled', (event) => {
    //console.log('模块已启用:', event.detail.moduleName);
});

// 触发自定义应用事件
const app = window.NWSTools;
app.dispatchEvent('customEvent', { data: 'value' });
```

## 错误处理

### 1. 模块错误

```javascript
const module = window.NWSModules.SomeModule;

// 监听模块错误
module.on('error', (error) => {
    console.error('模块错误:', error);
    // 处理错误，如显示通知
    window.NWSModules.NotificationModule?.error('模块发生错误');
});

// 在模块方法中处理错误
try {
    await module.someAsyncMethod();
} catch (error) {
    console.error('方法执行失败:', error);
}
```

### 2. 全局错误处理

```javascript
// 监听未捕获的错误
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
});

// 监听Promise拒绝
window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
});
```

## 调试技巧

### 1. 开发者工具

```javascript
// 在控制台中访问模块
//console.log(window.NWSModules);
//console.log(window.NWSTools);

// 查看模块状态
const app = window.NWSTools;
//console.log(app.getModulesStatus());

// 手动控制模块
await app.enableModule('SomeModule');
await app.disableModule('SomeModule');
await app.reloadModule('SomeModule');
```

### 2. 日志记录

```javascript
// 在模块中添加日志
class MyModule extends ModuleBase {
    log(message, level = 'info') {
        //console.log(`[${this.name}] ${message}`);
    }

    async onInitialize() {
        this.log('模块初始化开始');
        // 初始化逻辑
        this.log('模块初始化完成');
    }
}
```

### 3. 性能监控

```javascript
// 监控模块性能
const module = window.NWSModules.SomeModule;

console.time('模块操作');
await module.someOperation();
console.timeEnd('模块操作');

// 监控内存使用
//console.log('内存使用:', performance.memory);
```

## 常见问题

### Q: 如何确保模块按正确顺序初始化？

A: 在模块构造函数中声明依赖关系，ModuleManager会自动解析依赖顺序：

```javascript
class MyModule extends ModuleBase {
    constructor(name, options = {}) {
        super(name, {
            dependencies: ['ChromeSettingsModule', 'NotificationModule'],
            ...options
        });
    }
}
```

### Q: 如何在模块间传递数据？

A: 使用事件系统进行模块间通信：

```javascript
// 模块A触发事件
moduleA.emit('dataReady', { data: 'value' });

// 模块B监听事件
moduleB.on('dataReady', (eventData) => {
    //console.log('收到数据:', eventData.data);
});
```

### Q: 如何处理模块加载失败？

A: 使用try-catch包装模块操作，并提供降级处理：

```javascript
try {
    await app.enableModule('SomeModule');
} catch (error) {
    console.error('模块加载失败:', error);
    // 降级处理
    window.NWSModules.NotificationModule?.error('功能暂时不可用');
}
```

### Q: 如何优化性能？

A: 
- 延迟加载非关键模块
- 使用事件委托减少监听器数量
- 及时清理不需要的资源
- 避免频繁的DOM操作

```javascript
// 延迟加载示例
class MyModule extends ModuleBase {
    async onEnable() {
        // 只在需要时加载重型资源
        if (!this.heavyResource) {
            this.heavyResource = await this.loadHeavyResource();
        }
    }
}
```

## 下一步

- 查看 [API文档](./API_Documentation.md) 了解详细的接口说明
- 参考现有模块的实现代码
- 根据需求开发自定义模块
- 参与项目贡献和反馈

## 支持

如有问题，请查看：
- [API文档](./API_Documentation.md)
- [GitHub Issues](https://github.com/your-repo/issues)
- [开发者社区](https://community.example.com)