const cookie = require("cookie-parser");
const express = require("express");
const session = require("express-session");
const path = require("path");
const bodyParser = require("body-parser");
const favicon = require("serve-favicon");
const net = require("net");
// User定義
const { PORT, log4jsConfig } = require("./config.js");
const mysqlHandler = require("./handlers/mysql.js");
const pgHandler = require("./handlers/postgresql.js");
const oracleODBCHandler = require("./handlers/oracle-odbc.js");

const userid = "";
const { login, login2, csvread, loginCheck, csvwrite, sendMail } = require("./handlers/server.js");
// log4jsロガー設定
const log4js = require("log4js");
log4js.configure(log4jsConfig);

// Expressインスタンスを生成
const app = express();

const fs = require("fs");
const https = require("https");
const options = {
  key:  fs.readFileSync("./servercert/server.key"),
  cert: fs.readFileSync("./servercert/server.crt")
};
const server = https.createServer(options,app);

// テンプレートエンジンの設定
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// ミドルウエアの設定
app.use(cookie());
app.use(session({ secret: "YOUR SECRET SALT", resave: true, saveUninitialized: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use("/static", express.static("./public"));
app.use(favicon(`${__dirname}/public/images/favicon.ico`));

// ユーザー認証
app.get( "/login", (req, res) => res.render("login", {err: "", userid}));
app.post("/login", (req, res) => login(req, res));
app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/mp")));
app.get("/direct/:userid/:password/:nextaddr/", (req, res) => login2(req, res));
app.get("/directerror/:userid", (req, res) => {
    const userid = req.params.userid;
    res.render("login.ejs", {err: "自動ログイン設定を確認してください", userid})
});

// ******************************* ハンドラー *********************************
// Top Page
app.get( "/", (req, res) => res.redirect(`https://${req.hostname}/`));

// 切削業務メニュー
app.get("/mp", async (req, res) => {
    req.session.nextaddr = "/mp";
    try {
        res.render("index.ejs", {req});
    } catch (err) {
        next(err);
    }
});



// 手配一覧
app.get("/mp/order/:mcgcd", async (req, res, next) => {
    const mcgcd = req.params.mcgcd.toUpperCase();
    req.session.nextaddr = `/mp/order/${mcgcd}`;
    if (!loginCheck(req, res)) return;
    req.session.mcgcd = mcgcd;

    // バインド変数 に 3BP(先頭数値) を入れると Promise.all が効かなくなるので個別実行に戻す
    const mccds = await mysqlHandler.getMCCDs(mcgcd);
    const ymds = await mysqlHandler.getYMDOrders();

    // 手配情報取得
    const kd8450 = await mysqlHandler.getKD8450Orders(mcgcd, mccds, ymds);

        // タナコンサーバー接続確認
        const socket = new net.Socket();
        socket.setTimeout(3000); // タイムアウト時間を設定（ミリ秒）
        socket.connect(oracleODBCHandler.PORT, oracleODBCHandler.HOST, async () => {
            socket.end(); // 接続を閉じる

            // タナコン在庫情報取得
            try
            {
                const tioitem = await oracleODBCHandler.getTLOCStock();
                const kd8450new = await oracleODBCHandler.setTLOCStock(kd8450, tioitem); // 手配情報にタナコン在庫情報をセット
                // 手配一覧の表示
                res.render("order-information.ejs", {req, ymds, mcgcd, mccds, kd8450: kd8450new});
            } catch (e) {
                const err = {"message" : "タナコンデータベースへの接続失敗: " + e.message};
                res.render("order-information.ejs", {req, ymds, mcgcd, mccds, kd8450, err});
            }

        });
        socket.on('error', (e) => {
            const err = {"message" : "タナコンサーバーへの接続失敗: " + e.message};
            // 手配一覧の表示
            res.render("order-information.ejs", {req, ymds, mcgcd, mccds, kd8450, err});
        });
        socket.on('timeout', () => {
            const err = {"message" : "タナコンサーバー接続タイムアウト"};
            socket.destroy(); // タイムアウト時にソケットを破棄
            // 手配一覧の表示
            res.render("order-information.ejs", {req, ymds, mcgcd, mccds, kd8450, err});
        });

});



// 高精度な処理時間計測
/*
const start = performance.now();
const end = performance.now();
console.log(`全体処理時間: ${(end - start).toFixed(3)} ms`);
*/

// 内示一覧
app.get("/mp/plan/:mcgcd", async (req, res, next) => {
    const mcgcd = req.params.mcgcd.toUpperCase();
    req.session.nextaddr = `/mp/plan/${mcgcd}`;
    if (!loginCheck(req, res)) return;
    req.session.mcgcd = mcgcd;
    Promise.all([mysqlHandler.getMCCDs(mcgcd), mysqlHandler.getYMDPlans()])
    .then( async ([mccds, ymds]) => {

        // 内示情報取得
        const kd8440 = await mysqlHandler.getKD8440Plans(mcgcd, mccds, ymds);

        // タナコンサーバー接続確認
        const socket = new net.Socket();
        socket.setTimeout(3000); // タイムアウト時間を設定（ミリ秒）
        socket.connect(oracleODBCHandler.PORT, oracleODBCHandler.HOST, async () => {
            socket.end(); // 接続を閉じる

            // タナコン在庫情報取得
            try
            {
                const tioitem = await oracleODBCHandler.getTLOCStock();
                const kd8440new = oracleODBCHandler.setTLOCStock(kd8440, tioitem); // 手配情報にタナコン在庫情報をセット
                // 内示一覧の表示
                res.render("plan-order.ejs", {req, ymds, mcgcd, mccds, kd8440: kd8440new});
            } catch (e) {
                const err = {"message" : "タナコンデータベースへの接続失敗: " + e.message};
                res.render("plan-order.ejs", {req, ymds, mcgcd, mccds, kd8440, err});
            }
    
        });
        socket.on('error', (e) => {
            const err = {"message" : "タナコンサーバーへの接続失敗: " + e.message};
            res.render("plan-order.ejs", {req, ymds, mcgcd, mccds, kd8440, err});
        });
        socket.on('timeout', () => {
            const err = {"message" : "タナコンサーバー接続タイムアウト"};
            socket.destroy(); // タイムアウト時にソケットを破棄
            // 内示一覧の表示
            res.render("plan-order.ejs", {req, ymds, mcgcd, mccds, kd8440, err});
        });
    }).catch((err) => {
        next(err);
    });
});



// ダッシュボード
app.get("/mp/dashboard", async (req, res, next) => {
    try {
        let animation = "";
        if (typeof req.session.data === "undefined") {
            animation = "";
        } else {
            const data = req.session.data;
            animation = (data.screen.includes("history")) ? "slidein_fromright" : (data.screen.includes("future")) ? "slidein_fromleft" : "";
            delete req.session.data;
        }
        res.render("dashboard-now.ejs", {req, animation});
    } catch (err) {
        next(err);
    }
});
// 実績ダッシュボード
app.get("/mp/dashboard/history", async (req, res, next) => {
    try {
        let animation = "";
        if (typeof req.session.data === "undefined") {
            animation = "";
        } else {
            animation = "slidein_fromleft";
            delete req.session.data;
        }
        res.render("dashboard-history.ejs", {req, animation});
    } catch (err) {
        next(err);
    }
});
// 計画ダッシュボード
app.get("/mp/dashboard/future", async (req, res, next) => {
    try {
        let animation = "";
        if (typeof req.session.data === "undefined") {
            animation = "";
        } else {
            animation = "slidein_fromright";
            delete req.session.data;
        }
        res.render("dashboard-future.ejs", {req, animation});
    } catch (err) {
        next(err);
    }
});
// ダッシュボード画面遷移コントロール
app.get("/mp/todashboard/:param", async (req, res) => {
    const param = req.params.param;
    req.session.data = { screen: param };
    res.redirect("/mp/dashboard");
});
app.get("/mp/tohistory", async (req, res) => {
    req.session.data = { screen: "fromdashboard" };
    res.redirect("/mp/dashboard/history");
});
app.get("/mp/tofuture", async (req, res) => {
    req.session.data = { screen: "fromdashboard" };
    res.redirect("/mp/dashboard/future");
});



// 日報一覧
// IREPOSV.PostgreSQLサーバーから情報を取得
app.get("/mp/viewreport/:mcgcd", async (req, res, next) => {
    const mcgcd = req.params.mcgcd.toUpperCase();
    const d = new Date();
    const planday = d.getFullYear() + "-" + 
        ("0" + (d.getMonth() + 1)).slice(-2) + "-" + 
        ("0" + d.getDate()).slice(-2);
    res.redirect(`/mp/viewreport/${mcgcd}/${planday}`);
});
// 指定日付の日報一覧
app.get("/mp/viewreport/:mcgcd/:planday", async (req, res, next) => {
    const mcgcd = req.params.mcgcd.toUpperCase();
    const planday = req.params.planday;
    req.session.nextaddr = `/mp/viewreport/${mcgcd}/${planday}`;
    if (!loginCheck(req, res)) return;
    req.session.mcgcd = mcgcd;
    if (mcgcd == "SW") {
        const viewreport = await pgHandler.getRepID1509(planday);
        res.render("view-report.ejs", {req, mcgcd, planday, viewreport});
    }
});
// 前日の日報一覧
app.get("/mp/viewreport/prevday/:mcgcd/:planday", async (req, res, next) => {
    const mcgcd = req.params.mcgcd.toUpperCase();
    const planday = await mysqlHandler.getPrevDay(req.params.planday);
    res.redirect(`/mp/viewreport/${mcgcd}/${planday}`);
});
// 翌日の日報一覧
app.get("/mp/viewreport/nextday/:mcgcd/:planday", async (req, res, next) => {
    const mcgcd = req.params.mcgcd.toUpperCase();
    const planday = await mysqlHandler.getNextDay(req.params.planday);
    res.redirect(`/mp/viewreport/${mcgcd}/${planday}`);
});



// SW帳票の入力完了時処理
app.get("/ireporegist/sw/:id/:args", async function (req, res, next) {
    try {
        const operator = req.params.id;
        const args = req.params.args;
        const hmcd = args.split(":")[0];
        const jiqty = Number(args.split(":")[1]);
        const mode = args.split(":")[2];

        //　i-Reporter登録内容をデバッグログに記録
        const logger = log4js.getLogger();
        logger.debug(`/ireporegist/sw/${operator}/${hmcd}:${jiqty}:${mode}:`);

        // 処理モード判定
        if (mode == "auto") {
            const msg = "現在、帳票からの起動に対応していません．";
            const logger = log4js.getLogger("e");
            logger.error(msg + `[ /ireporegist/sw/${operator}/${hmcd}:${jiqty}:${mode}: ]`);
            return res.redirect(`/error/${msg}`);

        } else if (mode == "plan") {
            // 仕掛り在庫に追加
            // https://pc090n:53030/ireporegist/sw/10841/RD479-63171-1:6:plan:
            // https://pc090n:53030/ireporegist/sw/10841/RP801-63142-2:105:plan:
            // https://nabev2:53030/ireporegist/sw/10841/RP801-63142-2:400:plan:
            await mysqlHandler.updateKD8460(hmcd, "SW", "SW", jiqty, operator);

        } else if (mode == "order") {
            // 実績登録
            // https://pc090n:53030/ireporegist/sw/11014/RD479-63171-1:20:order:
            // https://pc090n:53030/ireporegist/sw/10841/05719-52741-1:100:order:
            // １．スタート日付を取得
            const ymds = await mysqlHandler.getYMDOrders();
            // ２．更新対象の注文番号を取得
            const kd8450 = await mysqlHandler.getWaitOdrno(hmcd, "SW", "SW", ymds[0])
            if (kd8450[0].ODRNO) {
                // ３．実績登録
                await mysqlHandler.finishOrder(kd8450[0].ODRNO, "SW", "SW", jiqty, operator);
            } else {
                // ４．仕掛り在庫に追加（消し込み対象の注文番号がない場合）
                await mysqlHandler.updateKD8460(hmcd, "SW", "SW", jiqty, operator);
            }
        }

        //    res.writeHead(301, {Location: `jp.co.cimtops.ireporter.openreport:repid=187146`}); // 入力帳票を開く

        // 処理モードに応じて画面遷移
       res.redirect(`/mp/confirm`);

    }
    catch (err) {
        next(err);
    }
});

// チェックシートから実績登録
// https://pc090n:53030/ireporegist2/MC/21343/V1311-62551-2:17:20:
// https://pc090n:53030/ireporegist2/sw/11014/05719-52741-1:62:60:
// https://pc090n:53030/ireporegist2/sw/11014/TD170-56144-3:82:80:
// https://pc090n:53030/ireporegist2/SW/11014/R1441-63121-2:13:13: 7/16手配3 7/29内示14 SW-SW > TN-4 > MC-3F > EX-BT2
// https://pc090n:53030/ireporegist2/TTN/11014/R1441-63121-2:13:10: 7/16手配3 7/29内示14 SW-SW > TN-4 > MC-3F > EX-BT2
// https://pc090n:53030/ireporegist2/MC/11014/R1441-63121-2:10:10: 7/16手配3 7/29内示14 SW-SW > TN-4 > MC-3F > EX-BT2
app.get("/ireporegist2/:mcglabel/:dandori/:args", async function (req, res, next) {
    try {
        const userid = req.session.userid ?? 'DEBUG';
        const mcglabel = req.params.mcglabel.toUpperCase();
        const dandori = req.params.dandori;
        const args = req.params.args;
        const hmcd = args.split(":")[0];
        const procqty = Number(args.split(":")[1]); // 加工数
        let jiqty = 0;
        if (!args.split(":")[2]) {
            jiqty = procqty;                        // 実績数がnullまたは空文字の場合は実績数＝加工数
        } else {
            jiqty = Number(args.split(":")[2]);     // 実績数
        }

        //　i-Reporter登録内容をデバッグログに記録
        const logger = log4js.getLogger();
        logger.debug(`/ireporegist2/${req.params.mcglabel}/${dandori}/${args}`);
        
        // 事前チェック
        Promise.all([mysqlHandler.isKM8430HMCD(hmcd), mysqlHandler.isKM8430HMCD(hmcd, mcglabel)])
        .then( async ([isHMCD, isMCGCD]) => {
            if (!isHMCD || !isMCGCD) {
                const msg = `コード票マスタに存在しません[${hmcd}:${mcglabel}]処理を中断します．`;
                const logger = log4js.getLogger("e");
                logger.error(msg);
                logger.error(`[/ireporegist2/${req.params.mcglabel}/${dandori}/${args}]`);
                return res.render("error.ejs", {err: msg});
            }
            
            // コード票マスタ、切削帳票定義マスタから帳票定義ID、品番CIDを検索
            const km8430 = await mysqlHandler.getReportDefID(hmcd, mcglabel, "%");
            const defid = km8430[0].DEFID;
            const clusterno = km8430[0].HMCDCID;
            if (defid == -1) {
                const logger = log4js.getLogger("e");
                logger.error("帳票定義IDが見つけられませんでした．");
                logger.error(`[/ireporegist2/${req.params.mcglabel}/${dandori}/${args}]`);
            }

            // IREPOSVの入力帳票IDを検索
            let repid = 0;
            if (mcglabel == "SW") {
                // 　SWと共通部品の場合
                const viewreport = await pgHandler.getCompleteReportID(defid, hmcd, clusterno);
                repid = viewreport.rows[0].repid;
            } else {
                const viewreport = await pgHandler.getCompleteReportIDSingle(defid);
                repid = viewreport.rows[0].repid;
            }
            if (repid == 0) {
                logger.error("入力帳票IDが見つけられませんでした．");
            }

            // チェックシートからの実績登録処理
            const results = await mysqlHandler.irepoRegist_2(userid, mcglabel, dandori, hmcd, procqty, jiqty, repid);
            if (results) {
                // 登録完了画面にリダイレクトして終了（アドレスバーに登録用URLを残さない措置）
                res.redirect(`/mp/confirm`);
            } else {
                res.redirect(`/error/手配の消込はありませんでした．仕掛在庫と実績を計上しました．`);
            }

        }).catch((err) => {
            next(err);
        });
    }
    catch (err) {
        next(err);
    }
});

// API 実績登録（手配指定の手配完成予定日以降を更新）
app.get("/mysqlsv/jissekiRegist/:args", async function (req, res, next) {
    const userid = req.session.userid ?? 'DEBUG';
    const args = req.params.args;
    const odrno = args.split(":")[0];
    const hmcd = args.split(":")[1];
    const mcgcd = args.split(":")[2];
    const mccd = args.split(":")[3];
    const jiqty = Number(args.split(":")[4]);
    const mode = args.split(":")[5];

    //　登録内容をデバッグログに記録
    const logger = log4js.getLogger();
    logger.debug(`/mysqlsv/jissekiRegist/${args}`);

    try {
        // ポップアップウィンドウからの実績登録（手配内示共通）
        const updateresult = await mysqlHandler.apiRegist_2(odrno, hmcd, mcgcd, mccd, jiqty, mode, userid);
        res.status(200).json(updateresult);
    } catch (err) {
        next(err);
    }
});

// API 実績訂正
app.get("/mysqlsv/modifyOrder/:args", async function (req, res, next) {
    const userid = req.session.userid ?? 'DEBUG';
    const args = req.params.args;
    const odrno = args.split(":")[0];
    const hmcd = args.split(":")[1];
    const mcgcd = args.split(":")[2];
    const mccd = args.split(":")[3];
    const preqty = Number(args.split(":")[4]);
    const modqty = Number(args.split(":")[5]);
    const mode = args.split(":")[6];

    //　訂正内容をデバッグログに記録
    const logger = log4js.getLogger();
    logger.debug(`/mysqlsv/modifyOrder/${args}`);

    try {
        const updateresult = await mysqlHandler.apiModify_2(odrno, hmcd, mcgcd, mccd, preqty, modqty, mode, userid);
        if (updateresult) {
            res.status(200).json(updateresult);
        } else {
            res.status(204).end(); // HTTPステータスコード 204: No Content
        }
    } catch (err) {
        next(err);
    }
});

// 登録後の確認画面
app.get("/mp/confirm", async (req, res, next) => {
    res.render("confirm.ejs");
});

// 品番,設備,手配日付から、注文番号[ODRNO],手配状態[ODRSTS],実績数[JIQTY],未来の実績数[FUTUREQTY],過去の実績残数[ZANQTY]を取得するAPI
app.get("/mysqlsv/getOdrno/:args", async (req, res, next) => {
    const args = req.params.args;
    const hmcd = args.split(":")[0];
    const mcgcd = args.split(":")[1];
    const mccd = args.split(":")[2]; 
    const eddt = args.split(":")[3];
    const stdt = args.split(":")[4];
    const kd8450 = await mysqlHandler.getOdrno(hmcd, mcgcd, mccd, eddt, stdt);
    res.status(200).json(kd8450);
});
// 品番,設備,手配日付から、注文番号[PLNNO],手配状態[ODRSTS],実績数[JIQTY],未来の実績数[FUTUREQTY],過去の実績残数[ZANQTY]を取得するAPI
app.get("/mysqlsv/getPlnno/:args", async (req, res, next) => {
    const args = req.params.args;
    const hmcd = args.split(":")[0];
    const mcgcd = args.split(":")[1];
    const mccd = args.split(":")[2];
    const eddt = args.split(":")[3];
    const stdt = args.split(":")[4];
    const kd8440 = await mysqlHandler.getPlnno(hmcd, mcgcd, mccd, eddt, stdt);
    res.status(200).json(kd8440);
});

// API 作業開始
app.get("/mysqlsv/startOrder/:args", async function (req, res, next) {
    const args = req.params.args;
    const odrno = args.split(":")[0];
    const mcgcd = args.split(":")[1];
    const mccd = args.split(":")[2];
    try {
        await mysqlHandler.startOrder(odrno, mcgcd, mccd);
        res.status(200).end();
    } catch (err) {
        next(err);
    }
});

// API 仕掛り在庫訂正
app.get("/mysqlsv/modifyZaiko/:args", async function (req, res, next) {
    const userid = req.session.userid;
    const args = req.params.args;
    const hmcd = args.split(":")[0];
    const mcgcd = args.split(":")[1];
    const mccd = args.split(":")[2];
    const modqty = Number(args.split(":")[3]);

    //　訂正内容をデバッグログに記録
    const logger = log4js.getLogger();
    logger.debug(`/mysqlsv/modifyZaiko/${args}`);

    try {
        const result = await mysqlHandler.modifyZaiko(hmcd, mcgcd, mccd, modqty, userid);
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
});

// API ダッシュボード（当日取得）
app.get("/mysqlsv/dashboard/today", async function (req, res, next) {
    try {
        const result = await mysqlHandler.getDashboardToday();
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
});

// API ダッシュボード（当日遅延一覧取得）
app.get("/mysqlsv/dashboard/delay", async function (req, res, next) {
    try {
        const result = await mysqlHandler.getDelayList();
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
});

// API ダッシュボード（注文データ集計情報の取得）
app.get("/mysqlsv/dashboard/future", async function (req, res, next) {
    try {
        const dates = await mysqlHandler.get2WeeksMondaySaturday();
        const result = await mysqlHandler.getDashboardFuture(dates);
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
});
// API ダッシュボード（注文データ工程グループ情報の取得）
app.get("/mysqlsv/dashboard/future/:MCGCD", async function (req, res, next) {
    try {
        const mcgcd = req.params.MCGCD;
        const dates = await mysqlHandler.get2WeeksMondaySaturday();
        const result = await mysqlHandler.getDashboardFutureGCD(mcgcd, dates);
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
});
// API ダッシュボード（注文データ設備情報の取得）
app.get("/mysqlsv/dashboard/future/:MCGCD/:MCCD", async function (req, res, next) {
    try {
        const mcgcd = req.params.MCGCD;
        const mccd = req.params.MCCD;
        const dates = await mysqlHandler.get2WeeksMondaySaturday();
        const result = await mysqlHandler.getDashboardFutureQTY(mcgcd, mccd, dates);
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
});
// API ダッシュボード（注文データ設備情報詳細情報の取得）
app.get("/mysqlsv/dashboard/future/popup/:MCGCD/:MCCD/:EDDT", async function (req, res, next) {
    try {
        const mcgcd = req.params.MCGCD;
        const mccd = req.params.MCCD;
        const eddt = req.params.EDDT;
        const result = await mysqlHandler.getDashboardFuturePopup(mcgcd, mccd, eddt);
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
});
// API コード票マスタから帳票定義ID、品番のクラスター番号を取得
// i-Repoマニュアル：データー連携テーブル機能を参照の事
// 保留がない場合は0、保留がある場合は最新の帳票定義IDを取得
// テストスタブ
// curl http://pc090n:53030/mysqlsv/getDefid/RD431-51322-1:TN:1:
app.get("/mysqlsv/getDefid/:args", async (req, res, next) => {
    const args = req.params.args;
    const hmcd = args.split(":")[0];
    const mcgcd = args.split(":")[1];
    const mccd = args.split(":")[2];
    const km8430 = await mysqlHandler.getReportDefID(hmcd, mcgcd, mccd);
    res.status(200).json(km8430[0]);
});


// API IREPOSVの稼働確認（fetchのレスポンスを確認）
app.get("/ireposv/isireposv", async (req, res, next) => {
    const IREPOSV_TIMEOUT = 5000; // タイムアウト時間（ミリ秒）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IREPOSV_TIMEOUT);
    let ret = false;
    try {
        const response = await fetch("http://ireposv/ConMasManager/", {
            method: "GET",
            cache: "no-store", // キャッシュを使わない
            signal: controller.signal
        });
        ret = true;
        clearTimeout(timeoutId);
        /*if (response.ok) {
            console.log(`✅ サーバー稼働中 (HTTP ${response.status})`);
        } else {
            console.log(`⚠️ サーバー応答あり (HTTP ${response.status})`);
        }*/
    } catch (err) {
        if (err.name === "AbortError") {
            console.error("⏳ IREPOSVタイムアウト: サーバー応答なし");
        } else {
            console.error(`❌ IREPOSV接続エラー: ${err.message}`);
        }
    }
    res.status((ret == true) ? 200 : 504).end();
});

// API IREPOSVのPostgreSQLからview_report_defidの編集中ステータスの帳票IDを取得
// （パラメータ3個：1帳票につき複数品番のパターン・・・SWの品番入力欄等）
// （パラメータ1個：1帳票につき1品番のパターン（共通部品も1帳票））
// i-Repoマニュアル：データー連携テーブル機能を参照の事
// 保留がない場合は0、保留がある場合は最新の帳票定義IDを取得
// テストスタブ
// curl http://pc090n:53030/ireposv/getHoldid/1509:RD479-63171-1:16:
app.get("/ireposv/getHoldid/:args", async (req, res, next) => {
    const args = req.params.args;
    if (args.split(":").length == 1) {
        const defid = args.split(":")[0];
        const viewreport = await pgHandler.getHoldReportIDSingle(defid);
        res.status(200).json(viewreport.rows[0].repid);

    } else {
        const defid = args.split(":")[0];
        const hmcd = args.split(":")[1];
        const clusterno = args.split(":")[2];
        const viewreport = await pgHandler.getHoldReportID(defid, hmcd, clusterno);
        res.status(200).json(viewreport.rows[0].repid);
    }
});
// 帳票一覧取得API
app.get("/ireposv/getViewReport/:defid", async (req, res, next) => {
    const defid = req.params.defid;
    const viewreport = await pgHandler.getViewReport(defid);
    res.status(200).json(viewreport);
});

app.get("/error/:msg", async (req, res, next) => {
    res.render("error.ejs", {err : req.params.msg});
});

app.get("/settings", async (req, res, next) => {
    res.render("settings.ejs", {req});
});

// PostgreSQL Test
app.get("/pg", async (req, res, next) => {
//    if (!loginCheck(req, res)) return;
    try {
        const mcgcdmenu = await pgHandler.getRepID1509();
        console.log("mcgcdmenu:" + mcgcdmenu.rowCount);
        res.end();
    } catch (err) {
        next(err);
    }
});

// Send Mail Test
app.get("/sendmail", async (req, res, next) => {
    const MAIL_SUBJECT = "[自動通知] メール送信テスト";
    const MAIL_BODY_HEADER = `各位\n\nメール送信テストとなります．\n\n error.log を確認してください\n\n`;
    sendMail(MAIL_SUBJECT, MAIL_BODY_HEADER);
});

// Oracle ODBC Test
const odbc = require('odbc');
app.get("/odbc", async (req, res, next) => {
    const connection = await odbc.connect("DSN=TANACON;UID=STxxxxxxxx;PWD=xxxx;");
    const data = await connection.query("select * from TIO_ITEM")
    console.log(data);
    return;
});

// 日別計画表 (mp-daily-planning)
app.get("/mp/dailyplan/:planday", async (req, res, next) => {
    req.session.nextaddr = "/mp/plan/" + req.params.planday;
    if (!loginCheck(req, res)) return;
    const mcgcd = req.session.mcgcd;
    const planday = req.params.planday;
    req.session.planday = planday;
    Promise.all([mysqlHandler.getMCGCDs(), mysqlHandler.getMCCDs(mcgcd), mysqlHandler.getYMDPlans(), mysqlHandler.getKM8430(mcgcd)])
    .then( async ([mcgcdmenu, mccds, ymds, km8430]) => {
        const d0410 = await mysqlHandler.getKD8440Plans(mcgcd, mccds, planday, km8430);
        res.render("daily-plan.ejs", {req, mcgcdmenu, ymds, d0410});
    }).catch((err) => {
        next(err);
    });
});

// 段取り開始
app.get("/mp/dandori/:odrno", async function (req, res, next) {
    if (!loginCheck(req, res)) return;
    const userid = req.session.userid;
    const mcgcd = req.session.mcgcd;
    const planday = req.session.planday;
    const str = req.params.odrno;
    const odrno = str.split(":")[0];
    const mccd = str.split(":")[1];
    try {
        await mysqlHandler.dandori(userid, odrno, planday, mcgcd, mccd);
        res.redirect("/mp/plan/" + planday + "#" + mccd);
    } catch (err) {
        next(err);
    }
});

// 作業開始
app.get("/mp/start/:odrno", async function (req, res, next) {
    if (!loginCheck(req, res)) return;
    const userid = req.session.userid;
    const mcgcd = req.session.mcgcd;
    const planday = req.session.planday;
    const str = req.params.odrno;
    const odrno = str.split(":")[0];
    const mccd = str.split(":")[1];
    try {
        await mysqlHandler.workstart(userid, odrno, planday, mcgcd, mccd);
        res.redirect("/mp/plan/" + planday + "#" + mccd);
    } catch (err) {
        next(err);
    }
});

// 作業終了
app.get("/mp/end/:odrno/:jiqty", async function (req, res, next) {
    if (!loginCheck(req, res)) return;
    const userid = req.session.userid;
    const mcgcd = req.session.mcgcd;
    const planday = req.session.planday;
    const str = req.params.odrno;
    const odrno = str.split(":")[0];
    const mccd = str.split(":")[1];
    const jiqty = Number(req.params.jiqty);
    try {
        await mysqlHandler.workend(jiqty, userid, odrno, planday, mcgcd, mccd);
        res.redirect("/mp/plan/" + planday + "#" + mccd);
    } catch (err) {
        next(err);
    }
});

// 包括的エラーハンドリング
app.use((err, req, res, next) => {
    console.log(`[${new Date().toISOString()}] 包括的エラーハンドリング`)
    console.error(err);
    res.status(500).send(`サーバーの動作が失敗しました．:${err.code} `);
});

// データベース接続 確証後にサーバーを起動
mysqlHandler.connect
.then(() => {
    console.log(`MySQL Database [${mysqlHandler.database}] Connected!`);
    //app.listen(53030); // ←HTTPのCurlでのテストをする場合https化しない
    server.listen(PORT, () => {console.log(`Koken MP-APP listen on Port:${PORT}`)});
}).catch((err) => {
    console.log("MySQL Database Connection Error!");
    console.log(err);
});
