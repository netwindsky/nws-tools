(function() {
    'use strict';

    class SummaryService {
        constructor(options = {}) {
            this.getConfig = typeof options.getConfig === 'function' ? options.getConfig : () => ({});
        }

        async callOllama(messages, model) {
            const config = this.getConfig();
            const targetModel = model || config.defaultModel;
            const endpoint = config.ollamaEndpoint;
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: targetModel,
                        messages: messages,
                        stream: false,
                        temperature: 0.7
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error?.message || response.statusText}`);
                }
                const data = await response.json();

                if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                    return data.choices[0].message.content;
                }

                if (data.response) {
                    return data.response;
                }

                throw new Error('API 返回格式不正确');
            } catch (error) {
                throw error;
            }
        }

        async summarizeContent(content) {
            const config = this.getConfig();
            const lang = config.targetLanguage || '中文';
            const systemPrompt = `你是一位专业的内容分析专家。请根据提供的网页内容，生成一份详尽、专业且结构清晰的总结报告。

要求如下：
1. **语言**：使用${lang}。
2. **结构化输出**：
   - **【标题】**：为内容起一个简洁且具概括性的标题，并以 \`# \` 开头。
   - **【核心摘要】**：用 100-200 字高度概括全文的核心内容和背景。
   - **【关键要素】**：
     - **时间/地点**：明确提到的关键时间节点和地理位置。
     - **主要人物/机构**：涉及的核心人物、组织、公司或政府部门。
   - **【详细内容】**：使用 Markdown 列表分章节详述：
     - 事件的发展脉络或逻辑架构。
     - 核心数据、关键证据或重要论点。
     - 相关的背景信息。
   - **【深度洞察】**：分析该内容的影响力、潜在风险、行业意义或未来趋势。
   - **【总结评价】**：一句话总结全文的最终价值或结论。
3. **格式规范**：必须使用标准的 Markdown 语法（标题、粗体、列表、代码块等），确保排版精美。
4. **风格**：客观严谨，不遗漏重要细节，同时保持逻辑通顺。`;

            const userPrompt = `页面内容如下：\n${content}`;
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ];
            return await this.callOllama(messages);
        }
    }

    if (window.NWSModules) {
        window.NWSModules.SummaryService = SummaryService;
    }
})();
