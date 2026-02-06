// JavascriptでOS（Windows・Linux・Mac・iPad・iPhone）を判定
function myDevice() {
    const ua = navigator.userAgent;
    const platform = navigator.platform;
    // 非推奨だがplatform=Win32からしかwindowsの判定が出来ない
    const isWindows = /Windows/.test(ua) ||
        (platform === 'Win32');
    // iPad判定（iPadOS13以降のMacintosh偽装にも対応）
    const isIPad = /iPad/.test(ua) ||
        (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isWindows) { return 'windows' } else
    if (isIPad) { return 'ipad' } else return 'other';
}
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
// 年がない日付文字列 (m/d) から、年月日 (yyyy-mm-dd) を算出して返却 (※空白とハイフン(/)はサーバーにfetch出来ない)
function myConvertOmitDateString(eddtlabel) {
    if (typeof eddtlabel !== "string") {
        throw new TypeError("引数は文字列である必要があります．");
    }
    if (eddtlabel.length <= 2) {
        throw new TypeError("想定外の日付が選択されました． 想定:[m/d (曜日)]");
    }
    // "/" の出現回数をカウントが２個以上
    const count = (eddtlabel.match(/\//g) || []).length;
    if (count > 2) {
        throw new TypeError(`想定外の日付が選択されました． [${eddtlabel}]`);
    }

    // 括弧"(曜日"があれば以降切り捨てる
    let datestr = "";
    const startIndex = eddtlabel.indexOf('(');
    if (startIndex > 0) {
        datestr = eddtlabel.slice(0, startIndex).trim();
    } else {
        datestr = eddtlabel.trim();
    }
    // 年判定
    const now = new Date();
    let year = (count == 1) ? now.getFullYear() : Number(datestr.split("/")[0]);
    const month = (count == 1) ? Number(datestr.split("/")[0]) : Number(datestr.split("/")[1]);
    const day = (count == 1) ? Number(datestr.split("/")[1]) : Number(datestr.split("/")[2]);
    if (now < new Date(year, month - 1 - 6, day)) {             // 2026年1月に2025年12月のデータを取得する場合
        year--;

    } else if (now > new Date(year, month - 1 + 6, day)) {      // 2025年12月に2026年1月のデータを取得する場合
        year++;

    }
    // "yyyy-mm-dd"文字列で返却 (※空白とハイフン(/)はサーバーにfetch出来ない)
    const date = String(year) + "-" + String(month).padStart(2, '0') + "-" + String(day).padStart(2, '0');
    return date;
}
// 設備番号から MCGCD を取得し返却
function myFuncGetMCGCD(mccode) {
    if (mccode.indexOf("-") == -1) {
        return (mccode=='MC3') ? 'ON' : (mccode=='MC2') ? '3BP' : (mccode=='MC1') ? 'MC' : mccode;
    } else {
        let mcgcd = mccode.split("-")[0];
        return (mcgcd=='MC3') ? 'ON' : (mcgcd=='MC2') ? '3BP' : (mcgcd=='MC1') ? 'MC' : mcgcd;
    }
}
// 設備番号から MCCD を取得し返却
function myFuncGetMCCD(mccode) {
    let mcgcd = "";
    let mccd = "";
    if (mccode.indexOf("-") == -1) {
        return mccode;
    } else {
        return mccode.split("-")[1];
    }
}
