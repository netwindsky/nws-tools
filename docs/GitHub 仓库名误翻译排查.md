# GitHub 仓库名误翻译问题排查

## 问题内容

```
K-Dense-AI / claude-scientific-skills
```

这个被翻译了，但**不应该被翻译**。

## 检测逻辑分析

### 1. 短横线命名检测

**当前正则**：
```javascript
const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)+$/i;
```

**测试**：
```javascript
kebabCaseRegex.test("K-Dense-AI") → true ✓
kebabCaseRegex.test("claude-scientific-skills") → true ✓
```

**理论上应该被识别为代码标识符！**

### 2. 可能的原因

#### 原因 A：文本被分割处理

**GitHub 面包屑导航的 DOM 结构**：

```html
<div class="breadcrumb">
    <a>K-Dense-AI</a>
    <span class="separator">/</span>
    <a>claude-scientific-skills</a>
</div>
```

**问题**：
- 每个部分被**单独处理**
- `K-Dense-AI` → 单独检测 → `isCodeIdentifier` → `true` ✓
- `claude-scientific-skills` → 单独检测 → `isCodeIdentifier` → `true` ✓
- `/` → 符号，被忽略

**但是**：如果检测逻辑有问题，可能仍然被翻译。

#### 原因 B：检测顺序问题

**`shouldTranslateText` 检测顺序**：

```javascript
_shouldTranslateTextForPage(text) {
    // 1. URL 检测
    if (this.isURLWithDescription(text)) return false;
    
    // 2. 邮箱检测
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return false;
    
    // 3. 文件名检测
    if (this.isFileName(text)) return false;
    
    // 4. 路径检测
    if (this.isPath(text)) return false;
    
    // 5. 代码标识符检测
    if (this.isCodeIdentifier(text)) return false;  // ← 这里应该拦截
    
    // 6. 命令检测
    if (this.isCommand(text)) return false;
    
    // ... 其他检测
    
    return true;  // 需要翻译
}
```

**问题**：如果 `isCodeIdentifier` 返回 `false`，就会继续后续检测并最终返回 `true`。

#### 原因 C：正则表达式问题

**当前正则**：
```javascript
const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)+$/i;
```

**分解**：
```
^         - 开始
[a-z0-9]+ - 1 个或多个字母或数字
(-        - 左括号（分组）
[a-z0-9]+ - 1 个或多个字母或数字
)+        - 右括号 + 1 次或多次（表示至少有 1 个分隔符）
$         - 结束
/i        - 忽略大小写
```

**测试**：
```javascript
// 应该匹配
"K-Dense-AI" → true ✓ (K + -Dense + -AI)
"claude-scientific-skills" → true ✓ (claude + -scientific + -skills)

// 不应该匹配
"hello" → false ✓ (没有分隔符)
"Hello-World" → true ✓
```

**看起来是正确的！**

### 3. 真正的问题

**可能的原因**：

#### 问题 1：文本被分成多个节点

**实际情况**：
```
节点 1: "K-Dense-AI" → isCodeIdentifier → true ✓ → 不翻译
节点 2: "/" → 符号，被忽略
节点 3: "claude-scientific-skills" → isCodeIdentifier → true ✓ → 不翻译
```

**但是**：如果文本节点是：
```
节点 1: "K-Dense-AI / claude-scientific-skills" (整体)
```

**检测**：
```javascript
isCodeIdentifier("K-Dense-AI / claude-scientific-skills") → false ❌
// 因为包含空格和斜杠，不符合短横线命名
```

**然后**：
```javascript
isPath("K-Dense-AI / claude-scientific-skills") → true ✓
// 面包屑路径正则：/^[\w\-./]+\s*\/\s*[\w\-./]+$/
```

**应该被路径检测拦截！**

#### 问题 2：路径正则不匹配

**当前路径正则**：
```javascript
const breadcrumbRegex = /^[\w\-./]+\s*\/\s*[\w\-./]+$/;
```

**测试**：
```javascript
breadcrumbRegex.test("K-Dense-AI / claude-scientific-skills") → true ✓
```

**应该匹配！**

### 4. 调试建议

**添加调试日志**：

```javascript
shouldTranslateText(text) {
    console.log('[TranslationUtils] 检测文本:', text);
    
    if (this.isCodeIdentifier(text)) {
        console.log('[TranslationUtils] 是代码标识符');
        return false;
    }
    
    if (this.isPath(text)) {
        console.log('[TranslationUtils] 是路径');
        return false;
    }
    
    // ...
}
```

**查看控制台输出**：
```
[TranslationUtils] 检测文本：K-Dense-AI
[TranslationUtils] 是代码标识符 ← 正确拦截

[TranslationUtils] 检测文本：claude-scientific-skills
[TranslationUtils] 是代码标识符 ← 正确拦截
```

或者：
```
[TranslationUtils] 检测文本：K-Dense-AI / claude-scientific-skills
[TranslationUtils] 是路径 ← 正确拦截
```

### 5. 最可能的原因

**原因**：文本被**分成多个节点**处理，但**某个节点没有被正确识别**。

**场景**：
```
节点 1: "K-Dense-AI" → true ✓
节点 2: " / " → 可能被忽略或与前后合并
节点 3: "claude-scientific-skills" → true ✓
```

**但是**：如果某个节点是：
```
"skills" (被单独分割)
```

**检测**：
```javascript
isCodeIdentifier("skills") → false ❌ (没有分隔符，长度 < 10)
shouldTranslateText("skills") → false ✓ (单个单词，不翻译)
```

**应该被过滤！**

### 6. 修复方案

#### 方案 A：增强调试

**添加详细日志**，找出哪个节点被误翻译。

#### 方案 B：增强代码标识符检测

**当前问题**：
- `K-Dense-AI` → 应该匹配 ✓
- `claude-scientific-skills` → 应该匹配 ✓

**但是**：如果有更短的仓库名：
```
"my-repo" → true ✓ (my + -repo)
"ai-tool" → true ✓ (ai + -tool)
```

**这些都应该被识别！**

#### 方案 C：增强路径检测

**确保面包屑格式被正确识别**：
```javascript
const breadcrumbRegex = /^[\w\-./]+\s*\/\s*[\w\-./]+$/;
```

**测试**：
```javascript
"K-Dense-AI / claude-scientific-skills" → true ✓
"repo / project" → true ✓
"a / b" → true ✓
```

### 7. 临时解决方案

**如果问题仍然存在**，可以：

1. **降低最小翻译长度**：
   ```javascript
   const minLength = this.config?.minTextLength || 4;  // 增加到 4
   ```

2. **增强单个单词过滤**：
   ```javascript
   // 短横线命名的单词不翻译
   if (/^[a-z0-9]+(-[a-z0-9]+)+$/i.test(text)) {
       return false;
   }
   ```

## 总结

**理论上**：
- ✅ `K-Dense-AI` 应该被 `isCodeIdentifier` 识别
- ✅ `claude-scientific-skills` 应该被 `isCodeIdentifier` 识别
- ✅ 整体应该被 `isPath` 识别

**如果仍然被翻译**，可能是：
1. 文本节点分割问题
2. 检测逻辑有 bug
3. 某些边界情况未处理

**建议**：添加调试日志，查看实际被翻译的文本是什么。
