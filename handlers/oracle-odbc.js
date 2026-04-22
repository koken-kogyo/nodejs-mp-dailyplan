const oracleodbc = require('odbc');
const { oracleTanaConfig } = require('../config.js');
const { decryptPassword } = require("./decrypt-password.js");
const decPasswd = decryptPassword(oracleTanaConfig.PASSWORD);

// Oracle ODBC 接続情報
exports.HOST = oracleTanaConfig.HOST;
exports.PORT = 1521;
const connectionString = `DSN=TANACON;UID=${oracleTanaConfig.USER};PWD=${decPasswd};`;

// [Oracle] タナコン在庫一覧取得
const getTLOCStock = async () => {
    let connection;
    try {
        connection = await oracleodbc.connect(connectionString);
        const sql = "select ITEM_CODE as HMCD, sum(STCK_QTY) as STORE from TLOC_STCK " +  
            "group by ITEM_CODE order by ITEM_CODE";
        const results = await connection.query(sql);
        return JSON.parse(JSON.stringify(results));
    } catch (err) {
        console.log("エラーが発生しました:", err.message);
        throw err; // 再スロー
    } finally {
        connection?.close(); // リソースを解放
    }
};
exports.getTLOCStock = getTLOCStock;

const setTLOCStock = (kd8440orkd8450, tioitem) => {
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
exports.setTLOCStock = setTLOCStock;
