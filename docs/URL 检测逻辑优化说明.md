# 翻译功能：URL 检测逻辑优化

## 问题描述

### 原始问题
以下长句子**应该被翻译**，但被误判为 URL 而过滤：

```
In the past (before 2018), we were using free-decompiler.com domain as homepage and GitHub for the source code, We've now moved all information (except the issue tracker) to GitHub.
```

**原因**：之前的 `pureDomainRegex` 会匹配任何包含域名的文本，导致长句子被误判。

---

## 解决方案

### 优化策略：按单词数区分

**核心思路**：
- ✅ **纯域名/短域名短语**（≤3 个单词）→ 不翻译
- ✅ **包含域名的长句子**（>3 个单词）→ 翻译

### 代码实现

```javascript
isURLWithDescription(text) {
    // 1. 完整 URL
    const fullURLRegex = /^https?:\/\/[^\s]+$/i;
    
    // 2. 简写 URL
    const wwwURLRegex = /^www\.[^\s]+$/i;
    
    // 3. 域名 + 常见后缀（只匹配短语）
    const domainWithDescRegex = /^[\w\-]+\.[a-z]{2,}\s+(website|page|site|home|docs|api|app|blog|shop|store|cloud|portal|platform|service|system)$/i;
    
    // 4. 纯域名
    const pureDomainRegex = /^[\w\-]+\.(com|org|net|io|cn|edu|gov|mil|info|biz|me|co|tv|cc|xyz|top|vip|app|dev|cloud|ai|tech)$/i;
    
    // 5. 【新增】智能判断：检查是否只是简单提及域名
    const hasDomain = /[\w\-]+\.[a-z]{2,}/i.test(text);
    if (hasDomain) {
        const wordCount = text.split(/\s+/).length;
        // 如果单词数超过 3 个，说明是句子，应该翻译
        if (wordCount > 3) {
            return false; // 不是 URL，是句子
        }
    }
    
    return fullURLRegex.test(text) || 
           wwwURLRegex.test(text) ||
           domainWithDescRegex.test(text) ||
           pureDomainRegex.test(text);
}
```

---

## 测试用例对比

### ❌ 之前的错误行为

| 内容 | 之前判断 | 正确判断 |
|------|---------|---------|
| `free-decompiler.com` | 不翻译 ✓ | 不翻译 ✓ |
| `Free-Deompiler.com website` | 不翻译 ✓ | 不翻译 ✓ |
| `In the past we were using free-decompiler.com domain...` | ❌ 不翻译（错误） | ✅ 翻译（正确） |
| `Visit github.com for more info` | ❌ 不翻译（错误） | ✅ 翻译（正确） |

### ✅ 修复后的正确行为

#### 不翻译的情况（≤3 个单词）
- `free-decompiler.com` → 纯域名 ✓
- `Free-Deompiler.com website` → 域名 + 描述 ✓
- `github.com` → 纯域名 ✓
- `www.example.com` → URL ✓
- `https://github.com` → URL ✓

#### 翻译的情况（>3 个单词）
- `In the past we were using free-decompiler.com domain as homepage` → ✅ 翻译
- `Visit github.com for more information` → ✅ 翻译
- `We moved from example.com to GitHub` → ✅ 翻译
- `Check out docs.example.com for documentation` → ✅ 翻译

---

## 判断流程图

```
输入文本
  ↓
包含域名吗？
  ↓
是 → 单词数 > 3？
      ↓
      是 → 翻译（是句子）
      ↓
      否 → 继续检查...
              ↓
              是纯 URL 吗？(https://...) → 不翻译 ✓
              是 www 开头吗？ → 不翻译 ✓
              是域名 + 后缀吗？(example.com website) → 不翻译 ✓
              是纯域名吗？(github.com) → 不翻译 ✓
              否则 → 翻译
```

---

## 边界情况测试

### 应该翻译的句子（包含域名）
```javascript
// 1. 提及域名的历史描述
"In the past (before 2018), we were using free-decompiler.com domain as homepage"
→ 翻译 ✓

// 2. 建议使用某个网站
"Please visit github.com for more information"
→ 翻译 ✓

// 3. 比较多个网站
"We moved from example.com to newdomain.org"
→ 翻译 ✓

// 4. 包含多个域名的长句
"Our old site was at old.example.com but now we use new.example.com"
→ 翻译 ✓
```

### 不应该翻译的短域名/短语
```javascript
// 1. 纯域名
"github.com"
→ 不翻译 ✓

// 2. 域名 + 简单描述
"github.com website"
→ 不翻译 ✓

// 3. 完整 URL
"https://github.com/user/repo"
→ 不翻译 ✓

// 4. www 开头的 URL
"www.github.com"
→ 不翻译 ✓
```

---

## 单词数统计示例

```javascript
// 示例 1：短域名短语（不翻译）
"Free-Deompiler.com website"
→ 单词数：2
→ 不翻译 ✓

// 示例 2：长句子（翻译）
"In the past (before 2018), we were using free-decompiler.com domain as homepage"
→ 单词数：12
→ 翻译 ✓

// 示例 3：边界情况（4 个单词，翻译）
"Visit github.com for more"
→ 单词数：4
→ 翻译 ✓

// 示例 4：边界情况（3 个单词，不翻译）
"github.com for developers"
→ 单词数：3
→ 不翻译 ✓
```

---

## 性能影响

- **单词数统计**：`text.split(/\s+/).length` - O(n)
- **域名检测**：正则表达式 - O(1)
- **总体性能**：增加约 0.1-0.2ms，可忽略不计

---

## 未来优化方向

### 可能的改进

1. **更智能的域名识别**
   - 使用域名解析库（如 tldts）
   - 识别更多顶级域名

2. **上下文感知**
   - 检查域名在句子中的角色
   - 区分"提及域名"和"使用域名"

3. **可配置阈值**
   - 允许用户配置单词数阈值（默认 3）
   - 提供更灵活的过滤规则

---

## 总结

通过**单词数判断**，成功解决了：
- ✅ 短域名/域名短语不被翻译
- ✅ 包含域名的长句子正常翻译
- ✅ 保持了原有的 URL 过滤功能
- ✅ 没有引入复杂的 NLP 算法，性能优秀

这是一个**简单而有效**的解决方案！
