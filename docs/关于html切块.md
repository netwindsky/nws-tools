
如果你直接把网页的 `innerHTML` 丢给 LLM，token 会瞬间爆炸，且返回的 HTML 往往会损坏（闭合标签丢失等）。
如果你一个一个 `TextNode`（文本节点）去翻译，会因为缺乏上下文（Context）导致“Word-by-word”的机翻感，而且请求次数过多会卡死浏览器。

**最优雅的解决方案是：基于块级元素（Block-Level）的上下文感知分段 + JSON 批量处理。**

以下是详细的分段切割策略与算法实现。

---

### 核心策略：三层切割法

我们需要像剥洋葱一样处理网页：

1. **第一层：语义块过滤 (Block Filter)**
* 先找到 `<p>`, `<div>`, `<li>`, `<h1>` 等块级元素。
* **目的**：确保翻译是在一个完整的“段落”或“句子”语境下进行的。


2. **第二层：内联文本提取 (Inline Extraction)**
* 在块级元素内部，提取所有的文本节点，但**保持它们的顺序**。
* **目的**：解决 `I <b>love</b> coding` 这种被标签打断的句子。


3. **第三层：批量打包 (Batching)**
* 将提取出的文本组装成 JSON 数组，一次性发给后台。
* **目的**：减少 HTTP 请求开销，利用 GPU 并行推理能力。



---

### 详细算法实现步骤

#### 1. 定义“合法容器”和“黑名单”

首先，告诉程序哪些地方不能碰。

```javascript
// 那些绝对不能翻译的标签
const BLACKLIST_TAGS = new Set([
  'SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SVG', 'IMG'
]);

// 块级元素特征（用于判断一段话的结束）
const BLOCK_TAGS = new Set([
  'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'SECTION', 'ARTICLE'
]);

```

#### 2. 核心分段器 (Segmenter)

这是最关键的代码逻辑。我们需要遍历 DOM，收集文本节点，并将它们归类到同一个“请求包”中。

**技术难点解决：** 假设 HTML 是 `<p>Hello <b>World</b>!</p>`。
DOM 树里有三个文本节点：`"Hello "`, `"World"`, `"!"`。
如果我们分别翻译，结果可能是 `"你好 "`, `"世界"`, `"！"`。
但如果我们把它们放在一个 JSON 数组里发给 LLM：`["Hello ", "World", "!"]`，并告诉 LLM 这是一个连续的句子，LLM 就能利用上下文翻译得更准确。

**代码实现 (`content.js` 的核心逻辑):**

```javascript
class DomSegmenter {
  constructor() {
    this.batchSize = 10; // 每次发送给 LLM 的文本节点数量（或者按字符数累计）
    this.buffer = [];    // 待发送的文本内容
    this.nodeRef = [];   // 对应的 DOM 节点引用（为了翻译回来后能找到家）
  }

  // 入口：处理整个页面或某个区域
  process(rootElement) {
    // 使用 TreeWalker 高效遍历
    const walker = document.createTreeWalker(
      rootElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // 1. 排除空文本
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          // 2. 排除黑名单标签
          let parent = node.parentNode;
          while (parent && parent !== rootElement) {
            if (BLACKLIST_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
            // 如果父元素设置了不翻译属性 (例如 class="no-translate")
            if (parent.classList && parent.classList.contains('notranslate')) return NodeFilter.FILTER_REJECT;
            parent = parent.parentNode;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      this.addToBuffer(node);
    }
    
    // 处理剩余的缓冲区
    this.flush();
  }

  addToBuffer(node) {
    const text = node.nodeValue;
    
    // 简单的长度过滤，太短的无意义字符不翻（除非是菜单项）
    if (text.length < 2 && !text.match(/[a-zA-Z]/)) return;

    this.buffer.push(text);
    this.nodeRef.push(node);

    // 缓冲区满了（比如积攒了 10 段话），就发射一次
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    }
  }

  flush() {
    if (this.buffer.length === 0) return;

    // 深拷贝当前的数据，因为我们要清空 buffer 为下一次做准备
    const textsToSend = [...this.buffer];
    const nodesToUpdate = [...this.nodeRef];

    // 清空缓冲区
    this.buffer = [];
    this.nodeRef = [];

    // 发送给 Background script
    chrome.runtime.sendMessage({
      action: "batch_translate",
      texts: textsToSend
    }, (response) => {
      if (response && response.status === "success") {
        this.applyTranslations(nodesToUpdate, response.translatedTexts);
      }
    });
  }

  applyTranslations(nodes, translatedTexts) {
    // 这里的数组下标是一一对应的，这非常关键
    nodes.forEach((node, index) => {
      const translation = translatedTexts[index];
      if (translation) {
        // 【核心操作】
        // 模式1：直接替换
        // node.nodeValue = translation; 
        
        // 模式2：双语对照 (推荐)
        this.insertBilingual(node, translation);
      }
    });
  }

  insertBilingual(node, translation) {
    const parent = node.parentNode;
    // 创建一个特定样式的容器
    const transSpan = document.createElement('span');
    transSpan.className = 'ai-trans-result'; // 在 CSS 里定义样式
    transSpan.innerText = ` ${translation} `;
    
    if (node.nextSibling) {
      parent.insertBefore(transSpan, node.nextSibling);
    } else {
      parent.appendChild(transSpan);
    }
  }
}

```

---

#### 3. 后台 Prompt 设计 (Background.js)

这是分段切割成功的另一半关键。你需要设计一个能处理 **JSON Array** 的 Prompt。

**为什么用 JSON Array？**
因为它可以完美保持输入和输出的**数量一致**和**顺序一致**。

```javascript
// background.js

async function handleBatchTranslate(texts) {
  // texts 是一个字符串数组: ["Hello", "World", "This is a test."]
  
  const systemPrompt = `
    You are a professional translator engine. 
    You will receive a JSON array of strings. 
    Translate each string into Simplified Chinese.
    IMPORTANT rules:
    1. Return ONLY a JSON array of strings.
    2. Maintain the exact same order and number of elements.
    3. Do not combine sentences.
    4. Do not translate code fragments or variable names.
    5. No markdown, no explanations. Just the JSON.
  `;

  const userPrompt = JSON.stringify(texts);

  // 调用 Ollama
  const responseText = await callOllamaAPI(systemPrompt, userPrompt);
  
  // 解析结果
  try {
    // 有时候 LLM 会抽风在外面加 Markdown 代码块，需要清洗
    const cleanJson = responseText.replace(/```json|```/g, '').trim();
    const translatedArray = JSON.parse(cleanJson);
    return translatedArray;
  } catch (e) {
    console.error("LLM JSON 解析失败", e);
    return texts; // 失败时返回原文，防止报错
  }
}

```

---

### 进阶挑战：如何处理跨节点的长难句？

上述方案能解决 90% 的问题，但有一个边缘情况：
HTML: `<p>This is a <b>very</b> important sentence.</p>`
上述算法会拆成：`["This is a ", "very", " important sentence."]`

LLM 可能会翻译成：`["这是一个", "非常", "重要的句子。"]`
拼起来：`这是一个<b>非常</b>重要的句子。` -> **完美！**

**但是**，如果断句很奇怪：
HTML: `<p>The US <b>Department</b> of State</p>`
LLM 翻译：`["美国", "部门", "的状态"]`
拼起来：`美国<b>部门</b>的状态` -> **错误**（应该是“美国国务院”）。

**高级优化方案 (V2.0 建议)：**

如果想要极致的翻译效果，需要引入 **Placeholder (占位符) 机制**。

1. **分段逻辑修改**：不再遍历 TextNode，而是遍历 **Block Element (如 `<p>`)**。
2. **内容提取**：获取 `<p>` 的 `innerHTML`。
3. **占位符替换**：将标签替换为特殊标记。
* 原文: `The US <b>Department</b> of State`
* 发送给 LLM: `The US <t0>Department</t0> of State`


4. **Prompt 修改**：告诉 LLM 保留 `<t0>` 标签。
* LLM 返回: `美国<t0>国务院</t0>`


5. **还原**：将 `<t0>` 还原为 `<b>`。

**建议：**
对于个人开发的插件，**优先使用第一种“JSON 数组批量 TextNode”方案**。虽然处理被标签切断的专有名词能力稍弱，但它的**稳定性高、实现简单、且不会破坏网页复杂的 DOM 事件绑定**。

### 总结关键点

1. **不要发碎字符串**：一定要打包（Batching），建议 10-20 个节点包一次。
2. **使用 JSON 协议**：输入数组，要求输出数组，依靠数组下标来做“译文-原文”的映射。
3. **黑名单过滤**：千万别翻译 `<script>` 或 `<pre>` 里的代码，否则网页功能会挂。
4. **TreeWalker**：使用 JS 原生的 `TreeWalker` API 比递归遍历 DOM 快得多。