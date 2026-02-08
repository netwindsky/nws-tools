# NWS Tools 开发核心规则

## 1. 架构与职能 (Architecture & Responsibility)
- **模块化核心**：所有功能必须继承 [ModuleBase.js](nwsTools/js/modules/core/ModuleBase.js) 并实现完整生命周期（`onInitialize`, `onEnable`, `onDisable`, `onDestroy`）。
- **业务包模式 (Feature Bundle)**：按功能独立成文件夹 `modules/features/{feature}/`，内部包含该功能的 `Module` (逻辑控制器)、`Service` (数据/请求) 及 `View` (UI)。
- **分层解耦**：
  - `app/`：各端入口逻辑（Content/Background/Options）。
  - `services/`：单例基础设施服务（如 `StorageService`, `I18nService`）。
  - `shared/`：全局共享常量、配置 Schema 及事件定义。
  - `utils/`：无状态纯工具函数。
- **通信机制**：模块间禁止直接硬引用，必须通过 `shared/events` 定义的事件总线进行异步通信。

## 2. 存储与资源管理 (Storage & Resources)
- **配置管理**：禁止直接调用 `chrome.storage`。必须通过 `StorageService` 读写，默认配置与 Schema 统一定义在 `shared/constants`。
- **多语言 (I18n)**：遵循 Chrome `_locales` 标准。禁止硬编码文本，统一使用 `I18nService.t('key')` 获取。
- **视觉系统**：
  - 强制引用 `css/variables.css` (Design Token) 维持主题一致性。
  - 通用组件样式存放于 `css/components/`，模块私有样式存放于业务包目录下。
  - 禁止使用 Emoji，统一使用高品质 SVG；状态切换需具备流畅过渡动画。

## 3. 安全与隔离 (Safety & Isolation)
- **DOM 操作**：禁止直接使用原生 `querySelector`。必须通过 [dom-helper.js](nwsTools/js/utils/dom-helper.js) 的安全封装函数，且属性选择器必须经过 `sanitizeSelector` 处理。
- **原网页保护**：
  - **命名空间**：所有 CSS 类名、ID 及自定义属性必须以前缀 `nws-` 开头。
  - **样式隔离**：插件根容器应用 `all: initial`；严禁使用通用标签选择器（如 `div`, `p`），必须始终绑定类名。
  - **交互隔离**：注入 DOM 必须挂载在 `body` 直属层级，避免破坏原网页布局；严禁干扰原网页正常的事件流。

## 4. 维护与规范 (Maintenance & Standards)
- **命名规则**：
  - 目录：`modules/features/` 下采用 `kebab-case`。
  - 文件：模块 `*Module.js`，视图 `*View.js`，服务 `*Service.js`，辅助工具 `*Manager.js`。
  - 变量/函数：采用 `camelCase`。
- **彻底清理**：`onDestroy` 阶段必须移除所有注入的 DOM、定时器、全局事件监听器，确保无内存泄漏。
- **错误处理**：通过 `error-handler.js` 统一拦截异常，并通过 `NotificationModule` 反馈用户。
