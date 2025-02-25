/**
 * imageDownloader.js - 通用图片下载功能模块
 * 为页面上的所有图片添加下载按钮
 */

// 创建下载按钮的样式
const downloadButtonStyle = `
    position: absolute;
    top: 10px;
    right: 10px;
    background-color: rgba(255,247,153,0.75);
    border: none;
    padding: 0;
    width: 32px !important;
    height: 32px !important;
    cursor: pointer;
    z-index: 2147483647;
    display: none;
    transition: opacity 0.3s;
    pointer-events: auto;
    user-select: none;
    border-radius: 5px;
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
    
    // 遍历所有图片
    images.forEach((img, index) => {
        // 标记图片已处理
        img.classList.add('image-downloader-processed');

        // 确保图片加载完成后再处理
        if (!img.complete) {
            img.addEventListener('load', () => handleImage(img));
        } else {
            handleImage(img);
        }
    });
}

function handleImage(img) {
    // 获取图片的尺寸和位置信息
    const rect = img.getBoundingClientRect();
    const imgWidth = rect.width;
    const imgHeight = rect.height;

    // 如果图片太小，不添加下载按钮
    if (imgWidth < 50 || imgHeight < 50) {
        return;
    }

    // 创建图片容器
    const container = document.createElement('div');
    container.style.cssText = containerStyle;
    container.classList.add('image-downloader-container');
    
    // 保持原始图片的样式
    const originalStyles = window.getComputedStyle(img);
    container.style.display = originalStyles.display;
    container.style.width = originalStyles.width;
    container.style.height = originalStyles.height;
    
    // 将图片包装在容器中
    img.parentNode.insertBefore(container, img);
    container.appendChild(img);
    
    // 创建下载按钮
    const downloadBtn = document.createElement('button');
    const imagebase64="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDQ4IDQ4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik00MC41MTc4IDM0LjMxNjFDNDMuODA0NCAzMi4wMDUgNDUuMjEzNiAyNy44MzAyIDQ0LjAwMDEgMjRDNDIuNzg2NiAyMC4xNjk4IDM5LjA3MDUgMTguMDcxNCAzNS4wNTI3IDE4LjA3NDVIMzIuNzMxN0MzMS4yMTQ0IDEyLjE2MTMgMjYuMjA4MiA3Ljc5NTcyIDIwLjE0MzUgNy4wOTcyQzE0LjA3ODcgNi4zOTg2OCA4LjIxMTIxIDkuNTExOCA1LjM4OTMxIDE0LjkyNTNDMi41Njc0MSAyMC4zMzg4IDMuMzc1NDUgMjYuOTMxNyA3LjQyMTE1IDMxLjUwMzUiIHN0cm9rZT0iI0IwNTM0NiIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJNMjQuMDA4NCA0MUwyNCAyMyIgc3Ryb2tlPSIjQjA1MzQ2IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik0zMC4zNjM4IDM0LjYzNjJMMjMuOTk5OCA0MS4wMDAyTDE3LjYzNTggMzQuNjM2MiIgc3Ryb2tlPSIjQjA1MzQ2IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg=="
    downloadBtn.innerHTML = `<img src="${imagebase64}" width="24px" height="24px" alt="下载">`;
    downloadBtn.style.cssText = downloadButtonStyle;

    container.appendChild(downloadBtn);
    
    // 显示/隐藏下载按钮
    container.addEventListener('mouseenter', () => {
        downloadBtn.style.display = 'block';
    });
    
    container.addEventListener('mouseleave', () => {
        downloadBtn.style.display = 'none';
    });
    
    // 点击下载按钮时下载图片
    downloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        downloadImage(img.src);
    });
}

// 下载图片函数
function downloadImage(url) {
    if (!url || typeof url !== 'string') {
        return;
    }

    fetch(url)
        .then(response => response.blob())
        .then(blob => {
            const objectUrl = URL.createObjectURL(blob);
            const filename = url.split('/').pop().split('?')[0] || 'image.jpg';
            
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(objectUrl);
            }, 100);
        });
}

// 在页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initImageDownloader();
});

// 添加备用初始化方法
if (document.readyState === 'complete' || document.readyState === 'interactive') {
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