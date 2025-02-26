/**
 * 显示通知消息
 * @param {string} message - 要显示的消息内容
 * @param {string} type - 消息类型：'success' | 'error' | 'info'
 * @param {number} duration - 显示时长(毫秒)，默认2000ms
 */
function showNotification(message, type = 'info', duration = 2000) {
    const notification = document.createElement('div');
    
    // 根据类型设置背景色
    const bgColors = {
        success: '#4CAF50',
        error: '#f44336',
        info: '#42b883'
    };

    notification.style.cssText = `
        position: fixed;
        right: 20px;
        top: 10px;
        padding: 8px 12px;
        background: ${bgColors[type] || bgColors.info};
        color: white;
        border-radius: 4px;
        font-size: 12px;
        z-index: 999999;
        animation: fadeOut ${duration}ms forwards;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        document.body.removeChild(notification);
    }, duration);
}

// 导出函数
export { showNotification };