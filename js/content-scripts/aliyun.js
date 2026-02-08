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

// 初始化样式
loadStyles();

// 创建下载按钮
let downloadbtn = document.createElement("div");
downloadbtn.className = "nws-site-download-button nws-aliyun-download-container";
downloadbtn.innerHTML = "<button>下载json</button>";
downloadbtn.onclick = function () {
    let model = $("div.content--rYWre76t");
    let child = model.children();
    console.log(child)
    model.each(function (index, element) {
        console.log(index,element);
        let name = $(element).find("div.head--HXwGn3_N").text()
        let prompt=$(element).find("div.ant-typography").text()

        console.log(name,prompt)

        let formdata =new FormData()
        formdata.name=name
        formdata.prompt=prompt

        axios.post('http://127.0.0.1:8088/api/prompt/add', 
        {
            name: name,
            prompt: prompt
        })
          .then(function (response) {
            console.log(response);
          })
          .catch(function (error) {
            console.log(error);
          });
        /*
        const formdata = new FormData();
        formdata.append("name", name);
        formdata.append("prompt", prompt);
        $.ajax({
            url: "http://127.0.0.1:8080/api/prompt/add",
            type: "POST",
            data: formdata,
            success: function (data) {
                console.log(data)
            }
        });*/

    });

}
intervalId = setInterval(function () {
    var next = document.getElementById("baseMainSpace");
    console.log(next)
    if(next){
        var nextparent = next.parentElement;
        nextparent.firstChild
        if (nextparent.firstChild) {
            nextparent.insertBefore(downloadbtn, nextparent.firstChild)
        }
        clearInterval(intervalId );
    }
    
}, 1000);