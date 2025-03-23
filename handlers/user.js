const mysqla = require('./mysql.js');

const getUsers = async (req) => {
    const conn = await mysqla.connect;
    const sql = "select TANNM as 'NAME', PASSWD, INSTDT from m0010 limit 10"
    const results = await conn.query(sql);
    conn.release();
    return JSON.parse(JSON.stringify(results[0]));
};
exports.getUsers = getUsers;

const getUser = async (req) => {
    const conn = await mysqla.connect;
    const sql = `select TANNM as 'NAME', PASSWD, INSTDT from m0010 where TANCD=${req.params.id}`;
    const results = await conn.query(sql);
    conn.release();
    return JSON.parse(JSON.stringify(results[0]));
};
exports.getUser = getUser;
