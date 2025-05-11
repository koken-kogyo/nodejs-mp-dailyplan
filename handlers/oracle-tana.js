const oracledb=require('oracledb');
const { oracleTanaConfig } = require('../config.js');

// ORACLE 接続情報
exports.HOST = oracleTanaConfig.HOST;
exports.PORT = 1521;
const dbTanaConfig = {
    user          : oracleTanaConfig.USER,
    password      : oracleTanaConfig.PASSWORD,
    connectString : `${oracleTanaConfig.HOST}/${oracleTanaConfig.SERVICENAME}`,
    externalAuth  : process.env.NODE_ORACLEDB_EXTERNALAUTH ? true : false
};
const options = {outFormat: oracledb.OUT_FORMAT_OBJECT};

// [Oracle] タナコン在庫一覧取得
const getTIOitem = async () => {
    const connection = await oracledb.getConnection(dbTanaConfig);
    // const results = await connection.execute(sql, options);
    const sql = "select ITEM_CODE as HMCD, sum(CNF_QTY) as STORE from TIO_ITEM " +  
        "where ITEM_STAT=:status group by ITEM_CODE order by ITEM_CODE";
    const binds = {status: "01"};
    const results = await connection.execute(sql, binds, options);
    connection.release();
    return JSON.parse(JSON.stringify(results.rows));
};
exports.getTIOitem = getTIOitem;

const setTIOitem = (kd8440orkd8450, tioitem) => {
    for (mccd of kd8440orkd8450) {
        for (row of mccd[1]) {
            let idx = 0;
            // 在庫情報を付与
            idx = tioitem.findIndex(t => t.HMCD === row.HMCD);
            if (idx < 0) {
                row.STORE = 0;
            } else {
                row.STORE = tioitem[idx].STORE === null ? 0 : tioitem[idx].STORE; // タナコンサーバーから直接取得
            }
        }
    }
    return kd8440orkd8450;
}
exports.setTIOitem = setTIOitem;
