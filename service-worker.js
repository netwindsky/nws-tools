import "./js/menu.js"

function showMessage(message) {
  chrome.notifications.create(null, {
    type: 'basic',
    iconUrl: 'img/icon.png',
    title: '来自civitai采集的消息',
    message: message
  });
}

// 创建右键菜单项
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "openSidePanel",
    title: "打开侧边栏",
    contexts: ["action"]
  });

  chrome.contextMenus.create({
    id: "downloadImage",
    title: "下载图片",
    contexts: ["image"]
  });

  chrome.contextMenus.create({
    id: "copyLink",
    title: "复制链接",
    contexts: ["link"]
  });

  chrome.contextMenus.create({
    id: "copySelectedText",
    title: "复制选中文本",
    contexts: ["selection"]
  });
});

// 添加右键菜单点击事件监听器
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "openSidePanel") {
    chrome.sidePanel.open({ windowId: tab.windowId });
  } else if (info.menuItemId === "downloadImage") {
    if (info.srcUrl) {
      chrome.downloads.download({
        url: info.srcUrl,
        filename: 'image.jpg' // 可以自定义文件名
      });
    }
  } else if (info.menuItemId === "copyLink") {
    if (info.linkUrl) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: (link) => {
          navigator.clipboard.writeText(link);
        },
        args: [info.linkUrl]
      });
      showMessage("链接已复制到剪贴板");
    }
  } else if (info.menuItemId === "copySelectedText") {
    if (info.selectionText) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: (text) => {
          navigator.clipboard.writeText(text);
        },
        args: [info.selectionText]
      });
      showMessage("选中文本已复制到剪贴板");
    }
  }
});

// 初始化service worker
function init() {
  console.log("初始化service worker");

  // 监听来自content script的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('收到消息:', request);

    switch (request.command) {
      case 'success':
        showMessage('操作成功！');
        break;
      case 'hasit':
        showMessage('已存在！');
        break;
      case 'error':
        showMessage('操作失败！');
        break;
      case 'downloadImage':
        if (request.data && request.data.url) {
          chrome.downloads.download({
            url: request.data.url,
            filename: request.data.filename || 'image.jpg'
          });
        }
        break;
      case 'aliprompt':
        // 处理aliprompt命令
        break;
    }
  });

  // 监听标签页更新
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && changeInfo.url !== "chrome://newtab/") {
      chrome.tabs.sendMessage(tabId, {
        message: 'pathChange',
        url: changeInfo.url
      });
    }
  });

  // 监听标签页创建
  chrome.tabs.onCreated.addListener((tab) => {
    console.log("标签页创建:", tab);
  });

  // 监听标签页激活
  chrome.tabs.onActivated.addListener((activeInfo) => {
    console.log("标签页激活:", activeInfo);
  });

  // 监听标签页关闭
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.log("标签页关闭:", tabId, removeInfo);
  });
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log(request.command)
  switch (request.command) {
    case 'success':
      showMessage('已保存！');
      break;
    case 'hasit':
      showMessage('已存在！');
      break;
    case 'error':
      showMessage('错误！');
      break;
    case 'aliprompt':
      break;
  }
});

// 启动初始化
init();
