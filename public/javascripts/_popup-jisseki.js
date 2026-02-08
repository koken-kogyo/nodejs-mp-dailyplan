/*
    ポップアップウィンドウ（実績入力）
*/

/* ポップアップ関連 ここから */
const inputBox = document.getElementById("inputJIQTY");
const startObj = document.getElementById("jiqtyStart");
const finishObj = document.getElementById("jiqtyEntry");
const modifyObj = document.getElementById("jiqtyModify");
// TDで描画したボタンにフォーカスがあてられるように設定
finishObj.setAttribute("tabindex", "-1");
modifyObj.setAttribute("tabindex", "-1");
// イベントリスナー（フォーカス時全選択）（アロー関数での書き方と）
inputBox.addEventListener("focus", event => event.target.select());
// イベントリスナー（実績数キーダウン）（無名関数での書き方とで比較してみた）
inputBox.addEventListener("keydown", function(event) {
    if (event.key == "Enter") {
        inputBox.blur();
        const finishObj = document.getElementById("jiqtyEntry");
        const modifyObj = document.getElementById("jiqtyModify");
        if (!finishObj.classList.contains("disable")) finishObj.focus();
        if (!modifyObj.classList.contains("disable")) modifyObj.focus();
    }
    if (event.keyCode == 27) document.getElementById("jiqtyPopupWindow").style.display = "none";
});
// イベントリスナー（ボタンキーダウン）（1行で簡潔に記述してみた）
finishObj.addEventListener("keydown", e => e.key === "Enter" && orderEntry());
modifyObj.addEventListener("keydown", e => e.key === "Enter" && orderModify());
// イベントリスナー（閉じる）
document.getElementById("jiqtyClose").addEventListener("click", () => {
    document.getElementById("jiqtyPopupWindow").style.display = "none";
});

// 二重送信防止フラグ
let flgSubmit = false;

// 実績入力ポップアップの起動
async function jissekiPopup(tblno, row, col, mode) {
    // 呼び出し元の基本情報取得
    //alert(tblno + " - " + row + ":" +col)
    let tblobj = document.getElementById(`tbl${tblno}`);
    if (tblobj.rows[row].cells[4].innerText != "") {
        alert("遅れがある場合は実績入力出来ません．");
        return;
    }
    let mcgcd = document.getElementById("mcgcd").value;
    let mccd = document.getElementById(`mccd${tblno}`).value;
    let stdt = document.getElementById("starteddt").value;      // ymd[0]
    let basecol = (col > 10) ? 6 : 5;
    let eddt = document.getElementById(`eddt${col - basecol}`).value; // ymd[0] == col:5 == 遅れ ...
    let hmcd = tblobj.rows[row].cells[0].innerText;
    let odrqty = tblobj.rows[row].cells[col].innerText;
    let fetchv = "";
    if (mode == "ORDER") {
        fetchv = "getOdrno";
    } else {
        fetchv = "getPlnno";
    }
    if (flgSubmit) return;
    flgSubmit = true;
    // 品番,設備,手配日付から、注文番号[ODRNO],手配状態[ODRSTS],実績数[JIQTY],未来の実績数[FUTUREQTY],過去の実績残数[ZANQTY]を取得するAPI
    fetch(`/mysqlsv/${fetchv}/${hmcd}:${mcgcd}:${mccd}:${eddt}:${stdt}:`)
    .then(response => response.json())
    .then(data => {
        flgSubmit = false;
        if (data.length == 0) {
            alert("遅れ分の実績訂正には対応していません．");
            return;
        }
        // ポップアップウィンドウに値をセット
        let odrno = data[0].ODRNO;
        let odrsts = data[0].ODRSTS;
        document.getElementById("jpopHMCD").innerText = hmcd;
        document.getElementById("jpopODRNO").innerText = odrno;
        document.getElementById("jpopODRSTS").innerText = (odrsts=="1") ? "追加分" : (odrsts=="2") ? "着手前" : (odrsts=="3") ? "着手中" : (odrsts=="4") ? "完了" : (odrsts=="9") ? "取消" : "不明";
        document.getElementById("jpopEDDT").innerText = eddt;
        document.getElementById("jpopODRQTY").innerText = odrqty;
        document.getElementById("jpopJIQTY").innerText = data[0].JIQTY;
        document.getElementById("jpopFUTUREODR").innerText = data[0].FUTUREODR;
        document.getElementById("jpopFUTUREQTY").innerText = data[0].FUTUREQTY;
        document.getElementById("jpophMCCD").value = mccd;
        document.getElementById("jpophTBLNO").value = tblno;
        document.getElementById("jpophROW").value = row;
        document.getElementById("jpophCOL").value = col;
        document.getElementById("jpophKTSEQ").value = data[0].KTSEQ;
        document.getElementById("jpophMODE").value = mode;
        inputBox.value = "";
        // 使用可能ボタンを判定
        /*
        const startObj = document.getElementById("jiqtyStart");
        const finishObj = document.getElementById("jiqtyEntry");
        const modifyObj = document.getElementById("jiqtyModify");
        */
        startObj.classList.remove("disable");
        finishObj.classList.remove("disable");
        modifyObj.classList.remove("disable");
        if (odrsts == "1") {
            startObj.classList.add("disable");
            if (Number(data[0].ZANQTY) != 0) finishObj.classList.add("disable");
            modifyObj.classList.add("disable");
        } else if (odrsts == "2") {
            if (Number(data[0].ZANQTY) != 0) startObj.classList.add("disable");
            if (Number(data[0].ZANQTY) != 0) finishObj.classList.add("disable");
            modifyObj.classList.add("disable");
        } else if (odrsts == "3") {
            startObj.classList.add("disable");
            if (Number(data[0].JIQTY) == 0) modifyObj.classList.add("disable");
        } else if (odrsts == "4") {
            startObj.classList.add("disable");
            finishObj.classList.add("disable");
            if (Number(data[0].FUTUREQTY) != 0) modifyObj.classList.add("disable");
        } else {
            startObj.classList.add("disable");
            finishObj.classList.add("disable");
            modifyObj.classList.add("disable");
        }
        // ポップアップウィンドウを表示
        document.getElementById("jiqtyPopupWindow").style.display = "flex";
        inputBox.focus();
    })
    .catch(err => {alert(err);});
}
// 表示されているポップアップウィンドウの場所を変更
function jiw(justifyname, alignname) {
    document.getElementById("jiqtyPopupWindow").style.justifyContent = justifyname;
    document.getElementById("jiqtyPopupWindow").style.alignItems = alignname;
}
// 数値キーパッド処理
function jii(numpad) {
    if (inputBox.value.length >= 4) return;
    inputBox.value += numpad;
}
// BS処理
function jiinputBS() {
    inputBox.value = inputBox.value.slice(0, inputBox.value.length - 1);
}
// Clear処理
function jiinputClear() {
    inputBox.value = "";
    inputBox.focus();
}
// イコール＝処理
function jiequalqty() {
    inputBox.value = Number(document.getElementById("jpopODRQTY").innerText);
}
// 作業開始
function orderStart() {
    let odrno = document.getElementById("jpopODRNO").innerText;
    let tblno = document.getElementById("jpophTBLNO").value;
    let mcgcd = document.getElementById("mcgcd").value;
    let mccd = document.getElementById("jpophMCCD").value;
    let row = document.getElementById("jpophROW").value;
    let col = document.getElementById("jpophCOL").value;
    const tblobj = document.getElementById(`tbl${tblno}`);
    const popWin = document.getElementById("jiqtyPopupWindow");
    fetch(`/mysqlsv/startOrder/${odrno}:${mcgcd}:${mccd}:`)
    .then(res => {if(!res.ok) {throw new Error(`${res.status} ${res.statusText}`);}})
    .then(data => {
        //廃止 tblobj.rows[row].cells[col].className = "s1";
        popWin.style.display = "none";
    })
    .catch(err => {alert(err);});
}
// 実績登録
async function orderEntry() {
    if (checkInputBox() == "false") {return;}
    let odrno = document.getElementById("jpopODRNO").innerText;
    let hmcd = document.getElementById("jpopHMCD").innerText;
    let odrqty = Number(document.getElementById("jpopODRQTY").innerText);       // 手配数
    let prejiqty = Number(document.getElementById("jpopJIQTY").innerText);      // 変更前の実績数
    let futureodr = Number(document.getElementById("jpopFUTUREODR").innerText);
    let futureqty = Number(document.getElementById("jpopFUTUREQTY").innerText);
    let jiqty = Number(inputBox.value);                                         // 変更後の実績数
    let mode = document.getElementById("jpophMODE").value;
    let tblno = document.getElementById("jpophTBLNO").value;
    let mcgcd = document.getElementById("mcgcd").value;
    let mccd = document.getElementById("jpophMCCD").value;
    let row = document.getElementById("jpophROW").value;
    let col = document.getElementById("jpophCOL").value;
    let ktseq = Number(document.getElementById("jpophKTSEQ").value);

    // 個別の入力ボックスチェック
    if (mode == "ORDER" && ktseq==1 && (odrqty - prejiqty + futureodr) < jiqty) {
        const msg = "内示注文の消込も行います\nよろしいですか？";
        if (!window.confirm(msg)) {
            inputBox.focus();
            return;
        }
    }
    
    const tblobj = document.getElementById(`tbl${tblno}`);
    const popWin = document.getElementById("jiqtyPopupWindow");
    try {
        // 内部的な実績登録、在庫登録、ステータス更新（データベース）
        const response = await fetch(`/mysqlsv/jissekiRegist/${odrno}:${hmcd}:${mcgcd}:${mccd}:${jiqty}:${mode}:`)
        const data = await response.json();
        // 表面上のステータス更新（DOM）
        data.forEach(function (d) {
            if ((mode=="ORDER" && d.TARGET=="ORDER") || (mode=="PLAN" && d.TARGET=="PLAN")) {
                let idx = d.COLIDX;
                idx = (idx<5) ? idx + 5 : idx + 6; // 配列番号をtableのcolに合わせる
                if (d.NEWSTS == "3") {
                    let odrqty = Number(tblobj.rows[row].cells[idx].innerText);
                    let newjiqty = Number(d.NEWJIQTY);
                    let remainper = 100 - Math.round(newjiqty / odrqty * 100);
                    tblobj.rows[row].cells[idx].style = "--remain-per: " + remainper + "%;";
                    tblobj.rows[row].cells[idx].className = "s3";
                } else if (d.NEWSTS == "4") {
                    tblobj.rows[row].cells[idx].className = "s4 td-qty";
                }
            }
        });
        // 表面上の仕掛り在庫更新（DOM）
        const endcol = tblobj.rows[row].cells.length - 1;
        let zaiqty = Number(tblobj.rows[row].cells[endcol - 3].innerText??0);
        tblobj.rows[row].cells[endcol - 3].innerHTML = `<a href="javascript:zaiqtyPopup(${tblno},${row})" class="td-zai-a">` + (zaiqty + jiqty) + "</a>" ;
        tblobj.rows[row].cells[endcol - 3].style.cursor = "pointer";
        // ポップアップを消して終了
        popWin.style.display = "none";
    } catch (err) {
        alert(err);
    }
}
// 共通の入力ボックスチェック
function checkInputBox() {
    let errmsg = "";
    if (inputBox.value == "") errmsg = "実績数を入力して下さい";
    if (Number.isNaN(inputBox.value)) errmsg = "数値を入力して下さい";
    //if (Number(inputBox.value) < 0) errmsg = "0以上を入力して下さい";
    if (errmsg != "") {
        alert(errmsg);
        inputBox.focus();
        return "false";
    }
    return "true";
}
// 実績訂正
async function orderModify() {
    if (checkInputBox() == "false") return;
    let odrno = document.getElementById("jpopODRNO").innerText;
    let hmcd = document.getElementById("jpopHMCD").innerText;
    let odrqty = Number(document.getElementById("jpopODRQTY").innerText);
    let preqty = Number(document.getElementById("jpopJIQTY").innerText);
    let modqty = Number(inputBox.value);
    if (preqty == modqty) {
        alert("変更ありません．\n正しい数を入力してください");
        inputBox.focus();
        return;
    }
    if (odrqty < modqty) {
        const msg = "注文数以上の訂正です．\nこのまま処理を続行してよろしいですか？";
        if (!window.confirm(msg)) {
            inputBox.focus();
            return;
        }
    }
    if (modqty < 0) {
        const msg = "マイナスが入力されました．\n過去にさかのぼって訂正してもよろしいですか？";
        if (!window.confirm(msg)) {
            inputBox.focus();
            return;
        }
    }
    let mode = document.getElementById("jpophMODE").value;
    let tblno = document.getElementById("jpophTBLNO").value;
    let mcgcd = document.getElementById("mcgcd").value;
    let mccd = document.getElementById("jpophMCCD").value;
    let row = document.getElementById("jpophROW").value;
    let col = document.getElementById("jpophCOL").value;
    const tblobj = document.getElementById(`tbl${tblno}`);
    const popWin = document.getElementById("jiqtyPopupWindow");
    try {
        // 内部的な実績登録、在庫登録、ステータス更新（データベース）
        const response = await fetch(`/mysqlsv/modifyOrder/${odrno}:${hmcd}:${mcgcd}:${mccd}:${preqty}:${modqty}:${mode}:`)
        const data = await response.json();
        // 表面上のステータス更新（DOM）
        let jiqty = modqty - preqty;
        data.forEach(function (d) {
            if ((mode=="ORDER" && d.TARGET=="ORDER") || (mode=="PLAN" && d.TARGET=="PLAN")) {
                let idx = d.COLIDX;
                idx = (idx<5) ? idx + 5 : idx + 6; // 配列番号をtableのcolに合わせる
                if (d.NEWSTS == "2") {
                    tblobj.rows[row].cells[idx].className = "s2 td-qty";
                } else if (d.NEWSTS == "3") {
                    let odrqty = Number(tblobj.rows[row].cells[idx].innerText);
                    let newjiqty = Number(d.NEWJIQTY);
                    let remainper = 100 - Math.round(newjiqty / odrqty * 100);
                    tblobj.rows[row].cells[idx].style = "--remain-per: " + remainper + "%;";
                    tblobj.rows[row].cells[idx].className = "s3 td-qty";
                } else if (d.NEWSTS == "4") {
                    tblobj.rows[row].cells[idx].className = "s4 td-qty";
                }
            }
        });
        // 表面上の仕掛り在庫更新（DOM）
        const endcol = tblobj.rows[row].cells.length - 1;
        let zaiqty = Number(tblobj.rows[row].cells[endcol - 3].innerText??0);
        tblobj.rows[row].cells[endcol - 3].innerHTML = `<a href="javascript:zaiqtyPopup(${tblno},${row})" class="td-zai-a">` + (zaiqty + jiqty) + "</a>" ;
        tblobj.rows[row].cells[endcol - 3].style.cursor = "pointer";
        // ポップアップを消して終了
        popWin.style.display = "none";
    } catch (err) {
        alert(err);
    }
}
