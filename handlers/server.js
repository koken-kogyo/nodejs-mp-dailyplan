const mysqlHandler = require("../handlers/mysql.js");

// csv モジュールの内，必要な機能を読み込む
const fs = require("fs");
const csvParse = require("csv-parse/sync");
const stringify = require("csv-stringify/sync");
const iconv = require("iconv-lite");

// nodemailer設定
const { smtpConfig, SMTPFROM, SMTPTO } = require("../config.js");
const nodemailer = require("nodemailer");

// Topics の読み込み
const csvread = (req, res, csvpath) => {
    try {
        const topics = csvParse.parse(fs.readFileSync(csvpath), { columns: true });
        return topics;
    } catch (err) {
        console.log(err);
        res.send("csvの読み込みに失敗しました.");
    }
};
exports.csvread = csvread;

// CSV 出力
const csvwrite = (data, csvfilepath) => {
    const writer = fs.createWriteStream(csvfilepath);
    const outputData = stringify.stringify(data, { header : true });
    writer.write(iconv.encode(outputData, "Shift_JIS"));
    writer.end();
};
exports.csvwrite = csvwrite;

// ログインロジック
const login = async (req, res, next) => {
    try {
        const userid = req.body.userid;
        const password = req.body.password;
        const userinfo = await mysqlHandler.getM0010(userid.toUpperCase());
        if (userinfo.length == 0) {
            return res.render("./login.ejs", {err: "ユーザーIDが間違っているか存在しません", userid});
        } else {
            if (userinfo[0].PASSWD == password.toUpperCase()) {
                req.session.userid = userid;
                req.session.jpname = userinfo[0].TANNM;
                res.redirect(req.session.nextaddr);
            } else {
                console.log("パスワードが間違っています");
                return res.render("./login.ejs", {err: "パスワードが間違っています", userid});
            }
        }
    } catch (err) {
        next(err);
    }
};
exports.login = login;

// ログイン２
const login2 = async (req, res, next) => {
    try {
        const userid = req.params.userid;
        const password = req.params.password;
        const userinfo = await mysqlHandler.getM0010(userid.toUpperCase());
        if (userinfo.length == 0) {
            console.log("userid faild:" + userid);
            res.redirect("/directerror/" + userid);
        } else {
            if (userinfo[0].PASSWD == password.toUpperCase()) {
                req.session.userid = userid;
                req.session.jpname = userinfo[0].TANNM;
                res.redirect("/" + req.params.nextaddr + "/");
            } else {
                console.log("password faild");
                res.redirect("/directerror/" + userid);
            }
        }
    } catch (err) {
        res.redirect("/" + req.params.nextaddr);
    }
};
exports.login2 = login2;

// ログインチェック
exports.loginCheck = (req, res) => {
    if (!req.session.userid) {
        res.redirect("/login");
        return false;
    }
    return true;
};

// メール送信
const sendMail = async (MAIL_SUBJECT, MAIL_BODY_HEADER) => {
    const MAIL_BODY_FOOTER = 
    "------------------------------------------------------------------------\n" +
    "node.js より \n" +
    "このメールは、プログラムが自動送信したものです。\n" +
    "------------------------------------------------------------------------\n";
    const mail = {
        from: SMTPFROM, // 送信元メールアドレス
        to: SMTPTO,     // 送信先メールアドレス
        subject: MAIL_SUBJECT,
        text: MAIL_BODY_HEADER + MAIL_BODY_FOOTER,
    };
    const transport = nodemailer.createTransport(smtpConfig);
    const resultMail = await transport.sendMail(mail);
};
exports.sendMail = sendMail;