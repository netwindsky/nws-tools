(function() {
    'use strict';

    class ElementHighlighterView {
        constructor(options = {}) {
            this.getConfig = typeof options.getConfig === 'function' ? options.getConfig : () => ({});
            this.getSimplifiedCssPath = typeof options.getSimplifiedCssPath === 'function' ? options.getSimplifiedCssPath : () => '';
            this.onCopySelector = typeof options.onCopySelector === 'function' ? options.onCopySelector : () => {};
            this.onCopyStyle = typeof options.onCopyStyle === 'function' ? options.onCopyStyle : () => {};
            this.onSaveAsMD = typeof options.onSaveAsMD === 'function' ? options.onSaveAsMD : () => {};
            this.onConvertToVue = typeof options.onConvertToVue === 'function' ? options.onConvertToVue : () => {};
            this.safeQuerySelector = options.safeQuerySelector || window.DOMHelper?.safeQuerySelector || null;
            this.tooltip = null;
            this.styleInfo = null;
            this.buttonGroup = null;
            this.styleManager = options.styleManager || null;
            this.moduleName = options.moduleName || '';
        }

        highlightElement(element) {
            const previousHighlight = this.safeQuerySelector ? this.safeQuerySelector('.nws-element-highlight') : null;
            if (previousHighlight) {
                previousHighlight.remove();
            }

            const rect = element.getBoundingClientRect();
            const highlight = document.createElement('div');
            highlight.className = 'nws-element-highlight';
            highlight.style.cssText = `
                position: fixed;
                top: ${rect.top}px;
                left: ${rect.left}px;
                width: ${rect.width}px;
                height: ${rect.height}px;
                border: 2px solid ${this.getConfig().highlightColor};
                background-color: ${this.getConfig().highlightColor}20;
                pointer-events: none;
                z-index: 999998;
                box-sizing: border-box;
            `;

            document.body.appendChild(highlight);
        }

        showTooltip(element, x, y) {
            if (!this.tooltip) return;

            const tagName = element.tagName.toLowerCase();
            const className = element.className ? `.${element.className.split(' ').join('.')}` : '';
            const id = element.id ? `#${element.id}` : '';
            const text = element.textContent ? element.textContent.substring(0, 50) + '...' : '';

            this.tooltip.innerHTML = '';
            
            const tagDiv = document.createElement('div');
            tagDiv.className = 'nws-tooltip-tag';
            tagDiv.textContent = `<${tagName}${id}${className}>`;
            this.tooltip.appendChild(tagDiv);
            
            const pathDiv = document.createElement('div');
            pathDiv.className = 'nws-tooltip-path';
            pathDiv.textContent = this.getSimplifiedCssPath(element);
            this.tooltip.appendChild(pathDiv);
            
            if (text) {
                const textDiv = document.createElement('div');
                textDiv.className = 'nws-tooltip-text';
                textDiv.textContent = text;
                this.tooltip.appendChild(textDiv);
            }

            const tooltipRect = this.tooltip.getBoundingClientRect();
            let left = x + 10;
            let top = y + 10;

            if (left + tooltipRect.width > window.innerWidth) {
                left = x - tooltipRect.width - 10;
            }
            if (top + tooltipRect.height > window.innerHeight) {
                top = y - tooltipRect.height - 10;
            }

            this.tooltip.style.left = `${left}px`;
            this.tooltip.style.top = `${top}px`;
            this.tooltip.style.display = 'block';
        }

        hideTooltip() {
            if (this.tooltip) {
                this.tooltip.style.display = 'none';
            }

            const highlight = this.safeQuerySelector ? this.safeQuerySelector('.nws-element-highlight') : null;
            if (highlight) {
                highlight.remove();
            }
        }

        showStyleInfo(element) {
            if (!this.styleInfo) return;

            const computedStyle = window.getComputedStyle(element);
            const importantStyles = [
                'display', 'position', 'width', 'height', 'margin', 'padding',
                'border', 'background-color', 'color', 'font-size', 'font-family'
            ];

            let styleHtml = '<div class="nws-style-title">计算样式</div>';
            importantStyles.forEach(prop => {
                const value = computedStyle.getPropertyValue(prop);
                if (value && value !== 'none' && value !== 'auto') {
                    styleHtml += `<div class="nws-style-item"><span class="nws-style-prop">${prop}:</span> <span class="nws-style-value">${value}</span></div>`;
                }
            });

            this.styleInfo.innerHTML = styleHtml;
            this.styleInfo.style.display = 'block';
        }

        hideStyleInfo() {
            if (this.styleInfo) {
                this.styleInfo.style.display = 'none';
            }
        }

        showButtonGroup(element, x, y) {
            if (!this.buttonGroup) {
                this.createButtonGroup();
            }

            this.buttonGroup.style.left = `${x}px`;
            this.buttonGroup.style.top = `${y}px`;
            this.buttonGroup.style.display = 'block';

            setTimeout(() => {
                this.hideButtonGroup();
            }, 5000);
        }

        hideButtonGroup() {
            if (this.buttonGroup) {
                this.buttonGroup.style.display = 'none';
            }
        }

        createTooltip() {
            this.tooltip = document.createElement('div');
            this.tooltip.className = 'nws-tooltip';
            this.tooltip.style.display = 'none';
            document.body.appendChild(this.tooltip);
        }

        createStyleInfo() {
            this.styleInfo = document.createElement('div');
            this.styleInfo.className = 'nws-style-info';
            this.styleInfo.style.display = 'none';
            document.body.appendChild(this.styleInfo);
        }

        createButtonGroup() {
            this.buttonGroup = document.createElement('div');
            this.buttonGroup.className = 'nws-button-group';
            this.buttonGroup.style.display = 'none';
            
            const copySelectorBtn = document.createElement('button');
            copySelectorBtn.innerHTML = `
                <svg style="width:14px;height:14px;vertical-align:middle;margin-right:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                复制选择器
            `;
            copySelectorBtn.onclick = () => {
                this.onCopySelector();
                this.hideButtonGroup();
            };
            
            const copyStyleBtn = document.createElement('button');
            copyStyleBtn.innerHTML = `
                <svg style="width:14px;height:14px;vertical-align:middle;margin-right:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                复制计算样式
            `;
            copyStyleBtn.onclick = () => {
                this.onCopyStyle();
                this.hideButtonGroup();
            };

            const saveMdBtn = document.createElement('button');
            saveMdBtn.innerHTML = `
                <svg style="width:14px;height:14px;vertical-align:middle;margin-right:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
                保存为 Markdown
            `;
            saveMdBtn.onclick = () => {
                this.onSaveAsMD();
                this.hideButtonGroup();
            };

            const convertVueBtn = document.createElement('button');
            convertVueBtn.innerHTML = `
                <svg style="width:14px;height:14px;vertical-align:middle;margin-right:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                转换为 Vue 组件
            `;
            convertVueBtn.onclick = () => {
                this.onConvertToVue();
                this.hideButtonGroup();
            };
            
            this.buttonGroup.appendChild(copySelectorBtn);
            this.buttonGroup.appendChild(copyStyleBtn);
            this.buttonGroup.appendChild(saveMdBtn);
            this.buttonGroup.appendChild(convertVueBtn);
            document.body.appendChild(this.buttonGroup);
        }

        removeUI() {
            [this.tooltip, this.styleInfo, this.buttonGroup].forEach(element => {
                if (element && element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            });

            const highlight = this.safeQuerySelector ? this.safeQuerySelector('.nws-element-highlight') : null;
            if (highlight) {
                highlight.remove();
            }
        }

        injectStyles() {
            if (!this.styleManager) return;

            const config = this.getConfig();
            const css = `
                .nws-element-highlight {
                    position: absolute;
                    border: 2px solid ${config.highlightColor};
                    background: ${config.highlightColor}20;
                    pointer-events: none;
                    z-index: 9999;
                    transition: all 0.2s ease;
                }
                
                .nws-element-highlight.active {
                    box-shadow: 0 0 10px ${config.highlightColor}40;
                }
                
                .nws-tooltip {
                    position: absolute;
                    background: #333;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-family: monospace;
                    z-index: 10000;
                    max-width: 300px;
                    word-wrap: break-word;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    pointer-events: none;
                }
                
                .nws-tooltip-tag {
                    color: #4CAF50;
                    font-weight: bold;
                    margin-bottom: 4px;
                }
                
                .nws-tooltip-path {
                    color: #2196F3;
                    font-size: 11px;
                    margin-bottom: 4px;
                }
                
                .nws-tooltip-text {
                    color: #FFC107;
                    font-style: italic;
                }
                
                .nws-button-group {
                    position: absolute;
                    display: flex;
                    gap: 8px;
                    z-index: 10001;
                }
                
                .nws-action-btn {
                    background: ${config.highlightColor};
                    color: white;
                    border: none;
                    padding: 6px 10px;
                    border-radius: 4px;
                    font-size: 11px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }
                
                .nws-action-btn:hover {
                    opacity: 0.8;
                    transform: translateY(-1px);
                }
                
                .nws-style-info {
                    position: absolute;
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 16px;
                    font-size: 12px;
                    font-family: monospace;
                    z-index: 10002;
                    max-width: 400px;
                    max-height: 300px;
                    overflow: auto;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
                }
                
                .nws-style-info h4 {
                    margin: 0 0 12px 0;
                    color: ${config.highlightColor};
                    border-bottom: 1px solid #eee;
                    padding-bottom: 8px;
                }
            `;

            this.styleManager.inject(this.moduleName, css, null, {
                priority: 'high',
                cache: true
            });
        }

        destroy() {
            this.removeUI();
        }
    }

    if (window.NWSModules) {
        window.NWSModules.ElementHighlighterView = ElementHighlighterView;
    }
})();
