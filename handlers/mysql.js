const mysql = require('mysql2/promise');
const { mysqlConfig } = require('../config.js');

// MySQL接続情報
const connectionString = {
      host: mysqlConfig.HOST
    , port: mysqlConfig.PORT
    , database: mysqlConfig.DATABASE
    , user: mysqlConfig.USER
    , password: mysqlConfig.PASSWORD
    , dateStrings: 'date' /*または'true'*/
};
exports.database = connectionString.database;

// コネクションプールの取得
const pool = mysql.createPool(connectionString);
const connect = pool.getConnection()
exports.connect = connect;


// Database から データを取得する
const getDatabase = async (sql, param) => {
    const conn = await pool.getConnection();
    const results = await conn.query(sql, param);
    conn.release();
    return JSON.parse(JSON.stringify(results[0]));
};

// ユーザー情報の取得
const getM0010 = async (userid) => {
    const sql = "select TANNM, PASSWD from m0010 where TANCD=?"
    return getDatabase(sql, [userid]);
};
exports.getM0010 = getM0010;

// 手配用今週月曜日から来週金曜日までの日付を取得
const getYMDOrders = async () => {
    // 基準日の取得（月曜日の場合は先週に巻き戻す）
    // Javascript getDay()  は ["0:日", "1:月", "2:火", "3:水", "4:木", "5:金", "6:土"];
    // MySQL DAYOFWEEK()    は ["1:日", "2:月", "3:火", "4:水", "5:木", "6:金", "7:土"];
    // MySQL WEEKDAY()      は ["0:月", "1:火", "2:水", "3:木", "4:金", "5:土", "6:日"];
    let baseday = new Date();                                       // 本番用
    // baseday = new Date(2025,4,5);                                // Debug用（※月は 0 から始まるので2025/05/05 0:00:00をセット）
    if (baseday.getDay() <= 1) {                                    // ※月曜日の場合はリストを更新しない
        let offset = (baseday.getDay() == 0) ? 6 : 7;
        baseday.setDate(baseday.getDate() - offset);                // 先週の月曜日を取得
    } else {
        baseday.setDate(baseday.getDate() - baseday.getDay() + 1);  // 今週の月曜日を取得
    }
    // カレンダー配列を作成
    const ymd = [];
    while (ymd.length < 9) {
        // 基準日の週に稼働日が1日でもあれば配列にセット
        let dstring = baseday.getFullYear() + "-" + (baseday.getMonth() + 1) + "-" + baseday.getDate();        
        let s0820 =  await getDatabase(
            "select COUNT(*) as WKCNT from s0820 where CALTYP='00001' and WKKBN='1' and " + 
            "YMD between ? and (? + interval 5 day)"
            ,[dstring, dstring]
        );
        if (ymd.length == 0 && s0820[0].WKCNT == 0) {               // 最初の基準日が非稼働週の場合
            baseday.setDate(baseday.getDate() - 7);                 // さらに前週に移動
            continue;
        }
        if (s0820[0].WKCNT > 0) {
            for (let i = 0; i < 5; i++) {
                let d = new Date(baseday);
                d.setDate(baseday.getDate() + i);
                ymd.push(d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate());
            }
        }
        baseday.setDate(baseday.getDate() + 7);                     // 基準日を翌週に移動
    }
    return ymd;
};
exports.getYMDOrders = getYMDOrders;

// 内示用月曜日から金曜日までの日付を取得
const getYMDPlans = async () => {
    // 基準日の取得（月曜日の場合は先週に巻き戻す）
    // Javascript getDay()  は ["0:日", "1:月", "2:火", "3:水", "4:木", "5:金", "6:土"];
    // MySQL WEEKDAY()      は ["0:月", "1:火", "2:水", "3:木", "4:金", "5:土", "6:日"];
    // MySQL DAYOFWEEK()    は ["1:日", "2:月", ... , "7:土"];
    let baseday = new Date();                                       // 本番用
    // baseday = new Date(2025,4,5);                                // Debug用（※月は 0 から始まるので2025/05/05 0:00:00をセット）
    if (baseday.getDay() <= 1) {                                    // ※月曜日の場合はリストを更新しない
        let offset = (baseday.getDay() == 0) ? 6 : 7;
        baseday.setDate(baseday.getDate() - offset);                // 先週の月曜日を取得
    } else {
        baseday.setDate(baseday.getDate() - baseday.getDay() + 1);  // 今週の月曜日を取得
    }
    // カレンダー配列を作成
    const ymd = [];
    let weekcount = 0;
    while (ymd.length < 9) {
        // 基準日の週に稼働日があるか調査
        let dstring = baseday.getFullYear() + "-" + (baseday.getMonth() + 1) + "-" + baseday.getDate();        
        let s0820 =  await getDatabase(
            "select COUNT(*) as WKCNT from s0820 where CALTYP='00001' and WKKBN='1' and " + 
            "YMD between ? and (? + interval 5 day)"
            ,[dstring, dstring]
        );
        if (ymd.length == 0 && s0820[0].WKCNT == 0 && weekcount == 0) { // 最初の基準日が非稼働週の場合
            baseday.setDate(baseday.getDate() - 7);                     // さらに前週に移動
            continue;
        }
        // 手配の2week分は内示一覧の対象外とする
        if (s0820[0].WKCNT > 0) weekcount++;
        if (weekcount > 2 && s0820[0].WKCNT > 0) {
            for (let i = 0; i < 5; i++) {
                let d = new Date(baseday);
                d.setDate(baseday.getDate() + i);
                ymd.push(d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate());
            }
        }
        baseday.setDate(baseday.getDate() + 7);                     // 基準日を翌週に移動
    }
    return ymd;
};
exports.getYMDPlans = getYMDPlans;

// 前日営業日を取得
const getPrevDay = async (planday) => {
    const sql = 
    "select DATE_FORMAT(YMD, '%Y-%m-%d') AS PREVDAY " + 
    "from s0820 " + 
    "where CALTYP='00001' and WKKBN='1' and " + 
    "YMD between " + 
        `(select date_add(YMD, INTERVAL -14 day) from s0820 where CALTYP='00001' and YMD = '${planday}') ` + 
        "and " + 
        `date_add(CONVERT('${planday}', DATE), interval -1 day) ` + 
    "order by YMD desc " + 
    "limit 1";
    const obj = await getDatabase(sql);
    return obj[0].PREVDAY;
};
exports.getPrevDay = getPrevDay;

// 翌日営業日を取得
const getNextDay = async (planday) => {
    const sql = 
    "select DATE_FORMAT(YMD, '%Y-%m-%d') AS NEXTDAY " + 
    "from s0820 " + 
    "where CALTYP='00001' and WKKBN='1' and " + 
    "YMD between " + 
        `date_add(CONVERT('${planday}', DATE), interval +1 day) ` + 
        "and " + 
        `(select date_add(YMD, INTERVAL +14 day) from s0820 where CALTYP='00001' and YMD = '${planday}') ` + 
    "order by YMD asc " + 
    "limit 1";
    const obj = await getDatabase(sql);
    return obj[0].NEXTDAY;
};
exports.getNextDay = getNextDay;

// 稼働日ベースでの今週と来週の月曜日,土曜日を取得
const get2WeeksMondaySaturday = async () => {
    let baseday = new Date();                                       // 現在の日時を取得 例: Tue Jan 26 2021 21:25:35 GMT+0900 (日本標準時)
    //baseday = new Date(2025, 4, 5, 12, 3, 15, 0);                 // Debug用（※月は 0 から始まるので2025/5/5 12:03:15.000をセット）
    if (baseday.getDay() <= 1) {                                    // 現在の日時が日・月曜日の場合
        baseday.setDate(baseday.getDate() - 3);                     // 基準日を3日前に設定
    }
    const now = baseday.toLocaleString();                           // 'Sat Jan 03 2026 12:12:23 GMT+0900 (日本標準時)' → '2026/1/3 12:12:23'
    const sql = 
        "select " +
            ` max(case when YMD < '${now}' then YMD end) as 今週月曜日 ` +
            `,max(case when YMD < '${now}' then date_add(YMD, interval + 5 day) end) as 今週土曜日 ` +
            `,min(case when YMD > '${now}' then YMD end) as 来週月曜日 ` +
            `,min(case when YMD > '${now}' then date_add(YMD, interval + 5 day) end) as 来週土曜日 ` +
        "from (" +
            "select YMD - interval weekday(YMD) day as YMD, count(*) as 稼働日数 " +    // 月曜日を返却
            "from s0820 " +
            "where CALTYP='00001' " +
                "and WKKBN = '1' " +
                `and YMD between date_add('${now}', interval - 21 day) and date_add('${now}', interval + 21 day) ` +
            "group by YMD - interval weekday(YMD) day" + /* 月曜日で Group By すると非稼働週が抜ける ※2025/5/5月曜日が非稼働日の場合に注意 */
        ") z"
    ;
    const results = await getDatabase(sql);
    // 日付オブジェクトを配列に格納
    const dates = [
        results[0].今週月曜日,
        results[0].今週土曜日,
        results[0].来週月曜日,
        results[0].来週土曜日,
    ];
    return dates;
}
exports.get2WeeksMondaySaturday = get2WeeksMondaySaturday;

// 設備グループ群の取得
const getMCGCDs = async () => {
    const sql = "select MCGSEQ, MCGCD from km8420 group by MCGSEQ, MCGCD";
    return getDatabase(sql, []);
};
exports.getMCGCDs = getMCGCDs;

// 設備群の取得
const getMCCDs = async (mcgcd) => {
    const sql = 
        "select MCCD, MCNM, ifnull(CUTTHICKNESS,0) CUTTHICKNESS, ifnull(SCRAPLEN,0) SCRAPLEN " + 
        "from km8420 where MCGCD=? and FLG1='1' order by MCSEQ asc";
    return getDatabase(sql, mcgcd);
};
exports.getMCCDs = getMCCDs;

// 設備マスタ展開 KT1～KT6を展開
const getKM8430 = async (mcgcd) => {
    const sql = "select * from km8430 where KTKEY like ?";
    const km8430 = await getDatabase(sql, [`%${mcgcd}-%:%`])
    const results = [];
    for (let row of km8430) {
        // 工程数分ループし横→縦変換
        for(let i = 1; i <= row.KTSU; i++) {
            results.push({
                HMCD: row.HMCD, MCGCD: row[`KT${i}MCGCD`], MCCD: row[`KT${i}MCCD`], 
                CT: row[`KT${i}CT`], DT: row[`KT${i}DT`], KTSU: row.KTSU, KTKEY: row.KTKEY
            });
        }
    }
    return results;
};
exports.getKM8430 = getKM8430;

// 各工程毎に表示の並び変え順序
const getMCOrderby = (mcgcd) => {
    const orderby = {
        SW: "order by b.MATESIZE desc, a.HMCD ",
        SS: "order by a.HMCD ",
        XT: "order by a.HMCD ",
        CN: "order by b.MATESIZE, a.HMCD ",
        MS: "order by b.MATESIZE desc, a.HMCD ",
        LA: "",
        NC: "order by a.HMCD ",
        ON: "order by a.HMCD ",
        ON3:"order by a.HMCD ",
        "3BP":"order by a.HMCD ",
        MD: "order by a.HMCD ",
        D:  "order by a.HMCD ",
        MC: "order by a.HMCD ",
        G:  "order by a.HMCD ",
        TP: "order by a.HMCD ",
        SK: "order by a.HMCD ",
        LF: "order by a.HMCD ",
        TN: "order by a.HMCD "
    };
    return orderby[mcgcd];
};
exports.getMCOrderby = getMCOrderby;

// 設備毎の注文データを2週間分取得
const getKD8450Orders = async (mcgcd, mccds, ymds) => {

    // 検索を高速化する為に開始ODRNOを決定
    const targetday = new Date();
    targetday.setMonth(targetday.getMonth() - 4); // 4カ月前を取得
    const startodrno = ("00" + (targetday.getFullYear())).slice(-2) + 
                        ("00" + (targetday.getMonth()+1)).slice(-2) + "000000";

    // グループの設備一覧を取得
    const orderby = getMCOrderby(mcgcd);
    
    // 過去の遅れ分を抽出する為の日付を取得（開始日から過去10営業日でさかのぼる）
    let okureSql = "select YMD from (" + 
        "select row_number() over (order by YMD desc) as LINENO, YMD from s0820 " + 
        "where CALTYP='00001' and WKKBN='1' and YMD between ? - interval 30 day and ?" +  
        ") a where a.LINENO=10";
    let okure = await getDatabase(okureSql, [ymds[0], ymds[0]]);

    const mc = [];
    for (let mccd of mccds) {
        let sql = "select a.HMCD,b.HMNM,b.MATESIZE,b.LENGTH" +
        ",max(ifnull(b.MATERIALLEN,0)) as 'MATERIALLEN'" + 
        `,sum(case when EDDT<'${ymds[0]}' and ODRSTS in ('1','2','3') then ODRQTY else null end) as 'DA'` +
        `,sum(case when EDDT='${ymds[0]}' and ODRSTS != '9' then ODRQTY else null end) as 'D0'` +
        `,sum(case when EDDT='${ymds[1]}' and ODRSTS != '9' then ODRQTY else null end) as 'D1'` +
        `,sum(case when EDDT='${ymds[2]}' and ODRSTS != '9' then ODRQTY else null end) as 'D2'` +
        `,sum(case when EDDT='${ymds[3]}' and ODRSTS != '9' then ODRQTY else null end) as 'D3'` +
        `,sum(case when EDDT='${ymds[4]}' and ODRSTS != '9' then ODRQTY else null end) as 'D4'` +
        `,sum(case when EDDT='${ymds[5]}' and ODRSTS != '9' then ODRQTY else null end) as 'D5'` +
        `,sum(case when EDDT='${ymds[6]}' and ODRSTS != '9' then ODRQTY else null end) as 'D6'` +
        `,sum(case when EDDT='${ymds[7]}' and ODRSTS != '9' then ODRQTY else null end) as 'D7'` +
        `,sum(case when EDDT='${ymds[8]}' and ODRSTS != '9' then ODRQTY else null end) as 'D8'` +
        `,sum(case when EDDT='${ymds[9]}' and ODRSTS != '9' then ODRQTY else null end) as 'D9'` +
        `,sum(case when EDDT<'${ymds[0]}' and ODRSTS in ('1','2','3') then ODRQTY-JIQTY else 0 end) as 'DAZ'` +
        `,sum(case when EDDT='${ymds[0]}' and ODRSTS in ('1','2','3') then ODRQTY-JIQTY else 0 end) as 'D0Z'` +
        `,sum(case when EDDT='${ymds[1]}' and ODRSTS in ('1','2','3') then ODRQTY-JIQTY else 0 end) as 'D1Z'` +
        `,sum(case when EDDT='${ymds[2]}' and ODRSTS in ('1','2','3') then ODRQTY-JIQTY else 0 end) as 'D2Z'` +
        `,sum(case when EDDT='${ymds[3]}' and ODRSTS in ('1','2','3') then ODRQTY-JIQTY else 0 end) as 'D3Z'` +
        `,sum(case when EDDT='${ymds[4]}' and ODRSTS in ('1','2','3') then ODRQTY-JIQTY else 0 end) as 'D4Z'` +
        `,sum(case when EDDT='${ymds[5]}' and ODRSTS in ('1','2','3') then ODRQTY-JIQTY else 0 end) as 'D5Z'` +
        `,sum(case when EDDT='${ymds[6]}' and ODRSTS in ('1','2','3') then ODRQTY-JIQTY else 0 end) as 'D6Z'` +
        `,sum(case when EDDT='${ymds[7]}' and ODRSTS in ('1','2','3') then ODRQTY-JIQTY else 0 end) as 'D7Z'` +
        `,sum(case when EDDT='${ymds[8]}' and ODRSTS in ('1','2','3') then ODRQTY-JIQTY else 0 end) as 'D8Z'` +
        `,sum(case when EDDT='${ymds[9]}' and ODRSTS in ('1','2','3') then ODRQTY-JIQTY else 0 end) as 'D9Z'` +
        `,min(case when EDDT<'${ymds[0]}' and ODRSTS in ('1','2','3') then ODRSTS else null end) as 'STSA'` + 
        `,min(case when EDDT='${ymds[0]}' then ODRSTS else null end) as 'STS0'` + 
        `,min(case when EDDT='${ymds[1]}' then ODRSTS else null end) as 'STS1'` + 
        `,min(case when EDDT='${ymds[2]}' then ODRSTS else null end) as 'STS2'` + 
        `,min(case when EDDT='${ymds[3]}' then ODRSTS else null end) as 'STS3'` + 
        `,min(case when EDDT='${ymds[4]}' then ODRSTS else null end) as 'STS4'` + 
        `,min(case when EDDT='${ymds[5]}' then ODRSTS else null end) as 'STS5'` + 
        `,min(case when EDDT='${ymds[6]}' then ODRSTS else null end) as 'STS6'` + 
        `,min(case when EDDT='${ymds[7]}' then ODRSTS else null end) as 'STS7'` + 
        `,min(case when EDDT='${ymds[8]}' then ODRSTS else null end) as 'STS8'` + 
        `,min(case when EDDT='${ymds[9]}' then ODRSTS else null end) as 'STS9'` + " " + 
        "from kd8450 a, km8430 b where a.HMCD = b.HMCD" +
        " and a.EDDT between ? and ?" +
        " and a.MCGCD=? and a.MCCD=? " +
        "group by a.HMCD, b.HMNM, b.MATESIZE, b.LENGTH " + 
        "having " +
        " sum(case when EDDT<? and ODRSTS in ('1','2','3') then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 " + orderby;
        let kd8450 = await getDatabase(sql,
            [okure[0].YMD , ymds[9], mcgcd, mccd.MCCD, ymds[0], ...ymds]);

        // 各設備が係わる帳票定義IDデータを取得
        const km8430 = await getKM8430Defids(mcgcd, mccd.MCCD);

        // 切削オーダーに品番毎の在庫情報を取得して付加
        let kd8460 = await getDatabase(
            "select HMCD, " + 
            "sum(case when MCGCD=? and MCCD=? then ZAIQTY else 0 end) as 'ZAIQTY', " +
            "sum(case when MCGCD='STORE' then ZAIQTY else 0 end) as 'STORE' " +
            "from kd8460 group by HMCD"
            , [mcgcd, mccd.MCCD]
        );
        for await (row of kd8450) {
            let idx = 0;
            // IREPO帳票IDとCTを付与
            idx = km8430.findIndex(t => t.HMCD === row.HMCD);
            if (idx < 0) {
                row.DEFID = 0;
                row.CT = 0;
            } else {
                row.DEFID = km8430[idx].DEFID === null ? 0 : km8430[idx].DEFID;
                row.CT = km8430[idx].CT === null ? 0 : km8430[idx].CT;
            }
            // 在庫情報を付与
            idx = kd8460.findIndex(t => t.HMCD === row.HMCD);
            if (idx < 0) {
                row.ZAIQTY = 0;
                row.STORE = 0;
            } else {
                row.ZAIQTY = kd8460[idx].ZAIQTY === null ? 0 : kd8460[idx].ZAIQTY;
                row.STORE = 0; // kd8460[idx].STORE === null ? 0 : kd8460[idx].STORE; タナコンサーバーから直接取得するよう変更
            }
        }
        mc.push([mccd, kd8450]);
    }
    return mc;
};
exports.getKD8450Orders = getKD8450Orders;

// 設備毎の内示データを2週間分取得
const getKD8440Plans = async (mcgcd, mccds, ymds) => {

    // 検索を高速化する為に開始ODRNOを決定
    const targetday = new Date();
    targetday.setMonth(targetday.getMonth() - 4); // 4カ月前を取得
    const startodrno = ("00" + (targetday.getFullYear())).slice(-2) + 
                       ("00" + (targetday.getMonth()+1)).slice(-2) + "000000";

    // グループの設備一覧を取得
    const orderby = await getMCOrderby(mcgcd);

    // メイン処理（設備一覧でループ）
    const mc = [];
    for await (let mccd of mccds) {
        // 各設備の内示一覧を取得
        let sql = "select a.HMCD,b.HMNM,b.MATESIZE,b.LENGTH" +
        ",max(ifnull(b.MATERIALLEN,0)) as 'MATERIALLEN'" + 
        `,sum(case when EDDT='${ymds[0]}' and ODRSTS != '9' then ODRQTY else null end) as 'D0'` +
        `,sum(case when EDDT='${ymds[1]}' and ODRSTS != '9' then ODRQTY else null end) as 'D1'` +
        `,sum(case when EDDT='${ymds[2]}' and ODRSTS != '9' then ODRQTY else null end) as 'D2'` +
        `,sum(case when EDDT='${ymds[3]}' and ODRSTS != '9' then ODRQTY else null end) as 'D3'` +
        `,sum(case when EDDT='${ymds[4]}' and ODRSTS != '9' then ODRQTY else null end) as 'D4'` +
        `,sum(case when EDDT='${ymds[5]}' and ODRSTS != '9' then ODRQTY else null end) as 'D5'` +
        `,sum(case when EDDT='${ymds[6]}' and ODRSTS != '9' then ODRQTY else null end) as 'D6'` +
        `,sum(case when EDDT='${ymds[7]}' and ODRSTS != '9' then ODRQTY else null end) as 'D7'` +
        `,sum(case when EDDT='${ymds[8]}' and ODRSTS != '9' then ODRQTY else null end) as 'D8'` +
        `,sum(case when EDDT='${ymds[9]}' and ODRSTS != '9' then ODRQTY else null end) as 'D9'` +
        `,sum(case when EDDT='${ymds[0]}' and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D0Z'` +
        `,sum(case when EDDT='${ymds[1]}' and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D1Z'` +
        `,sum(case when EDDT='${ymds[2]}' and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D2Z'` +
        `,sum(case when EDDT='${ymds[3]}' and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D3Z'` +
        `,sum(case when EDDT='${ymds[4]}' and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D4Z'` +
        `,sum(case when EDDT='${ymds[5]}' and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D5Z'` +
        `,sum(case when EDDT='${ymds[6]}' and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D6Z'` +
        `,sum(case when EDDT='${ymds[7]}' and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D7Z'` +
        `,sum(case when EDDT='${ymds[8]}' and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D8Z'` +
        `,sum(case when EDDT='${ymds[9]}' and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D9Z'` +
        `,min(case when EDDT='${ymds[0]}' then ODRSTS else null end) as 'STS0'` +
        `,min(case when EDDT='${ymds[1]}' then ODRSTS else null end) as 'STS1'` +
        `,min(case when EDDT='${ymds[2]}' then ODRSTS else null end) as 'STS2'` +
        `,min(case when EDDT='${ymds[3]}' then ODRSTS else null end) as 'STS3'` +
        `,min(case when EDDT='${ymds[4]}' then ODRSTS else null end) as 'STS4'` +
        `,min(case when EDDT='${ymds[5]}' then ODRSTS else null end) as 'STS5'` +
        `,min(case when EDDT='${ymds[6]}' then ODRSTS else null end) as 'STS6'` +
        `,min(case when EDDT='${ymds[7]}' then ODRSTS else null end) as 'STS7'` +
        `,min(case when EDDT='${ymds[8]}' then ODRSTS else null end) as 'STS8'` +
        `,min(case when EDDT='${ymds[9]}' then ODRSTS else null end) as 'STS9'` + " " +
        "from kd8440 a, km8430 b where a.HMCD = b.HMCD" +
        " and a.KTCD like 'MP%' and a.ODCD like '6060%'" +
        " and a.EDDT between ? and ?" +
        " and a.HMCD in (select hmcd from km8430 where ktkey like ? ) " +
        "group by a.HMCD, b.HMNM, b.MATESIZE, b.LENGTH " + 
        "having " +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? and ODRSTS != '9' then ODRQTY else null end) > 0 " + orderby;
        const kd8440 = await getDatabase(sql
            , [ymds[0], ymds[9]
            , "%" + mcgcd + "-" + mccd.MCCD + ":%"
            , ...ymds
        ]);
        
        // 各設備の手配残データを取得（おまけ１）
        const kd8450 = await getDatabase(
            "select HMCD, sum(ODRQTY) as 'ODRQTY', sum(ODRQTY-JIQTY) as 'ZANQTY', min(ODRSTS) as 'ODRSTS' " + 
            "from kd8450 " + 
            "where MCGCD=? and MCCD=? and ODRSTS in ('1','2','3') and EDDT<? and ODRNO>?" + 
            "group by HMCD"
            , [mcgcd, mccd.MCCD, ymds[0], startodrno]
        );

        // 在庫テーブルの仕掛り在庫情報を取得（おまけ２）
        const kd8460mccd = await getDatabase(
            "select a.HMCD, b.HMNM, b.MATESIZE, b.LENGTH" +
            ", ifnull(b.MATERIALLEN,0) as 'MATERIALLEN'" +
            ", null as 'D0', null as 'D1', null as 'D2', null as 'D3', null as 'D4'" + 
            ", null as 'D5', null as 'D6', null as 'D7', null as 'D8', null as 'D9'" + 
            ", a.ZAIQTY from kd8460 a, km8430 b " + 
            "where a.HMCD=b.HMCD and MCGCD=? and MCCD=? and a.ZAIQTY > 0"
            , [mcgcd, mccd.MCCD]
        );

        // 帳票定義IDデータを取得（おまけ４）
        const km8430 = await getKM8430Defids(mcgcd, mccd.MCCD);

        // 各設備の内示一覧に各種データを付与
        for await (row of kd8440) {
            let idx = 0;
            // 手配残データを付与（おまけ１）
            idx = kd8450.findIndex(t => t.HMCD === row.HMCD);
            if (idx < 0) {
                row.DA = null;
                row.DAZ = 0;
                row.STSA = null;
            } else {
                row.DA = kd8450[idx].ODRQTY;
                row.DAZ = kd8450[idx].ZANQTY;
                row.STSA = kd8450[idx].ODRSTS;
            }
            // 在庫テーブルの仕掛り情報を付与（おまけ２）
            idx = kd8460mccd.findIndex(t => t.HMCD === row.HMCD);
            if (idx < 0) {
                row.ZAIQTY = 0;
            } else {
                row.ZAIQTY = kd8460mccd[idx].ZAIQTY === null ? 0 : kd8460mccd[idx].ZAIQTY;
            }
            row.STORE = 0;
            // IREPO帳票IDとCTを付与（おまけ４）
            idx = km8430.findIndex(t => t.HMCD === row.HMCD);
            if (idx < 0) {
                row.DEFID = 0;
                row.CT = 0;
            } else {
                row.DEFID = km8430[idx].DEFID === null ? 0 : km8430[idx].DEFID;
                row.CT = km8430[idx].CT === null ? 0 : km8430[idx].CT;
            }
        }

        // 仕掛かり在庫のみデータを内示一覧に追加（おまけ５）
        let countAdded = 0;
        for await (row of kd8460mccd) {
            let idx = 0;
            // 内示情報を検索
            idx = kd8440.findIndex(t => t.HMCD === row.HMCD && row.ZAIQTY > 0);
            if (idx < 0) {
                // 手配残データを付与（おまけ１）
                idx = kd8450.findIndex(t => t.HMCD === row.HMCD);
                if (idx < 0) {
                    row.DA = null;
                    row.DAZ = 0;
                    row.STSA = null;
                } else {
                    row.DA = kd8450[idx].ODRQTY;
                    row.DAZ = kd8450[idx].ZANQTY;
                    row.STSA = kd8450[idx].ODRSTS;
                }
                row.STORE = 0;
                // IREPO帳票IDを付与（おまけ４）
                idx = km8430.findIndex(t => t.HMCD === row.HMCD);
                if (idx < 0) {
                    row.DEFID = 0;
                    row.CT = 0;
                } else {
                    row.DEFID = km8430[idx].DEFID === null ? 0 : km8430[idx].DEFID;
                    row.CT = km8430[idx].CT === null ? 0 : km8430[idx].CT;
                }
                // 通常の内示一覧に仕掛かり在庫のみのデータを追加する
                kd8440.push(row);
                countAdded++;
            }
        }

        // 仕掛かり在庫の追加があった場合は JSON の並び替えを行う
        // [ order by MATESIZE asc, HMCD asc ] ・・・ desc にしたい場合は 1 と -1 を入れ替えればよい
        if (countAdded > 0) {
            kd8440.sort((a, b) => {
                var key1A = a.MATESIZE;
                var key1B = b.MATESIZE;
                var key2A = a.HMCD;
                var key2B = b.HMCD;
                if (key1A > key1B) return -1;
                if (key1A < key1B) return 1;
                if (key2A > key2B) return 1;
                if (key2A < key2B) return -1;
                return 0;
            });    
        }
        
        // １設備分の情報が出来上がり
        mc.push([mccd, kd8440]);
    }
    return mc;
};
exports.getKD8440Plans = getKD8440Plans;

// 指定された設備の品番一覧と帳票定義ID一覧のデータを取得
const getKM8430Defids =  async (mcgcd, mccd) => {
    const sql = "select HMCD, " + 
        "case " + 
            `when KT1MCGCD='${mcgcd}' and KT1MCCD='${mccd}' then KT1IREPO ` + 
            `when KT2MCGCD='${mcgcd}' and KT2MCCD='${mccd}' then KT2IREPO ` + 
            `when KT3MCGCD='${mcgcd}' and KT3MCCD='${mccd}' then KT3IREPO ` + 
            `when KT4MCGCD='${mcgcd}' and KT4MCCD='${mccd}' then KT4IREPO ` + 
            `when KT5MCGCD='${mcgcd}' and KT5MCCD='${mccd}' then KT5IREPO ` + 
            "else 0 end DEFID, " + 
        "case " + 
            `when KT1MCGCD='${mcgcd}' and KT1MCCD='${mccd}' then KT1CT ` + 
            `when KT2MCGCD='${mcgcd}' and KT2MCCD='${mccd}' then KT2CT ` + 
            `when KT3MCGCD='${mcgcd}' and KT3MCCD='${mccd}' then KT3CT ` + 
            `when KT4MCGCD='${mcgcd}' and KT4MCCD='${mccd}' then KT4CT ` + 
            `when KT5MCGCD='${mcgcd}' and KT5MCCD='${mccd}' then KT5CT ` + 
            "else 0 end CT " + 
        "from km8430 where KTKEY like ? " + 
        "having DEFID > 0 or CT > 0";
    const km8430 = await getDatabase(sql, [`%${mcgcd}-${mccd}:%`]);
    return km8430;
}

// 設備グループ毎の手配一覧データを取得
const getKD8430Orders = async (mcgcd, mccds, planday, km8430) => {
    const orderby = getMCOrderby(mcgcd);
    const mc = [];
    for (let mccd of mccds) {
        let mccdstr = mccd.MCCD;
        let d0410 = await getDatabase(
            "select a.ODRNO, a.HMCD, a.ODRQTY, a.JIQTY, a.ODRSTS, a.MCSEQ, a.MCGCD, a.MCCD " + 
            ",time_format(WKDTDT, '%H:%i') as 'DTTM' " +
            ",time_format(WKSTDT, '%H:%i') as 'STTM', time_format(WKEDDT, '%H:%i') as 'EDTM' " +
            "from d0415 a, km8430 b where a.HMCD = b.HMCD" +
            " and a.KTCD like 'MP%' and a.ODCD like '6060%'" +
            " and a.EDDT=? and a.MCGCD=? " + orderby
            , [planday, mcgcd]
        );
        // 注文データにコード票データを付加（CT,DT,工程経路,STS)
        for await (row of d0410) {
            let idx = km8430.findIndex(t => t.HMCD === row.HMCD && t.MCGCD === row.MCGCD && t.MCCD === row.MCCD);
            row.CT = km8430[idx].CT === null ? 0 : km8430[idx].CT;
            row.DT = km8430[idx].DT === null ? 0 : (km8430[idx].DT / 60);
            row.STS1 = row.ODRSTS;
            let sts2 = "";
            let sts3 = "";
            let sts4 = "";
            //　前後工程のオーダー情報を取得
            if (km8430[idx].KTSU > 1) {
                let d0410_sub = await getDatabase(
                "select min(case when MCSEQ=1 then ODRSTS else 'X' end) as 'STS1'" +
                ",min(case when MCSEQ=2 then ODRSTS else 'X' end) as 'STS2'" +
                ",min(case when MCSEQ=3 then ODRSTS else 'X' end) as 'STS3'" +
                ",min(case when MCSEQ=4 then ODRSTS else 'X' end) as 'STS4'" +
                " from d0415 where ODRNO=? group by ODRNO", [row.ODRNO]
                );
                row.STS1 = d0410_sub[0].STS1;
                row.STS2 = d0410_sub[0].STS2;
                row.STS3 = d0410_sub[0].STS3;
                row.STS4 = d0410_sub[0].STS4;
            }
            let ktkeys = (km8430[idx].KTKEY + ":::::").split(":")// 工程を分割
            row.KT1 = getKT(ktkeys[0]);
            row.KT2 = getKT(ktkeys[1]);
            row.KT3 = getKT(ktkeys[2]);
            row.KT4 = getKT(ktkeys[3]);
        };
        mc.push([mccd, d0410]);
    };
    return mc;
};
exports.getKD8430Orders = getKD8430Orders;

// 設備毎の日別計画票データを取得
const agetKD8440Daily = async (mcgcd, mccds, planday, km8430) => {
    const orderby = getMCOrderby(mcgcd);
    const mc = [];
    for (let mccd of mccds) {
        let mccdstr = mccd.MCCD;
        let d0410 = await getDatabase(
            "select a.ODRNO, a.HMCD, a.ODRQTY, a.JIQTY, a.ODRSTS, a.MCSEQ, a.MCGCD, a.MCCD " + 
            ",time_format(WKDTDT, '%H:%i') as 'DTTM' " +
            ",time_format(WKSTDT, '%H:%i') as 'STTM', time_format(WKEDDT, '%H:%i') as 'EDTM' " +
            "from d0415 a, km8430 b where a.HMCD = b.HMCD" +
            " and a.KTCD like 'MP%' and a.ODCD like '6060%'" +
            " and a.EDDT=? and a.MCGCD=? " + orderby
            , [planday, mcgcd]
        );
        // 注文データにコード票データを付加（CT,DT,工程経路,STS)
        for await (row of d0410) {
            let idx = km8430.findIndex(t => t.HMCD === row.HMCD && t.MCGCD === row.MCGCD && t.MCCD === row.MCCD);
            row.CT = km8430[idx].CT === null ? 0 : km8430[idx].CT;
            row.DT = km8430[idx].DT === null ? 0 : (km8430[idx].DT / 60);
            row.STS1 = row.ODRSTS;
            let sts2 = "";
            let sts3 = "";
            let sts4 = "";
            //　前後工程のオーダー情報を取得
            if (km8430[idx].KTSU > 1) {
                let d0410_sub = await getDatabase(
                "select min(case when MCSEQ=1 then ODRSTS else 'X' end) as 'STS1'" +
                ",min(case when MCSEQ=2 then ODRSTS else 'X' end) as 'STS2'" +
                ",min(case when MCSEQ=3 then ODRSTS else 'X' end) as 'STS3'" +
                ",min(case when MCSEQ=4 then ODRSTS else 'X' end) as 'STS4'" +
                " from d0415 where ODRNO=? group by ODRNO", [row.ODRNO]
                );
                row.STS1 = d0410_sub[0].STS1;
                row.STS2 = d0410_sub[0].STS2;
                row.STS3 = d0410_sub[0].STS3;
                row.STS4 = d0410_sub[0].STS4;
            }
            let ktkeys = (km8430[idx].KTKEY + ":::::").split(":")// 工程を分割
            row.KT1 = getKT(ktkeys[0]);
            row.KT2 = getKT(ktkeys[1]);
            row.KT3 = getKT(ktkeys[2]);
            row.KT4 = getKT(ktkeys[3]);
        };
        mc.push([mccd, d0410]);
    };
    return mc;
};
exports.agetKD8440Daily = agetKD8440Daily;

// グループ名と設備名が同一の場合は片側のみに編集
const getKT = function (str) {
    const kts = str.split("-");
    return kts[0] === kts[1] ? kts[0] : str;
};

// コード票マスタから帳票IDを取得
const getReportDefID = async (hmcd, mcgcd, mccd) => {
    const sql = 
    "select max(DEFID) as DEFID from (" + 
        `select KT1IREPO as DEFID from km8430 where hmcd='${hmcd}' and KT1MCGCD='${mcgcd}' and KT1MCCD='${mccd}' ` + 
        "union " + 
        `select KT2IREPO as DEFID from km8430 where hmcd='${hmcd}' and KT2MCGCD='${mcgcd}' and KT2MCCD='${mccd}' ` + 
        "union " + 
        `select KT3IREPO as DEFID from km8430 where hmcd='${hmcd}' and KT3MCGCD='${mcgcd}' and KT3MCCD='${mccd}' ` + 
        "union " + 
        `select KT4IREPO as DEFID from km8430 where hmcd='${hmcd}' and KT4MCGCD='${mcgcd}' and KT4MCCD='${mccd}' ` + 
        "union " + 
        `select KT5IREPO as DEFID from km8430 where hmcd='${hmcd}' and KT5MCGCD='${mcgcd}' and KT5MCCD='${mccd}' ` + 
        "union select 0 as DEFID" +
        ") a";
    const km8430 = await getDatabase(sql);
    const defid = km8430[0].DEFID;
    if (defid == 0) {
        km8430[0].HMCDCID = 0;
    } else {
        const km8440 = await getDatabase(`select HMCDCID from km8440 where DEFID=${defid}`);
        if (km8440.length == 0) {
            km8430[0].HMCDCID = 0;
        } else {
            km8430[0].HMCDCID = km8440[0].HMCDCID;
        }
    }
    return km8430;
};
exports.getReportDefID = getReportDefID;

// 品番,設備,手配日付から、注文番号[ODRNO],手配状態[ODRSTS],実績数[JIQTY],未来の実績数[FUTUREQTY],過去の実績残数[ZANQTY]を取得
const getOdrno = async (hmcd, mcgcd, mccd, eddt, stdt) => {
    const sql = 
    "select min(ODRNO) as ODRNO, sum(ODRQTY) as ODRQTY, sum(JIQTY) as JIQTY from kd8450 " + 
        `where HMCD='${hmcd}' and MCGCD='${mcgcd}' and MCCD='${mccd}' and EDDT='${eddt}' ` + 
        "and ODRSTS in ('1','2','3','4') group by EDDT";
    const kd8450 = await getDatabase(sql);
    // 過去日付の実績訂正がタップされた場合、処理不可能を返却
    if (kd8450.length == 0) return kd8450;
    // 同じ日に違う手配番号が複数、１オーダーのロット分割があるのでここでステータス判定
    if (kd8450[0].ODRQTY == kd8450[0].JIQTY) {
        kd8450[0].ODRSTS = "4";
    } else if (kd8450[0].JIQTY == 0) {
        kd8450[0].ODRSTS = "2";
    } else {
        kd8450[0].ODRSTS = "3";
    }
    // 未来の注文数、実績数をここでチェックして返却
    const sql_2 = 
    "select sum(ODRQTY) as FUTUREODR, sum(ifnull(JIQTY, 0)) as FUTUREQTY from kd8450 " + 
        `where HMCD='${hmcd}' and MCGCD='${mcgcd}' and MCCD='${mccd}' and EDDT>'${eddt}' ` + 
        "and ODRSTS in ('1','2','3','4') ";
    const kd8450_2 = await getDatabase(sql_2);
    kd8450[0].FUTUREODR = kd8450_2[0].FUTUREODR;
    kd8450[0].FUTUREQTY = kd8450_2[0].FUTUREQTY;
    // 過去の手配に未完成のものが存在するかここでチェック（ODRQTY!=JIQTY ODRSTS:"4" 手配あり！）
    const sql_3 = 
    "select ifnull(sum(ODRQTY) - sum(JIQTY), 0) as ZANQTY from kd8450 " + 
        `where HMCD='${hmcd}' and MCGCD='${mcgcd}' and MCCD='${mccd}' and EDDT<'${eddt}' and EDDT between '${stdt}' and '${eddt}' ` + 
        "and ODRSTS in ('1','2','3') ";
    const kd8450_3 = await getDatabase(sql_3);
    kd8450[0].ZANQTY = kd8450_3[0].ZANQTY;
    return kd8450;
};
exports.getOdrno = getOdrno;

// 品番,設備,調査開始日付から、注文番号[ODRNO]を取得
const getWaitOdrno = async (hmcd, mcgcd, mccd, stdt) => {
    const sql = 
    "select min(ODRNO) as ODRNO, sum(ODRQTY) as ODRQTY, sum(JIQTY) as JIQTY from kd8450 " + 
    `where HMCD='${hmcd}' and MCGCD='${mcgcd}' and MCCD='${mccd}' and ODRSTS in ('1','2','3') and EDDT=` + 
    "(select min(EDDT) from kd8450 " + 
        `where HMCD='${hmcd}' and MCGCD='${mcgcd}' and MCCD='${mccd}' and EDDT>='${stdt}' ` + 
        "and ODRSTS in ('1','2','3') )";
    const kd8450 = await getDatabase(sql);
    // 同じ日に違う手配番号が複数、１オーダーのロット分割があるのでここでステータス判定
    if (kd8450[0].ODRQTY == kd8450[0].JIQTY) {
        kd8450[0].ODRSTS = "4";
    } else if (kd8450[0].JIQTY == 0) {
        kd8450[0].ODRSTS = "2";
    } else {
        kd8450[0].ODRSTS = "3";
    }
    return kd8450;
};
exports.getWaitOdrno = getWaitOdrno;

// 段取り開始
exports.dandori = async (userid, odrno, planday, mcgcd, mccd) => {
    const update = await getDatabase(
        "update d0415 set ODRSTS='3', UPDTID=?, WKDTDT=current_timestamp " +
        "where ODRNO=? and EDDT=? and MCGCD=? and MCCD=?"
        , [userid, odrno, planday, mcgcd, mccd]
    );    
};

// 作業開始
exports.startOrder = async (odrno, mcgcd, mccd) => {
    const kd8430 = await getDatabase("select EDDT, HMCD from kd8430 where ODRNO=?",[odrno]);
    const update = await getDatabase(
        "update kd8450 set WKSTDT=current_timestamp " +
        "where HMCD=? and EDDT=? and MCGCD=? and MCCD=? and ODRSTS in ('1,','2')"
        , [kd8430[0].HMCD, kd8430[0].EDDT, mcgcd, mccd]);
};






// 実績登録(odrnoを元手に品目指定で登録する)
exports.finishOrder = async (odrno, mcgcd, mccd, jiqty, oparator) => {
    let countdownQty = jiqty;
    const kd8430 = await getDatabase("select EDDT, HMCD from kd8430 where ODRNO=?", [odrno]);
    const kd8450 = await getDatabase("select ODRNO, LOTSEQ, EDDT, ODRQTY, JIQTY from kd8450 " + 
        "where HMCD=? and EDDT>=? and MCGCD=? and MCCD=? and ODRSTS<>'4' and ODRSTS<>'9' " + 
        "order by EDDT, ODRNO, LOTSEQ"
        , [kd8430[0].HMCD, kd8430[0].EDDT, mcgcd, mccd]);
    let result= null;
    // 切削オーダーファイルをループして実績数の消込
    for await (row of kd8450) {
        let odrQty = Number(row.ODRQTY);
        let jiQty = Number(row.JIQTY);
        let needQty = odrQty - jiQty;
        if (countdownQty >= needQty) {
            // odrqtyで更新 countdownQty--
            const update = await getDatabase(
                "update kd8450 set JIQTY=ODRQTY, ODRSTS='4', WKEDDT=current_timestamp, MPUPDTID=? " +
                "where ODRNO=? and LOTSEQ=? and MCGCD=? and MCCD=?"
                , [oparator, row.ODRNO, row.LOTSEQ, mcgcd, mccd]
            );
            if (!result) {
                result = [{"EDDT": row.EDDT, "NEWSTS": "4", "NEWJIQTY": odrQty}];
            } else {
                result.push({"EDDT": row.EDDT, "NEWSTS": "4", "NEWJIQTY": odrQty});
            }
            countdownQty -= needQty;
        } else {
            // jiqtyに足して更新 countdownQty=0
            let newjiqty = jiQty + countdownQty;
            const update = await getDatabase(
                "update kd8450 set JIQTY=?, ODRSTS='3', WKEDDT=current_timestamp, MPUPDTID=? " +
                "where ODRNO=? and LOTSEQ=? and MCGCD=? and MCCD=?"
                , [newjiqty, oparator, row.ODRNO, row.LOTSEQ, mcgcd, mccd]
            );
            if (!result) {
                result = [{"EDDT": row.EDDT, "NEWSTS": "3", "NEWJIQTY": newjiqty}];
            } else {
                result.push({"EDDT": row.EDDT, "NEWSTS": "3", "NEWJIQTY": newjiqty});
            }
        countdownQty = 0;
        }
        if (countdownQty <= 0) break;
    }
    // 手配以上の実績の場合は仕掛り在庫に投入
    if (countdownQty > 0) {
        await this.updateKD8460(kd8430[0].HMCD, mcgcd, mccd, countdownQty, oparator);
    }
    // 結果を返却
    return result;
};


// 実績訂正(品目指定で更新)
exports.modifyOrder = async (odrno, mcgcd, mccd, preqty, modqty, userid) => {
    const kd8430 = await getDatabase("select EDDT, HMCD from kd8430 where ODRNO=?",[odrno]);
    const ordered = (preqty < modqty) ? "asc" : "desc";
    const kd8450 = await getDatabase("select ODRNO, LOTSEQ, EDDT, ODRQTY, JIQTY from kd8450 " + 
        "where HMCD=? and EDDT=? and MCGCD=? and MCCD=? and ODRSTS<>'9' " + 
        "order by ODRNO " + ordered + ", LOTSEQ " + ordered
        , [kd8430[0].HMCD, kd8430[0].EDDT, mcgcd, mccd]);
    let result= null;
    // 加算訂正
    if (preqty < modqty) {
        let countdownQty = modqty - preqty;
        // 切削オーダーファイルをループして実績数を訂正
        for await (row of kd8450) {
            let odrQty = Number(row.ODRQTY);
            let jiQty = Number(row.JIQTY);
            if (countdownQty >= (odrQty - jiQty)) {
                const update = await getDatabase(
                    "update kd8450 set JIQTY=ODRQTY, ODRSTS='4', WKEDDT=current_timestamp, MPUPDTID=? " +
                    "where ODRNO=? and LOTSEQ=? and MCGCD=? and MCCD=?"
                    , [userid, row.ODRNO, row.LOTSEQ, mcgcd, mccd]
                );
                if (!result) {
                    result = [{"EDDT": row.EDDT, "NEWSTS": "4", "NEWJIQTY": odrQty}];
                } else {
                    result.push({"EDDT": row.EDDT, "NEWSTS": "4", "NEWJIQTY": odrQty});
                }
                countdownQty -= (odrQty - jiQty);
            } else {
                // 訂正数量に変更して更新
                let newjiqty = jiQty + countdownQty;
                let newsts = (newjiqty == odrQty) ? "4" : "3";
                const update = await getDatabase(
                    "update kd8450 set JIQTY=?, ODRSTS=?, WKEDDT=null, MPUPDTID=? " +
                    "where ODRNO=? and LOTSEQ=? and MCGCD=? and MCCD=?"
                    , [newjiqty, newsts, userid, row.ODRNO, row.LOTSEQ, mcgcd, mccd]
                );
                if (!result) {
                    result = [{"EDDT": row.EDDT, "NEWSTS": newsts, "NEWJIQTY": newjiqty}];
                } else {
                    result.push({"EDDT": row.EDDT, "NEWSTS": newsts, "NEWJIQTY": newjiqty});
                }
                countdownQty = 0;
            }
            if (countdownQty <= 0) break;
        }

    // 減算訂正
    } else if (preqty > modqty) {
        let countdownQty = preqty - modqty;
        // 切削オーダーファイルをループして実績数を訂正
        for await (row of kd8450) {
            let jiQty = Number(row.JIQTY);
            if (countdownQty >= jiQty) {
                const update = await getDatabase(
                    "update kd8450 set JIQTY=0, ODRSTS='2', WKSTDT=null, WKEDDT=null, MPUPDTID=? " +
                    "where ODRNO=? and LOTSEQ=? and MCGCD=? and MCCD=?"
                    , [userid, row.ODRNO, row.LOTSEQ, mcgcd, mccd]
                );
                if (!result) {
                    result = [{EDDT: row.EDDT, NEWSTS: "2", NEWJIQTY: 0}];
                } else {
                    result.push([{EDDT: row.EDDT, NEWSTS: "2", NEWJIQTY: 0}]);
                }
                countdownQty -= jiQty;
            } else {
                // 訂正数量に変更して更新 countdownQty=0
                let newjiqty = jiQty - countdownQty;
                let newsts = (countdownQty == 0) ? "2" : "3";
                const update = await getDatabase(
                    "update kd8450 set JIQTY=?, ODRSTS=?, WKEDDT=null, MPUPDTID=? " +
                    "where ODRNO=? and LOTSEQ=? and MCGCD=? and MCCD=?"
                    , [newjiqty, newsts, userid, row.ODRNO, row.LOTSEQ, mcgcd, mccd]
                );
                if (!result) {
                    result = [{EDDT: row.EDDT, NEWSTS: newsts, NEWJIQTY: newjiqty}];
                } else {
                    result.push({EDDT: row.EDDT, NEWSTS: newsts, NEWJIQTY: newjiqty});
                }
                countdownQty = 0;
            }
            if (countdownQty <= 0) break;
        }

    }
    // 実績数以上の訂正数の入力はフロント側でチェック済み
    return result;
};

// 在庫訂正
exports.modifyZaiko = async (hmcd, mcgcd, mccd, modqty, userid) => {
    const sql = "select count(*) as COUNT from kd8460 where HMCD=? and MCGCD=? and MCCD=?";
    const kd8460 = await getDatabase(sql, [hmcd, mcgcd, mccd]);
    if (kd8460[0].COUNT == 0) {
        const insert = await getDatabase(
            "insert into kd8460 " +
            "(HMCD, MCGCD, MCCD, ZAIQTY, INDT, MPINSTID, MPINSTDT, MPUPDTID, MPUPDTDT)" + 
            "select ?, ?, ?, ?, now(), ?, now(), ?, now()"
            , [hmcd, mcgcd, mccd, modqty, userid, userid]
        );
        return insert;
    } else {
        const update = await getDatabase(
            "update kd8460 set ZAIQTY=?, MPUPDTID=?, MPUPDTDT=now() " +
            "where HMCD=? and MCGCD=? and MCCD=?"
            , [modqty, userid, hmcd, mcgcd, mccd]
        );
        return update;
    }
};



// 従業員マスタ(KM0010)存在チェック
exports.isKM0010 = async (userid) => {
    const km0010 = await getDatabase("select * from km0010 where EMPNO=?", [userid]);
    return km0010.length == 0 ? false : true;
};

// 在庫テーブルに品番が存在するかチェック
// レコードなし:-1、それ以外は在庫数を返却
exports.isKD8460 = async (hmcd, mcgcd, mccd) => {
    const sql = "select count(*) as cnt, sum(ZAIQTY) as ZAIQTY from kd8460 where HMCD=? and MCGCD=? and MCCD=?";
    const res = await getDatabase(sql, [hmcd, mcgcd, mccd]);
    return (Number(res[0].cnt) == 0) ? -1 : Number(res[0].ZAIQTY);
}

// 在庫更新
// https://pc090n:53030/ireporegist/sw/10841/RD479-63171-1:6:plan: -> ZAI=0
// https://pc090n:53030/ireporegist/sw/10841/RP801-63142-2:105:plan: -> ZAI=229
// https://pc090n:53030/ireporegist/sw/10841/69141GL10A-1:30:plan: -> REC=0
exports.updateKD8460 = async (hmcd, mcgcd, mccd, jiqty, operator) => {
    // 在庫テーブルが存在するかチェック
    const zaiqty = await this.isKD8460(hmcd, mcgcd, mccd);
    if (zaiqty < 0) {
        // なければ追加
        // 減算の場合は追加しない
        if (jiqty > 0) {
            const sql = "insert into kd8460 " +
                "(HMCD, MCGCD, MCCD, ZAIQTY, " +
                "INDT, MPINSTID, MPUPDTID, MPINSTDT, MPUPDTDT) " +
                "values " + 
                "(?,?,?,?,now(),?,?,now(),now())";
            const insert = await getDatabase(sql, 
                [hmcd, mcgcd, mccd, jiqty, operator, operator]);
        }
    } else {
        // あれば更新
        // 減算の場合、最低数を0に設定（レコードなし=-1との相関関係）
        let newqty = (zaiqty + jiqty < 0) ? 0 : zaiqty + jiqty;
        const sql = "update kd8460 set ZAIQTY=?, INDT=now(), MPUPDTID=?, MPUPDTDT=now() " +
            "where HMCD=? and MCGCD=? and MCCD=?";
        const update = await getDatabase(sql,
            [newqty, operator, hmcd, mcgcd, mccd]);
    }
};

// 当日ダッシュボード データ取得 [0]当日、[1]遅延
exports.getDashboardToday = async () => {
    // ダッシュボード
    const sql1 = 
        "select " + 
        "count(*) as GOAL " + 
        ",count(if(new.ODRSTS='4', 1, NULL)) as RESULT " + 
        ",count(if(new.ODRSTS<>'4', 1, NULL)) as REMAIN " + 
        ",cast(ifnull(sum(old.ODRQTY-old.JIQTY),0) as signed) as GOALQTY " + 
        ",cast(ifnull(sum(if(new.ODRSTS='4',old.ODRQTY-old.JIQTY,0)),0) as signed) as RESULTQTY " + 
        ",cast(ifnull(sum(if(new.ODRSTS<>'4',old.ODRQTY-old.JIQTY,0)),0) as signed) as REMAINQTY " + 
        "from kd8430 new, kd8490 old " + 
        "where new.ODRNO = old.ODRNO and new.ODRSTS<>'9' and old.TARGETDT=curdate() " + 
        "and old.EDDT=curdate() " + 
        "union all " + 
        "select " + 
        "count(*) as GOAL " +
        ",count(if(new.ODRSTS='4', 1, NULL)) as RESULT " +
        ",count(if(new.ODRSTS<>'4', 1, NULL)) as REMAIN " + 
        ",cast(ifnull(sum(old.ODRQTY-old.JIQTY),0) as signed) as GOALQTY " + 
        ",cast(ifnull(sum(if(new.ODRSTS='4',old.ODRQTY-old.JIQTY,0)),0) as signed) as RESULTQTY " + 
        ",cast(ifnull(sum(if(new.ODRSTS<>'4',old.ODRQTY-old.JIQTY,0)),0) as signed) as REMAINQTY " + 
        "from kd8430 new, kd8490 old " + 
        "where new.ODRNO = old.ODRNO and new.ODRSTS<>'9' and old.TARGETDT=curdate()" + 
        "and old.EDDT<curdate() " + 
        "union all " + 
        "select 0 as GOAL, 0 as RESULT, 0 as REMAIN, 0 as GOALQTY, 0 as RESULTQTY, 0 as REMAINQTY "   // 遅れレコードが存在しない場合はここを参照させる
    ;
    const summary = await getDatabase(sql1);
    // chart2 実績数(実績テーブルがMPシステムには存在しないので更新日付で無理やり取得)・・・要改善検討事項
    const sql2 = "select cast(MPUPDTDT as date) as label, sum(ODRQTY) as data1 " + 
        "from kd8430 " + 
        "where ODRSTS = '4' and " + 
        "cast(MPUPDTDT as date) between date_add(CURDATE(), interval -20 day) and CURDATE() " + 
        "group by cast(MPUPDTDT as date) order by cast(MPUPDTDT as date)"
    ;
    const chart2Jisseki = await getDatabase(sql2);
    // chart2 遅れ点数
    const sql3 = "select cast(TARGETDT as date) as label, count(*) as data2 " + 
        "from kd8490 " + 
        "where TARGETDT between date_add(CURDATE(), interval -20 day) and CURDATE()" + 
        "and EDDT<TARGETDT " + 
        "group by TARGETDT order by TARGETDT"
    ;
    const chart2Okure = await getDatabase(sql3);

    /* Degub用
    summary[0].GOALQTY = 2500;
    summary[0].RESULTQTY = 500;
    summary[0].REMAINQTY = 2000;
    summary[1].GOALQTY = 1000;
    summary[1].RESULTQTY = 800;
    summary[1].REMAINQTY = 200;
    */
    const objToday = {
        today: summary[0],
        delay: summary[1],
        chart2: {
            labels: [],
            data1: [],
            data2: [],
        },
        chart3: {
            labels: [],
            data1: [],
            data2: [],
        },
    };
    for await (row of chart2Jisseki) {
        objToday.chart2.labels.push(row.label);
        objToday.chart2.data1.push(Number(row.data1));
        const result = chart2Okure.find(d => d.label === row.label);
        if (!result) {
            objToday.chart2.data2.push(0);
        } else {
            objToday.chart2.data2.push(Number(result.data2));
        }
    }
    // chart3 進捗状況
    const chart3Sql = 
        "select m.KTNKBN, a.MCGCD" +
        ", sum(if(a.ODRSTS in ('4'), 1, 0)) 完了点数" +
        ", count(*) 合計点数 " +
        "from " +
        "(" +

            "select MCGCD, ODRSTS from kd8450 where ODRSTS !=  '9' " +
            "and EDDT between " +
                "DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 7 DAY), INTERVAL WEEKDAY(CURDATE()) DAY) and " + 
                "date_add(date_sub(date_add(CURDATE(), interval 7 day), interval weekday(CURDATE()) day), interval 5 day) " +  // 来週の月曜日から土曜日
            "and MCGCD in ('SW') " +

            "union all " +
            "select if(MCGCD='3BP','MC',if(MCGCD='ON','MC',MCGCD)) MCGCD, ODRSTS " +
            "from kd8450 where ODRSTS !=  '9' " +
            "and EDDT between " + 
                "DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) and " + 
                "DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 5 DAY) " +  // 今週の月曜日から土曜日
            "and MCGCD not in ('EX','G','D','MD','TP','SW')" +
        ") a, km8420 m " +
        "where a.MCGCD=m.MCGCD " +
        "group by m.KTNKBN, m.MCGSEQ, a.MCGCD " +
        "order by m.KTNKBN, m.MCGSEQ, a.MCGCD"
    ;
    const chart3Result = await getDatabase(chart3Sql);
    // 必要に応じて別の配列に加工
    objToday.chart3.labels = chart3Result.map(row => row.MCGCD);
    for await (row of chart3Result) {
        objToday.chart3.data1.push(Math.floor((Number(row.完了点数) / Number(row.合計点数)) * 100)); // パーセンテージ
        objToday.chart3.data2.push(row.KTNKBN);
    }
        /*
                "labels": ['11/6', '11/7', '11/10', '11/11', '11/12', '11/13', '11/14'],
                "data1": [5017, 7652, 6995, 8592, 5419, 5069, 5060],
                "data2": [30, 75, 44, 0, 0, 20, 0],
                jsonToday.chart2.labels.push('11/19');
                jsonToday.chart2.data1.push(7777);
                jsonToday.chart2.data2.push(55);
        */
    return objToday;
}

// 当日ダッシュボード
//   遅れポップアップウィンドウ
exports.getDelayList = async () => {
    const sql = 
        "select row_number() OVER (ORDER BY 完了予定日, 品番) 行番号, 集計.*, sum(c.ODRQTY) 最低必要数 from ( " + 
        "select DATE_FORMAT(min(a.EDDT), '%Y-%m-%d') 完了予定日, a.HMCD 品番, replace(replace(replace(m.KTKEY,':','　→　'),'3BP-','MC-'),'ON-','MC-') 工程経路 " + 
        ", sum(a.ODRQTY) 必要数, count(*) 遅延件数  " + 
        "from kd8490 a ,kd8430 b, km8430 m  " + 
        "where 1=1 " + 
        "and a.ODRNO = b.ODRNO " + 
        "and a.HMCD = m.HMCD " + 
        "and a.ODRSTS <> '4' " + 
        "and a.TARGETDT = CURDATE() " + 
        "group by a.HMCD, ktkey " + 
        ") 集計, kd8490 c " + 
        "where 集計.完了予定日 = c.EDDT and 集計.品番 = c.HMCD and c.TARGETDT=CURDATE() " + 
        "group by 集計.完了予定日, 集計.品番 " + 
        "order by 集計.完了予定日, 集計.品番 "
    ;
    const data = await getDatabase(sql);
    return data;
}

// 注文ダッシュボード
exports.getDashboardFuture = async (dates) => {
    //   工程全体
    const sql = 
        "select KTNKBN, case KTNKBN when '1' then '手動機' when '2' then '自動機' else '不明' end as 工程内区分 " +
            ", MCGCD, MCGCD as 工程コード " +
            ", sum(case z.week when '今週' then 作業工数 else 0 end) as 今週注文工数 " +
            ", sum(case z.week when '今週' then 段取工数 else 0 end) as 今週段取工数 " +
            ", sum(case z.week when '来週' then 作業工数 else 0 end) as 来週注文工数 " +
            ", sum(case z.week when '来週' then 段取工数 else 0 end) as 来週段取工数 " +
        "from " +
        "( " +
            "select '今週'as week, m20.KTNKBN, m20.MCGSEQ " +
                ", case a.MCGCD when 'ON' then 'MC3' when '3BP' then 'MC2' when 'MC' then 'MC1' else a.MCGCD end as MCGCD " +
                ", round(sum(ODRHOUR) / count(*), 2) as 作業工数 " +
                ", round(sum(SETUPHOUR) / count(*), 2) as 段取工数 " +
            "from kd8510 a inner join km8420 m20 on m20.MCGCD=a.MCGCD and m20.MCCD=a.MCCD " +
            "where eddt between ? and ? " +
            "group by KTNKBN, MCGSEQ, case a.MCGCD when 'ON' then 'MC3' when '3BP' then 'MC2' when 'MC' then 'MC1' else a.MCGCD end " +
            "union  " +
            "select '来週' as week, m20.KTNKBN, m20.MCGSEQ " +
                ", case a.MCGCD when 'ON' then 'MC3' when '3BP' then 'MC2' when 'MC' then 'MC1' else a.MCGCD end as MCGCD " +
                ", round(sum(ODRHOUR) / count(*), 2) as 作業工数 " +
                ", round(sum(SETUPHOUR) / count(*), 2) as 段取工数 " +
            "from kd8510 a inner join km8420 m20 on m20.MCGCD=a.MCGCD and m20.MCCD=a.MCCD " +
            "where eddt between ? and ? " +
            "group by KTNKBN, MCGSEQ, case a.MCGCD when 'ON' then 'MC3' when '3BP' then 'MC2' when 'MC' then 'MC1' else a.MCGCD end " +
        ") z " +
        "group by z.KTNKBN, z.MCGSEQ, z.MCGCD " +
        "order by z.KTNKBN, z.MCGSEQ, z.MCGCD "
    ;
    const data = await getDatabase(sql, [...dates]);
    
    const objFuture = {
        "labels": data.map(row => row.MCGCD),
        "ktnkbn": data.map(row => row.KTNKBN),
        "thisweekworks": data.map(row => Number(row.今週注文工数)),
        "thisweekdandori": data.map(row => Number(row.今週段取工数)),
        "nextweekworks": data.map(row => Number(row.来週注文工数)),
        "nextweekdandori": data.map(row => Number(row.来週段取工数)),
        /*
        "labels": ['SW', 'NC', 'MC1', 'MC2', 'MC3', 'SK', 'TN', 'SS', 'XT', 'CN', 'MS'],
        "ktnkbn": ["1", "1", "1", "1", "1", "1", "1", "2", "2", "2", "2"],
        "thisweekworks": [6.08, 2.94, 2.02, 5.06, 3.02, 5.03, 1.58, 9.68, 6.19, 9.47, 7.09],
        "thisweekdandori": [1.95, 0.64, 0.68, 1.03, 0.73, 0.25, 0.93, 1.25, 2.59, 0.83, 0.63],
        "nextweekworks": [5.27, 2.95, 2.02, 6.19, 2.81, 5.05, 2.23, 9.90, 7.87, 8.26, 7.25],
        "nextweekdandori": [1.85, 0.55, 0.75, 0.95, 0.65, 0.25, 1.13, 1.17, 3.08, 0.90, 0.73],
        */
    };
    return objFuture;

}

// 注文ダッシュボード（工程ごと）
exports.getDashboardFutureGCD = async (mcgcode, dates) => {
    //   各工程ごと
    const mcgcd = (mcgcode=='MC3') ? 'ON' : (mcgcode=='MC2') ? '3BP' : (mcgcode=='MC1') ? 'MC' : mcgcode;
    const sql = 
        "select KTNKBN, case KTNKBN when '1' then '手動機' when '2' then '自動機' else '不明' end as 工程内区分 " +
            ", MCCD, MCCD as 工程コード " +
            ", sum(case z.week when '今週' then 作業工数 else 0 end) as 今週注文工数 " +
            ", sum(case z.week when '今週' then 段取工数 else 0 end) as 今週段取工数 " +
            ", sum(case z.week when '来週' then 作業工数 else 0 end) as 来週注文工数 " +
            ", sum(case z.week when '来週' then 段取工数 else 0 end) as 来週段取工数 " +
        "from " +
        "( " +
            "select '今週'as week, m20.KTNKBN, m20.MCSEQ " +
                ", concat(a.MCGCD,'-',a.MCCD) as MCCD " +
                ", round(sum(ODRHOUR) / count(*), 2) as 作業工数 " +
                ", round(sum(SETUPHOUR) / count(*), 2) as 段取工数 " +
            "from kd8510 a inner join km8420 m20 on m20.MCGCD=a.MCGCD and m20.MCCD=a.MCCD " +
            "where eddt between ? and ? and a.MCGCD = ? " +
            "group by KTNKBN, MCSEQ, a.MCCD " +
            "union  " +
            "select '来週' as week, m20.KTNKBN, m20.MCSEQ " +
                ", concat(a.MCGCD,'-',a.MCCD) as MCCD " +
                ", round(sum(ODRHOUR) / count(*), 2) as 作業工数 " +
                ", round(sum(SETUPHOUR) / count(*), 2) as 段取工数 " +
            "from kd8510 a inner join km8420 m20 on m20.MCGCD=a.MCGCD and m20.MCCD=a.MCCD " +
            "where eddt between ? and ? and a.MCGCD = ? " +
            "group by KTNKBN, MCSEQ, a.MCCD " +
        ") z " +
        "group by z.KTNKBN, z.MCSEQ, z.MCCD " +
        "order by z.KTNKBN, z.MCSEQ, z.MCCD "
    ;
    const data = await getDatabase(sql, [dates[0], dates[1], mcgcd, dates[2], dates[3], mcgcd, ]);
    
    const objFuture = {
        "labels": data.map(row => row.MCCD),
        "ktnkbn": data.map(row => row.KTNKBN),
        "thisweekworks": data.map(row => Number(row.今週注文工数)),
        "thisweekdandori": data.map(row => Number(row.今週段取工数)),
        "nextweekworks": data.map(row => Number(row.来週注文工数)),
        "nextweekdandori": data.map(row => Number(row.来週段取工数)),
        /*
        "labels": ['SW', 'NC', 'MC1', 'MC2', 'MC3', 'SK', 'TN', 'SS', 'XT', 'CN', 'MS'],
        "ktnkbn": ["1", "1", "1", "1", "1", "1", "1", "2", "2", "2", "2"],
        "thisweekworks": [6.08, 2.94, 2.02, 5.06, 3.02, 5.03, 1.58, 9.68, 6.19, 9.47, 7.09],
        "thisweekdandori": [1.95, 0.64, 0.68, 1.03, 0.73, 0.25, 0.93, 1.25, 2.59, 0.83, 0.63],
        "nextweekworks": [5.27, 2.95, 2.02, 6.19, 2.81, 5.05, 2.23, 9.90, 7.87, 8.26, 7.25],
        "nextweekdandori": [1.85, 0.55, 0.75, 0.95, 0.65, 0.25, 1.13, 1.17, 3.08, 0.90, 0.73],
        */
    };
    return objFuture;

}

// 注文ダッシュボード（設備ごと）
exports.getDashboardFutureQTY = async (mcgcode, mccd, dates) => {
    //   各工程ごと
    const mcgcd = (mcgcode=='MC3') ? 'ON' : (mcgcode=='MC2') ? '3BP' : (mcgcode=='MC1') ? 'MC' : mcgcode;
    const sql = 
        "select case when a.MCGCD = a.MCCD then a.MCGCD else concat(a.MCGCD,'-',a.MCCD) end as MCCODE " + 
            ", concat( " +
                "date_format(a.EDDT, '%c/%e') "+
                ",' (' " +
                ", case weekday(a.EDDT) " +
                    "when 0 then '月' " +
                    "when 1 then '火' " +
                    "when 2 then '水' " +
                    "when 3 then '木' " +
                    "when 4 then '金' " +
                    "when 5 then '土' " +
                    "when 6 then '日' " +
                    "end " +
                ", ')') as EDDT " +
            ", case when a.EDDT <= ? then '1' else '2' end as WEEKKBN " +
            ", a.ODRQTY, a.ODRHOUR, a.SETUPHOUR " +
        "from kd8510 a " +
        "where a.MCGCD = ? and a.MCCD = ? " +
            "and a.EDDT between ? and ?"
        "order by a.EDDT"
    ;
    const data = await getDatabase(sql, [dates[1], mcgcd, mccd, dates[0], dates[3]]);
    return {
        "title": data[0].MCCODE,
        "labels": data.map(row => row.EDDT),
        "weekkbn": data.map(row => row.WEEKKBN),
        "qty": data.map(row => Number(row.ODRQTY)),
        "works": data.map(row => Number(row.ODRHOUR)),
        "dandori": data.map(row => Number(row.SETUPHOUR)),
    };
}

// 注文ダッシュボード（設備の対象日の詳細ポップアップ画面）
exports.getDashboardFuturePopup = async (mcgcd, mccd, eddt) => {
    const sql =
        "select a.HMCD as 品番, m30.HMNM as 品名, m30.MATESIZE as 材料, replace(m30.KTKEY, ':', '　→　') as 工程経路 " +
            ", a.ODRQTY as 注文数 " +
            ", case " +
                "when a.MCGCD=m30.KT1MCGCD and a.MCCD=m30.KT1MCCD then ifnull(m30.KT1CT,0) " +
                "when a.MCGCD=m30.KT2MCGCD and a.MCCD=m30.KT2MCCD then ifnull(m30.KT2CT,0) " +
                "when a.MCGCD=m30.KT3MCGCD and a.MCCD=m30.KT3MCCD then ifnull(m30.KT3CT,0) " +
                "when a.MCGCD=m30.KT4MCGCD and a.MCCD=m30.KT4MCCD then ifnull(m30.KT4CT,0) " +
                "when a.MCGCD=m30.KT5MCGCD and a.MCCD=m30.KT5MCCD then ifnull(m30.KT5CT,0) " +
                "when a.MCGCD=m30.KT6MCGCD and a.MCCD=m30.KT6MCCD then ifnull(m30.KT6CT,0) " +
                "else 0 " +
            "end as CT " +
            ", case " +
                "when a.MCGCD=m30.KT1MCGCD and a.MCCD=m30.KT1MCCD then a.ODRQTY * ifnull(m30.KT1CT,0) " +
                "when a.MCGCD=m30.KT2MCGCD and a.MCCD=m30.KT2MCCD then a.ODRQTY * ifnull(m30.KT2CT,0) " +
                "when a.MCGCD=m30.KT3MCGCD and a.MCCD=m30.KT3MCCD then a.ODRQTY * ifnull(m30.KT3CT,0) " +
                "when a.MCGCD=m30.KT4MCGCD and a.MCCD=m30.KT4MCCD then a.ODRQTY * ifnull(m30.KT4CT,0) " +
                "when a.MCGCD=m30.KT5MCGCD and a.MCCD=m30.KT5MCCD then a.ODRQTY * ifnull(m30.KT5CT,0) " +
                "when a.MCGCD=m30.KT6MCGCD and a.MCCD=m30.KT6MCCD then a.ODRQTY * ifnull(m30.KT6CT,0) " +
                "else 0 " +
            "end as OT " +
        "from kd8450 a inner join km8430 m30 on m30.HMCD=a.HMCD " +
        "where a.MCGCD = ? and a.MCCD = ? " +
            "and a.EDDT = ? and a.ODRSTS != '9' " +
        "order by a.HMCD "
    ;
    const data = await getDatabase(sql, [mcgcd, mccd, eddt]);
    return data;
}