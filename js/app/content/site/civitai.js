/**
 * civitai.js - 用于Civitai网站采集数据的核心脚本
 * 主要功能：
 * 1. 采集模型信息
 * 2. 采集图片数据
 * 3. 处理关键词信息
 * 重构版本：已分离内联样式
 */

(async () => {
    const chromeSettings = window.NWSModules?.ChromeSettingsModule;
    if (chromeSettings && typeof chromeSettings.isBlacklisted === 'function') {
        if (!chromeSettings.initialized && typeof chromeSettings.initialize === 'function') {
            await chromeSettings.initialize();
        }
        if (chromeSettings.isBlacklisted()) {
            return;
        }
    }

// 加载样式
function loadStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('css/content-scripts.css');
    document.head.appendChild(link);
}

// 初始化样式
loadStyles();

let civitaipath = "#civitai:\n" + window.location.href + "\n";
let arr = window.location.href.split("/");
let filename = arr[arr.length - 1];
function receiveMsg() {
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.message === 'pathChange') {
            arr = request.url.split("/");
            filename = arr[arr.length - 1];
            ////console.log(filename) // new url is now in content scripts!
            //window.addEventListener('load', windowLoadedHandler,false)
            //window.onload = windowLoadedHandler();

        }
    });
};
receiveMsg();
// 初始化JSON对象用于存储采集的数据
let jsonobj = JSON.parse("{}");

//延时5秒钟执行windowLoadedHandler()函数
// 使用全局ConfigManager对象
const ConfigManager = window.ConfigManager || {
    getConfig: async () => ({}),
    setConfig: async () => false
};

// 创建下载按钮
let downloadbtn = document.createElement("div");
downloadbtn.className = "nws-site-download-button nws-civitai-download-container";
downloadbtn.innerHTML = "<button>下载json</button>";
downloadbtn.onclick = async function () {
    const config = await ConfigManager.getConfig('toggleSettings');
    if (!config.imageDownloader) {
        alert('请在插件设置中启用图片下载功能');
        return;
    }
    getModelInfo()
    getDataInfo()
    getImageInfo()
}
setTimeout(function () {
    var next = document.getElementById("__next");
    var nextparent = next.parentElement;
    nextparent.firstChild
    if (nextparent.firstChild) {
        nextparent.insertBefore(downloadbtn, nextparent.firstChild)
    }
}, 1000);
function getModelInfo() {
    jsonobj["civitaipath"] = window.location.href;
    ////console.log(arr[arr.length - 1]);
    //模型区
    let $model = $("div.mantine-mwqi5l");
    let $child = $model.children();
    let models = "#Model:\n";
    let modelsjson = [];
    $child.each(function (index, element) {
        ////console.log(index,element);
        if ($(element).hasClass("mantine-4xj3rk")) {
            let name = $(element).find("div.mantine-p6jtwo").text()
            let type = $(element).find("div.mantine-1m0j8uq").text()
            let href = "https://civitai.com" + element.getAttribute("href")
            modelsjson.push({ "name": name, "type": type, "href": href });
            ////console.log(name,type,href);
            models += "**模型：**" + name + "\n**类型：**" + type + "\n**地址：**" + href + "\n\r";
            models += "\n";
        }
    });
    jsonobj["models"] = modelsjson;
}
function getDataInfo() {
    //数据区
    let data = "#Data:\n";
    let datajson = {}
    let $general = $("div.mantine-Text-root.mantine-6bst0b");
    $.each($general, function (index, element) {
        ////console.log(index);
        ////console.log(element);
        let parent = $(element).parent()[0];
        ////console.log(parent);
        let key = $(parent).find("div.mantine-6bst0b").text();
        let value = $(parent).find("[dir='ltr']").text();
        datajson[key] = value;
        data += "**" + key + "**:" + value + "\n";
        ////console.log(key, value);
    });

    let keywordjson = {};
    let keyword = "#KEYWORD:\n";
    let $prompt = $("div.mantine-Stack-root.mantine-1qlxz9s");
    $.each($prompt, function (index, element) {
        ////console.log(index);
        ////console.log(element);
        let parent = $(element).parent()[0];
        if ($(parent).hasClass("mantine-zyu68o")) {
            let key = $(element).find("div.mantine-Text-root.mantine-1ercuvb").text();
            let value = $(element).find("[dir='ltr']").text();
            //datajson[key]=value;
            //data+="**"+key+"**:"+value+"\n";
            keyword += "**" + key + "**:" + value + "\n\r";
            keywordjson[key] = value;
            ////console.log(key, value);
        }
        jsonobj["keyword"] = keywordjson;
        jsonobj["data"] = datajson;
        //let key=$(parent).find("div.mantine-Stack-root.mantine-zyu68o").text();
        //let value=$(parent).find("[dir='ltr']").text();
        ////console.log(parent);
    });
}

let blob;
/**
 * 下载并处理图片
 * @param {string} imagepath - 图片URL
 */
function downloadImage(imagepath) {
    // 添加数据验证
    if (!imagepath || typeof imagepath !== 'string') {
        console.error('无效的图片路径');
        return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', imagepath, true);
    xhr.responseType = 'blob';
    
    // 添加超时处理
    xhr.timeout = 30000; // 30秒超时
    
    xhr.onload = function(e) {
        if (this.status == 200) {
            blob = this.response;
            // 验证blob数据
            if (blob.size > 0) {
                uploadImage(blob);
            } else {
                console.error('图片数据为空');
            }
        } else {
            console.error('下载图片失败:', this.status);
        }
    };
    
    xhr.onerror = function() {
        console.error('获取图片数据时出错:', xhr.statusText);
    };
    
    xhr.ontimeout = function() {
        console.error('图片下载超时');
    };
    
    try {
        xhr.send();
    } catch (error) {
        console.error('发送请求失败:', error);
    }
}




let imagejson = {};
function getImageInfo() {
    //图片区
    let $image = $("div.mantine-1ynvwjz img");
    //console.log($image[0])
    let imagepath = $image[0].getAttribute("src");

    let images;
    imagejson["path"] = imagepath;
    //imagejson= { "path": imagepath };
    //let imageBase64;
    imagejson["data"] = "";
    ////console.log(base64String);
    jsonobj["image"] = imagejson
    
    downloadImage(imagepath)

    //formdata.append("image", $image[0]);
    
    /*
    const b = document.createElement("a");
    b.href = "data:application/octet-stream," + encodeURIComponent(JSON.stringify(jsonobj));
    b.download = filename + ".json";
    b.click();
    */
    /*
    getBase64Image(imagepath).then(base64String => {
        //imageBase64=base64String;
        //images = "#Image:\n  ![图片](" + base64String + ")\n";
        //imagejson["data"] = base64String;
        ////console.log(base64String);
        //jsonobj["image"] = imagejson
        imageCompleted(base64String);

    }).catch(err => {
        console.error(err);
    });*/
    ////console.log(imagejson);

}

/**
 * 上传图片数据到服务器
 * @param {Blob} blob - 图片数据
 */
function uploadImage(blob) {
    // 数据验证
    if (!(blob instanceof Blob)) {
        console.error('无效的图片数据');
        return;
    }

    const formdata = new FormData();
    formdata.append("data", JSON.stringify(jsonobj));
    formdata.append("image", blob);

    // 使用Promise包装异步操作
    return new Promise((resolve, reject) => {
        $.ajax({
            url: "http://127.0.0.1:8080/threed-0/api/aigc/add",
            type: "POST",
            data: formdata,
            async: true, // 改为异步上传
            cache: false,
            processData: false,
            contentType: false,
            timeout: 30000, // 30秒超时
            success: function(data) {
                sendsuccess(data);
                switch (data) {
                    case "success":
                        //console.log("上传成功");
                        resolve(data);
                        break;
                    case "hasit":
                        //console.log("文件已存在");
                        resolve(data);
                        break;
                    default:
                        console.error("上传错误");
                        reject(new Error("上传失败"));
                        break;
                }
            },
            error: function(xhr, status, error) {
                console.error('上传失败:', error);
                reject(error);
            }
        });
    });
}
function sendsuccess(cmd) {
    ////console.log("sendsuccess",chrome.runtime);
    //let cmd="success";
    chrome.runtime.sendMessage(
        {
            command : cmd
        },
            function(response) {
            //console.log('收到来自后台的回复：' + response);
        }
    );
}
//sendsuccess();
function imageCompleted(base64String) {
    let images;
    //let imagejson = { "path": imagepath };
    ////console.log("imageCompleted");
    images = "#Image:\n  ![图片](" + base64String + ")\n";
    imagejson["data"] = base64String;
    ////console.log(base64String);
    jsonobj["image"] = imagejson

    const b = document.createElement("a");
    b.href = "data:application/octet-stream," + encodeURIComponent(JSON.stringify(jsonobj));
    b.download = filename + ".json";
    b.click();
}

//更具图片地址转换Base64
function getBase64Image(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; // 如果需要跨域加载图片，则设置此属性
        img.onload = function () {
            const canvas = document.createElement("canvas");
            canvas.width = this.naturalWidth;
            canvas.height = this.naturalHeight;

            const context = canvas.getContext("2d");

            context.drawImage(this, 0, 0);

            resolve(canvas.toDataURL());
        };

        img.onerror = function () {
            reject(new Error('Failed to load image'));
        }

        img.src = url;
    });
}

})();
