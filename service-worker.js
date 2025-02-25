import "./js/menu.js"

function showMessage(message) {
  chrome.notifications.create(null, {
    type: 'basic',
    iconUrl: 'img/icon.png',
    title: '来自civitai采集的消息',
    message: message
  });
}

function init() {
  console.log("init")

  // 创建右键菜单项
  chrome.contextMenus.create({
    id: "openSidePanel",
    title: "打开侧边栏",
    contexts: ["action"]
  });

  // 添加右键菜单点击事件监听器
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "openSidePanel") {
      chrome.sidePanel.open({ windowId: tab.windowId });
    }
  });
  chrome.tabs.onUpdated.addListener(
    function (tabId, changeInfo, tab) {
      // read changeInfo data and do something with it
      // like send the new url to contentscripts.js
      //console.log("fuck -------------------------------")
      //console.log(changeInfo,changeInfo.url)
      //console.log("you -------------------------------")
      if (changeInfo.url) {
        if(changeInfo.url!="chrome://newtab/"){
          console.log(tabId, changeInfo, tab)
        chrome.tabs.sendMessage(tabId, {
          message: 'pathChange',
          url: changeInfo.url
        })
        }
      }
    }
  );

  chrome.tabs.onCreated.addListener(
    function (tab) {
      console.log("this is tabs oncreate", tab)
    });
  chrome.tabs.onActivated.addListener(
    function (activeInfo) {
      console.log("this is tabs onActivated", activeInfo)
    });
  chrome.tabs.onRemoved.addListener(

    function (tabId, removeInfo) {
      console.log("this is tabs onRemoved", tabId, removeInfo)
    }

  );
  /*chrome.notifications.create(null, {
    type: 'image',
    iconUrl: 'img/icon.png',
    title: '祝福',
    message: '骚年，祝你圣诞快乐！Merry christmas!',
    imageUrl: 'img/lw.png'
});*/
}
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse)
{
    // code...
    console.log(request.command)
    switch(request.command){
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
    //sendResponse('我已收到你的命令：' +request.command);
    //sendResponse('我已收到你的消息：' +JSON.stringify(request));//做出回应
});

init()
