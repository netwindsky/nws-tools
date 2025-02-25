/**
 * elementHighlighter.js
 * 实现鼠标悬停时元素高亮和信息显示功能
 */

// 检查功能是否启用
let isEnabled = false;

// 定义全局变量
let tooltip;
let styleInfo;
let lastHighlightedElement = null;
let lastCssPath = '';
let buttonGroup = null;

// 从Chrome Storage加载设置
function loadSettings() {
    console.log('[ElementHighlighter] 开始加载设置');
    chrome.storage.sync.get('toggleSettings', (result) => {
        console.log('[ElementHighlighter] 获取到设置:', result);
        if (result.toggleSettings) {
            isEnabled = result.toggleSettings.elementHighlighter || false;
            const elementActionsEnabled = result.toggleSettings.elementActions || false;
            console.log('[ElementHighlighter] 高亮功能状态:', isEnabled);
            console.log('[ElementHighlighter] 元素操作功能状态:', elementActionsEnabled);
            if (isEnabled) {
                initializeHighlighter();
                if (elementActionsEnabled) {
                    document.addEventListener('click', handleClick);
                }
            }
        }else{
            isEnabled = true;
            initializeHighlighter();
            console.log('[ElementHighlighter] 初始化点击');
            document.addEventListener('click', handleClick);
        }
    });
}

// 监听设置变化
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.toggleSettings) {
        const newValue = changes.toggleSettings.newValue;
        isEnabled = newValue.elementHighlighter || false;
        const elementActionsEnabled = newValue.elementActions || false;
        console.log('[ElementHighlighter] 设置变更，高亮功能状态:', isEnabled);
        console.log('[ElementHighlighter] 设置变更，元素操作功能状态:', elementActionsEnabled);
        
        if (isEnabled) {
            initializeHighlighter();
            if (elementActionsEnabled) {
                document.addEventListener('click', handleClick);
            } else {
                document.removeEventListener('click', handleClick);
                if (buttonGroup) {
                    buttonGroup.style.display = 'none';
                }
            }
        } else {
            removeHighlighter();
        }
    }
});

// 初始化高亮器
function initializeHighlighter() {
    // 检查是否已存在tooltip和styleInfo
    if (document.getElementById('nws-element-tooltip') || document.getElementById('nws-element-styleinfo')) {
        return;
    }

    // 创建悬浮提示框
    tooltip = document.createElement('div');
    tooltip.id = 'nws-element-tooltip';
    tooltip.style.cssText = `
        position: fixed;
        right: 20px;
        bottom: 20px;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border-radius: 4px;
        font-size: 12px;
        z-index: 999999;
        pointer-events: none;
        max-width: 300px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        transition: opacity 0.2s ease;
        display: none;
    `;
    document.body.appendChild(tooltip);

    // 创建左下角样式信息框
    styleInfo = document.createElement('div');
    styleInfo.id = 'nws-element-styleinfo';
    styleInfo.style.cssText = `
        position: fixed;
        left: 20px;
        bottom: 20px;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border-radius: 4px;
        font-size: 12px;
        z-index: 999999;
        pointer-events: none;
        max-width: 300px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        transition: opacity 0.2s ease;
        display: none;
    `;
    document.body.appendChild(styleInfo);
    console.log('初始化完成handleMouseMove');
    // 添加事件监听器
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('keydown', handleKeyDown);
}

// 移除高亮器
function removeHighlighter() {
    const tooltip = document.getElementById('nws-element-tooltip');
    const styleInfo = document.getElementById('nws-element-styleinfo');
    
    if (tooltip) {
        document.body.removeChild(tooltip);
    }
    if (styleInfo) {
        document.body.removeChild(styleInfo);
    }

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseleave', handleMouseLeave);
    document.removeEventListener('keydown', handleKeyDown);

    if (lastHighlightedElement) {
        lastHighlightedElement.style.outline = '';
        lastHighlightedElement = null;
    }
    
    if (buttonGroup) {
        document.body.removeChild(buttonGroup);
        buttonGroup = null;
    }
    document.removeEventListener('click', handleClick);
}

// 更新handleMouseMove函数
function handleMouseMove(e) {
    console.log('handleMouseMove');
    if (!tooltip || !styleInfo) {
        tooltip = document.getElementById('nws-element-tooltip');
        styleInfo = document.getElementById('nws-element-styleinfo');
        if (!tooltip || !styleInfo) return;
    }

    const target = e.target;
    
    if (target !== lastHighlightedElement) {
        if (lastHighlightedElement) {
            lastHighlightedElement.style.outline = '';
        }
        
        target.style.outline = '1px dashed rgb(158, 42, 34)';
        target.style.outlineOffset = '1px';
        lastHighlightedElement = target;
        
        lastCssPath = getCssPath(target);
        const simplifiedPath = getSimplifiedCssPath(target);
        
        const tagName = target.tagName.toLowerCase();
        const computedStyle = window.getComputedStyle(target);
        
        // 更新右下角提示框内容
        tooltip.innerHTML = `
            <div style="margin-bottom: 4px;"><strong>标签：</strong>${tagName}</div>
            <div style="word-break: break-all;"><strong>简化选择器：</strong>${simplifiedPath}</div>
            <div style="word-break: break-all; margin-top: 4px;"><strong>完整选择器：</strong>${lastCssPath}</div>
            <div style="margin-top: 4px; font-size: 11px; color: #aaa;">按Alt+C复制选择器</div>
        `;
        tooltip.style.display = 'block';
        
        // 更新左下角样式信息
        const styleProperties = [
            'display',
            'position',
            'width',
            'height',
            'margin',
            'padding',
            'background-color',
            'color',
            'font-size',
            'font-family',
            'border',
            'border-radius'
        ];
        
        const styleText = styleProperties
            .map(prop => `<div style="margin: 2px 0;"><strong>${prop}:</strong> ${computedStyle.getPropertyValue(prop)}</div>`)
            .join('');
        
        styleInfo.innerHTML = `
            <div style="margin-bottom: 8px;"><strong>${tagName}</strong> 样式：</div>
            ${styleText}
            <div style="margin-top: 4px; font-size: 11px; color: #aaa;">按Alt+S复制样式</div>
        `;
        styleInfo.style.display = 'block';
    }
}

// 更新handleMouseLeave函数
function handleMouseLeave(e) {
    if (lastHighlightedElement) {
        lastHighlightedElement.style.outline = '';
        lastHighlightedElement = null;
        styleInfo.style.display = 'none';
    }
}

// 生成CSS选择器路径
function getCssPath(element) {
    if (!(element instanceof Element)) return '';
    const path = [];
    while (element.nodeType === Node.ELEMENT_NODE) {
        let selector = element.nodeName.toLowerCase();
        if (element.id) {
            selector += '#' + element.id;
            path.unshift(selector);
            break;
        } else {
            let sibling = element;
            let nth = 1;
            while (sibling.previousElementSibling) {
                sibling = sibling.previousElementSibling;
                if (sibling.nodeName.toLowerCase() === selector) nth++;
            }
            if (nth !== 1) selector += `:nth-of-type(${nth})`;
        }
        path.unshift(selector);
        element = element.parentNode;
    }
    return path.join(' > ');
}

// 生成简化的CSS选择器路径
function getSimplifiedCssPath(element) {
    if (!(element instanceof Element)) return '';
    
    // 如果元素有id，直接返回
    if (element.id) {
        return '#' + element.id;
    }
    
    // 如果元素有class，尝试使用class
    if (element.classList.length > 0) {
        const classSelector = '.' + Array.from(element.classList).join('.');
        // 检查使用class选择器是否唯一
        if (document.querySelectorAll(classSelector).length === 1) {
            return classSelector;
        }
    }
    
    // 如果没有唯一的id或class，尝试构建最短的唯一路径
    let currentElement = element;
    let path = [];
    
    while (currentElement !== document.body) {
        let selector = currentElement.tagName.toLowerCase();
        
        if (currentElement.id) {
            return '#' + currentElement.id + ' ' + path.join(' > ');
        }
        
        if (currentElement.classList.length > 0) {
            const classSelector = '.' + Array.from(currentElement.classList).join('.');
            const testSelector = classSelector + (path.length ? ' > ' + path.join(' > ') : '');
            if (document.querySelectorAll(testSelector).length === 1) {
                return testSelector;
            }
        }
        
        const siblings = Array.from(currentElement.parentNode.children);
        if (siblings.length > 1) {
            const index = siblings.indexOf(currentElement) + 1;
            selector += `:nth-child(${index})`;
        }
        
        path.unshift(selector);
        currentElement = currentElement.parentNode;
        
        // 测试当前路径是否唯一
        const testSelector = path.join(' > ');
        if (document.querySelectorAll(testSelector).length === 1) {
            return testSelector;
        }
    }
    
    return path.join(' > ');
}

// 复制文本到剪贴板
function copyToClipboard(simplifiedPath, fullPath) {
    const selectorData = {
        simplified: simplifiedPath,
        full: fullPath
    };
    const jsonString = JSON.stringify(selectorData, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
        // 创建一个临时提示元素
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            right: 20px;
            top: 10px;
            padding: 8px 12px;
            background: #4CAF50;
            color: white;
            border-radius: 4px;
            font-size: 12px;
            z-index: 999999;
            animation: fadeOut 2s forwards;
        `;
        notification.textContent = '选择器已以JSON格式复制到剪贴板';
        document.body.appendChild(notification);

        // 2秒后移除提示
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
    }).catch(err => {
        console.error('复制失败:', err);
    });
}

// 复制元素样式到剪贴板
function copyStyleToClipboard(element) {
    if (!element) return;
    
    const computedStyle = window.getComputedStyle(element);
    const styleProperties = [
        'display',
        'position',
        'width',
        'height',
        'margin',
        'padding',
        'background-color',
        'color',
        'font-size',
        'font-family',
        'border',
        'border-radius',
        'box-shadow',
        'opacity',
        'z-index',
        'text-align',
        'line-height',
        'overflow'
    ];
    
    const cssRules = styleProperties
        .map(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'none' && value !== 'normal') {
                return `${prop}: ${value};`;
            }
            return null;
        })
        .filter(Boolean)
        .join('\n    ');
    
    const cssText = `{
    ${cssRules}
}`;
    
    navigator.clipboard.writeText(cssText).then(() => {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            right: 20px;
            top: 10px;
            padding: 8px 12px;
            background: #4CAF50;
            color: white;
            border-radius: 4px;
            font-size: 12px;
            z-index: 999999;
            animation: fadeOut 2s forwards;
        `;
        notification.textContent = '元素样式已复制到剪贴板';
        document.body.appendChild(notification);

        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
    }).catch(err => {
        console.error('复制样式失败:', err);
    });
}

// 创建按钮组
function createButtonGroup(target, clickX, clickY) {
    if (buttonGroup) {
        document.body.removeChild(buttonGroup);
    }

    buttonGroup = document.createElement('div');
    buttonGroup.style.cssText = `
        position: fixed;
        padding: 8px;
        background: rgba(0, 0, 0, 0.8);
        border-radius: 4px;
        z-index: 1000000;
        display: flex;
        gap: 8px;
    `;

    const saveButton = document.createElement('button');
    saveButton.textContent = '保存MD';
    saveButton.style.cssText = `
        padding: 4px 8px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
    saveButton.onclick = () => handleSaveMD(target);

    const collectButton = document.createElement('button');
    collectButton.textContent = '采集信息';
    collectButton.style.cssText = `
        padding: 4px 8px;
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
    collectButton.onclick = () => handleCollectInfo(target);

    buttonGroup.appendChild(saveButton);
    buttonGroup.appendChild(collectButton);
    document.body.appendChild(buttonGroup);

    // 设置按钮组位置为鼠标点击位置的右侧
    buttonGroup.style.left = (clickX + 5) + 'px';
    buttonGroup.style.top = clickY + 'px';
}

// 处理保存MD功能
async function handleSaveMD(element) {
    const cssPath = getCssPath(element);
    const htmlContent = element.outerHTML;
    
    // 创建一个临时容器来转换HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // 移除脚本标签
    const scripts = tempDiv.getElementsByTagName('script');
    while (scripts.length > 0) {
        scripts[0].parentNode.removeChild(scripts[0]);
    }
    
    // 提取原始文本内容
    let originalText = tempDiv.innerText
        .replace(/\n{3,}/g, '\n\n') // 移除多余的空行
        .trim();

    // 使用Ollama处理内容
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'qwen2.5:14b',
                prompt: `请将以下内容整理成结构清晰的Markdown格式，添加适当的标题和层级结构：\n${originalText}`,
                stream: false
            })
        });

        const data = await response.json();
        let markdown = data.response;

        // 如果Ollama处理失败，使用原始文本
        if (!markdown) {
            markdown = `# 提取内容\n\n${originalText}`;
        }

        // 添加CSS选择器作为注释
        markdown = `<!-- CSS选择器: ${cssPath} -->\n\n${markdown}`;
        
        // 创建Blob对象
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        
        // 创建下载链接
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = `element_${Date.now()}.md`;
        
        // 触发下载
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // 清理URL对象
        URL.revokeObjectURL(downloadLink.href);
        
        // 显示成功提示
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            right: 20px;
            top: 10px;
            padding: 8px 12px;
            background: #4CAF50;
            color: white;
            border-radius: 4px;
            font-size: 12px;
            z-index: 999999;
            animation: fadeOut 2s forwards;
        `;
        notification.textContent = 'Markdown文件已保存';
        document.body.appendChild(notification);

        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);

    } catch (error) {
        console.error('Ollama处理失败:', error);
        // 显示错误提示
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            right: 20px;
            top: 10px;
            padding: 8px 12px;
            background: #f44336;
            color: white;
            border-radius: 4px;
            font-size: 12px;
            z-index: 999999;
            animation: fadeOut 2s forwards;
        `;
        notification.textContent = 'Markdown生成失败，请检查Ollama服务是否运行';
        document.body.appendChild(notification);

        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
    }
}

// 处理采集信息功能
function handleCollectInfo(element) {
    const info = {
        cssPath: getCssPath(element),
        tagName: element.tagName.toLowerCase(),
        innerHTML: element.innerHTML,
        attributes: Array.from(element.attributes).map(attr => ({
            name: attr.name,
            value: attr.value
        }))
    };
    // TODO: 实现信息采集和保存逻辑
    console.log('采集信息', info);
}

// 处理点击事件
function handleClick(e) {
    console.log("handlerclick",e)
    if (e.altKey) {
        e.preventDefault();
        createButtonGroup(e.target, e.clientX, e.clientY);
    } else if (buttonGroup) {
        document.body.removeChild(buttonGroup);
        buttonGroup = null;
    }
}

// 处理键盘事件
function handleKeyDown(e) {
    if (e.altKey && e.key.toLowerCase() === 'c' && lastCssPath) {
        e.preventDefault();
        const simplifiedPath = getSimplifiedCssPath(lastHighlightedElement);
        copyToClipboard(simplifiedPath, lastCssPath);
    } else if (e.altKey && e.key.toLowerCase() === 's' && lastHighlightedElement) {
        e.preventDefault();
        copyStyleToClipboard(lastHighlightedElement);
    }
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);

// 在页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('[ElementHighlighter] DOM加载完成，准备加载设置');
    loadSettings();
});

// 添加备用初始化方法
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('[ElementHighlighter] 页面已加载，直接加载设置');
    loadSettings();
}