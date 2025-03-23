const cookie = require("cookie-parser");
const express = require("express");
const session = require("express-session");
const path = require("path");
const bodyParser = require("body-parser");
const favicon = require("serve-favicon");
// User定義
const { PORT, log4jsConfig } = require("./config.js");
const mysqlHandler = require("./handlers/mysql.js");
const pgHandler = require("./handlers/postgresql.js");

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

// Top Page
app.get( "/", (req, res) => res.redirect(`https://${req.hostname}/`));

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
// 切削業務メニュー
app.get("/mp", async (req, res) => {
    req.session.nextaddr = "/mp";
    try {
        res.render("index.ejs", {req});
    } catch (err) {
        next(err);
    }
});

// SW工程メニュー
// ブックマーク
// https://pc090n:53030/sw
app.get("/mp/sw", async (req, res, next) => {
    req.session.nextaddr = "/mp/sw";
    if (!loginCheck(req, res)) return;
    try {
        req.session.mcgcd = "";
        res.render("index-sw.ejs", {req});
    } catch (err) {
        next(err);
    }
});

// SW工程, CN工程, MS工程 の 内示一覧
app.get("/mp/plan/:mcgcd", async (req, res, next) => {
    const mcgcd = req.params.mcgcd.toUpperCase();
    req.session.nextaddr = `/mp/plan/${mcgcd}`;
    if (!loginCheck(req, res)) return;
    req.session.mcgcd = mcgcd;
    Promise.all([mysqlHandler.getMCCDs(mcgcd), mysqlHandler.getYMDPlans()])
    .then( async ([mccds, ymds]) => {
        // 内示情報取得
        const kd8440 = await mysqlHandler.getKD8440Plans(mcgcd, mccds, ymds);
        res.render("plan-order.ejs", {req, ymds, mcgcd, mccds, kd8440});
    }).catch((err) => {
        next(err);
    });
});


//    res.writeHead(301, {Location: `jp.co.cimtops.ireporter.openreport:repid=187146`}); // 入力帳票を開く

// 帳票の入力完了時処理
app.get("/ireporegist/sw/:id/:args", async function (req, res, next) {
    try {
        const operator = req.params.id;
        const args = req.params.args;
        const hmcd = args.split(":")[0];
        const jiqty = args.split(":")[1];
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
        }

        // 在庫更新
        // https://pc090n:53030/ireporegist/sw/10841/RD479-63171-1:6:plan:
        // https://nabev2:53030/ireporegist/sw/10841/RD479-63171-1:10:plan:
        await mysqlHandler.updateKD8460(hmcd, "SW", "SW", jiqty, operator);

        // 処理モードに応じて画面遷移
       res.redirect(`/mp/${mode}/sw`);

    }
    catch (err) {
        next(err);
    }
});

// API iRepoSVのPostgreSQLからview_report_defidの編集中ステータスの帳票IDを取得
// i-Repoマニュアル：データー連携テーブル機能を参照の事
// 保留がない場合は0、保留がある場合は最新の帳票定義IDを取得
// テストスタブ
// curl https://pc090n:53030/ireposv/hold/1509:RD479-63171-1:16:
app.get("/ireposv/hold/:args", async (req, res, next) => {
    const args = req.params.args;
    const defid = args.split(":")[0];
    const hmcd = args.split(":")[1];
    const clusterno = args.split(":")[2];
    const viewreport = await pgHandler.getHoldReportID(defid, hmcd, clusterno);
    res.status(200).json(viewreport.rows[0].repid);
});

app.get("/error/:msg", async (req, res, next) => {
    res.render("error.ejs", {err : req.params.msg});
});

// SW工程 日報兼チェックシートの一時保存
app.get("/sw/irepopending/:hmcd/", async (req, res, next) => {
    const hmcd = req.params.hmcd;
    req.session.nextaddr = `/sw/irepopending/${hmcd}/"`;
    if (!loginCheck(req, res)) return;
    try {

        // コード票マスタから帳票定義IDを取得（品番、工程Gコード、工程コード）
        // 
        const hmcdparam = encodeURI(`スキャン品番=${hmcd}`);
        console.log("hmcdparam:" + hmcdparam);
        res.writeHead(301, {Location: `jp.co.cimtops.ireporter.createreport:defid=1509&${hmcdparam}`});
        res.end();
    } catch (err) {
        next(err);
    }
});

//https://192.168.10.12:53030/sw/irepopending/

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

// 工程全体促進表 (sokusin.ejs
app.get("/mp", async (req, res, next) => {
    req.session.nextaddr = "/mp";
    if (!loginCheck(req, res)) return;
    try {
        req.session.mcgcd = "";
        const mcgcdmenu = await mysqlHandler.getMCGCDs();
        res.render("sokusin.ejs", {req, mcgcdmenu, d0410: null, eddts: null});
    } catch (err) {
        next(err);
    }
});

// グループ別促進表 (sokusin.ejs)
app.get("/mp/:mcgcd", async (req, res, next) => {
    req.session.nextaddr = "/mp/" + req.params.mcgcd;
    if (!loginCheck(req, res)) return;
    const mcgcd = req.params.mcgcd;
    req.session.mcgcd = mcgcd;
    Promise.all([mysqlHandler.getMCGCDs(), mysqlHandler.getMCCDs(mcgcd), mysqlHandler.getYMDs()])
    .then( async ([mcgcdmenu, mccds, ymds]) => {
        const d0410 = await mysqlHandler.getD0415weeks(mcgcd, mccds, ymds);
        res.render("sokusin.ejs", {req, mcgcdmenu, ymds, d0410});
    }).catch((err) => {
        next(err);
    });
});

// 日別計画表 (mp-daily-planning)
app.get("/mp/plan/:planday", async (req, res, next) => {
    req.session.nextaddr = "/mp/plan/" + req.params.planday;
    if (!loginCheck(req, res)) return;
    const mcgcd = req.session.mcgcd;
    const planday = req.params.planday;
    req.session.planday = planday;
    Promise.all([mysqlHandler.getMCGCDs(), mysqlHandler.getMCCDs(mcgcd), mysqlHandler.getYMDPlans(), mysqlHandler.getKM8430(mcgcd)])
    .then( async ([mcgcdmenu, mccds, ymds, km8430]) => {
        const d0410 = await mysqlHandler.getKD8440Plans(mcgcd, mccds, planday, km8430);
        res.render("dailyplan.ejs", {req, mcgcdmenu, ymds, d0410});
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

// iPhone専用Page (リーダー用)
// entryplace=wl01,wl04
app.get("/i/:entryplace", async (req, res, next) => {
    const d = new Date();
    const planday = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    try {
        // 一覧表示
        const entryplace = req.params.entryplace.toUpperCase();
        const ymds = await mysqlHandler.getESYMDs();
        const kd8220 = await mysqlHandler.getKD8220iPhone(planday, entryplace);
        res.render("./wl04/es-i-phone.ejs", {req, ymds, planday, kd8220});
    } catch (err) {
        next(err);
    }
});

// リストの消込処理 DB更新 ⇒ ステータス返却
app.get("/es/marking/:autono/:sts", async function (req, res, next) {
    const userid = req.session.userid;
    const autono = req.params.autono;
    const sts = req.params.sts;
    try {
        await mysqlHandler.updateKD8220status(userid, autono, sts);
        res.status(200).end();
    } catch (err) {
        next(err);
    }
});

// CSVファイル作成 [es_YYYY-MM-DD.csv] ⇒ DB更新 ⇒ ステータス返却
app.get("/es/makecsv/:planday/:odcd/:downloadday/:time", async function (req, res, next) {
    const planday = req.params.planday;
    const odcd = req.params.odcd;
    const downloadday = req.params.downloadday;
    const time = req.params.time;
    const csvfilename = `es_${downloadday}_${odcd}_${time}.csv`;
    const csvfilepath = `${__dirname}/public/downloads/${csvfilename}`;
    try {
        const kd8220csv = await mysqlHandler.getKD8220csv(planday, odcd);
        csvwrite(kd8220csv, csvfilepath); // サーバー上にCSVファイル作成
        const userid = req.session.userid;
        await mysqlHandler.updateKD8220downloaded(userid, planday, odcd);
        res.status(200).end();
    } catch (err) {
        next(err);
    }
});

// 洩れ検査日報データ取得API
app.get("/es/search/:hmcd", async function (req, res, next) {
    try {
        const hmcd = req.params.hmcd;
        const kd8220hmcd = await mysqlHandler.getKD8220hmcd(hmcd);
        res.status(200).json(kd8220hmcd);
    } catch (err) {
        next(err);
    }
});

// 包括的エラーハンドリング
app.use((err, req, res, next) => {
    console.log("包括的エラーハンドリング")
    console.error(err);
    res.status(500).send(`サーバーの動作が失敗しました．:${err.code} `);
});

// データベース接続 確証後にサーバーを起動
mysqlHandler.connect
.then(() => {
    console.log(`MySQL Database [${mysqlHandler.database}] Connected!`);
    server.listen(PORT, () => {console.log(`Koken MP-APP listen on Port:${PORT}`)});
}).catch((err) => {
    console.log("MySQL Database Connection Error!");
    console.log(err);
});
