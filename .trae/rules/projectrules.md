# NWS Tools 开发核心规则

## 1. 架构与生命周期 (Architecture)
- **模块化核心**：新功能必须继承 [ModuleBase.js](nwsTools/js/modules/core/ModuleBase.js) 并在 [main.js](nwsTools/js/main.js) 注册。
- **严格生命周期**：必须正确实现 `onInitialize`, `onEnable`, `onDisable`, `onDestroy`。
- **职能分离**：
    - `features/`: 纯业务逻辑实现。
    - `ui/`: 仅负责 DOM 渲染与交互（如 `*View.js`）。
    - `utils/`: 统一使用 `ConfigManager`, `StyleManager`, `DOMHelper`。

## 2. UI 与交互规范 (UI/UX)
- **视觉系统**：深蓝主题，必须引用 [modern-control-panel.css](nwsTools/css/modern-control-panel.css) 中的变量（`--panel`, `--accent` 等）。
- **组件标准**：禁止使用 Emoji，必须使用高品质 **SVG**；所有状态切换需具备流畅过渡动画。
- **资源声明**：注入页面的样式/脚本必须在 `manifest.json` 的 `web_accessible_resources` 中定义。

## 3. 稳定性与安全 (Stability)
- **DOM 操作**：**禁止**直接使用原生 `querySelector`，必须通过 [dom-helper.js](/nwsTools/js/utils/dom-helper.js) 的安全包装函数。
- **选择器防错**：属性选择器必须经过 `sanitizeSelector` 处理，以规避内联样式引号导致的解析错误。
- **统一报错**：通过 `error-handler.js` 拦截异常，并使用 `NotificationModule` 反馈。

## 4. 维护与清理 (Maintenance)
- **彻底清理**：`onDestroy` 阶段必须移除所有注入的 DOM、定时器及事件监听器。
- **存储准则**：配置存入 `chrome.storage.sync`，大容量数据存入 `local`。
- **命名规范**：模块类 `*Module.js`，视图类 `*View.js`，辅助工具 `*Manager.js`。

## 5. 原网页保护与隔离 (Isolation & Protection)
- **命名空间**：所有 CSS 类名、ID 必须以前缀 `nws-` 开头，严禁污染全局变量。
- **样式防渗透**：
    - 插件根容器必须应用 `all: initial` 或 CSS Reset，阻断原网页样式对插件 UI 的干扰。
    - 严禁使用通用标签选择器（如 `div`, `p`），必须始终绑定 `.nws-` 前缀类名。
    - 插件样式应合理使用 `!important` 确保显示效果，但绝不能覆盖原网页元素的既有样式。
- **交互隔离**：
    - 事件监听器应尽可能限制在插件 DOM 容器内。
    - 除非必要，禁止干扰原网页的事件流（如滥用 `stopPropagation`）。
- **DOM 安全**：注入 DOM 必须挂载在 `body` 直属层级，避免嵌套在原网页的业务容器中以防破坏其布局逻辑（如 Flex/Grid 容器）。
