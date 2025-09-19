// 监听来自后台的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'pageSummary') {
        updateSummary(message.summary);
    }
});

// 更新页面总结内容
function updateSummary(summary) {
    const summaryElement = document.getElementById('pageSummary');
    if (summaryElement) {
        summaryElement.innerHTML = `<p>${summary}</p>`;
    }
}

// 页面加载完成后，请求当前页面的内容总结
document.addEventListener('DOMContentLoaded', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'requestSummary'
            });
        }
    });
});