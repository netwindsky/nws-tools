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

    // 创建子菜单
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