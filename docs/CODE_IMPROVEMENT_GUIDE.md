# NWS Tools 代码改进指南

本指南提供具体的代码修复方案和重构建议，帮助开发者快速修复问题并提升代码质量。

---

## 🔴 P0 - 严重问题修复（必须立即处理）

### 1. 修复XSS安全漏洞

**问题文件**: 
- `js/modules/features/ElementHighlighterModule.js:283-287`
- `js/controllers/SidebarController.js:298-425`

**风险等级**: 🔴 高危

**修复方案**:

```javascript
// 替换 innerHTML 为 DOM API
// 创建通用转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 在 ElementHighlighterModule.js:283-287
// 修改前:
this.tooltip.innerHTML = `
    <div class="nws-tooltip-text">${text}</div>
`;

// 修改后:
const textDiv = document.createElement('div');
textDiv.className = 'nws-tooltip-text';
textDiv.textContent = text;
this.tooltip.appendChild(textDiv);
```

---

### 2. 修复内存泄漏

**问题文件**: `js/modules/features/ImageDownloaderModule.js:40, 428-432`

**修复方案**:

```javascript
// 修改前:
this.downloadButtons = new Map();

// 修改后:
this.downloadButtons = new WeakMap();

// 在 removeAllDownloadButtons() 方法末尾添加:
this.downloadButtons = new WeakMap();
```

---

### 3. 修复变量未定义

**问题文件**: 
- `js/modules/features/ImageDownloaderModule.js:98`
- `js/modules/features/ElementHighlighterModule.js:244`

**修复方案**:

```javascript
// ImageDownloaderModule.js:98
// 修改前:
const images = safeQuerySelectorAll('img', node);

// 修改后:
const images = imageSafeQuerySelectorAll('img', node);

// ElementHighlighterModule.js:244
// 修改前:
const previousHighlight = safeQuerySelector('.nws-element-highlight');

// 修改后:
const previousHighlight = elementSafeQuerySelector('.nws-element-highlight');
```

---

## 🟡 P1 - 重要问题修复

### 4. 优化图片处理性能

**问题文件**: `js/modules/features/ImageDownloaderModule.js:97-105`

**修复方案**:

```javascript
// 修改前:
for (const img of images) {
    if (!this.processedImages.has(img)) {
        await this.processImage(img);
    }
}

// 修改后:
const unprocessedImages = images.filter(img => !this.processedImages.has(img));
await Promise.allSettled(
    unprocessedImages.map(img => this.processImage(img))
);
```

### 5. 添加事件防抖

**问题文件**: `js/modules/features/ElementHighlighterModule.js`

**修复方案**:

```javascript
// 添加防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 在构造函数中应用:
this.handleMouseMove = debounce(this.handleMouseMove.bind(this), 16);
```

---

## 📊 修复清单

### 紧急修复（今天完成）
- [ ] 修复XSS漏洞（ElementHighlighterModule.js:283-287）
- [ ] 修复内存泄漏（ImageDownloaderModule.js:40, 428-432）
- [ ] 修复变量名错误（ImageDownloaderModule.js:98）
- [ ] 修复未定义变量（ElementHighlighterModule.js:244）

### 本周计划
- [ ] 优化图片处理性能（并行处理）
- [ ] 添加事件防抖
- [ ] 增强错误处理机制
- [ ] 抽取公共配置管理器

### 本月目标
- [ ] 迁移到ES6模块系统
- [ ] 添加单元测试
- [ ] 优化架构降低耦合度

---

**最后更新**: 2025-02-07
