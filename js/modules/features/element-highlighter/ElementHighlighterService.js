(function() {
    'use strict';

    class ElementHighlighterService {
        constructor(options = {}) {
            this.chromeSettings = options.chromeSettings || null;
            this.notification = options.notification || null;
            this.jszipLoaded = false;
        }

        getCssPath(element) {
            const path = [];
            let current = element;

            while (current && current.nodeType === Node.ELEMENT_NODE) {
                let selector = current.tagName.toLowerCase();
                
                if (current.id) {
                    selector += `#${current.id}`;
                    path.unshift(selector);
                    break;
                }
                
                if (current.className) {
                    const classValue = typeof current.className === 'string' ? current.className : (current.className.baseVal || '');
                    const classes = classValue.split(' ').filter(c => c.trim());
                    if (classes.length > 0) {
                        selector += '.' + classes.join('.');
                    }
                }
                
                const siblings = Array.from(current.parentNode?.children || []);
                const sameTagSiblings = siblings.filter(s => s.tagName === current.tagName);
                if (sameTagSiblings.length > 1) {
                    const index = sameTagSiblings.indexOf(current) + 1;
                    selector += `:nth-child(${index})`;
                }
                
                path.unshift(selector);
                current = current.parentElement;
            }

            return path.join(' > ');
        }

        getSimplifiedCssPath(element) {
            if (element.id) {
                return `#${element.id}`;
            }

            if (element.className) {
                const classValue = typeof element.className === 'string' ? element.className : (element.className.baseVal || '');
                const classes = classValue.split(' ').filter(c => c.trim());
                if (classes.length > 0) {
                    return `.${classes.join('.')}`;
                }
            }

            return element.tagName.toLowerCase();
        }

        async copySelector(element) {
            const simplifiedPath = this.getSimplifiedCssPath(element);
            try {
                await navigator.clipboard.writeText(simplifiedPath);
                if (this.notification) {
                    this.notification.success(`选择器已复制: ${simplifiedPath}`);
                }
                return simplifiedPath;
            } catch (error) {
                if (this.notification) {
                    this.notification.error('复制选择器失败');
                }
                throw error;
            }
        }

        async copyStyle(element) {
            const computedStyle = window.getComputedStyle(element);
            const styleText = Array.from(computedStyle).map(prop => 
                `${prop}: ${computedStyle.getPropertyValue(prop)};`
            ).join('\n');

            try {
                await navigator.clipboard.writeText(styleText);
                if (this.notification) {
                    this.notification.success('样式已复制到剪贴板');
                }
                return styleText;
            } catch (error) {
                if (this.notification) {
                    this.notification.error('复制样式失败');
                }
                throw error;
            }
        }

        generateMarkdownContent(element) {
            const selector = this.getSimplifiedCssPath(element);
            const fullPath = this.getCssPath(element);
            const computedStyle = window.getComputedStyle(element);
            
            let content = `# 元素信息\n\n`;
            content += `**选择器**: \`${selector}\`\n\n`;
            content += `**完整路径**: \`${fullPath}\`\n\n`;
            content += `**标签**: ${element.tagName.toLowerCase()}\n\n`;
            
            if (element.textContent) {
                content += `**文本内容**: ${element.textContent.substring(0, 200)}\n\n`;
            }
            
            content += `## 样式信息\n\n`;
            content += `\`\`\`css\n`;
            
            const importantStyles = [
                'display', 'position', 'width', 'height', 'margin', 'padding',
                'border', 'background-color', 'color', 'font-size', 'font-family'
            ];
            
            importantStyles.forEach(prop => {
                const value = computedStyle.getPropertyValue(prop);
                if (value && value !== 'none' && value !== 'auto') {
                    content += `${prop}: ${value};\n`;
                }
            });
            
            content += `\`\`\`\n\n`;
            content += `**生成时间**: ${new Date().toLocaleString()}\n`;
            
            return content;
        }

        generateVueComponent(element) {
            const tagName = element.tagName.toLowerCase();
            const className = element.className;
            const textContent = element.textContent?.trim();
            
            let template = `<template>\n  <${tagName}`;
            
            if (className) {
                template += ` class="${className}"`;
            }
            
            template += `>`;
            
            if (textContent && textContent.length < 100) {
                template += textContent;
            } else {
                template += '{{ content }}';
            }
            
            template += `</${tagName}>\n</template>\n\n`;
            
            template += `<script>
module.exports = {
  name: 'ExtractedElement',
  data() {
    return {
      content: '${textContent || '内容'}'
    }
  }
}
</script>

`;
            
            template += `<style scoped>\n/* 添加样式 */\n</style>`;
            
            return template;
        }

        async loadJSZip() {
            if (this.jszipLoaded || window.JSZip) {
                this.jszipLoaded = true;
                return;
            }

            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('libs/jszip.min.js');

            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = () => reject(new Error('加载JSZip库失败'));
                document.head.appendChild(script);
            });

            this.jszipLoaded = true;
        }

        async saveAsMD(element) {
            try {
                await this.loadJSZip();

                const content = this.generateMarkdownContent(element);
                
                const zip = new JSZip();
                zip.file('element.md', content);
                
                const blob = await zip.generateAsync({ type: 'blob' });
                const url = URL.createObjectURL(blob);
                
                if (this.chromeSettings) {
                    await this.chromeSettings.downloadFile({
                        url: url,
                        filename: `element_${Date.now()}.zip`,
                        saveAs: false
                    });
                }

                if (this.notification) {
                    this.notification.success('元素已保存为Markdown');
                }

            } catch (error) {
                if (this.notification) {
                    this.notification.error('保存失败');
                }
                throw error;
            }
        }

        async convertToVue(element) {
            const vueCode = this.generateVueComponent(element);
            
            try {
                await navigator.clipboard.writeText(vueCode);
                if (this.notification) {
                    this.notification.success('Vue组件代码已复制到剪贴板');
                }
            } catch (error) {
                if (this.notification) {
                    this.notification.error('复制失败');
                }
                throw error;
            }
        }
    }

    if (window.NWSModules) {
        window.NWSModules.ElementHighlighterService = ElementHighlighterService;
    }
})();
