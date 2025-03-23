// JavascriptでOS（Windows・Linux・Mac・iPad・iPhone）を判定
function myOS() {
    var ua = window.navigator.userAgent.toLowerCase();
    if (ua.match("windows") !== null) { return "windows"; } else 
    if (ua.match("linux") !== null) { return "linux"; } else 
    if (ua.match("mac") !== null) { return "mac"; } else 
    if (ua.match("ipad") !== null) { return "ipad"; } else 
    if (ua.match("iphone") !== null) { return "iphone"; } else { return "nothing"; }
}
// Javascriptでブラウザ（Chrome・IE・Edge・FireFox・Safari）を判定
function myBrowser() {
    var browser = window.navigator.userAgent.toLowerCase();
    if (browser.match("chrome") !== null) { return "chrome"; } else 
    if (browser.match("firefox") !== null) { return "firefox"; } else 
    if (browser.match("safari") !== null) { return "safari"; } else 
    if (browser.match("edge") !== null) { return "edge"; } else 
    if (browser.match("ie") !== null) { return "ie"; } else 
    if (browser.match("opera") !== null) { return "opera"; } else { return ""; }
}
