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

        async callOllama(messages, model) {
            const config = this.getCurrentConfig();
            const targetModel = model || config.defaultModel;
            const endpoint = config.ollamaEndpoint;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: targetModel,
                    messages: messages,
                    stream: false,
                    temperature: 0.3
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
        }

        async translateTextRequest(text) {
            const config = this.getCurrentConfig();
            const chunks = this.splitTextIntoChunks(text, config.maxChunkSize);
            const results = [];
            const lang = config.targetLanguage || '中文';
            for (const chunk of chunks) {
                const messages = this.buildTranslationMessages(chunk, lang);
                const result = await this.callOllama(messages);
                results.push(this.cleanTranslationResult(result));
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

            const systemPrompt = `You are a professional ${lang} native translator.
Translate ONLY the text between <text> and </text>.
Do NOT translate or repeat any instruction outside <text>.

Rules:
1. Output only the translated text.
2. Keep the same number of paragraphs and formatting.
3. Preserve HTML tags and keep them in correct positions.
4. Keep proper nouns, code, and non-translatable content unchanged.
5. If input contains "%%", use "%%" as paragraph separators in output; otherwise do not add "%%".

Output:
- single paragraph → output translation only
- multi paragraph → use "%%" between paragraphs

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
