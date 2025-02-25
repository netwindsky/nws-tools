/**
 * elementHighlighter.js
 * 实现鼠标悬停时元素高亮和信息显示功能
 */

// 检查功能是否启用
let isEnabled = false;

// JSZip库加载状态
let jszipLoaded = false;
let jszipLoading = false;


// 加载JSZip库
async function loadJSZip() {
    if (jszipLoaded) return;
    if (jszipLoading) {
        // 等待加载完成
        while (jszipLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return;
    }

    jszipLoading = true;
    try {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('js/jszip.min.js');

        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = () => reject(new Error('加载JSZip库失败'));
            document.head.appendChild(script);
        });

        jszipLoaded = true;
    } catch (error) {
        console.error('加载JSZip库失败:', error);
        throw error;
    } finally {
        jszipLoading = false;
    }
}

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
        } else {
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

    const vueButton = document.createElement('button');
    vueButton.textContent = '转成Vue';
    vueButton.style.cssText = `
        padding: 4px 8px;
        background: #42b883;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
    vueButton.onclick = () => handleConvertToVue(target);

    buttonGroup.appendChild(saveButton);
    buttonGroup.appendChild(collectButton);
    buttonGroup.appendChild(vueButton);
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


function loadJSZip() {
    return new Promise((resolve, reject) => {
        if (jszipLoaded) {
            resolve();
            return;
        }

        if (jszipLoading) {
            showNotification('正在加载必要的库，请稍后重试', 'info');
            reject(new Error('JSZip库正在加载中'));
            return;
        }

        jszipLoading = true;
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('js/jszip.min.js');

        script.onload = () => {
            console.log('JSZip库加载成功');
            jszipLoaded = true;
            jszipLoading = false;
            resolve();
        };

        script.onerror = () => {
            console.error('JSZip库加载失败');
            jszipLoading = false;
            showNotification('JSZip库加载失败，请检查网络连接', 'error');
            reject(new Error('JSZip库加载失败'));
        };

        document.head.appendChild(script);
    });
}

// 添加通用的通知函数
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        right: 20px;
        top: 10px;
        padding: 8px 12px;
        background: ${type === 'error' ? '#f44336' : '#42b883'};
        color: white;
        border-radius: 4px;
        font-size: 12px;
        z-index: 999999;
        animation: fadeOut 2s forwards;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        document.body.removeChild(notification);
    }, 2000);
}

async function handleConvertToVue(element) {
    try {
        // 等待JSZip库加载完成
        await loadJSZip();
    } catch (error) {
        console.error('加载JSZip库失败:', error);
        showNotification('加载JSZip库失败，请重试', 'error');
        return;
    }
    const timestamp = Date.now();
    const folderName = `ExtractedComponent_${timestamp}`;
    const imageFolder = 'assets/images';

    // 获取元素的HTML结构并处理图片
    let template = element.outerHTML;
    const images = element.getElementsByTagName('img');
    const imagePromises = [];
    const imageMap = new Map();

    // 处理图片资源
    function base64ToBlob(base64Data) {
        // 检查是否是完整的Data URL格式
        if (base64Data.startsWith('data:')) {
            // 提取MIME类型和实际的base64数据
            const [header, data] = base64Data.split(',');
            const mime = header.match(/:(.*?);/)[1];
            const binaryStr = atob(data);
            const array = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                array[i] = binaryStr.charCodeAt(i);
            }
            return new Blob([array], { type: mime });
        } else {
            // 如果只是纯base64数据
            const binaryStr = atob(base64Data);
            const array = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                array[i] = binaryStr.charCodeAt(i);
            }
            return new Blob([array]);
        }
    }

    Array.from(images).forEach((img, index) => {
        const originalSrc = img.src;
        let extension = 'png'; // 默认扩展名
        let downloadPromise;
        // 生成随机文件名
        const randomStr = Math.random().toString(36).substring(2, 10); // 生成8位随机字符串
        if (originalSrc.startsWith('data:')) {
            // 处理base64图片
            const mimeMatch = originalSrc.match(/data:(.*?);/);
            if (mimeMatch) {
                const mime = mimeMatch[1];
                extension = mime.split('/')[1] || extension;
            }
            const newFileName = `image_${randomStr}.${extension}`;
            const newPath = `./assets/images/${newFileName}`;
            imageMap.set(originalSrc, newPath);

            downloadPromise = new Promise((resolve) => {
                const blob = base64ToBlob(originalSrc);
                resolve({
                    fileName: newFileName,
                    blob: blob
                });
            });
        } else {
            // 处理普通URL图片
            extension = originalSrc.split('.').pop().split('?')[0] || 'png';
            console.log("原始图片路径", originalSrc);
            const newFileName = `image_${randomStr}.${extension}`;
            const newPath = `../assets/images/${newFileName}`;
            imageMap.set(originalSrc, newPath);

            downloadPromise = new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', originalSrc, true);
                xhr.responseType = 'blob';
                xhr.onload = function () {
                    if (this.status === 200) {
                        const blob = this.response;
                        if (blob.size > 0) {
                            resolve({
                                fileName: newFileName,
                                blob: blob
                            });
                        } else {
                            reject(new Error('图片数据为空'));
                        }
                    } else {
                        reject(new Error(`下载失败: ${this.status}`));
                    }
                };
                xhr.onerror = () => reject(new Error('网络错误'));
                xhr.send();
            });
        }

        imagePromises.push(downloadPromise);
    });

    // 添加加载状态提示
    const loadingNotification = document.createElement('div');
    loadingNotification.style.cssText = `
        position: fixed;
        right: 20px;
        top: 10px;
        padding: 8px 12px;
        background: #42b883;
        color: white;
        border-radius: 4px;
        font-size: 12px;
        z-index: 999999;
    `;
    loadingNotification.textContent = '正在下载资源文件...';
    document.body.appendChild(loadingNotification);

    // 更新模板中的图片路径
    imageMap.forEach((newPath, originalSrc) => {
        // 将绝对路径转换为相对路径
        const relativePath = newPath.replace(/^assets\//, '../assets/');
        // 获取原始图片文件名
        const originalFileName = originalSrc.split('/').pop().split('?')[0];
        //console.log("原始图片文件名", originalFileName);
        //console.log("相对路径", relativePath)
        // 查找包含原始文件名的img标签并替换src
        const imgElements = template.match(/<img[^>]*>/g) || [];
        imgElements.forEach(imgTag => {
            if (imgTag.includes(originalFileName)) {
                const newImgTag = imgTag.replace(/src=["'][^"']*["']/, `src="${relativePath}"`);
                template = template.replace(imgTag, newImgTag);
            }
        });
        //console.log(template)
        // 使用字符串替换而不是正则表达式来处理base64图片
        // while (template.includes(originalSrc)) {
        //     template = template.replace(originalSrc, relativePath);
        // }
    });

    // 获取所有CSS样式
    const styles = new Set();
    const processElement = (el) => {
        const computedStyle = window.getComputedStyle(el);
        // 保留原有类名
        const originalClassNames = el.className;
        if (originalClassNames === '') {
            return;
        }


        console.log("原始类名", originalClassNames);
        // 生成新的唯一类名
        const uniqueClassName = `c_${Math.random().toString(36).substr(2, 9)}`;
        // 合并类名
        el.className = originalClassNames ? `${originalClassNames} ${uniqueClassName}` : uniqueClassName;
        console.log("合并后的类名", el.className);
        // 记录原始类名，用于还原
        const originalClass = el.getAttribute('class') || '';
        // 替换模板中的类名
        template = template.replace(new RegExp(`class=["']${originalClassNames}["']`, 'g'), `class="${el.className}"`);
        let cssText = `.${uniqueClassName} {\n`;
        for (let prop of computedStyle) {
            let value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'initial' && value !== 'none' && value !== 'normal') {
                // 处理背景图片URL
                if (prop.includes('background') && value.includes('url')) {
                    const matches = value.match(/url\(["']?([^"'\)]+)["']?\)/g);
                    if (matches) {
                        matches.forEach(match => {
                            const url = match.replace(/url\(["']?([^"'\)]+)["']?\)/, '$1');
                            const extension = url.split('.').pop().split('?')[0] || 'jpg';
                            const newFileName = `bg_${Math.random().toString(36).substr(2, 9)}.${extension}`;
                            const newPath = `${imageFolder}/${newFileName}`;
                            imageMap.set(url, newPath);
                            console.log("Background image:", url, "=>", newPath);
                            const updatedValue = value.replace(url, newPath);
                            console.log("Updated value:", updatedValue);
                            value = updatedValue;

                            const downloadPromise = new Promise((resolve, reject) => {
                                const xhr = new XMLHttpRequest();
                                xhr.open('GET', url, true);
                                xhr.responseType = 'blob';
                                xhr.timeout = 30000; // 30秒超时

                                xhr.onload = function () {
                                    if (this.status === 200) {
                                        const blob = this.response;
                                        if (blob.size > 0) {
                                            resolve({
                                                fileName: newFileName,
                                                blob: blob
                                            });
                                        } else {
                                            reject(new Error('图片数据为空'));
                                        }
                                    } else {
                                        reject(new Error(`下载失败: ${this.status}`));
                                    }
                                };

                                xhr.onerror = () => reject(new Error('网络错误'));
                                xhr.ontimeout = () => reject(new Error('下载超时'));
                                xhr.send();
                            });

                            imagePromises.push(downloadPromise);
                        });
                    }
                }
                cssText += `    ${prop}: ${value};\n`;
            }
        }
        cssText += `}\n`;

        // 添加伪类样式
        const pseudoElements = [':before', ':after', ':hover', ':active', ':focus'];
        pseudoElements.forEach(pseudo => {
            const pseudoStyle = window.getComputedStyle(el, pseudo);
            if (pseudoStyle.content !== 'none' || pseudoStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                cssText += `.${uniqueClassName}${pseudo} {\n`;
                for (let prop of pseudoStyle) {
                    const value = pseudoStyle.getPropertyValue(prop);
                    if (value && value !== 'initial' && value !== 'none' && value !== 'normal') {
                        cssText += `    ${prop}: ${value};\n`;
                    }
                }
                cssText += `}\n`;
            }
        });

        styles.add(cssText);

        // 递归处理子元素
        Array.from(el.children).forEach(child => processElement(child));
    };
    processElement(element);

    // 生成Vue组件内容
    const vueContent = `<template>
${template}
</template>

<script>
export default {
    name: 'ExtractedComponent',
    data() {
        return {}
    }
}
</script>

<style scoped>
${Array.from(styles).join('\n')}
</style>
`;

    // 创建ZIP文件
    Promise.all(imagePromises).then(async images => {
        try {
            console.log('所有图片下载完成', images);
            const zip = new JSZip();
            const componentFolder = zip.folder(folderName);

            // 验证并添加Vue组件文件
            if (!vueContent) {
                throw new Error('Vue组件内容为空');
            }
            componentFolder.file('ExtractedComponent.vue', vueContent, { binary: false });

            // 添加图片文件
            const imagesFolder = componentFolder.folder(imageFolder);
            for (const { fileName, blob } of images) {
                if (!(blob instanceof Blob)) {
                    throw new Error(`无效的图片数据: ${fileName}`);
                }
                // 使用arrayBuffer确保二进制数据的完整性
                const arrayBuffer = await blob.arrayBuffer();
                await imagesFolder.file(fileName, arrayBuffer, {
                    binary: true,
                    createFolders: true
                });
            }

            // 优化ZIP文件生成配置
            const content = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: {
                    level: 9
                },
                platform: 'UNIX',
                comment: 'Generated by Chrome Extension'
            });

            // 使用Blob URL下载文件
            const downloadLink = document.createElement('a');
            const blobUrl = URL.createObjectURL(content);
            downloadLink.href = blobUrl;
            downloadLink.download = `${folderName}.zip`;
            document.body.appendChild(downloadLink);

            // 触发下载并清理
            downloadLink.click();
            setTimeout(() => {
                document.body.removeChild(downloadLink);
                URL.revokeObjectURL(blobUrl);
            }, 100);

            // 移除加载提示并显示成功提示
            document.body.removeChild(loadingNotification);
            console.log('Vue组件和资源文件已打包下载');
            showNotification('Vue组件和资源文件已打包下载', 'success');
        } catch (error) {
            console.error('打包文件失败:', error);
            document.body.removeChild(loadingNotification);
            showNotification(`文件打包失败: ${error.message}`, 'error');
        }
    }).catch(error => {
        console.error('处理图片资源失败:', error);
        document.body.removeChild(loadingNotification);
        showNotification(`处理图片资源失败: ${error.message}`, 'error');
    });

    // 显示成功提示
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        right: 20px;
        top: 10px;
        padding: 8px 12px;
        background: #42b883;
        color: white;
        border-radius: 4px;
        font-size: 12px;
        z-index: 999999;
        animation: fadeOut 2s forwards;
    `;
    notification.textContent = 'Vue组件和资源文件已打包下载';
    document.body.appendChild(notification);

    setTimeout(() => {
        document.body.removeChild(notification);
    }, 2000);
}

// 处理点击事件
function handleClick(e) {
    console.log("handlerclick", e)
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