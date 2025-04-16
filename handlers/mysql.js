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
    return JSON.parse(JSON.stringify(results[0]));;
};

// ユーザー情報の取得
const getM0010 = async (userid) => {
    const sql = "select TANNM, PASSWD from m0010 where TANCD=?"
    return getDatabase(sql, [userid]);
};
exports.getM0010 = getM0010;

// 今週月曜日から来週金曜日までの営業日を取得
// ※月曜日の場合は今週からのリストに更新しない
const getYMDOrders = async () => {
    const d = new Date();
    const monday = (d.getDay() == 1) ? "- interval 7 day " : "";    
    const sql = 
        "select YMD from (select DATE_FORMAT(YMD,'%Y-%m-%d') 'YMD' from s0820 where CALTYP='00001' and WKKBN='1' and YMD between " +
        "(CURRENT_DATE - interval WEEKDAY(CURRENT_DATE) day) " + monday + 
        "and " + 
        "(CURRENT_DATE - interval WEEKDAY(CURRENT_DATE) day + interval 30 day)) T limit 10"
    const ymdobj = await getDatabase(sql, []);
    const ymd = [];
    for (let row of ymdobj) {ymd.push(row.YMD)};
    return ymd;
};
exports.getYMDOrders = getYMDOrders;

// 内示用月曜日から金曜日までの営業日を取得
// ※月曜日の場合は今週からのリストに更新しない
const getYMDPlans = async () => {
    const d = new Date();
    const monday = (d.getDay() == 1) ? "- interval 7 day " : "";
    const sql = 
        "select YMD from (select DATE_FORMAT(YMD,'%Y-%m-%d') 'YMD' from s0820 where CALTYP='00001' and WKKBN='1' and YMD between " +
        "(CURRENT_DATE - interval WEEKDAY(CURRENT_DATE) day) + interval 14 day " + monday + 
        "and " + 
        "(CURRENT_DATE - interval WEEKDAY(CURRENT_DATE) day + interval 44 day)) T limit 10"
    const ymdobj = await getDatabase(sql, []);
    const ymd = [];
    for (let row of ymdobj) {ymd.push(row.YMD)};
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
    return getDatabase(sql, [mcgcd]);
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
        MS: "order by b.MATESIZE, a.HMCD ",
        LA: "",
        NC: "order by a.HMCD ",
        ON: "order by a.HMCD ",
        ON3:"order by a.HMCD ",
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
    const orderby = getMCOrderby(mcgcd);
    // 受注状態[1:作業開始]を新設
    let appendsql = "";
    for (let i=0; i<=9; i++){
        appendsql +=
        `,min(case when EDDT='${ymds[i]}' and ` + 
            "ifnull(WKSTDT, STR_TO_DATE('1900-01-01', '%Y-%m-%d')) > " + 
            "ifnull(WKEDDT, STR_TO_DATE('1900-01-01', '%Y-%m-%d')) then '1' " + 
            `else case when EDDT='${ymds[i]}' then ODRSTS else null end end) as 'STS${i}'`;
    }
    const mc = [];
    for (let mccd of mccds) {
        let parameters = [...ymds, ...ymds, ymds[0], ymds[9], mcgcd, mccd.MCCD, ...ymds];
        let sql = "select a.HMCD,b.HMNM,b.MATESIZE,b.LENGTH" +
        ",max(ifnull(b.MATERIALLEN,0)) as 'MATERIALLEN'" + 
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D0'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D1'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D2'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D3'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D4'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D5'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D6'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D7'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D8'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D9'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D0Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D1Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D2Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D3Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D4Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D5Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D6Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D7Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D8Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D9Z'" +
        appendsql + " " + 
        "from kd8450 a, km8430 b where a.HMCD = b.HMCD" +
        " and a.EDDT between ? and ?" +
        " and a.MCGCD=? and a.MCCD=? " +
        "group by a.HMCD, b.HMNM, b.MATESIZE, b.LENGTH " + 
        "having " +
        " sum(case when EDDT<=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 " + orderby;
        let kd8450 = await getDatabase(sql, parameters);

        // 帳票定義IDデータを取得
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
            // IREPO帳票IDを付与
            idx = km8430.findIndex(t => t.HMCD === row.HMCD);
            if (idx < 0) {
                row.DEFID = 0;
            } else {
                row.DEFID = km8430[idx].DEFID === null ? 0 : km8430[idx].DEFID;
            }
            // 在庫情報を付与
            idx = kd8460.findIndex(t => t.HMCD === row.HMCD);
            if (idx < 0) {
                row.ZAIQTY = 0;
                row.STORE = 0;
            } else {
                row.ZAIQTY = kd8460[idx].ZAIQTY === null ? 0 : kd8460[idx].ZAIQTY;
                row.STORE = kd8460[idx].STORE === null ? 0 : kd8460[idx].STORE;
            }
        }
        
        mc.push([mccd, kd8450]);
    }
    return mc;
};
exports.getKD8450Orders = getKD8450Orders;

// 設備毎の内示データを2週間分取得
const getKD8440Plans = async (mcgcd, mccds, ymds) => {
    const orderby = getMCOrderby(mcgcd);
    const mc = [];
    for (let mccd of mccds) {
        let parameters = [...ymds, ...ymds, ...ymds, ymds[0], ymds[9],
                "%" + mcgcd + "-" + mccd.MCCD + ":%", ...ymds];
        let sql = "select a.HMCD,b.HMNM,b.MATESIZE,b.LENGTH" +
        ",max(ifnull(b.MATERIALLEN,0)) as 'MATERIALLEN'" + 
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D0'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D1'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D2'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D3'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D4'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D5'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D6'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D7'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D8'" +
        ",sum(case when EDDT=? then ODRQTY else null end) as 'D9'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D0Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D1Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D2Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D3Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D4Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D5Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D6Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D7Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D8Z'" +
        ",sum(case when EDDT=? and ODRSTS in ('2','31') then ODRQTY else 0 end) as 'D9Z'" +
        ",min(case when EDDT=? then ODRSTS else null end) as 'STS0'" +
        ",min(case when EDDT=? then ODRSTS else null end) as 'STS1'" +
        ",min(case when EDDT=? then ODRSTS else null end) as 'STS2'" +
        ",min(case when EDDT=? then ODRSTS else null end) as 'STS3'" +
        ",min(case when EDDT=? then ODRSTS else null end) as 'STS4'" +
        ",min(case when EDDT=? then ODRSTS else null end) as 'STS5'" +
        ",min(case when EDDT=? then ODRSTS else null end) as 'STS6'" +
        ",min(case when EDDT=? then ODRSTS else null end) as 'STS7'" +
        ",min(case when EDDT=? then ODRSTS else null end) as 'STS8'" +
        ",min(case when EDDT=? then ODRSTS else null end) as 'STS9' " +
        "from kd8440 a, km8430 b where a.HMCD = b.HMCD" +
        " and a.KTCD like 'MP%' and a.ODCD like '6060%'" +
        " and a.EDDT between ? and ?" +
        " and a.HMCD in (select hmcd from km8430 where ktkey like ? ) " +
        "group by a.HMCD, b.HMNM, b.MATESIZE, b.LENGTH " + 
        "having " +
        " sum(case when EDDT<=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 or" +
        " sum(case when EDDT=? then ODRQTY else null end) > 0 " + orderby;
        const kd8440 = await getDatabase(sql, parameters);

        // 帳票定義IDデータを取得
        const km8430 = await getKM8430Defids(mcgcd, mccd.MCCD);

        // 内示データに品番毎の在庫情報を取得して付加
        const kd8460 = await getDatabase(
            "select HMCD, " + 
            "sum(case when MCGCD=? and MCCD=? then ZAIQTY else 0 end) as 'ZAIQTY', " +
            "sum(case when MCGCD='STORE' then ZAIQTY else 0 end) as 'STORE' " +
            "from kd8460 group by HMCD"
            , [mcgcd, mccd.MCCD]
        );
        for await (row of kd8440) {
            let idx = 0;
            // IREPO帳票IDを付与
            idx = km8430.findIndex(t => t.HMCD === row.HMCD);
            if (idx < 0) {
                row.DEFID = 0;
            } else {
                row.DEFID = km8430[idx].DEFID === null ? 0 : km8430[idx].DEFID;
            }
            // 在庫情報を付与
            idx = kd8460.findIndex(t => t.HMCD === row.HMCD);
            if (idx < 0) {
                row.ZAIQTY = 0;
                row.STORE = 0;
            } else {
                row.ZAIQTY = kd8460[idx].ZAIQTY === null ? 0 : kd8460[idx].ZAIQTY;
                row.STORE = kd8460[idx].STORE === null ? 0 : kd8460[idx].STORE;
            }
        }
        
        mc.push([mccd, kd8440]);
    }
    return mc;
};
exports.getKD8440Plans = getKD8440Plans;

const getKM8430Defids =  async (mcgcd, mccd) => {
    const sql = "select HMCD, case " + 
    "when KT1MCGCD=? and KT1MCCD=? then KT1IREPO " + 
    "when KT2MCGCD=? and KT2MCCD=? then KT2IREPO " + 
    "when KT3MCGCD=? and KT3MCCD=? then KT3IREPO " + 
    "when KT4MCGCD=? and KT4MCCD=? then KT4IREPO " + 
    "when KT5MCGCD=? and KT1MCCD=? then KT5IREPO " + 
    "else 0 end DEFID " + 
    "from km8430 where KTKEY like ? " + 
    "having DEFID > 0";
    const km8430 = await getDatabase(sql, [
        mcgcd, mccd, 
        mcgcd, mccd, 
        mcgcd, mccd, 
        mcgcd, mccd, 
        mcgcd, mccd, 
        `%${mcgcd}-${mccd}:%`]);
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
        "update kd8450 set ODRSTS='1', WKSTDT=current_timestamp " +
        "where HMCD=? and EDDT=? and MCGCD=? and MCCD=? and ODRSTS='2'"
        , [kd8430[0].HMCD, kd8430[0].EDDT, mcgcd, mccd]);
};






// 実績登録(品目指定で登録する)
exports.finishOrder = async (odrno, mcgcd, mccd, jiqty) => {
    let countdownQty = jiqty;
    const kd8430 = await getDatabase("select EDDT, HMCD from kd8430 where ODRNO=?",[odrno]);
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
                "update kd8450 set JIQTY=ODRQTY, ODRSTS='4', WKEDDT=current_timestamp " +
                "where ODRNO=? and LOTSEQ=? and MCGCD=? and MCCD=?"
                , [row.ODRNO, row.LOTSEQ, mcgcd, mccd]
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
                "update kd8450 set JIQTY=?, ODRSTS='3', WKEDDT=current_timestamp " +
                "where ODRNO=? and LOTSEQ=? and MCGCD=? and MCCD=?"
                , [newjiqty, row.ODRNO, row.LOTSEQ, mcgcd, mccd]
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
        await this.updateKD8460(kd8430[0].HMCD, mcgcd, mccd, countdownQty, "11014");
    }
    // 結果を返却
    return result;
};


// 実績訂正(品目指定で更新)
exports.modifyOrder = async (odrno, mcgcd, mccd, preqty, modqty) => {
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
                    "update kd8450 set JIQTY=ODRQTY, ODRSTS='4', WKEDDT=current_timestamp " +
                    "where ODRNO=? and LOTSEQ=? and MCGCD=? and MCCD=?"
                    , [row.ODRNO, row.LOTSEQ, mcgcd, mccd]
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
                    "update kd8450 set JIQTY=?, ODRSTS=?, WKEDDT=null " +
                    "where ODRNO=? and LOTSEQ=? and MCGCD=? and MCCD=?"
                    , [newjiqty, newsts, row.ODRNO, row.LOTSEQ, mcgcd, mccd]
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
                    "update kd8450 set JIQTY=0, ODRSTS='2', WKSTDT=null, WKEDDT=null " +
                    "where ODRNO=? and LOTSEQ=? and MCGCD=? and MCCD=?"
                    , [row.ODRNO, row.LOTSEQ, mcgcd, mccd]
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
                    "update kd8450 set JIQTY=?, ODRSTS=?, WKEDDT=null " +
                    "where ODRNO=? and LOTSEQ=? and MCGCD=? and MCCD=?"
                    , [newjiqty, newsts, row.ODRNO, row.LOTSEQ, mcgcd, mccd]
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





// 炉中洩れ検査日報登録
exports.insertKD8220 = async (id, args, bads, scraps, others) => {
    // parseInt():必須項目にはこれ（速そう）
    const odcd = args.split(":")[0];
    const hmcd = args.split(":")[1].trim(); // サトーラベルプリンタ対応 23.09.07 y.w trim()
    const chkqty = parseInt(args.split(":")[2]);
    const depoqty = parseInt(args.split(":")[3]);
    const operator = args.split(":")[4];
    // Number():nullを0に変換してくれる（遅そう）
    const leakbrass = Number(bads.split(":")[0]);
    const leaktig = Number(bads.split(":")[1]);
    const leakcopper = Number(bads.split(":")[2]);
    const leakarc = Number(bads.split(":")[3]);
    const defectshape = Number(bads.split(":")[4]);
    const defectother = Number(bads.split(":")[5]);
    const scrapbrass = Number(scraps.split(":")[0]);
    const scraptig = Number(scraps.split(":")[1]);
    const scrapcopper = Number(scraps.split(":")[2]);
    const scraparc = Number(scraps.split(":")[3]);
    const scrapshape = Number(scraps.split(":")[4]);
    const scrapother = Number(scraps.split(":")[5]);
    const entrykbn = others.split(":")[1]; // 1:QR品番 2:三枚複写 3:試作品番
    let note = "";
    if (entrykbn == "3") {
        note = "試作" + others.split(":")[0];
    } else {
        note = others.split(":")[0]; // 備考
    }
    const insert = await getDatabase(
        "insert into kd8220 (" + 
            "ENTRYDT, ENTRYKBN, ODCD, TKCD, HMCD, " + 
            "CHKQTY, DEPOQTY, DEPTCD, OPERATOR, " + 
            "LEAKBRASS, LEAKTIG, LEAKCOPPER, LEAKARC, DEFECTSHAPE, DEFECTOTHER, "+ 
            "SCRAPBRASS, SCRAPTIG, SCRAPCOPPER, SCRAPARC, SCRAPSHAPE, SCRAPOTHER, " + 
            "NOTE, INSTID, UPDTID" + 
        ") select curdate(), ?, ?, b.TKCD, ?, " + 
            "?, ?, a.DEPTCD, ?, " + 
            "?, ?, ?, ?, ?, ?, " + 
            "?, ?, ?, ?, ?, ?, " + 
            "?, ?, ? " + 
        "from km0010 a left outer join m0500 b on b.HMCD=? where a.EMPNO=?" 
        , [ entrykbn, odcd, hmcd, 
            chkqty, depoqty, operator, 
            leakbrass, leaktig, leakcopper, leakarc, defectshape, defectother, 
            scrapbrass, scraptig, scrapcopper, scraparc, scrapshape, scrapother, 
            note, id, id, hmcd, operator ]
    );
    // APIテスト (CTRL+クリックで登録出来るよ)
    // http://192.168.96.189:3000/ireporegist/md/60707:T1855-70743:60:58:11014/::::2::/::::0::/コメント:
    // http://192.168.3.197:3000/ireporegist/md/60707:A49A0D0101-0400:200:194:11014/1:1:1:1:1:1:/1:1:1:1:1:1:/備考:
    // http://192.168.3.197:3000/ireporegist/md/60708:127677-39310:20:20:11014/::::::/::::::/:
};

// 炉中洩れ検査日報 ２重登録のチェック
// 1分以内に同一データの登録があるかをチェックする
exports.isDuplicateKD8220 = async (id, args, bads, scraps, others) => {
    // parseInt():必須項目にはこれ（速そう）
    const odcd = args.split(":")[0];
    const hmcd = args.split(":")[1];
    const chkqty = parseInt(args.split(":")[2]);
    const depoqty = parseInt(args.split(":")[3]);
    const operator = args.split(":")[4];
    // Number():nullを0に変換してくれる（遅そう）
    const leakbrass = Number(bads.split(":")[0]);
    const leaktig = Number(bads.split(":")[1]);
    const leakcopper = Number(bads.split(":")[2]);
    const leakarc = Number(bads.split(":")[3]);
    const defectshape = Number(bads.split(":")[4]);
    const defectother = Number(bads.split(":")[5]);
    const scrapbrass = Number(scraps.split(":")[0]);
    const scraptig = Number(scraps.split(":")[1]);
    const scrapcopper = Number(scraps.split(":")[2]);
    const scraparc = Number(scraps.split(":")[3]);
    const scrapshape = Number(scraps.split(":")[4]);
    const scrapother = Number(scraps.split(":")[5]);
    const kd8220autono = await getDatabase(
        "select autono from kd8220 where " + 
            "ENTRYDT=curdate() and ODCD=? and HMCD=? and " + 
            "CHKQTY=? and DEPOQTY=? and OPERATOR=? and " + 
            "LEAKBRASS=? and LEAKTIG=? and LEAKCOPPER=? and LEAKARC=? and DEFECTSHAPE=? and DEFECTOTHER=? and "+ 
            "SCRAPBRASS=? and SCRAPTIG=? and SCRAPCOPPER=? and SCRAPARC=? and SCRAPSHAPE=? and SCRAPOTHER=? and " + 
            "INSTID=? and UPDTID=? and instdt > CURRENT_TIMESTAMP() - INTERVAL 1 MINUTE"
        , [ odcd, hmcd, 
            chkqty, depoqty, operator, 
            leakbrass, leaktig, leakcopper, leakarc, defectshape, defectother, 
            scrapbrass, scraptig, scrapcopper, scraparc, scrapshape, scrapother, 
            id, id ]
    );
    return kd8220autono.length == 0 ? false : true;
};

// 炉中洩れ検査日報取得
exports.getKD8220 = async (date, odcd, disp) => {
    let orderby = "";
    switch(disp){
        case "1":
            orderby = "order by a.INSTDT asc";
            break;
        case "2":
            orderby = "order by a.INSTDT desc";
            break;
        case "3":
            orderby = "order by a.HMCD asc";
            break;
        case "4":
            orderby = "order by a.HMCD desc";
            break;
        case "5":
            orderby = "order by a.OPERATOR asc";
            break;
        case "6":
            orderby = "order by a.OPERATOR desc";
            break;                         
    }
    const kd8220 = await getDatabase(
        "select a.*, ifnull(b.TKRNM, '-') as 'TKRNM', NAME as 'OPNAME' " + 
        "from kd8220 a left outer join m0200 b on a.TKCD=b.TKCD, km0010 c " +
        "where a.OPERATOR=c.EMPNO and ENTRYDT=? and ODCD=? " + orderby
        , [date, odcd]
    );
    return kd8220;
};

// iPhone表示用の日報データ取得
exports.getKD8220iPhone = async (date, entryplace) => {
    let odcd = "";
    if (entryplace == "WL04") {
        odcd = "607%";
    } else if (entryplace == "WL01") {
        odcd = "605%";
    }
    const kd8220 = await getDatabase(
        "select a.*, ifnull(b.TKRNM, '-') as 'TKRNM', NAME as 'OPNAME' " + 
        "from kd8220 a left outer join m0200 b on a.TKCD=b.TKCD, km0010 c " +
        "where a.ODCD like '" + odcd + "' and a.OPERATOR=c.EMPNO and ENTRYDT=? order by a.HMCD"
        , [date]
    );
    return kd8220;
};

// 炉中洩れ検査日報CSV用データ取得
exports.getKD8220csv = async (date, odcd) => {
    const kd8220csv = await getDatabase(
        "select " + 
        "ROW_NUMBER() OVER (ORDER BY AUTONO ASC) AS 'NO'," + 
        "a.ODCD as '手配先コード'," + 
//        "a.ENTRYSTS as '入力ステータス'," + 
//        "a.TKCD as '得意先コード'," + 
        "ifnull(b.TKRNM, '-') as '得意先'," + 
        "a.HMCD as '品番'," + 
        "a.CHKQTY as '入庫数'," + 
        "a.DEPOQTY as '出庫数'," + 
        "a.SCRAPBRASS+a.SCRAPTIG+a.SCRAPCOPPER+a.SCRAPARC+a.SCRAPSHAPE+a.SCRAPOTHER as '廃棄数'," +
        "a.LEAKBRASS as '黄銅部'," + 
        "a.LEAKTIG as '仮付け部'," + 
        "a.LEAKCOPPER as '炉中部'," + 
        "a.LEAKARC as '電気溶接部'," + 
        "a.DEFECTSHAPE as '形状不良'," + 
        "a.DEFECTOTHER as 'その他'," + 
//        "a.DEPTCD as '部門コード'," + 
        "a.OPERATOR as '作業者コード'," + 
        "c.NAME as '作業者名'," + 
        "a.NOTE as '備考'," + 
        "a.SCRAPBRASS as '黄銅部廃棄数'," + 
        "a.SCRAPTIG as '仮付け部廃棄数'," + 
        "a.SCRAPCOPPER as '炉中部廃棄数'," + 
        "a.SCRAPARC as '電気溶接部廃棄数'," + 
        "a.SCRAPSHAPE as '形状不良廃棄数'," + 
        "a.SCRAPOTHER as 'その他廃棄数'," + 

        "case a.ODCD " + 
        "when '60707' then '炉中洩検(1階)' " + 
        "when '60708' then '炉中洩検(2階)' " + 
        "when '60500' then '黄銅洩検' " + 
        "else 'nothing'	end as '手配先名称1', " + 

        "a.INSTID as '登録者'," + 
        "a.INSTDT as '登録日時' " + 
        "from kd8220 a left outer join m0200 b on a.TKCD=b.TKCD, km0010 c " + 
        "where a.OPERATOR=c.EMPNO " + 
        "and a.CSVOUTDT is null and a.ENTRYDT=? and a.ODCD=?"
        , [date, odcd]
    );
    return kd8220csv;
};

// 炉中洩れ検査日報検索画面セレクトボックス用データ取得
exports.getKD8220dic = async () => {
    const kd8220dic = await getDatabase(
        "select HMCD from kd8220 group by HMCD order by HMCD"
    );
    return kd8220dic;
};

// 炉中洩れ検査日報検索APIデータ取得
exports.getKD8220hmcd = async (hmcd) => {
    const kd8220hmcd = await getDatabase(
        "select a.*, ifnull(b.TKRNM, '-') as 'TKRNM', NAME as 'OPNAME' " + 
        "from kd8220 a left outer join m0200 b on a.TKCD=b.TKCD, km0010 c " +
        "where a.OPERATOR=c.EMPNO and a.HMCD=? " + 
        "order by a.AUTONO desc"
        , [hmcd]
    );
    return kd8220hmcd;
};

// ２週間前から明日までのすべての日付を取得
const getESYMDs = async () => {
    const sql = 
        "select DATE_FORMAT(YMD,'%Y-%m-%d') 'YMD' from s0820 where CALTYP='00001' and YMD between " +
        "(CURRENT_DATE - interval 14 day) " + 
        "and " + 
        "(CURRENT_DATE + interval 1 day)"
    const ymdobj = await getDatabase(sql, []);
    const ymd = [];
    for (let row of ymdobj) {ymd.push(row.YMD)};
    return ymd;
};
exports.getESYMDs = getESYMDs;

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
