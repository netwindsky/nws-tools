(function() {
    'use strict';

    class SummaryView {
        constructor(options = {}) {
            this.uiManager = options.uiManager || window.uiManager || null;
            this.safeQuerySelector = options.safeQuerySelector || window.DOMHelper?.safeQuerySelector || null;
        }

        createLoadingOverlay(text, icon) {
            if (!this.uiManager || typeof this.uiManager.createLoadingOverlay !== 'function') {
                return null;
            }
            const overlay = this.uiManager.createLoadingOverlay(text, icon);
            document.body.appendChild(overlay);
            const progressBar = this.safeQuerySelector ? this.safeQuerySelector('.nws-progress-fill', overlay) : null;
            const progressText = this.safeQuerySelector ? this.safeQuerySelector('.nws-progress-text', overlay) : null;
            return { overlay, progressBar, progressText };
        }

        updateProgress(state, width, text) {
            if (!state) return;
            if (state.progressBar && width) {
                state.progressBar.style.width = width;
            }
            if (state.progressText && text) {
                state.progressText.textContent = text;
            }
        }

        removeLoadingOverlay(state) {
            if (state && state.overlay) {
                state.overlay.remove();
            }
        }

        showSummary(summary) {
            if (!this.uiManager || typeof this.uiManager.createModernModal !== 'function') {
                return;
            }
            const summaryOverlay = this.uiManager.createModernModal(
                '页面摘要',
                '📋',
                `<div class="nws-summary-content nws-markdown-content">${this.renderMarkdown(summary)}</div>`
            );
            document.body.appendChild(summaryOverlay);
        }

        renderMarkdown(markdown) {
            let html = markdown
                .replace(/<thinking>([\s\S]*?)<\/thinking>/g, '<span class="nws-think-content">$1</span>');

            html = html
                .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                .replace(/^\s*[-*+]\s+(.*)$/gm, '<li>$1</li>')
                .replace(/((<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>')
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>');

            html = '<p>' + html + '</p>';
            return html.replace(/<p><\/p>/g, '')
                       .replace(/<p>(<h[1-6]>|<ul>|<pre>|<span class="nws-think-content">)/g, '$1')
                       .replace(/(<\/h[1-6]>|<\/ul>|<\/pre>|<\/span>)<\/p>/g, '$1');
        }
    }

    if (window.NWSModules) {
        window.NWSModules.SummaryView = SummaryView;
    }
})();
