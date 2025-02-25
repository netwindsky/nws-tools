
let downloadbtn = document.createElement("div")
downloadbtn.style = "position: fixed;right: 15px;margin-top: 20px;z-index: 1000;font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\";-webkit-tap-highlight-color: transparent;color: inherit;"
downloadbtn.innerHTML = "<button style=\"background-color: #1971c2;border-radius: 12px;border: none;color: white;padding: 8px 24px;text-align: center;text-decoration: none;display: inline-block;font-size: 12px;\">下载json</button>";
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


   