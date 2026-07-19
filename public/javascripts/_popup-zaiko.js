/*
    ポップアップウィンドウ（仕掛かり在庫）
*/

// 背景そのものをクリックした時だけ閉じる
document.addEventListener("DOMContentLoaded", () => {
    const zpopwin = document.getElementById("zaiqtyPopupWindow");
    zpopwin.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) {
            zpopwin.style.display = "none";
        }
    });
});

const inputZaiko = document.getElementById("inputZAIQTY");
const zaiModifyObj = document.getElementById("zaiqtyModify");
// TDで描画したボタンにフォーカスがあてられるように設定
zaiModifyObj.setAttribute("tabindex", "-1");
// イベントリスナー（フォーカス時全選択）（アロー関数編）
inputZaiko.addEventListener("focus", event => event.target.select());
// イベントリスナー（キーダウン）（無名関数編）
inputZaiko.addEventListener("keydown", function(event) {
    if (event.key == "Enter") {
        inputZaiko.blur();
        zaiModifyObj.focus();
    }
    if (event.keyCode == 27) document.getElementById("zaiqtyPopupWindow").style.display = "none";
});
// イベントリスナー（ボタンキーダウン）（1行で簡潔に記述してみた）
zaiModifyObj.addEventListener("keydown", e => e.key === "Enter" && zaikoModify());

// 仕掛り在庫の表示
function zaiqtyPopup(tblno, row) {
    const tblobj = document.getElementById(`tbl${tblno}`);
    const mcgcd = document.getElementById("mcgcd").value;
    const mccd = document.getElementById(`mccd${tblno}`).value;
    const hmcd = tblobj.rows[row].cells[0].innerText;
    const endcol = tblobj.rows[1].cells.length - 1;
    // 仕掛り在庫情報を変換
    let zaiqty = 0;
    let zaiqtystr = tblobj.rows[row].cells[endcol - 3].innerText;
    if (!isNaN(zaiqtystr) && zaiqtystr.trim() !== "") {
        zaiqty = Number(zaiqtystr);
    } else if (zaiqtystr.includes("自:")) {
        zaiqty = zaiqtystr.split("自:")[1];
    }
    // ポップアップウィンドウに値をセット
    document.getElementById("popHMCD").innerText = hmcd;
    document.getElementById("popZAIQTY").innerText = zaiqty;
    document.getElementById("popMCCD").value = mccd;
    document.getElementById("popTBLNO").value = tblno;
    document.getElementById("popROW").value = row;
    inputZaiko.value = "";
    // 閉じるイベントリスナー設定
    document.getElementById("zaiqtyClose").addEventListener("click", () => {
        document.getElementById("zaiqtyPopupWindow").style.display = "none";
    });
    // ポップアップウィンドウを表示
    document.getElementById("zaiqtyPopupWindow").style.display = "flex";
    inputZaiko.focus();
}
// 表示されているポップアップウィンドウの場所を変更
function w(justifyname, alignname) {
    document.getElementById("zaiqtyPopupWindow").style.justifyContent = justifyname;
    document.getElementById("zaiqtyPopupWindow").style.alignItems = alignname;
}
// 数値キーパッド処理
function i(numpad) {
    if (inputZaiko.value.length >= 6) return;
    inputZaiko.value += numpad;
}
// BS処理
function inputBS() {
    inputZaiko.value = inputZaiko.value.slice(0, inputZaiko.value.length - 1);
}
// Clear処理
function inputClear() {
    inputZaiko.value = "";
    inputZaiko.focus();
}
// イコール＝処理
function equalqty() {
    inputZaiko.value = document.getElementById("popODRQTY").innerText
}
// 共通の入力ボックスチェック
function checkInputZaiko() {
    let errmsg = "";
    if (isNaN(inputZaiko.value)) errmsg = "数値を入力して下さい";
    if (inputZaiko.value == "") errmsg = "訂正数を入力して下さい";
    if (errmsg != "") {
        alert(errmsg);
        inputZaiko.focus();
        return "false";
    }
    return "true";
}
// 在庫訂正
async function zaikoModify() {
    if (checkInputZaiko() == "false") {return;}
    let hmcd = document.getElementById("popHMCD").innerText;
    let tblno = document.getElementById("popTBLNO").value;
    let mcgcd = document.getElementById("mcgcd").value;
    let mccd = document.getElementById("popMCCD").value;
    let row = document.getElementById("popROW").value;
    let col = document.getElementById("popCOL").value;
    let zaiqty = Number(inputZaiko.value);          // 訂正在庫数
    const tblobj = document.getElementById(`tbl${tblno}`);
    const popWin = document.getElementById("zaiqtyPopupWindow");
    try {
        const response = await fetch(`/mysqlsv/modifyZaiko/${hmcd}:${mcgcd}:${mccd}:${zaiqty}:`)
        /* 2026.01.30 仕掛り在庫からのステータス更新処理は廃止
        // 訂正在庫数で消し込みし直し
        for (var j=5; j<=11; j+=6) {
            for (var k=0; k<5; k++) {
                if (!isNaN(tblobj.rows[row].cells[j+k].innerText) && tblobj.rows[row].cells[j+k].innerText != "") {
                    let qty = Number(tblobj.rows[row].cells[j+k].innerText);
                    if (qty > 0) {
                        // 仕掛かり在庫判定（ステータスを済に変更）
                        if (zaiqty >= qty) {
                            tblobj.rows[row].cells[j+k].className = "s4 td-qty";
                            zaiqty -= qty;
                        } else if (zaiqty > 0 && qty > 0) {
                            let remainper = 100 - Math.round(zaiqty / qty * 100);
                            tblobj.rows[row].cells[j+k].style = "--remain-per: " + remainper + "%;";
                            tblobj.rows[row].cells[j+k].className = "s3 td-qty";
                            zaiqty = 0;
                        } else {
                            tblobj.rows[row].cells[j+k].className = "s2 td-qty";
                        }
                    }
                }
            }
        }
        */
        // 訂正在庫数でDOM更新
        const endcol = tblobj.rows[1].cells.length - 1;
        tblobj.rows[row].cells[endcol - 3].innerHTML = `<a href="javascript:zaiqtyPopup(${tblno},${row})" class="td-zai-a">` + inputZaiko.value + "</a>" ;
        popWin.style.display = "none";
    } catch (err) {
        alert(err);
    }
}
