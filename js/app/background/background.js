// background.js - Service Worker for NWS Tools
// 处理Chrome扩展的后台任务

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
    // 创建主菜单
    chrome.contextMenus.create({
        id: 'nwsTools',
        title: 'NWS Tools',
        contexts: ['all']
    });

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    //console.log('[Background] 收到消息:', request);
    
    if (request.action === 'download') {
        // 处理下载请求
        chrome.downloads.download(request.options)
            .then(downloadId => {
                sendResponse({ success: true, downloadId });
            })
            .catch(error => {
                console.error('[Background] 下载失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // 保持消息通道开放以支持异步响应
    }
    
    // 处理来自 popup 的功能执行请求
    if (request.type === 'executeFeature') {
        // 向当前活动标签页发送消息
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: request.action
                }).then(() => {
                    sendResponse({ success: true });
                }).catch(error => {
                    console.error('[Background] 发送功能执行消息失败:', error);
                    sendResponse({ success: false, error: error.message });
                });
            } else {
                sendResponse({ success: false, error: '未找到活动标签页' });
            }
        });
        return true; // 保持消息通道开放以支持异步响应
    }
    
    // 处理侧边栏相关消息
    if (request.action === 'toggleSidebar') {
        // 向所有标签页发送侧边栏切换消息
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'toggleSidebar'
                }).catch(() => {
                    // 忽略不支持消息的标签页
                });
            });
        });
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === 'openSidePanel') {
        // 打开原生侧边面板
        if (sender.tab) {
            chrome.sidePanel.open({ windowId: sender.tab.windowId });
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: '无法获取标签页信息' });
        }
        return true;
    }

    if (request.action === 'openOptionsPage') {
        chrome.runtime.openOptionsPage(() => {
            if (chrome.runtime.lastError) {
                console.warn('[Background] 打开设置页面失败:', chrome.runtime.lastError.message);
            }
        });
        sendResponse({ success: true });
        return false; // 同步响应，无需保持通道
    }
    
    // 处理配置变化通知
    if (request.action === 'notifyConfigChange') {
        // 从 content script 转发配置变化通知到所有标签页
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'configChanged',
                    key: request.key,
                    value: request.value
                }).catch(() => {
                    // 忽略不支持消息的标签页
                });
            });
        });
        sendResponse({ success: true });
        return true;
    }
    
    if (request.type === 'pageSummary') {
        // 转发页面摘要到工具面板
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.url && tab.url.includes('control-panel.html')) {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'pageSummary',
                        summary: request.summary
                    }).catch(() => {
                        // 忽略发送失败（页面可能已关闭）
                    });
                }
            });
        });
        
        // 也尝试发送到所有打开的扩展页面
        chrome.runtime.sendMessage(request).catch(() => {});
        
        sendResponse({ success: true });
        return true;
    }
});

    // 创建子菜单
    chrome.contextMenus.create({
        id: 'toggleSidebar',
        parentId: 'nwsTools',
        title: '切换侧边栏',
        contexts: ['all']
    });

    chrome.contextMenus.create({
        id: 'saveAsMD',
        parentId: 'nwsTools',
        title: '保存为 Markdown',
        contexts: ['all']
    });

    chrome.contextMenus.create({
        id: 'collectInfo',
        parentId: 'nwsTools',
        title: '采集信息',
        contexts: ['all']
    });

    chrome.contextMenus.create({
        id: 'convertToVue',
        parentId: 'nwsTools',
        title: '转换为 Vue 组件',
        contexts: ['all']
    });

    chrome.contextMenus.create({
        id: 'copySelector',
        parentId: 'nwsTools',
        title: '复制选择器',
        contexts: ['all']
    });

    chrome.contextMenus.create({
        id: 'copyStyle',
        parentId: 'nwsTools',
        title: '复制样式',
        contexts: ['all']
    });
    chrome.contextMenus.create({
        id: "openOptions",
        title: "选项",
        contexts: ["action"]
    });
});

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "openSidebar") {
        chrome.sidePanel.open({ windowId: tab.windowId });
    } else if (info.menuItemId === "openOptions") {
        chrome.runtime.openOptionsPage();
    } else if (info.menuItemId === "toggleSidebar") {
        // 向当前标签页发送侧边栏切换消息
        chrome.tabs.sendMessage(tab.id, {
            action: 'toggleSidebar'
        }).catch(error => {
            console.warn('[Background] 发送侧边栏切换消息失败:', error);
        });
    } else {
        // 向当前标签页发送消息
        chrome.tabs.sendMessage(tab.id, {
            action: info.menuItemId,
            data: {
                frameId: info.frameId
            }
        });
    }
});
