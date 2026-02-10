/**
 * 阿里云网站专用脚本
 * 重构版本：已分离内联样式
 */

// 加载样式
function loadStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('css/content-scripts.css');
    document.head.appendChild(link);
}

const startAliyun = () => {
    loadStyles();

    let downloadbtn = document.createElement("div");
    downloadbtn.className = "nws-site-download-button nws-aliyun-download-container";
    downloadbtn.innerHTML = "<button>下载json</button>";
    downloadbtn.onclick = function () {
        let model = $("div.content--rYWre76t");
        let child = model.children();
        //console.log(child)
        model.each(function (index, element) {
            //console.log(index,element);
            let name = $(element).find("div.head--HXwGn3_N").text()
            let prompt=$(element).find("div.ant-typography").text()

            //console.log(name,prompt)

            let formdata =new FormData()
            formdata.name=name
            formdata.prompt=prompt

            axios.post('http://127.0.0.1:8088/api/prompt/add', 
            {
                name: name,
                prompt: prompt
            })
              .then(function (response) {
                //console.log(response);
              })
              .catch(function (error) {
                //console.log(error);
              });
        });

    }
    let intervalId = setInterval(function () {
        var next = document.getElementById("baseMainSpace");
        //console.log(next)
        if(next){
            var nextparent = next.parentElement;
            nextparent.firstChild
            if (nextparent.firstChild) {
                nextparent.insertBefore(downloadbtn, nextparent.firstChild)
            }
            clearInterval(intervalId );
        }
        
    }, 1000);
};

const initAliyun = async () => {
    const chromeSettings = window.NWSModules?.ChromeSettingsModule;
    if (chromeSettings && typeof chromeSettings.isBlacklisted === 'function') {
        if (!chromeSettings.initialized && typeof chromeSettings.initialize === 'function') {
            await chromeSettings.initialize();
        }
        if (chromeSettings.isBlacklisted()) {
            return;
        }
    }
    startAliyun();
};

initAliyun();
