/*
    ポップアップウィンドウ（i-Reporter）
*/

// i-Reporter 選択ポップアップ画面の起動（手配内示共通）
async function iReporter(tblno, row) {
    // 呼び出し元の基本情報取得
    const tblobj = document.getElementById(`tbl${tblno}`);
    const hmcd = tblobj.rows[row].cells[0].innerText;
    const mcgcd = document.getElementById("mcgcd").value;
    const mccd = document.getElementById(`mccd${tblno}`).value;
    //alert(tblno + ":" + row + ":" + hmcd)

    // iRepoサーバーの稼働確認
    const isireposv = await fetch("/ireposv/isireposv");
    if (!isireposv.ok) {
        alert("IREPOSVの稼働が確認できませんでした．");
        return;
    }
    // iRepo情報の取得API
    const irepoinfo = await this.getDefid(hmcd, mcgcd, mccd);
    if (!irepoinfo) return;
    // 直接呼出し工程（値やフラグを渡してあげないといけない）
    if (mcgcd == "SW") {
        const repid = await getHoldid(irepoinfo.DEFID, hmcd, irepoinfo.HMCDCID);
        if (!repid) return;
        iRepoCustomURL(tblno, row, mcgcd, hmcd, irepoinfo.DEFID, irepoinfo.HMCDCID, repid)

    // ポップアップで選択工程
    } else {
        const table = document.getElementById("irepoPopupTable");
        // ポップアップウィンドウに値をセット
        document.getElementById("ipopHMCD").innerText = hmcd;
        // 一覧を一旦削除
        do {
            if (table.rows.length > 2) {table.
                deleteRow(-1);}
        } while (table.rows.length > 2);
        // 一覧の取得
        const viewreport = await this.getViewReport(irepoinfo.DEFID);
        if (!viewreport) {
            const msg = `帳票定義ID:${irepoinfo.DEFID} が本番環境に移行されていません．`;
            document.getElementById("oldReport").innerText = msg;
        } else if (viewreport.rowCount == 0) {
            const msg = `過去に入力した帳票は存在しません．`;
            document.getElementById("oldReport").innerText = msg;
        } else {
            document.getElementById("oldReport").innerText = 
                "チェックシート一覧（最新の10件を表示、タップして過去履歴の呼び出し）";
            // APIで取得したデータをテーブ行に追加
            viewreport.rows.forEach(function (d) {
                let newRow = table.insertRow();
                appendTD(newRow, d.rep_top_id, "small", 1);
                appendTD(newRow, d.rep_top_name, "small lef", 1);
                appendTD(newRow, d.edit_refer_status, "", 1);
                appendTD(newRow, d.sys_regist_time, "small", 1);
                appendTD(newRow, d.sys_update_time, "small", 1);
                // 帳票IDを起動
                newRow.addEventListener("click", () => {
                    location.href = `jp.co.cimtops.ireporter.openreport:repid=${d.rep_top_id}`;
                    document.getElementById("irepoPopupWindow").style.display = "none";
                });
            });
        };
        // 新規帳票起動イベント設定
        document.getElementById("ipopDEFID").value = irepoinfo.DEFID;
        const btnNewReport = document.getElementById("newReport");
        btnNewReport.addEventListener("click", () => {
            location.href = `jp.co.cimtops.ireporter.createreport:defid=${document.getElementById("ipopDEFID").value}`;
            document.getElementById("irepoPopupWindow").style.display = "none";
        }, { once: true });
        btnNewReport.addEventListener("keydown", function(event) {
            if (event.key == "Enter") btnNewReport.click();
            if (event.keyCode == 27) document.getElementById("irepoPopupWindow").style.display = "none";
        }, { once: true });
        // 閉じるイベントリスナー設定
        document.getElementById("irepoClose").addEventListener("click", () => {
            document.getElementById("irepoPopupWindow").style.display = "none";
        });
        // ポップアップウィンドウを表示
        document.getElementById("irepoPopupWindow").style.display = "flex";
        btnNewReport.focus(); // TD要素にフォーカスをセットするにはtabindex属性が必要です。
    }
}

// カスタムURLスキームによるシステム連携
function iRepoCustomURL(tblno, row, mcgcd, hmcd, defid, clusterno, repid) {
    // iRepo呼び出し用データの取得
    const tblobj = document.getElementById(`tbl${tblno}`);
    const irepourl = "jp.co.cimtops.ireporter";

    // 新規帳票定義を起動
    if (repid == 0) {
        if (mcgcd == "SW") {
            // 選択されたデータをセットして帳票定義IDを起動
            const mate = tblobj.rows[row].cells[2].innerText;
            const cut = tblobj.rows[row].cells[3].innerText;
            const hmcdparam = encodeURI(`スキャン品番=${hmcd}`);
            const mateparam = encodeURI(`材料サイズ=${mate}`);
            const cutparam = encodeURI(`切断長=${cut}`);
            const modeparam = encodeURI("処理モード=order"); // 手配モードで帳票を起動
            location.href = `${irepourl}.createreport:defid=${defid}` +
                `&${hmcdparam}&${mateparam}&${cutparam}&${modeparam}`;
        } else {
            // 帳票定義IDをそのまま起動
            location.href = `${irepourl}.createreport:defid=${defid}`;
        }

    // 保留中の帳票IDから起動
    } else {
        location.href = `${irepourl}.openreport:repid=${repid}`;
    }
}

// 保留中の帳票IDを取得
async function getHoldid(defid, hmcd, clusterno) {
    let customurl = "";
    if (clusterno == 0) {
        customurl = `/ireposv/getHoldid/${defid}`;
    } else {
        customurl = `/ireposv/getHoldid/${defid}:${hmcd}:${clusterno}`;
    }
    // irepoサーバーから編集中帳票ID取得API
    const res = await fetch(customurl);
    const repid = await res.json();
    if (!res.ok) {
        alert(repid.errormessage);
        return null;        
    }
    return repid;
}

// 帳票一覧を取得
async function getViewReport(defid) {
    const res = await fetch(`/ireposv/getViewReport/${defid}`);
    const viewreport = await res.json();
    if (!res.ok) {
        alert(viewreport.errormessage);
        return null;        
    }
    return viewreport;
}

// 品番と設備Gと設備コードから帳票IDと品番クラスター番号を取得
async function getDefid(hmcd, mcgcd, mccd) {
    try {
        const res = await fetch(`/mysqlsv/getDefid/${hmcd}:${mcgcd}:${mccd}:`);
        const data = await res.json();
        if (data.DEFID == -1) {
            alert("起動する帳票IDがマスター登録されていません．");
            return null;
        }
        return data;
    } catch (err) {
        alert(err);
        return null;
    }
}
