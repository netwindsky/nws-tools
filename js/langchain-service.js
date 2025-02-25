/**
 * langchain-service.js
 * 使用 LangChain 和 Ollama 实现页面翻译和总结功能
 */

class LangChainService {
    constructor() {
        this.ollamaEndpoint = 'http://localhost:11434/api/generate';
    }

    /**
     * 调用 Ollama API
     * @param {string} prompt - 提示词
     * @param {string} model - 模型名称
     * @returns {Promise<string>} - API 响应
     */
    async callOllama(prompt, model = 'llama2') {
        try {
            const response = await fetch(this.ollamaEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    prompt,
                    stream: false
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.response;
        } catch (error) {
            console.error('Ollama API 调用失败:', error);
            throw error;
        }
    }

    /**
     * 将文本分块
     * @param {string} text - 要分块的文本
     * @param {number} maxChunkSize - 最大块大小
     * @returns {string[]} - 文本块数组
     */
    splitTextIntoChunks(text, maxChunkSize = 2000) {
        const chunks = [];
        const sentences = text.split(/(?<=[.!?])\s+/);
        let currentChunk = '';

        for (const sentence of sentences) {
            if ((currentChunk + sentence).length <= maxChunkSize) {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
            } else {
                if (currentChunk) chunks.push(currentChunk);
                currentChunk = sentence;
            }
        }

        if (currentChunk) chunks.push(currentChunk);
        return chunks;
    }

    /**
     * 提取页面主要内容
     * @returns {string} - 页面内容
     */
    extractPageContent() {
        // 移除不需要的元素
        const elementsToSkip = [
            'script', 'style', 'noscript', 'iframe', 'nav', 'footer',
            'header', '[role="banner"]', '[role="navigation"]', '[role="complementary"]'
        ];

        const content = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    if (node.parentElement && 
                        elementsToSkip.some(selector => 
                            node.parentElement.matches(selector))) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            }
        );

        while (walker.nextNode()) {
            content.push(walker.currentNode.textContent.trim());
        }

        return content.join(' ').replace(/\s+/g, ' ').trim();
    }

    /**
     * 翻译页面内容
     * @param {string} targetLang - 目标语言
     * @returns {Promise<void>}
     */
    async translatePage(targetLang = '中文') {
        try {
            const content = this.extractPageContent();
            const chunks = this.splitTextIntoChunks(content);
            const translations = [];

            for (const chunk of chunks) {
                const prompt = `请将以下文本翻译成${targetLang}：\n${chunk}`;
                const translation = await this.callOllama(prompt);
                translations.push(translation);
            }

            // 创建翻译结果显示层
            const translationOverlay = document.createElement('div');
            translationOverlay.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 80%;
                height: 80%;
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 0 10px rgba(0,0,0,0.3);
                z-index: 10000;
                overflow-y: auto;
            `;

            translationOverlay.innerHTML = `
                <div style="position: sticky; top: 0; background: white; padding: 10px 0;">
                    <button onclick="this.parentElement.parentElement.remove()" 
                            style="float: right; padding: 5px 10px; cursor: pointer;">
                        关闭
                    </button>
                    <h2>页面翻译结果</h2>
                </div>
                <div style="margin-top: 20px;">
                    ${translations.join('\n\n')}
                </div>
            `;

            document.body.appendChild(translationOverlay);

        } catch (error) {
            console.error('翻译失败:', error);
            alert('翻译失败，请检查 Ollama 服务是否正在运行');
        }
    }

    /**
     * 生成页面内容摘要
     * @returns {Promise<void>}
     */
    async summarizePage() {
        try {
            const content = this.extractPageContent();
            const prompt = `请对以下内容进行摘要总结（控制在300字以内）：\n${content}`;
            const summary = await this.callOllama(prompt);

            // 创建摘要显示层
            const summaryOverlay = document.createElement('div');
            summaryOverlay.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 60%;
                max-height: 80%;
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 0 10px rgba(0,0,0,0.3);
                z-index: 10000;
                overflow-y: auto;
            `;

            summaryOverlay.innerHTML = `
                <div style="position: sticky; top: 0; background: white; padding: 10px 0;">
                    <button onclick="this.parentElement.parentElement.remove()" 
                            style="float: right; padding: 5px 10px; cursor: pointer;">
                        关闭
                    </button>
                    <h2>页面摘要</h2>
                </div>
                <div style="margin-top: 20px;">
                    ${summary}
                </div>
            `;

            document.body.appendChild(summaryOverlay);

        } catch (error) {
            console.error('生成摘要失败:', error);
            alert('生成摘要失败，请检查 Ollama 服务是否正在运行');
        }
    }
}

// 导出服务实例
const langChainService = new LangChainService();
export default langChainService;