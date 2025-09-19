# NWS Tools 模块化API文档

## 概述

NWS Tools 采用模块化架构，将功能拆分为独立的模块，每个模块都有统一的接口规范。本文档详细介绍了各个模块的API接口和使用方法。

## 架构概览

```
NWS Tools
├── 核心模块 (Core)
│   ├── ModuleBase - 基础模块类
│   └── ModuleManager - 模块管理器
├── Chrome模块 (Chrome)
│   └── ChromeSettingsModule - Chrome API封装
└── 功能模块 (Features)
    ├── NotificationModule - 通知模块
    ├── ImageDownloaderModule - 图片下载模块
    └── ElementHighlighterModule - 元素高亮模块
```

## 核心模块

### ModuleBase

所有模块的基类，定义了统一的接口规范。

#### 接口说明

```javascript
class ModuleBase {
    constructor(name, options = {})
    
    // 生命周期方法
    async initialize()
    async destroy()
    async enable()
    async disable()
    
    // 配置管理
    updateConfig(newConfig)
    getConfig()
    
    // 事件系统
    on(event, handler)
    off(event, handler)
    emit(event, data)
}
```

#### 使用示例

```javascript
// 继承ModuleBase创建自定义模块
class MyModule extends ModuleBase {
    constructor(name, options = {}) {
        super(name, {
            version: '1.0.0',
            defaultConfig: {
                enabled: true,
                customOption: 'value'
            },
            ...options
        });
    }
    
    async onInitialize() {
        // 模块初始化逻辑
        console.log(`${this.name} 初始化完成`);
    }
    
    async onDestroy() {
        // 模块销毁逻辑
        console.log(`${this.name} 已销毁`);
    }
}
```

### ModuleManager

模块管理器，负责模块的注册、加载和生命周期管理。

#### 接口说明

```javascript
class ModuleManager {
    // 模块注册
    register(name, ModuleClass, options = {})
    
    // 模块获取
    getModule(name)
    getAllModules()
    
    // 生命周期管理
    async initializeAll()
    async destroyAll()
    
    // 依赖管理
    resolveDependencies()
}
```

#### 使用示例

```javascript
// 创建模块管理器
const manager = new ModuleManager();

// 注册模块
manager.register('MyModule', MyModule, {
    customOption: 'value'
});

// 初始化所有模块
await manager.initializeAll();

// 获取模块实例
const myModule = manager.getModule('MyModule');
```

## Chrome模块

### ChromeSettingsModule

封装Chrome API相关功能，提供统一的接口。

#### 接口说明

```javascript
class ChromeSettingsModule extends ModuleBase {
    // 存储API
    async getStorage(keys)
    async setStorage(data)
    async removeStorage(keys)
    
    // 权限API
    async requestPermissions(permissions)
    async checkPermissions(permissions)
    
    // 标签页API
    async getCurrentTab()
    async createTab(options)
    async updateTab(tabId, options)
    
    // 右键菜单API
    createContextMenu(options)
    updateContextMenu(id, options)
    removeContextMenu(id)
    
    // 下载API
    async downloadFile(options)
    
    // 消息传递API
    sendMessage(message, options = {})
    onMessage(callback)
}
```

#### 使用示例

```javascript
// 获取Chrome设置模块
const chromeSettings = window.NWSModules.ChromeSettingsModule;

// 存储数据
await chromeSettings.setStorage({
    userPreference: 'dark-mode',
    lastUpdate: Date.now()
});

// 获取数据
const data = await chromeSettings.getStorage(['userPreference']);
console.log(data.userPreference); // 'dark-mode'

// 下载文件
await chromeSettings.downloadFile({
    url: 'https://example.com/file.pdf',
    filename: 'document.pdf',
    saveAs: true
});

// 创建右键菜单
chromeSettings.createContextMenu({
    id: 'my-menu',
    title: '我的菜单',
    contexts: ['selection']
});
```

## 功能模块

### NotificationModule

通知模块，提供统一的通知显示功能。

#### 接口说明

```javascript
class NotificationModule extends ModuleBase {
    // 显示通知
    show(message, type = 'info', options = {})
    success(message, options = {})
    error(message, options = {})
    warning(message, options = {})
    info(message, options = {})
    
    // 隐藏通知
    hide(id)
    hideAll()
    
    // 配置选项
    setDefaultOptions(options)
}
```

#### 使用示例

```javascript
// 获取通知模块
const notification = window.NWSModules.NotificationModule;

// 显示成功通知
notification.success('操作成功完成！');

// 显示错误通知
notification.error('操作失败，请重试', {
    duration: 5000,
    closable: true
});

// 显示自定义通知
const notificationId = notification.show('自定义消息', 'info', {
    duration: 0, // 不自动关闭
    position: 'top-right',
    showIcon: true
});

// 手动关闭通知
setTimeout(() => {
    notification.hide(notificationId);
}, 3000);
```

### ImageDownloaderModule

图片下载模块，为页面图片添加下载功能。

#### 接口说明

```javascript
class ImageDownloaderModule extends ModuleBase {
    // 图片处理
    processImages()
    addDownloadButton(img)
    removeDownloadButton(img)
    
    // 下载功能
    async downloadImage(img, options = {})
    async downloadMultipleImages(images, options = {})
    
    // 批量操作
    selectAllImages()
    deselectAllImages()
    getSelectedImages()
    
    // 配置选项
    setButtonStyle(styles)
    setDownloadOptions(options)
}
```

#### 使用示例

```javascript
// 获取图片下载模块
const imageDownloader = window.NWSModules.ImageDownloaderModule;

// 为所有图片添加下载按钮
imageDownloader.processImages();

// 下载单张图片
const img = document.querySelector('img');
await imageDownloader.downloadImage(img, {
    filename: 'custom-name.jpg',
    quality: 0.9
});

// 批量下载选中的图片
imageDownloader.selectAllImages();
const selectedImages = imageDownloader.getSelectedImages();
await imageDownloader.downloadMultipleImages(selectedImages, {
    zipFilename: 'images.zip'
});

// 自定义按钮样式
imageDownloader.setButtonStyle({
    backgroundColor: '#42b883',
    borderRadius: '50%',
    size: '30px'
});
```

### ElementHighlighterModule

元素高亮模块，提供鼠标悬停元素高亮和操作功能。

#### 接口说明

```javascript
class ElementHighlighterModule extends ModuleBase {
    // 高亮控制
    async enable()
    async disable()
    highlightElement(element)
    
    // 工具提示
    showTooltip(element, x, y)
    hideTooltip()
    
    // 样式信息
    showStyleInfo(element)
    hideStyleInfo()
    
    // 操作功能
    async copySelector()
    async copyStyle()
    async saveAsMD()
    async convertToVue()
    
    // 路径生成
    getCssPath(element)
    getSimplifiedCssPath(element)
    
    // 配置选项
    setHighlightColor(color)
    setExcludeSelectors(selectors)
}
```

#### 使用示例

```javascript
// 获取元素高亮模块
const highlighter = window.NWSModules.ElementHighlighterModule;

// 启用高亮功能
await highlighter.enable();

// 监听元素高亮事件
highlighter.on('elementHighlighted', (data) => {
    console.log('高亮元素:', data.element);
    console.log('CSS路径:', data.cssPath);
});

// 手动高亮元素
const element = document.querySelector('.target');
highlighter.highlightElement(element);

// 复制选择器
await highlighter.copySelector();

// 保存为Markdown
await highlighter.saveAsMD();

// 自定义配置
highlighter.updateConfig({
    highlightColor: '#ff6b6b',
    showTooltip: true,
    excludeSelectors: ['html', 'body', '.ignore']
});
```

## 全局访问

### 通过window对象访问

```javascript
// 访问应用实例
const app = window.NWSTools;

// 访问所有模块
const modules = window.NWSModules;

// 获取特定模块
const notification = window.NWSModules.NotificationModule;
const chromeSettings = window.NWSModules.ChromeSettingsModule;
```

### 应用级别操作

```javascript
// 获取应用实例
const app = window.NWSTools;

// 获取模块状态
const status = app.getModulesStatus();
console.log(status);

// 启用/禁用模块
await app.enableModule('ImageDownloaderModule');
await app.disableModule('ElementHighlighterModule');

// 重新加载模块
await app.reloadModule('NotificationModule');

// 监听应用事件
app.addEventListener('initialized', () => {
    console.log('应用初始化完成');
});
```

## 事件系统

所有模块都支持事件系统，可以监听和触发自定义事件。

### 事件监听

```javascript
// 监听模块事件
module.on('eventName', (data) => {
    console.log('事件触发:', data);
});

// 监听应用级事件
document.addEventListener('nws:initialized', (event) => {
    console.log('应用初始化完成');
});
```

### 事件触发

```javascript
// 在模块内部触发事件
this.emit('customEvent', { data: 'value' });

// 应用级事件触发
app.dispatchEvent('customEvent', { data: 'value' });
```

## 配置管理

### 模块配置

```javascript
// 获取模块配置
const config = module.getConfig();

// 更新模块配置
module.updateConfig({
    enabled: true,
    customOption: 'newValue'
});
```

### 全局配置

```javascript
// 通过Chrome设置模块管理全局配置
const chromeSettings = window.NWSModules.ChromeSettingsModule;

// 保存配置
await chromeSettings.setStorage({
    globalConfig: {
        theme: 'dark',
        language: 'zh-CN'
    }
});

// 读取配置
const data = await chromeSettings.getStorage(['globalConfig']);
```

## 错误处理

### 模块错误处理

```javascript
try {
    await module.initialize();
} catch (error) {
    console.error('模块初始化失败:', error);
    // 处理错误
}
```

### 全局错误处理

```javascript
// 监听模块错误事件
module.on('error', (error) => {
    console.error('模块错误:', error);
    // 错误处理逻辑
});
```

## 最佳实践

### 1. 模块开发

- 继承 `ModuleBase` 类
- 实现必要的生命周期方法
- 使用事件系统进行模块间通信
- 提供清晰的配置选项

### 2. 依赖管理

- 在模块构造函数中声明依赖
- 使用 `ModuleManager` 自动解析依赖
- 避免循环依赖

### 3. 错误处理

- 使用 try-catch 包装异步操作
- 提供有意义的错误信息
- 实现优雅的降级处理

### 4. 性能优化

- 延迟加载非关键模块
- 使用事件委托减少内存占用
- 及时清理事件监听器和DOM元素

## 版本信息

- **当前版本**: 1.0.0
- **最后更新**: 2024年1月
- **兼容性**: Chrome Extension Manifest V3

## 支持与反馈

如有问题或建议，请通过以下方式联系：

- 项目地址: [GitHub Repository]
- 问题反馈: [Issues]
- 文档更新: [Documentation]