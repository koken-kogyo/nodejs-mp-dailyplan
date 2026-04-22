/*
    Node.js版 復号化モジュール (DecryptPassword)
*/
// 定数（C# Common クラスと同じ値）
const DEC_CONST_ADD_INT = 16; // 復号化定数加算
const DEC_OFFSET_INT = 96;    // 復号化補正値
const DEC_MULTIPLY_RATE = 1;  // 復号化逓倍率

function eliminateOffset(i, relC) {
    let offset = 0;

    if (i < DEC_CONST_ADD_INT) {
        const code = relC.charCodeAt(0);
        if (code >= 112 && code <= 127) { // 0x70 ～ 0x7F
            offset = DEC_OFFSET_INT;
        }
    }

    return offset;
}

function decryptPassword(encPasswd) {
    let decPasswd = "";

    for (let i = 0; i < encPasswd.length; i++) {
        const relC = encPasswd[i];

        const offset = eliminateOffset(i, relC);

        const addend = DEC_CONST_ADD_INT - (i * DEC_MULTIPLY_RATE);
        const intVal = relC.charCodeAt(0);
        const outVal = intVal + addend - offset;
        const decC = String.fromCharCode(outVal);

        decPasswd += decC;
    }

    return decPasswd;
}

// Node.js 用エクスポート
module.exports = {
    decryptPassword,
};
