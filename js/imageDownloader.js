/**
 * imageDownloader.js - 通用图片下载功能模块
 * 为页面上的所有图片添加下载按钮
 */

// 创建下载按钮的样式
const downloadButtonStyle = `
    position: absolute;
    top: 10px;
    right: 10px;
    background-color: rgba(25, 113, 194, 0.8);
    border-radius: 4px;
    border: none;
    color: white;
    padding: 1px 2px;
    font-size: 8px;
    cursor: pointer;
    z-index: 2147483647;
    display: none;
    transition: opacity 0.3s;
    pointer-events: auto;
    user-select: none;
`;

const containerStyle = `
    position: relative;
    display: inline-block;
    margin: 0;
    padding: 0;
    pointer-events: all;
`;

// 初始化图片下载功能
function initImageDownloader() {
    // 获取页面上所有图片，包括动态加载的图片和背景图片
    const images = Array.from(document.querySelectorAll('img:not(.image-downloader-processed), [style*="background-image"]:not(.image-downloader-processed)'));
    
    // 过滤和处理背景图片
    const processedImages = images.map(element => {
        if (element.tagName.toLowerCase() === 'img') {
            return element;
        } else {
            const style = window.getComputedStyle(element);
            const bgImage = style.backgroundImage;
            if (bgImage && bgImage !== 'none') {
                const imgUrl = bgImage.slice(4, -1).replace(/["']/g, '');
                const img = new Image();
                img.src = imgUrl;
                return img;
            }
            return null;
        }
    }).filter(Boolean);
    console.log(`[ImageDownloader] 找到 ${images.length} 个未处理的图片`);
    
    // 遍历所有图片
    images.forEach((img, index) => {
        console.log(`[ImageDownloader] 处理第 ${index + 1} 个图片：${img.src}`);
        // 标记图片已处理
        img.classList.add('image-downloader-processed');

        // 确保图片加载完成后再处理
        if (!img.complete) {
            console.log(`[ImageDownloader] 图片未加载完成，添加加载监听器`);
            img.addEventListener('load', () => handleImage(img));
            img.addEventListener('error', () => console.error('[ImageDownloader] 图片加载失败:', img.src));
        } else {
            console.log(`[ImageDownloader] 图片已加载完成，直接处理`);
            handleImage(img);
        }
    });
}

function handleImage(img) {
    // 获取图片的尺寸和位置信息
    const rect = img.getBoundingClientRect();
    const imgWidth = rect.width;
    const imgHeight = rect.height;
    console.log(`[ImageDownloader] 处理图片尺寸：${imgWidth}x${imgHeight}`);

    // 如果图片太小，不添加下载按钮
    if (imgWidth < 50 || imgHeight < 50) {
        console.log(`[ImageDownloader] 图片尺寸过小，跳过处理`);
        return;
    }

    // 创建图片容器
    console.log(`[ImageDownloader] 创建图片容器`);
    const container = document.createElement('div');
    container.style.cssText = containerStyle;
    container.classList.add('image-downloader-container');
    
    // 保持原始图片的样式
    const originalStyles = window.getComputedStyle(img);
    container.style.display = originalStyles.display;
    container.style.width = originalStyles.width;
    container.style.height = originalStyles.height;
    
    // 将图片包装在容器中
    console.log(`[ImageDownloader] 将图片添加到容器中`);
    img.parentNode.insertBefore(container, img);
    container.appendChild(img);
    
    // 创建下载按钮
    console.log(`[ImageDownloader] 创建下载按钮`);
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = '下载';
    downloadBtn.style.cssText = downloadButtonStyle;

    // 根据图片尺寸调整按钮位置和大小
    const btnSize = Math.min(Math.max(imgWidth * 0.15, 30), 60);
    downloadBtn.style.padding = `${btnSize * 0.2}px ${btnSize * 0.4}px`;
    downloadBtn.style.fontSize = `${btnSize * 0.4}px`;
    
    container.appendChild(downloadBtn);
    
    // 显示/隐藏下载按钮
    container.addEventListener('mouseenter', () => {
        console.log(`[ImageDownloader] 显示下载按钮`);
        downloadBtn.style.display = 'block';
    });
    
    container.addEventListener('mouseleave', () => {
        console.log(`[ImageDownloader] 隐藏下载按钮`);
        downloadBtn.style.display = 'none';
    });
    
    // 点击下载按钮时下载图片
    downloadBtn.addEventListener('click', (e) => {
        console.log(`[ImageDownloader] 点击下载按钮，准备下载图片：${img.src}`);
        e.preventDefault();
        e.stopPropagation();
        downloadImage(img.src);
    });
}

// 下载图片函数
function downloadImage(url) {
    if (!url || typeof url !== 'string') {
        console.error('[ImageDownloader] 无效的图片URL');
        return;
    }

    console.log(`[ImageDownloader] 开始下载图片：${url}`);
    // 处理跨域图片
    fetch(url)
        .then(response => {
            console.log(`[ImageDownloader] 图片请求成功，开始处理响应`);
            return response.blob();
        })
        .then(blob => {
            console.log(`[ImageDownloader] 获取到图片数据，大小：${blob.size} 字节`);
            const objectUrl = URL.createObjectURL(blob);
            const filename = url.split('/').pop().split('?')[0] || 'image.jpg';
            console.log(`[ImageDownloader] 保存图片文件名：${filename}`);
            
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(objectUrl);
                console.log(`[ImageDownloader] 清理下载临时数据`);
            }, 100);
        })
        .catch(error => {
            console.error('[ImageDownloader] 下载图片失败:', error);
        });
}

// 在页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('[ImageDownloader] DOM加载完成，准备初始化');
    initImageDownloader();
});

// 添加备用初始化方法
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('[ImageDownloader] 页面已加载，直接初始化');
    initImageDownloader();
}

// 监听动态加载的内容
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            initImageDownloader();
        }
    });
});

// 开始监听DOM变化
observer.observe(document.body, {
    childList: true,
    subtree: true
});