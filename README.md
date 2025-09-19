# NWS Tools - 模块化Chrome扩展框架

## 项目概述

NWS Tools 是一个功能丰富的Chrome扩展，采用模块化架构设计，提供了元素高亮、图片下载、通知系统等多种实用功能。通过统一的模块接口，开发者可以轻松扩展和定制功能。

## 主要特性

- 🏗️ **模块化架构** - 基于统一接口的模块系统
- 🎯 **元素高亮** - 智能元素选择和信息提取
- 📥 **图片下载** - 批量图片下载和管理
- 🔔 **通知系统** - 统一的消息通知机制
- ⚙️ **Chrome API封装** - 简化的Chrome扩展API接口
- 🔧 **配置管理** - 灵活的配置系统
- 📱 **响应式设计** - 适配不同屏幕尺寸

## 项目结构

```
nwsTools/
├── manifest.json           # 扩展清单文件
├── js/
│   ├── main.js            # 主入口文件
│   ├── config.js          # 配置管理
│   ├── background.js      # 后台脚本
│   ├── options.js         # 选项页脚本
│   ├── toolspanel.js      # 工具面板脚本
│   └── modules/           # 模块目录
│       ├── core/          # 核心模块
│       │   ├── ModuleBase.js      # 基础模块类
│       │   └── ModuleManager.js   # 模块管理器
│       ├── chrome/        # Chrome API模块
│       │   └── ChromeSettingsModule.js
│       └── features/      # 功能模块
│           ├── NotificationModule.js
│           ├── ImageDownloaderModule.js
│           └── ElementHighlighterModule.js
├── html/                  # HTML文件
│   ├── options.html       # 选项页面
│   └── toolspanel.html    # 工具面板
├── css/                   # 样式文件
├── images/                # 图片资源
└── docs/                  # 文档
    ├── API_Documentation.md
    └── Quick_Start_Guide.md
```

## 快速开始

### 安装

1. 克隆项目到本地
2. 打开Chrome浏览器，进入扩展管理页面 (`chrome://extensions/`)
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"，选择项目目录

### 基本使用

扩展安装后会自动初始化所有模块：

```javascript
// 等待初始化完成
document.addEventListener('nws:initialized', () => {
    // 访问模块
    const notification = window.NWSModules.NotificationModule;
    const imageDownloader = window.NWSModules.ImageDownloaderModule;
    const highlighter = window.NWSModules.ElementHighlighterModule;
    
    // 显示欢迎通知
    notification.success('NWS Tools 已准备就绪！');
});
```

## 核心功能

### 1. 元素高亮模块

提供智能的元素选择和高亮功能：

- 鼠标悬停高亮元素
- 显示元素信息和CSS路径
- 复制选择器和样式
- 保存为Markdown格式
- 转换为Vue组件

```javascript
const highlighter = window.NWSModules.ElementHighlighterModule;

// 监听元素高亮事件
highlighter.on('elementHighlighted', (data) => {
    console.log('当前元素:', data.element);
    console.log('CSS路径:', data.cssPath);
});
```

### 2. 图片下载模块

为页面图片添加下载功能：

- 自动为图片添加下载按钮
- 支持单张和批量下载
- 自定义文件名和格式
- ZIP打包下载

```javascript
const imageDownloader = window.NWSModules.ImageDownloaderModule;

// 处理页面所有图片
imageDownloader.processImages();

// 批量下载
const images = imageDownloader.getSelectedImages();
await imageDownloader.downloadMultipleImages(images);
```

### 3. 通知模块

统一的消息通知系统：

- 多种通知类型（成功、错误、警告、信息）
- 自定义显示位置和持续时间
- 支持HTML内容和图标
- 响应式设计

```javascript
const notification = window.NWSModules.NotificationModule;

// 显示不同类型的通知
notification.success('操作成功！');
notification.error('操作失败，请重试');
notification.warning('请注意安全');
notification.info('这是一条信息');
```

### 4. Chrome设置模块

封装Chrome扩展API：

- 存储管理
- 权限控制
- 标签页操作
- 右键菜单
- 文件下载

```javascript
const chromeSettings = window.NWSModules.ChromeSettingsModule;

// 存储数据
await chromeSettings.setStorage({ key: 'value' });

// 下载文件
await chromeSettings.downloadFile({
    url: 'https://example.com/file.pdf',
    filename: 'document.pdf'
});
```

## 模块开发

### 创建自定义模块

```javascript
import ModuleBase from './modules/core/ModuleBase.js';

class MyModule extends ModuleBase {
    constructor(name, options = {}) {
        super(name, {
            version: '1.0.0',
            dependencies: ['NotificationModule'],
            defaultConfig: {
                enabled: true,
                customOption: 'default'
            },
            ...options
        });
    }

    async onInitialize() {
        console.log(`${this.name} 初始化完成`);
    }

    async onDestroy() {
        console.log(`${this.name} 已销毁`);
    }
}

export default MyModule;
```

### 注册模块

在 `main.js` 中注册自定义模块：

```javascript
import MyModule from './modules/custom/MyModule.js';

// 在registerModules方法中添加
this.moduleManager.register('MyModule', MyModule);
```

## 配置系统

### 模块配置

每个模块都有独立的配置：

```javascript
const module = window.NWSModules.SomeModule;

// 获取配置
const config = module.getConfig();

// 更新配置
module.updateConfig({
    enabled: false,
    customOption: 'newValue'
});
```

### 全局配置

通过Chrome存储API管理：

```javascript
const chromeSettings = window.NWSModules.ChromeSettingsModule;

// 保存配置
await chromeSettings.setStorage({
    globalConfig: { theme: 'dark' }
});

// 读取配置
const data = await chromeSettings.getStorage(['globalConfig']);
```

## 事件系统

### 模块事件

```javascript
// 监听事件
module.on('eventName', (data) => {
    console.log('事件数据:', data);
});

// 触发事件
module.emit('eventName', { data: 'value' });
```

### 应用级事件

```javascript
// 监听应用事件
document.addEventListener('nws:initialized', () => {
    console.log('应用初始化完成');
});

// 触发应用事件
window.NWSTools.dispatchEvent('customEvent', { data: 'value' });
```

## API文档

详细的API文档请参考：

- [API文档](./docs/API_Documentation.md) - 完整的接口说明
- [快速开始指南](./docs/Quick_Start_Guide.md) - 使用教程和示例

## 开发指南

### 环境要求

- Chrome 88+
- ES6+ 支持
- Manifest V3

### 开发流程

1. Fork项目
2. 创建功能分支
3. 开发和测试
4. 提交Pull Request

### 代码规范

- 使用ES6+语法
- 遵循模块化设计原则
- 添加适当的注释和文档
- 编写单元测试

### 调试技巧

```javascript
// 在控制台中访问
console.log(window.NWSModules);
console.log(window.NWSTools);

// 查看模块状态
const app = window.NWSTools;
console.log(app.getModulesStatus());

// 手动控制模块
await app.enableModule('SomeModule');
await app.disableModule('SomeModule');
```

## 版本历史

### v1.0.0 (2024-01-XX)
- 🎉 初始版本发布
- ✨ 模块化架构实现
- 🚀 核心功能模块完成
- 📚 完整文档编写

## 贡献指南

我们欢迎所有形式的贡献：

- 🐛 报告Bug
- 💡 提出新功能建议
- 📝 改进文档
- 🔧 提交代码

### 提交规范

- feat: 新功能
- fix: 修复Bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 代码重构
- test: 测试相关
- chore: 构建过程或辅助工具的变动

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 联系方式

- 项目地址: [GitHub Repository]
- 问题反馈: [Issues]
- 讨论交流: [Discussions]

## 致谢

感谢所有为项目做出贡献的开发者和用户！

---

**NWS Tools** - 让Chrome扩展开发更简单、更模块化！