
// A generic onclick callback function.
chrome.contextMenus.onClicked.addListener(genericOnClick);

// A generic onclick callback function.
function genericOnClick(info) {
  console.log(info)
  switch (info.menuItemId) {
    case 'aliprompt':
      // Radio item function
      let url=info.pageUrl
      //url包含aliyun.com
      if(url.indexOf('aliyun.com')!=-1){
        sendMessage("aliprompt")
      }

      break;
    default:
      // Standard context menu item function
      console.log('Standard context menu item clicked.');
  }
}

chrome.runtime.onInstalled.addListener(function () {
  // Create one test item for each context type.
  let parent=chrome.contextMenus.create({
    title: '工具合集',
    id: 'parent'
  });

  chrome.contextMenus.create({
    title: '阿里prompt抓取',
    parentId:parent,
    id: 'aliprompt'
  });

});

function sendMessage(cmd) {
  console.log("sendsuccess",chrome.runtime);

}