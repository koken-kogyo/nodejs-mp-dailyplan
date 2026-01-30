const { Client } = require('pg');
const { pgConfig } = require('../config.js');
exports.HOST = pgConfig.host;
exports.PORT = pgConfig.port;

// Database から データを取得する (都度コネクション貼って取得後に解放)
const getDatabase = async (sql, param) => {
    const client = new Client(pgConfig);
    client.connect();
    const results = await client.query(sql);
    await client.end(); // 接続終了
    return JSON.parse(JSON.stringify(results));;
};

// 最新の編集中の帳票IDを取得（編集中がない場合は0）
const getHoldReportIDSingle = async (defid) => {
    const result = await isViewReport(defid);
    if (result == false) {
        return getDatabase("select 0 as repid");
    } else {
        const sql = "select COALESCE(max(rep_top_id),0) as repid " + 
            `from view_report_${defid} ` + 
            `where edit_refer_status=1`;
        return getDatabase(sql);
    }
};
exports.getHoldReportIDSingle = getHoldReportIDSingle;

// 最新の編集中の帳票IDを取得（編集中がない場合は0）（defid:大元の帳票定義ID, clusterno:検索対象の品番クラスターNO）
const getHoldReportID = async (defid, hmcd, clusterno) => {
    const result = await isViewReport(defid);
    if (result == false) {
        return getDatabase("select 0 as repid");
    } else {
        const sql = "select COALESCE(max(rep_top_id),0) as repid " + 
        `from view_report_${defid} ` + 
        `where cluster_1_${clusterno}_t='${hmcd}' and edit_refer_status=1`;
        return getDatabase(sql);
    }
};
exports.getHoldReportID = getHoldReportID;

// そもそもテーブルが存在しているかチェック（帳票定義を本番にしていないとViewが作られない）
const isViewReport = async (defid) => {
    const sql = `SELECT count(*) registcount FROM information_schema.tables WHERE table_name = 'view_report_${defid}'`
    const res = await getDatabase(sql);
    if (res.rows[0].registcount == 0) {
        return false;
    } else {
        return true;
    }
}

// SW作業日報兼チェックシートの取得（帳票定義ID:1509）（※ejsに受け渡す項目名は小文字にする事）
const getRepID1509 = async (planday) => {
    const sql = "select " + 
        "rep_top_id,rep_top_name" + 
        ",edit_refer_status" + 
        ",sys_regist_time,sys_update_time" + 
        ",cluster_1_0_t スキャン品番 " + 
        ",cluster_1_1_t 初回品試作品 " + 
        ",cluster_1_2_t 段取者id " + 
        ",to_char(cluster_1_3_d, 'MM/DD') 初回手配日 " + 
        ",cluster_1_4_t 材料サイズ " + 
        ",to_char(round(cluster_1_5_n, 2), 'FM99999.00') 切断長 " + 
        ",case cluster_1_6_t when 'true' then 'OK' else 'NG' end 入力確認 " + 
        ",to_char(round(cluster_1_7_n, 2), 'FM99999.00') 着工 " + 
        ",to_char(round(cluster_1_8_n, 2), 'FM99999.00') 完工 " + 
        ",trunc(cluster_1_11_n) 実績数 " + 
        ",trunc(cluster_1_12_n) 廃棄数 " + 
        ",cluster_1_13_t 備考 " + 
        ",cluster_1_16_t 品番 " + 
        ",cluster_1_19_t モード " + 
        "from view_report_1509 " + 
        "where sys_regist_time between " + 
        `cast('${planday}' as date ) and cast('${planday}' as date ) + cast('1 days' as INTERVAL) `
        "order by sys_regist_time";
    return getDatabase(sql);
};
exports.getRepID1509 = getRepID1509;

// 帳票一覧の取得
const getViewReport = async (defid) => {
    const result = await isViewReport(defid);
    if (result == false) {
        return null;
    } else {
        // edit_refer_status==1) ? "編集中" : (d.edit_refer_status==4) ? "入力完了" 
        const sql = "select " + 
            "rep_top_id, " + 
            "rep_top_name, " + 
            "case edit_refer_status " + 
            "when 1 then '編集中' " + 
            "when 4 then '入力完了' " + 
            "else '不明' end edit_refer_status, " + 
            "to_char(sys_regist_time, 'YYYY-MM-DD HH24:MI') sys_regist_time,  " + 
            "to_char(sys_update_time, 'YYYY-MM-DD HH24:MI') sys_update_time " + 
            `from view_report_${defid} ` + 
            "order by rep_top_id desc limit 10";
        const viewreport = await getDatabase(sql);
        return viewreport;
    }
};
exports.getViewReport = getViewReport;
