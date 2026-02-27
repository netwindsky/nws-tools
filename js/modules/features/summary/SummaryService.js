(function() {
    'use strict';

    class SummaryService {
        constructor(options = {}) {
            this.getConfig = typeof options.getConfig === 'function' ? options.getConfig : () => ({});
        }

        async callOllama(messages, model, onStream = null) {
            const config = this.getConfig();
            const targetModel = model || config.defaultModel;
            const endpoint = config.ollamaEndpoint || 'http://localhost:11434/v1/chat/completions';
            const useStream = onStream !== null;
            
            console.log('[SummaryService] 调用 Ollama:', { endpoint, model: targetModel, stream: useStream });
            
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: targetModel,
                        messages: messages,
                        stream: useStream,
                        temperature: 0.7
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[SummaryService] Ollama 返回错误:', response.status, errorText);
                    let errorData = {};
                    try {
                        errorData = JSON.parse(errorText);
                    } catch (e) {}
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error?.message || errorText || response.statusText}`);
                }
                
                // 流式模式处理
                if (useStream && response.body) {
                    return await this.handleStreamResponse(response.body, onStream);
                }
                
                // 非流式模式处理
                const data = await response.json();
                console.log('[SummaryService] Ollama 响应:', data);

                if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                    return data.choices[0].message.content;
                }

                if (data.response) {
                    return data.response;
                }

                throw new Error('API 返回格式不正确: ' + JSON.stringify(data).substring(0, 200));
            } catch (error) {
                console.error('[SummaryService] 调用 Ollama 失败:', error);
                throw error;
            }
        }

        async handleStreamResponse(body, onStream) {
            const reader = body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n').filter(line => line.trim() !== '');
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;
                            
                            try {
                                const parsed = JSON.parse(data);
                                let content = '';
                                
                                // OpenAI 格式
                                if (parsed.choices && parsed.choices[0]?.delta?.content) {
                                    content = parsed.choices[0].delta.content;
                                }
                                // Ollama 原生格式
                                else if (parsed.message?.content) {
                                    content = parsed.message.content;
                                }
                                else if (parsed.response) {
                                    content = parsed.response;
                                }
                                
                                if (content) {
                                    fullContent += content;
                                    onStream(content, fullContent);
                                }
                            } catch (e) {
                                console.warn('[SummaryService] 解析流数据失败:', line, e);
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
            
            return fullContent;
        }

        async summarizeContent(content, onStream = null) {
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
            return await this.callOllama(messages, null, onStream);
        }
    }

    if (window.NWSModules) {
        window.NWSModules.SummaryService = SummaryService;
    }
})();
