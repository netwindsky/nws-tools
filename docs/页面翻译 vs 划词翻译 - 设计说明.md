# 翻译功能：页面翻译 vs 划词翻译

## 核心设计理念

**页面翻译和划词翻译是两种完全不同的功能，应该使用不同的过滤规则。**

---

## 一、功能定位对比

| 维度 | 页面翻译 | 划词翻译 |
|------|---------|---------|
| **用户意图** | 批量翻译网页内容 | 查询特定单词/短语 |
| **主动性** | 被动接收（自动翻译） | 主动选择（用户指定） |
| **翻译单位** | 段落、句子、Block | 单词、短语、句子 |
| **过滤策略** | 严格过滤（避免干扰） | 宽松过滤（尊重选择） |

---

## 二、过滤规则对比

### 页面翻译（严格过滤）

**目标**：只翻译有意义的自然语言内容，避免翻译技术内容干扰用户

**过滤内容**：
1. ✅ **技术内容**
   - 文件名：`README.md`、`Dockerfile`
   - URL：`https://github.com`、`example.com`
   - 邮箱：`user@example.com`
   - 路径：`/usr/bin`、`C:\Windows`

2. ✅ **代码相关内容**
   - 代码标识符：`TranslationUtils`、`shouldTranslateText`
   - 命令：`npm install`、`git commit`
   - 变量名：`maxChunkSize`、`API_ENDPOINT`

3. ✅ **无意义内容**
   - 单个英文单词：`Hello`、`Click`
   - 纯符号：`...`、`!!!`
   - 乱码：`asdfghjkl`

4. ✅ **语言判断**
   - 主要是中文的内容不翻译
   - 只翻译 2 个单词以上的英文短语

**示例**：
```
✅ 会翻译：
- "Open Source Flash SWF decompiler and editor."
- "Extract resources, convert SWF to FLA."
- "Works with Java on Windows, Linux and macOS."

❌ 不翻译：
- "README.md"
- "github.com"
- "TranslationUtils"
- "npm install"
- "Hello"（单个单词）
```

---

### 划词翻译（宽松过滤）

**目标**：尊重用户选择，用户想翻译什么就翻译什么

**过滤内容**：
1. ❌ **只过滤明显的无意义内容**
   - 纯符号：`...`、`!!!`
   - 乱码：`aaaaaa`
   - 空内容

2. ✅ **不过滤技术内容**（用户可能就想查这些）
   - 文件名：`README.md` ✓ 可以翻译
   - URL：`github.com` ✓ 可以翻译
   - 代码：`TranslationUtils` ✓ 可以翻译
   - 命令：`npm install` ✓ 可以翻译
   - 单个单词：`Hello` ✓ 可以翻译

**示例**：
```
✅ 会翻译（用户选择的）：
- "README.md" → 用户想知道什么意思
- "github.com" → 用户想了解这个域名
- "TranslationUtils" → 用户想查这个类名
- "npm" → 用户想知道这个缩写
- "Hello" → 用户想查这个单词
- "Open Source Flash SWF decompiler..." → 整段翻译
```

---

## 三、实现架构

### 代码结构

```
TranslationUtils.js
├── shouldTranslateText(text)           // 页面翻译入口（严格）
│   └── _shouldTranslateTextForPage(text)
│       ├── 过滤 URL、邮箱、文件名
│       ├── 过滤代码标识符、命令
│       ├── 过滤无意义内容
│       └── 语言判断（中文不翻译、英文 2 词以上）
│
└── shouldTranslateSelectedText(text)   // 划词翻译入口（宽松）
    ├── 只过滤无意义内容
    └── 尊重用户选择
```

### 调用关系

```javascript
// PageManager.js - 页面翻译
if (!this.utils.shouldTranslateText(fullText)) return;
// 使用严格过滤

// SelectionManager.js - 划词翻译
if (!this.utils.shouldTranslateSelectedText(text)) return;
// 使用宽松过滤
```

---

## 四、使用场景对比

### 场景 1：浏览技术文档

**页面翻译**：
```
原文：
"See README.md for installation instructions.
 Visit https://github.com/user/repo for source code.
 Use 'npm install package-name' to install."

翻译后：
"See README.md for installation instructions.（不翻译）
 Visit https://github.com/user/repo for source code.（不翻译）
 使用'npm install package-name'进行安装。（只翻译自然语言部分）"
```

**划词翻译**：
```
用户选中 "README.md" → 翻译：README 文档文件
用户选中 "npm install" → 翻译：npm 安装命令
用户选中 "github.com" → 翻译：GitHub 网站
```

---

### 场景 2：浏览代码仓库

**页面翻译**：
```
原文：
"TranslationUtils - A utility class for translation.
 Methods: shouldTranslateText, normalizeText.
 Location: js/modules/features/translation/"

翻译后：
"TranslationUtils - 翻译工具类。（不翻译类名）
 Methods: shouldTranslateText, normalizeText.（不翻译方法名）
 位置：js/modules/features/translation/（不翻译路径）"
```

**划词翻译**：
```
用户选中 "TranslationUtils" → 翻译：翻译工具类
用户选中 "shouldTranslateText" → 翻译：应该翻译文本
用户选中 "js/modules/features/translation/" → 翻译：路径说明
```

---

### 场景 3：浏览普通网页

**页面翻译**：
```
原文：
"Open Source Flash SWF decompiler and editor.
 Extract resources, convert SWF to FLA, edit ActionScript.
 Works with Java on Windows, Linux and macOS."

翻译后：
"开源 Flash SWF 反编译器和编辑器。
 提取资源，转换 SWF 为 FLA，编辑 ActionScript。
 支持 Java，可在 Windows、Linux 和 macOS 上运行。"
```

**划词翻译**：
```
用户选中任意单词/短语 → 立即翻译
用户选中 "SWF" → 翻译：Shockwave Flash 格式
用户选中 "F LA" → 翻译：Flash 源文件格式
```

---

## 五、为什么之前设计错误？

### 错误做法

**之前**：页面翻译和划词翻译使用**同一个规则** `shouldTranslateText()`

**问题**：
1. ❌ 页面翻译时，长句子包含域名被误判为 URL 不翻译
2. ❌ 划词翻译时，用户想查 `README.md` 被过滤掉
3. ❌ 无法兼顾两种场景的需求

### 正确做法

**现在**：页面翻译和划词翻译使用**不同的规则**

- 页面翻译：`_shouldTranslateTextForPage()` - 严格过滤
- 划词翻译：`shouldTranslateSelectedText()` - 宽松过滤

**优势**：
1. ✅ 页面翻译智能过滤技术内容
2. ✅ 划词翻译尊重用户选择
3. ✅ 两种场景互不干扰

---

## 六、测试用例

### 页面翻译测试

```javascript
// 应该翻译
shouldTranslateText("Open Source Flash SWF decompiler and editor.") → true ✓
shouldTranslateText("Extract resources, convert SWF to FLA.") → true ✓

// 不应该翻译
shouldTranslateText("README.md") → false ✓
shouldTranslateText("github.com") → false ✓
shouldTranslateText("TranslationUtils") → false ✓
shouldTranslateText("npm install") → false ✓
shouldTranslateText("Hello") → false ✓ (单个单词)
```

### 划词翻译测试

```javascript
// 应该翻译（用户选择的）
shouldTranslateSelectedText("README.md") → true ✓
shouldTranslateSelectedText("github.com") → true ✓
shouldTranslateSelectedText("TranslationUtils") → true ✓
shouldTranslateSelectedText("npm install") → true ✓
shouldTranslateSelectedText("Hello") → true ✓
shouldTranslateSelectedText("Open Source Flash SWF decompiler...") → true ✓

// 不应该翻译（无意义内容）
shouldTranslateSelectedText("...") → false ✓
shouldTranslateSelectedText("aaaaaa") → false ✓
shouldTranslateSelectedText("") → false ✓
```

---

## 七、总结

### 设计原则

1. **页面翻译**：智能过滤，避免干扰
   - 过滤技术内容
   - 只翻译自然语言
   - 提供流畅的阅读体验

2. **划词翻译**：尊重用户，按需翻译
   - 只过滤无意义内容
   - 用户选择的就是需要的
   - 提供即时的查询体验

### 关键区别

| 方面 | 页面翻译 | 划词翻译 |
|------|---------|---------|
| 过滤策略 | 严格 | 宽松 |
| 技术内容 | 过滤 | 不过滤 |
| 单个单词 | 过滤 | 翻译 |
| 用户体验 | 被动接收 | 主动查询 |

### 未来优化

1. **页面翻译**：
   - 更智能的段落识别
   - 上下文感知的翻译
   - 保持排版格式

2. **划词翻译**：
   - 支持单词发音
   - 显示词典释义
   - 历史记录功能

---

**这是两个完全不同的功能，应该在设计时完全分离！**
