const { Client } = require('pg');
const { pgConfig } = require('../config.js');

// Database から データを取得する (都度コネクション貼って取得後に解放)
const getDatabase = async (sql, param) => {
    const client = new Client(pgConfig);
    client.connect();
    const results = await client.query(sql);
    await client.end(); // 接続終了
    return JSON.parse(JSON.stringify(results));;
};

// SW作業日報兼チェックシートの取得（帳票定義ID:1509）
const getRepID1509 = async (defid, hmcd) => {
    const userid = "11014";
    const sql = "select rep_top_id, sys_regist_time, '黄銅' as repid, rep_top_name from view_report_500 order by sys_regist_time desc";
    return getDatabase(sql, [userid]);
};
exports.getRepID1509 = getRepID1509;

// 編集中の件数を取得（defid:帳票定義ID, clusterno:品番の入っているクラスター番号）
const getHoldReportID = async (defid, hmcd, clusterno) => {
    const sql = "select COALESCE(max(rep_top_id),0) as repid " + 
        `from view_report_${defid} ` + 
        `where cluster_1_${clusterno}_t='${hmcd}' and edit_refer_status=1`;
    return getDatabase(sql);
};
exports.getHoldReportID = getHoldReportID;
