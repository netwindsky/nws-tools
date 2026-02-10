/**
 * SelectionManager.js - 划词翻译管理器
 * 负责处理鼠标划词事件、调用翻译服务并控制 Tooltip 显示
 */

(function() {
    'use strict';

    class SelectionManager {
        constructor(moduleInstance) {
            this.module = moduleInstance;
            
            if (window.NWSModules?.TranslationUtils) {
                this.utils = new window.NWSModules.TranslationUtils(() => this.module.config);
            } else {
                console.error('[SelectionManager] TranslationUtils missing');
                this.utils = {
                    normalizeText: t => t,
                    shouldTranslateText: () => false,
                    isSkippableElement: () => true
                };
            }
            
            this.view = this.module.view;
            this.service = this.module.service;
            
            this.selectionListener = null;
            this.isActive = false;
        }

        enable() {
            if (this.isActive) return;
            this.isActive = true;
            
            // 绑定事件
            this.selectionListener = this.handleSelectionMouseUp.bind(this);
            const safeAdd = window.NWSModules?.utils?.safeAddEventListener || ((el, ev, h, opt) => el.addEventListener(ev, h, opt));
            safeAdd(document, 'mouseup', this.selectionListener, true);
        }

        disable() {
            if (!this.isActive) return;
            this.isActive = false;
            
            // 解绑事件
            if (this.selectionListener) {
                const safeRemove = window.NWSModules?.utils?.safeRemoveEventListener || ((el, ev, h, opt) => el.removeEventListener(ev, h, opt));
                safeRemove(document, 'mouseup', this.selectionListener, true);
                this.selectionListener = null;
            }
            
            // 隐藏 UI
            this.view?.hideTooltip();
        }

        async handleSelectionMouseUp(event) {
            // 再次检查配置，确保实时性
            const config = this.module.config;
            if (!this.isActive || !config.enableSelectionTranslation) return;

            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) return;

            const text = selection.toString().trim();
            // 使用 Utils 检查文本是否有效
            if (!this.utils.shouldTranslateText(text)) return;

            const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            if (!range) return;

            const rect = range.getBoundingClientRect();
            if (!rect || rect.width === 0 || rect.height === 0) return;

            // 检查点击位置是否在插件 UI 内
            if (this.isNwsElement(event.target)) return;

            // 计算 Tooltip 位置
            const position = this.clampTooltipPosition(
                rect.left + window.scrollX,
                rect.bottom + window.scrollY + 8
            );

            // 显示“正在翻译...”
            this.view.showTooltip(position.x, position.y, '正在翻译...');

            try {
                // 调用翻译服务
                const result = await this.module.translateText(text);
                const displayResult = result ? result.replace(/\s*%%\s*/g, '\n\n') : '翻译结果为空';
                this.view.updateTooltip(displayResult);
            } catch (e) {
                console.error('[SelectionManager] Translation failed:', e);
                this.view.updateTooltip('翻译失败，请稍后重试');
            }
        }

        isNwsElement(element) {
            return this.utils.isSkippableElement(element);
        }

        clampTooltipPosition(x, y) {
            const padding = 12;
            const maxX = window.scrollX + window.innerWidth - padding;
            const maxY = window.scrollY + window.innerHeight - padding;
            return {
                x: Math.min(x, maxX),
                y: Math.min(y, maxY)
            };
        }
    }

    if (!window.NWSModules) {
        window.NWSModules = {};
    }
    window.NWSModules.SelectionManager = SelectionManager;
})();