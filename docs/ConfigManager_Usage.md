# ConfigManager 使用指南

## 概述

ConfigManager 是一个统一的配置管理模块，提供了防抖和批量写入功能来避免 Chrome 存储 API 的频率限制错误。

## 主要功能

### 1. 防抖写入

默认情况下，`setConfig` 方法使用防抖机制，在 1 秒内的多次写入会被合并为一次操作：

```javascript
// 这些调用会被防抖处理，只执行最后一次
await ConfigManager.setConfig('userData', { username: 'user1' });
await ConfigManager.setConfig('userData', { username: 'user2' });
await ConfigManager.setConfig('userData', { username: 'user3' });
// 最终只会保存 { username: 'user3' }
```

### 2. 立即写入

如果需要立即写入配置，可以设置 `immediate` 参数为 `true`：

```javascript
// 立即写入，不使用防抖
await ConfigManager.setConfig('userData', { username: 'admin' }, true);
```

### 3. 批量写入

当需要同时更新多个配置时，使用批量写入可以避免频率限制：

```javascript
// 推荐：批量更新多个配置
const configs = {
    userData: { username: 'admin', email: 'admin@example.com' },
    modelSettings: { apiUrl: 'https://api.example.com', model: 'gpt-4' },
    toggleSettings: { elementHighlighter: false, imageDownloader: true }
};

await ConfigManager.setBatchConfig(configs);
```

### 4. 错误处理

所有方法都包含了完善的错误处理机制：

```javascript
try {
    const success = await ConfigManager.setConfig('userData', newData);
    if (success) {
        console.log('配置保存成功');
    } else {
        console.log('配置保存失败');
    }
} catch (error) {
    console.error('配置操作异常:', error);
}
```

## 最佳实践

### 1. 避免频繁调用

❌ **不推荐**：
```javascript
// 短时间内多次调用会触发频率限制
for (let i = 0; i < 10; i++) {
    await ConfigManager.setConfig('userData', { count: i });
}
```

✅ **推荐**：
```javascript
// 使用防抖或批量写入
const finalData = { count: 9 };
await ConfigManager.setConfig('userData', finalData);
```

### 2. 初始化时使用批量写入

❌ **不推荐**：
```javascript
// 逐个设置配置
await ConfigManager.setConfig('userData', defaultUserData);
await ConfigManager.setConfig('modelSettings', defaultModelSettings);
await ConfigManager.setConfig('toggleSettings', defaultToggleSettings);
```

✅ **推荐**：
```javascript
// 批量设置配置
const defaultConfigs = {
    userData: defaultUserData,
    modelSettings: defaultModelSettings,
    toggleSettings: defaultToggleSettings
};
await ConfigManager.setBatchConfig(defaultConfigs);
```

### 3. 表单提交时的处理

```javascript
// 表单提交时收集所有更改，然后批量保存
function handleFormSubmit(formData) {
    const updates = {};
    
    if (formData.userData) updates.userData = formData.userData;
    if (formData.modelSettings) updates.modelSettings = formData.modelSettings;
    if (formData.toggleSettings) updates.toggleSettings = formData.toggleSettings;
    
    return ConfigManager.setBatchConfig(updates);
}
```

## 错误类型

### MAX_WRITE_OPERATIONS_PER_MINUTE

这是最常见的频率限制错误，通常由以下原因引起：

1. **短时间内多次调用** `chrome.storage.sync.set()`
2. **初始化时逐个设置配置项**
3. **用户快速操作表单控件**

**解决方案**：
- 使用 `setBatchConfig()` 进行批量写入
- 使用默认的防抖机制
- 在必要时添加操作间隔

## API 参考

### setConfig(key, value, immediate = false)

设置单个配置项。

- `key`: 配置键名
- `value`: 配置值
- `immediate`: 是否立即写入（跳过防抖）

### setBatchConfig(configs)

批量设置多个配置项。

- `configs`: 包含多个配置的对象

### getConfig(key)

获取单个配置项。

- `key`: 配置键名

### getAllConfig()

获取所有配置项。

## 注意事项

1. **Chrome 存储限制**：`chrome.storage.sync` 有严格的写入频率限制
2. **防抖延迟**：默认防抖延迟为 1000ms，可根据需要调整
3. **批量写入优先**：当需要更新多个配置时，优先使用批量写入
4. **错误恢复**：批量写入失败时会自动降级为带延迟的逐个写入