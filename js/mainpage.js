//alert("Hello World!");

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.message === 'pathChange') {
        arr= request.url.split("/");
        filename=arr[arr.length - 1];
        console.log(filename) // new url is now in content scripts!
        //window.addEventListener('load', windowLoadedHandler,false)
        //window.onload = windowLoadedHandler();
    }
});