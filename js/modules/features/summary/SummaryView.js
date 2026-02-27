(function() {
    'use strict';

    class SummaryView {
        constructor(options = {}) {
            this.uiManager = options.uiManager || window.uiManager || null;
            this.safeQuerySelector = options.safeQuerySelector || window.DOMHelper?.safeQuerySelector || null;
            this.sidebar = null;
            this.summaryContent = null;
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
            this.showSummaryInSidebar(summary);
        }

        showSummaryInSidebar(summary) {
            // 获取或创建侧边栏
            let sidebar = document.getElementById('nws-summary-sidebar');
            
            if (!sidebar) {
                sidebar = this.createSummarySidebar();
                document.body.appendChild(sidebar);
            }

            // 更新内容
            const contentEl = sidebar.querySelector('.nws-summary-sidebar-content');
            if (contentEl) {
                contentEl.innerHTML = `<div class="nws-summary-content nws-markdown-content">${this.renderMarkdown(summary)}</div>`;
            }

            // 显示侧边栏
            sidebar.classList.add('nws-summary-sidebar-visible');
            
            // 添加遮罩层点击关闭功能
            this.addOverlayClickHandler(sidebar);
        }

        createSummarySidebar() {
            const sidebar = document.createElement('div');
            sidebar.id = 'nws-summary-sidebar';
            sidebar.className = 'nws-summary-sidebar';
            
            sidebar.innerHTML = `
                <div class="nws-summary-sidebar-overlay"></div>
                <div class="nws-summary-sidebar-panel">
                    <div class="nws-summary-sidebar-header">
                        <div class="nws-summary-sidebar-title">
                            <span class="nws-summary-sidebar-icon">📋</span>
                            <span>页面摘要</span>
                        </div>
                        <div class="nws-summary-sidebar-controls">
                            <button class="nws-summary-sidebar-btn nws-summary-sidebar-close" title="关闭">
                                <svg viewBox="0 0 24 24" width="16" height="16">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="nws-summary-sidebar-content">
                        <div class="nws-summary-placeholder">正在加载摘要...</div>
                    </div>
                </div>
            `;

            // 绑定关闭按钮事件
            const closeBtn = sidebar.querySelector('.nws-summary-sidebar-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.hideSummarySidebar();
                });
            }

            // 绑定ESC键关闭
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.hideSummarySidebar();
                }
            });

            return sidebar;
        }

        addOverlayClickHandler(sidebar) {
            const overlay = sidebar.querySelector('.nws-summary-sidebar-overlay');
            if (overlay) {
                overlay.addEventListener('click', () => {
                    this.hideSummarySidebar();
                });
            }
        }

        hideSummarySidebar() {
            const sidebar = document.getElementById('nws-summary-sidebar');
            if (sidebar) {
                sidebar.classList.remove('nws-summary-sidebar-visible');
            }
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
