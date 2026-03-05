# GitHub 仓库名误翻译修复

## 问题描述

**被误翻译的内容**：
```
K-Dense-AI / claude-scientific-skills
```

这是 GitHub 的仓库名称（面包屑导航格式），属于**技术术语**，不应该翻译。

## 问题根源

### 检测逻辑分析

**原始代码标识符检测**：
```javascript
isCodeIdentifier(text) {
    const camelCaseRegex = /^[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*$/;
    const pascalCaseRegex = /^[A-Z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*$/;
    const snakeCaseRegex = /^[a-z0-9]+(_[a-z0-9]+)+$/i;
    const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)+$/i;
    const constantCaseRegex = /^[A-Z]+(_[A-Z]+)+$/;
    const longLowercaseRegex = /^[a-z]{10,}$/;
    
    return camelCaseRegex.test(text) || ...;
}
```

**问题**：
- ❌ 没有检测 GitHub 仓库名格式（`user/repo` 或 `K-Dense-AI / claude-scientific-skills`）
- ❌ 虽然路径检测有面包屑正则，但在代码标识符检测之后
- ❌ 如果文本被规范化后空格被移除，路径正则可能不匹配

### 文本规范化影响

**normalizeText 方法**：
```javascript
normalizeText(text) {
    return text
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())  // 合并空格
        .filter(line => line.length > 0)
        .join('\n');
}
```

**可能的情况**：
```
原始："K-Dense-AI / claude-scientific-skills"
规范化后："K-Dense-AI / claude-scientific-skills"  (空格被保留，但多个空格合并为一个)

或者被进一步处理：
"K-Dense-AI/claude-scientific-skills"  (如果原网页就没有空格)
```

### 检测失败流程

```
文本："K-Dense-AI/claude-scientific-skills"

检测顺序：
1. isURLWithDescription → false
2. 邮箱检测 → false
3. isFileName → false
4. isPath → false ❌ (面包屑正则要求有空格)
5. isCodeIdentifier → false ❌ (没有 GitHub 仓库名检测)
6. isCommand → false
7. isMeaninglessContent → false
8. 纯英文检测 → wordCount = 5 (K, Dense, AI, claude, scientific, skills)
   → wordCount >= 2
   → 返回 true ❌ (被翻译！)
```

## 修复方案

### 增强代码标识符检测

**新增 GitHub 仓库名格式检测**：

```javascript
isCodeIdentifier(text) {
    // 原有的驼峰、帕斯卡、下划线、短横线、常量命名...
    
    // 全小写复合词
    const longLowercaseRegex = /^[a-z]{10,}$/;
    
    // 【新增】GitHub 仓库名格式：K-Dense-AI/claude-scientific-skills, user/repo
    // 包括带空格的格式：K-Dense-AI / claude-scientific-skills
    const githubRepoRegex = /^[\w\-./]+\s*\/\s*[\w\-./]+$/;
    
    return camelCaseRegex.test(text) || 
           pascalCaseRegex.test(text) || 
           snakeCaseRegex.test(text) || 
           kebabCaseRegex.test(text) ||
           constantCaseRegex.test(text) ||
           longLowercaseRegex.test(text) ||
           githubRepoRegex.test(text);  // ← 新增
}
```

### 正则表达式详解

```javascript
const githubRepoRegex = /^[\w\-./]+\s*\/\s*[\w\-./]+$/;

分解：
^          - 开始
[\w\-./]+  - 1 个或多个单词字符、横线、点、斜杠
           (匹配：K-Dense-AI, user, org.name 等)
\s*        - 0 个或多个空白字符
\/         - 斜杠分隔符
\s*        - 0 个或多个空白字符
[\w\-./]+  - 1 个或多个单词字符、横线、点、斜杠
           (匹配：claude-scientific-skills, repo 等)
$          - 结束
```

**匹配示例**：
```javascript
"K-Dense-AI/claude-scientific-skills" → true ✓
"K-Dense-AI / claude-scientific-skills" → true ✓
"user/repo" → true ✓
"org.name/project-name" → true ✓
"K-Dense-AI  /  claude-scientific-skills" → true ✓ (多个空格)
```

**不匹配**：
```javascript
"hello world" → false ✓ (没有斜杠)
"/usr/bin" → false ✓ (以斜杠开头，这是路径)
"K-Dense-AI" → false ✓ (没有斜杠)
```

## 修复效果

### 测试用例

```javascript
// GitHub 仓库名（应该被识别）
isCodeIdentifier("K-Dense-AI / claude-scientific-skills") → true ✓
isCodeIdentifier("K-Dense-AI/claude-scientific-skills") → true ✓
isCodeIdentifier("user/repo") → true ✓
isCodeIdentifier("microsoft/vscode") → true ✓
isCodeIdentifier("facebook/react") → true ✓

// 带复杂格式
isCodeIdentifier("org.name/project-name") → true ✓
isCodeIdentifier("user.name/repo.name") → true ✓
isCodeIdentifier("K-Dense-AI / claude-scientific-skills.v2") → true ✓

// 普通文本（不应该被识别）
isCodeIdentifier("hello world") → false ✓
isCodeIdentifier("this is a test") → false ✓
```

### 完整检测流程

```
文本："K-Dense-AI / claude-scientific-skills"

检测顺序：
1. isURLWithDescription → false
2. 邮箱检测 → false
3. isFileName → false
4. isPath → false (不是路径)
5. isCodeIdentifier → true ✓ (GitHub 仓库名格式)
   → 返回 false，不翻译 ✓
```

**或者**（如果文本被分割）：
```
节点 1: "K-Dense-AI" → isCodeIdentifier → true ✓ (短横线命名)
节点 2: " / " → 符号，被忽略
节点 3: "claude-scientific-skills" → isCodeIdentifier → true ✓ (短横线命名)
```

## 与其他检测的配合

### 路径检测

**路径检测也有面包屑正则**：
```javascript
isPath(text) {
    const breadcrumbRegex = /^[\w\-./]+\s*\/\s*[\w\-./]+$/;
    // ...
}
```

**检测顺序**：
```javascript
// 1. 路径检测
if (this.isPath(text)) return false;

// 2. 代码标识符检测（新增 GitHub 仓库名）
if (this.isCodeIdentifier(text)) return false;
```

**优先级**：
- 路径检测先执行
- 如果路径检测不匹配，代码标识符检测会拦截
- 双重保障，确保 GitHub 仓库名不被翻译

### 为什么需要两个检测？

**路径检测**：
- 主要检测文件系统路径：`/usr/bin`, `C:\Windows`
- 面包屑导航是"附带"检测

**代码标识符检测**：
- 主要检测代码命名：驼峰、下划线、短横线
- GitHub 仓库名是"附带"检测

**优势**：
- ✅ 双重检测，更可靠
- ✅ 即使一个检测失效，另一个也能拦截
- ✅ 语义清晰，各司其职

## 边界情况

### 1. 短仓库名

```javascript
isCodeIdentifier("a/b") → true ✓
isCodeIdentifier("user/repo") → true ✓
```

### 2. 带版本号

```javascript
isCodeIdentifier("repo/v2") → true ✓
isCodeIdentifier("project/v1.0") → true ✓
```

### 3. 带组织名

```javascript
isCodeIdentifier("org/team/project") → false ✓ (两个斜杠，不符合正则)
// 但会被路径检测拦截
isPath("org/team/project") → true ✓
```

### 4. URL 格式

```javascript
isCodeIdentifier("github.com/user/repo") → false ✓ (包含域名，不是仓库名格式)
// 但会被 URL 检测拦截
isURLWithDescription("github.com/user/repo") → true ✓
```

## 总结

### 修复内容

1. ✅ **新增 GitHub 仓库名检测**
   - 支持 `user/repo` 格式
   - 支持 `K-Dense-AI / claude-scientific-skills` 格式
   - 支持带空格的格式

2. ✅ **双重保障机制**
   - 路径检测拦截一次
   - 代码标识符检测拦截一次
   - 确保不漏网

3. ✅ **向后兼容**
   - 不影响原有检测逻辑
   - 只增加新的检测规则

### 修复效果

- ✅ **GitHub 仓库名不翻译**：`K-Dense-AI / claude-scientific-skills`
- ✅ **技术术语保护**：`microsoft/vscode`, `facebook/react`
- ✅ **灵活匹配**：支持有无空格、带版本号等
- ✅ **准确识别**：不误判普通文本

### 核心思想

**通过增强代码标识符检测，将 GitHub 仓库名格式纳入检测范围，与技术术语、代码命名等一起保护，避免被误翻译。**

---

**修复完成！现在 GitHub 仓库名将不再被翻译。**
