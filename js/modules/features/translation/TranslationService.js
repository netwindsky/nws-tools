(function() {
    'use strict';

    class TranslationService {
        constructor(options = {}) {
            this.getConfig = typeof options.getConfig === 'function'
                ? options.getConfig
                : () => options.config || {};
            this.fallbackTranslate = typeof options.translateText === 'function'
                ? options.translateText
                : null;
        }

        getCurrentConfig() {
            return (this.getConfig && this.getConfig()) || {};
        }

        splitTextIntoChunks(text, maxChunkSize) {
            const config = this.getCurrentConfig();
            const size = maxChunkSize || config.maxChunkSize;
            const chunks = [];
            let sentences = [];
            if (typeof Intl !== 'undefined' && Intl.Segmenter) {
                const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
                sentences = Array.from(segmenter.segment(text)).map((seg) => seg.segment);
            } else {
                sentences = text.split(/(?<=[.!?。！？])\s+/);
            }
            let currentChunk = '';

            for (const sentence of sentences) {
                if ((currentChunk + sentence).length <= size) {
                    currentChunk += (currentChunk ? ' ' : '') + sentence;
                } else {
                    if (currentChunk) chunks.push(currentChunk);
                    currentChunk = sentence;
                }
            }

            if (currentChunk) chunks.push(currentChunk);
            return chunks;
        }

        async callOllama(messages, model, onStream = null) {
            const config = this.getCurrentConfig();
            const targetModel = model || config.defaultModel;
            const endpoint = config.ollamaEndpoint;
            const useStream = onStream !== null;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: targetModel,
                    messages: messages,
                    stream: useStream,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error?.message || response.statusText}`);
            }

            // 流式模式处理
            if (useStream && response.body) {
                return await this.handleStreamResponse(response.body, onStream);
            }

            // 非流式模式处理
            const data = await response.json();

            if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                return data.choices[0].message.content;
            }

            if (data.response) {
                return data.response;
            }

            throw new Error('API 返回格式不正确');
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
                                console.warn('[TranslationService] 解析流数据失败:', line, e);
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }

            return fullContent;
        }

        async translateTextRequest(text, onStream = null) {
            const config = this.getCurrentConfig();
            const chunks = this.splitTextIntoChunks(text, config.maxChunkSize);
            const results = [];
            const lang = config.targetLanguage || '中文';
            
            for (const chunk of chunks) {
                const messages = this.buildTranslationMessages(chunk, lang);
                let chunkResult = '';
                
                if (onStream) {
                    // 流式模式
                    const chunkOnStream = (content, fullContent) => {
                        chunkResult = fullContent;
                        onStream(content, fullContent);
                    };
                    chunkResult = await this.callOllama(messages, null, chunkOnStream);
                } else {
                    // 非流式模式
                    chunkResult = await this.callOllama(messages);
                }
                
                results.push(this.cleanTranslationResult(chunkResult));
            }
            
            return results.join(' ');
        }

        cleanTranslationResult(text) {
            if (!text) return '';

            let cleaned = String(text);

            const tagMatch = cleaned.match(/<text>([\s\S]*?)<\/text>/i);
            if (tagMatch) {
                cleaned = tagMatch[1];
            } else {
                cleaned = cleaned.replace(/<\/?text>/gi, '');
            }

            cleaned = cleaned.replace(/```[a-z]*\n?|```/gi, '');

            cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

            return cleaned;
        }

        async translateTextBatch(texts) {
            if (!Array.isArray(texts) || texts.length === 0) return [];
            const config = this.getCurrentConfig();
            const lang = config.targetLanguage || '中文';
            const systemPrompt = `You are a professional ${lang} translator engine.
You will receive a JSON array of strings.
Translate each string into ${lang}.
IMPORTANT rules:
1. Return ONLY a JSON array of strings.
2. Maintain the exact same order and number of elements.
3. Do not merge or split sentences.
4. Preserve inline formatting intent; do not add "%%".
5. Do not translate code fragments or variable names.`;
            const userPrompt = JSON.stringify(texts);
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ];
            const raw = await this.callOllama(messages);
            const parsed = this.parseJsonArrayFromModel(raw);
            if (parsed && Array.isArray(parsed) && parsed.length === texts.length) {
                return parsed;
            }
            if (this.fallbackTranslate) {
                const fallbacks = await Promise.all(texts.map((text) => this.fallbackTranslate(text)));
                return fallbacks;
            }
            return texts.map((text) => String(text));
        }

        parseJsonArrayFromModel(text) {
            if (!text) return null;
            const cleaned = this.cleanTranslationResult(text);
            try {
                const arr = JSON.parse(cleaned);
                return Array.isArray(arr) ? arr : null;
            } catch (e) {
                return null;
            }
        }

        buildTranslationMessages(text, lang) {
            const prepared = this.prepareTextForPrompt(text);
            const outputMode = prepared.hasMulti ? 'multi' : 'single';
            const hasNwsTags = text.includes('<nws-text');

            let systemPrompt = `You are a professional ${lang} native translator.
Translate ONLY the text between <text> and </text>.
Do NOT translate or repeat any instruction outside <text>.

Rules:
1. Output in markdown format. Use **bold**, *italic*, lists, and other markdown syntax when appropriate.
2. Keep the same number of paragraphs and formatting.
3. Preserve HTML tags and keep them in correct positions.
4. Keep proper nouns, code, and non-translatable content unchanged.
5. If input contains "%%", use "%%" as paragraph separators in output; otherwise do not add "%%".`;

            if (hasNwsTags) {
                systemPrompt += `
6. CRITICAL: The input contains <nws-text id="..."> tags. You MUST preserve these tags EXACTLY as they are (including IDs). Translate ONLY the content inside the tags.

Example:
Input: <nws-text id="1">Hello world</nws-text>
Output: <nws-text id="1">你好世界</nws-text>`;
            }

            systemPrompt += `

Output:
- Use markdown format for output
- Single paragraph → output translation only
- Multi paragraph → use "%%" between paragraphs

Mode: ${outputMode}`;

            const userPrompt = `<text>
${prepared.text}
</text>`;

            return [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ];
        }

        prepareTextForPrompt(text) {
            const normalized = (text || '').replace(/\r\n/g, '\n').trim();
            const hasSeparator = normalized.includes('%%');
            const hasParagraphs = /\n{2,}/.test(normalized);
            if (hasSeparator) {
                return { text: normalized, hasMulti: true };
            }
            if (hasParagraphs) {
                return { text: normalized.replace(/\n{2,}/g, '\n%%\n'), hasMulti: true };
            }
            return { text: normalized, hasMulti: false };
        }
    }

    if (window.NWSModules) {
        window.NWSModules.TranslationService = TranslationService;
    }
})();
