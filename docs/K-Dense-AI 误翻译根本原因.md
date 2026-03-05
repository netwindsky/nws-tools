# K-Dense-AI 误翻译问题：根本原因分析

## 问题重现

**被翻译的内容**：
```
K-Dense-AI / claude-scientific-skills
```

## 检测流程

### 情况 1：整体文本

```javascript
文本："K-Dense-AI / claude-scientific-skills"

检测顺序：
1. isURLWithDescription → false
2. 邮箱检测 → false
3. isFileName → false
4. isPath → true ✓ (面包屑路径)
   → 返回 false，不翻译 ✓
```

**结论**：如果作为整体检测，应该被正确拦截。

### 情况 2：分割成多个文本节点

**GitHub 的 DOM 结构**：
```html
<div class="breadcrumb">
    <a href="...">K-Dense-AI</a>
    <span class="separator"> / </span>
    <a href="...">claude-scientific-skills</a>
</div>
```

**文本节点分割**：
```
节点 1: "K-Dense-AI"
节点 2: " / "
节点 3: "claude-scientific-skills"
```

**逐个检测**：

#### 节点 1: "K-Dense-AI"

```javascript
文本："K-Dense-AI"

检测顺序：
1. isURLWithDescription → false
2. 邮箱检测 → false
3. isFileName → false
4. isPath → false (不是路径格式)
5. isCodeIdentifier → true ✓ (短横线命名)
   → 返回 false，不翻译 ✓
```

**测试**：
```javascript
const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)+$/i;
kebabCaseRegex.test("K-Dense-AI") → true ✓
```

#### 节点 2: " / "

```javascript
文本：" / "

检测：
- 长度不足 (minLength = 2)
- 或者被识别为纯符号
→ 返回 false，不翻译 ✓
```

#### 节点 3: "claude-scientific-skills"

```javascript
文本："claude-scientific-skills"

检测顺序：
1. isURLWithDescription → false
2. 邮箱检测 → false
3. isFileName → false
4. isPath → false
5. isCodeIdentifier → true ✓ (短横线命名)
   → 返回 false，不翻译 ✓
```

**测试**：
```javascript
kebabCaseRegex.test("claude-scientific-skills") → true ✓
```

## 问题出在哪里？

### 可能性 1：文本节点被进一步分割

**实际分割**：
```
原始："K-Dense-AI / claude-scientific-skills"

可能被分成：
节点 1: "K"
节点 2: "-"
节点 3: "Dense"
节点 4: "-"
节点 5: "AI"
节点 6: " / "
节点 7: "claude"
节点 8: "-"
节点 9: "scientific"
节点 10: "-"
节点 11: "skills"
```

**检测**：
```javascript
"Dense" → isCodeIdentifier → false ❌ (没有分隔符)
         → 纯英文内容，wordCount = 1
         → 单个单词，返回 false ✓

"skills" → isCodeIdentifier → false ❌
          → 纯英文内容，wordCount = 1
          → 单个单词，返回 false ✓
```

**结论**：即使被分割成单个单词，也应该被过滤（wordCount < 2）。

### 可能性 2：多个单词被合并

**实际分割**：
```
节点 1: "K-Dense-AI"
节点 2: " / "
节点 3: "claude-scientific-skills"

但是翻译模块可能合并了多个节点：
"K-Dense-AI / claude-scientific-skills"
```

**检测**：
```javascript
文本："K-Dense-AI / claude-scientific-skills"

检测顺序：
1. isURLWithDescription → false
2. 邮箱检测 → false
3. isFileName → false
4. isPath → true ✓ (面包屑路径正则)
   → 返回 false，不翻译 ✓
```

**应该被正确拦截！**

### 可能性 3：normalizeText 破坏了格式

**可能的规范化操作**：
```javascript
normalizeText(text) {
    // 可能移除了斜杠周围的空格？
    return text.replace(/\s*\/\s*/g, '/');
}
```

**结果**：
```
原始："K-Dense-AI / claude-scientific-skills"
规范化后："K-Dense-AI/claude-scientific-skills"

检测：
isPath("K-Dense-AI/claude-scientific-skills") → false ❌
  (面包屑正则要求空格：/^[\w\-./]+\s*\/\s*[\w\-./]+$/)

isCodeIdentifier("K-Dense-AI/claude-scientific-skills") → false ❌
  (包含斜杠，不是短横线命名)

→ 继续后续检测
→ 纯英文内容，wordCount = 5 (K, Dense, AI, claude, scientific, skills)
→ wordCount >= 2
→ 返回 true ❌ (被翻译！)
```

**这就是问题所在！**

## 验证方法

### 1. 检查 normalizeText

```javascript
normalizeText(text) {
    return text
        .replace(/\s+/g, ' ')      // 可能的操作
        .trim();
}
```

**查看实际代码**，确认是否有移除空格的操作。

### 2. 添加调试日志

在 `TranslationUtils.js` 开头添加：

```javascript
_shouldTranslateTextForPage(text) {
    console.log('[TranslationUtils] 原始输入:', text);
    const normalized = this.normalizeText(text);
    console.log('[TranslationUtils] 规范化后:', normalized);
    
    // ... 后续检测
}
```

**查看控制台输出**：
```
[TranslationUtils] 原始输入：K-Dense-AI / claude-scientific-skills
[TranslationUtils] 规范化后：K-Dense-AI/claude-scientific-skills  ← 问题！
```

## 修复方案

### 方案 A：修改路径正则

**当前正则**：
```javascript
const breadcrumbRegex = /^[\w\-./]+\s*\/\s*[\w\-./]+$/;
// 要求：斜杠周围有空格（可选）
```

**修改为**：
```javascript
const breadcrumbRegex = /^[\w\-./]+\/[\w\-./]+$/;
// 允许：有无空格都匹配
```

**测试**：
```javascript
"K-Dense-AI/claude-scientific-skills" → true ✓
"K-Dense-AI / claude-scientific-skills" → true ✓
```

### 方案 B：保护短横线命名

**在纯英文检测之前**，先检查是否包含短横线：

```javascript
// 检查是否包含短横线命名（即使被规范化破坏）
if (/^[a-z0-9]+(-[a-z0-9]+)+$/i.test(text)) {
    console.log('[TranslationUtils] 包含短横线命名');
    return false;
}

// 或者检查是否包含多个短横线
if ((text.match(/-/g) || []).length >= 2) {
    console.log('[TranslationUtils] 包含多个短横线，可能是代码标识符');
    return false;
}
```

### 方案 C：增强代码标识符检测

**检测包含斜杠的组合**：

```javascript
isCodeIdentifier(text) {
    // 原有的检测...
    
    // 新增：检测 GitHub 仓库名格式
    // K-Dense-AI/claude-scientific-skills
    const githubRepoRegex = /^[\w\-]+\/[\w\-]+$/;
    if (githubRepoRegex.test(text)) {
        return true;
    }
    
    return false;
}
```

## 最佳修复方案

**修改路径正则**（最简单）：

```javascript
isPath(text) {
    // Unix 路径
    const unixPathRegex = /^\/[\w\-./]+$/;
    // Windows 路径
    const windowsPathRegex = /^[A-Z]:\\[\\ \w\-.\-]+$/i;
    // 相对路径
    const relativePathRegex = /^\.\.?\/[\w\-./]+$/;
    
    // 面包屑导航格式（包括有无空格）
    const breadcrumbRegex = /^[\w\-./]+\s*\/\s*[\w\-./]+$/;
    
    // 新增：GitHub 仓库名格式（无空格）
    const githubRepoRegex = /^[\w\-]+\/[\w\-]+$/;
    
    return unixPathRegex.test(text) || 
           windowsPathRegex.test(text) || 
           relativePathRegex.test(text) ||
           breadcrumbRegex.test(text) ||
           githubRepoRegex.test(text);  // ← 新增
}
```

**测试**：
```javascript
isPath("K-Dense-AI/claude-scientific-skills") → true ✓
isPath("K-Dense-AI / claude-scientific-skills") → true ✓
```

## 总结

**问题根源**：
1. 文本被规范化后，斜杠周围的空格被移除
2. 面包屑正则要求有空格，导致不匹配
3. 代码标识符检测被跳过
4. 纯英文检测判断为"多个单词"，返回 true

**修复方案**：
- ✅ 增强路径正则，支持无空格格式
- ✅ 或者增强代码标识符检测，支持 GitHub 仓库名格式

**建议**：使用方案 C，增强代码标识符检测。
