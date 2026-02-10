// 监听右键菜单点击事件
chrome.contextMenus.onClicked.addListener(genericOnClick);

// 菜单点击回调函数
function genericOnClick(info) {
  //console.log(info);
  switch (info.menuItemId) {
    case 'elementHighlight':
      sendMessage('toggleElementHighlight');
      break;
    case 'copySelector':
      sendMessage('copySelector');
      break;
    case 'copyStyles':
      sendMessage('copyStyles');
      break;
    case 'downloadImage':
      if (info.srcUrl) {
        sendMessage('downloadImage', { url: info.srcUrl });
      }
      break;
    case 'downloadAllImages':
      sendMessage('downloadAllImages');
      break;
    case 'civitaiDownload':
      sendMessage('civitaiDownload');
      break;
    case 'translatePage':
      sendMessage('translatePage');
      break;
    case 'summarizePage':
      sendMessage('summarizePage');
      break;
    case 'htmlToMd':
      sendMessage('htmlToMd');
      break;
    case 'htmlToJson':
      sendMessage('htmlToJson');
      break;
    case 'aliprompt':
      if (info.pageUrl.indexOf('aliyun.com') !== -1) {
        sendMessage('aliprompt');
      }
      break;
    default:
      //console.log('未知的菜单项被点击');
  }
}

// 安装时创建右键菜单
chrome.runtime.onInstalled.addListener(function () {
  // 创建主菜单
  let parent = chrome.contextMenus.create({
    title: '网页工具集',
    id: 'parent'
  });

  // 元素交互菜单组
  let elementGroup = chrome.contextMenus.create({
    title: '元素交互',
    parentId: parent,
    id: 'elementGroup'
  });

  chrome.contextMenus.create({
    title: '元素高亮',
    parentId: elementGroup,
    id: 'elementHighlight'
  });

  chrome.contextMenus.create({
    title: '复制选择器',
    parentId: elementGroup,
    id: 'copySelector'
  });

  chrome.contextMenus.create({
    title: '复制样式',
    parentId: elementGroup,
    id: 'copyStyles'
  });

  // 图片处理菜单组
  let imageGroup = chrome.contextMenus.create({
    title: '图片处理',
    parentId: parent,
    id: 'imageGroup'
  });

  chrome.contextMenus.create({
    title: '下载当前图片',
    parentId: imageGroup,
    id: 'downloadImage',
    contexts: ['image']
  });

  chrome.contextMenus.create({
    title: '下载所有图片',
    parentId: imageGroup,
    id: 'downloadAllImages'
  });

  chrome.contextMenus.create({
    title: 'Civitai图片下载',
    parentId: imageGroup,
    id: 'civitaiDownload'
  });

  // 内容处理菜单组
  let contentGroup = chrome.contextMenus.create({
    title: '内容处理',
    parentId: parent,
    id: 'contentGroup'
  });

  chrome.contextMenus.create({
    title: '页面翻译',
    parentId: contentGroup,
    id: 'translatePage'
  });

  chrome.contextMenus.create({
    title: '页面总结',
    parentId: contentGroup,
    id: 'summarizePage'
  });

  chrome.contextMenus.create({
    title: 'HTML转MD',
    parentId: contentGroup,
    id: 'htmlToMd'
  });

  chrome.contextMenus.create({
    title: 'HTML转JSON',
    parentId: contentGroup,
    id: 'htmlToJson'
  });

  // 其他工具菜单组
  let otherGroup = chrome.contextMenus.create({
    title: '其他工具',
    parentId: parent,
    id: 'otherGroup'
  });

  chrome.contextMenus.create({
    title: '阿里prompt抓取',
    parentId: otherGroup,
    id: 'aliprompt'
  });
});

// 发送消息到content script
function sendMessage(cmd, data = {}) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        command: cmd,
        data: data
      });
    }
  });
}