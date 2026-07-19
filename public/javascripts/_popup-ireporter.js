/*
    ポップアップウィンドウ（i-Reporter）
*/

// 背景そのものをクリックした時だけ閉じる
document.addEventListener("DOMContentLoaded", () => {
    const ipopwin = document.getElementById("irepoPopupWindow");
    ipopwin.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) {
            ipopwin.style.display = "none";
        }
    });
});

let lastTap = 0; // ダブルタップ対応

// イベントリスナーのつけ外し用に関数化
function btnNewReport_Click() {
    location.href = `jp.co.cimtops.ireporter.createreport:defid=${document.getElementById("ipopDEFID").value}`;
    document.getElementById("irepoPopupWindow").style.display = "none";
}

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

    if (mcgcd == "SW") {
        // カスタムURLで直接呼び出す（値やフラグを渡してあげないといけない）
        const repid = await getHoldid(irepoinfo.DEFID, hmcd, irepoinfo.HMCDCID);
        iRepoCustomURL(tblno, row, mcgcd, hmcd, irepoinfo.DEFID, irepoinfo.HMCDCID, repid)

    } else {
        // ポップアップウィンドウの設定
        document.getElementById("ipopHMCD").innerText = hmcd;



        // ※工程経路と前工程完了状態を取得
        const progressTableObj = document.getElementById("progressTable");
        progressTableObj.style.display = "table";
        for (let i = 0; i < 6; i++) {
            progressTableObj.rows[1].cells[i].innerHTML = "";
            progressTableObj.rows[2].cells[i].innerHTML = "";
            progressTableObj.rows[1].cells[i].className = "";
            progressTableObj.rows[2].cells[i].className = "";
        }
        // 進捗状況の取得
        const progressReport = await this.getprogressReport(hmcd, mcgcd, mccd);
        // 結果反映
        let checksheetflg = true;
        let progressflg = (progressReport.length > 1)
        if (progressflg) {
            let currentflg = false;
            for (let i = 0; i < progressReport.length; i++) {
                const d = progressReport[i];
                let j = d.MPSEQ - 1;
                progressTableObj.rows[1].cells[j].innerText = d.KTCD;
                // 色＆アイコン処理
                if (!currentflg && d.MCGCD != "EX" && d.MCGCD != "MD" && d.MCGCD != "D") {
                    // 実績日付
                    let datestr = "";
                    if (d.ODRSTS=="4" && d.WKEDDT != null) {
                        const jidt = new Date(d.WKEDDT.replace(" ", "T"));
                        datestr =  `${jidt.getMonth() + 1}/${jidt.getDate()}` + " ";
                    }
                    // 在庫情報
                    let zaiqtystr = "";
                    if (d.ZAIQTY != null && d.ZAIQTY != 0) {
                        zaiqtystr = `(${d.ZAIQTY})` + " ";
                    }
                    progressTableObj.rows[1].cells[j].className = (d.ODRSTS=="4") ? "check" : "times";
                    progressTableObj.rows[2].cells[j].className = (d.ODRSTS=="4") ? "check" : "times";
                    progressTableObj.rows[2].cells[j].innerHTML = (d.ODRSTS=="4") ? 
                        `${datestr}${zaiqtystr}<i class="fas fa-check"></i>` : 
                        '<i class="fas fa-times"></i>';
                    if (d.MCGCD == mcgcd && d.MCCD == mccd) {
                        progressTableObj.rows[1].cells[j].className = "current";
                        progressTableObj.rows[2].cells[j].className = "current";
                        progressTableObj.rows[2].cells[j].innerHTML = '<i class="fas fa-exclamation"></i>';
                        currentflg = true;          // 自分の工程で色付け終了
                    } else if (d.ODRSTS != "4") {
                        checksheetflg = false;      // 工程ジャンプ＝チェックシート起動不可
                    }
                }
            };
            progressTableObj.rows[2].cells[progressReport.length - 1].innerHTML = '<i class="fas fa-flag-checkered"></i>'; // 最終工程にチェッカーフラグを立てる
        }
        const progressMessageObj = document.getElementById("progressMessage");
        progressMessageObj.style.display = "none";
        if (progressReport.length == 0) {
            progressTableObj.style.display = "none";
            progressMessageObj.innerText = "　確定注文データがない場合、前工程チェック出来ません。ご注意ください．";
            progressMessageObj.style.display = "block";
        } else if (progressflg == false) {
            progressTableObj.style.display = "none";
        } else if (checksheetflg == false) {
            progressMessageObj.innerText = "　工程ジャンプの可能性があります確認してください．";
            progressMessageObj.style.display = "block";
        }


        // チェックシート一覧の設定
        const table = document.getElementById("irepoPopupTable");
        // 各種クリア
        do {
            if (table.rows.length > 2) {table.
                deleteRow(-1);}
        } while (table.rows.length > 2);
        const reportMessageObj = document.getElementById("reportMessage");

        // チェックシート一覧を取得
        const viewreport = await this.getViewReport(irepoinfo.DEFID);

        // 結果反映
        if (!viewreport) {
            const msg = `帳票定義ID:${irepoinfo.DEFID} が本番環境に移行されていません．`;
            document.getElementById("reportMessage").innerText = msg;
        } else if (viewreport.rowCount == 0) {
            const msg = `過去に入力した帳票は存在しません．`;
            document.getElementById("reportMessage").innerText = msg;
        } else {
            document.getElementById("reportMessage").innerText = 
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

        // 新規帳票起動イベントリスナー設定
        document.getElementById("ipopDEFID").value = irepoinfo.DEFID;
        const btnNewReport = document.getElementById("newReport");
        if (checksheetflg) {
            btnNewReport.classList.remove("disable");
            btnNewReport.addEventListener("click", btnNewReport_Click);
            btnNewReport.addEventListener("keydown", function(event) {
                if (event.key == "Enter") btnNewReport.click();
                if (event.keyCode == 27) document.getElementById("irepoPopupWindow").style.display = "none";
            }, { once: true });
        } else {
            /*
                まずは９品番で運用
                チェックシートが運用出来るようになったら条件を削除する
            */
            const targetHMCD = [
                "RD809-92331-2","RD809-92332-3","RB238-63122-1B",
                "RD809-51343-1","V0531-62152-1","3C081-82711-2-K",
                "RA221-62131-2","RA269-62131-2","91A76-30121"
            ];
            if (targetHMCD.includes(hmcd)) {
                btnNewReport.classList.add("disable");
                btnNewReport.removeEventListener("click", btnNewReport_Click);
            } else {
                btnNewReport.classList.remove("disable");
                btnNewReport.addEventListener("click", btnNewReport_Click);
                btnNewReport.addEventListener("keydown", function(event) {
                    if (event.key == "Enter") btnNewReport.click();
                    if (event.keyCode == 27) document.getElementById("irepoPopupWindow").style.display = "none";
                }, { once: true });
            }
            /*
                ここから救済措置
            */
            const emergencyObj = document.getElementById("ipopEmergency");
            // ダブルクリックでボタン復活
            emergencyObj.addEventListener("dblclick", () => {
                btnNewReport.classList.remove("disable");
                btnNewReport.addEventListener("click", btnNewReport_Click);
                btnNewReport.focus();
            });
            // ダブルタップでボタン復活
            emergencyObj.addEventListener("touchend", function (e) {
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTap;
                if (tapLength < 300 && tapLength > 0) {
                    btnNewReport.classList.remove("disable");
                    btnNewReport.addEventListener("click", btnNewReport_Click);
                    btnNewReport.focus();
                }
                lastTap = currentTime;
            });
        }
        
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

// 工程進捗状況を取得
// 　１．品番と設備Gと設備コードから実績計上対象の手配番号を取得
// 　２．手配番号より工程経路の進捗状況を取得
async function getprogressReport(hmcd, mcgcd, mccd) {
    try {
        const res = await fetch(`/mysqlsv/getprogressReport/${hmcd}:${mcgcd}:${mccd}:`);
        if (!res.ok) {
            return null;        
        }
        const data = await res.json();
        return data;
    } catch (err) {
        alert(err);
        return null;
    }
}
