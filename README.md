# 切削生産計画システム  
- [KMD000JW] nodejs-30-mp-deilyplan  

## 概要  
- 切削工程の日々の生産で利用
- 日報入力帳票の呼び出しやチェックシート呼び出しを行う  

## 開発環境  
- Node.js v20.19.0  
- MySQL 8.0.32  
- nvm-windows 1.1.10  

## npmパッケージ
├── body-parser@1.20.3
├── cookie-parser@1.4.7
├── csv-parse@5.6.0
├── csv-stringify@6.5.2
├── ejs@3.1.10
├── express-session@1.18.1
├── express@4.21.2
├── iconv-lite@0.6.3
├── log4js@6.9.1
├── mysql2@3.14.0
├── nodemailer@6.10.0
├── pg@8.14.1
└── serve-favicon@2.5.0

## npmパッケージ外
- jsQR - QRコードの読み取り
- QRCode - QRコードの作成
- JsBarcode V3.11.5 - １次元バーコードの作成

## メンバー  
- y.watanabe  

## データベース  

| Table    | Name                      |  
| :------: | :------------------------ |  
| kd8430   | 切削手配ファイル　　　　    |  
| kd8430   | 切削手配日程ファイル　　    |  
| kd8430   | 切削オーダーファイル　　    |  
| kd8430   | 切削在庫ファイル 　　　　   |  
| kd8430   | 切削内示カードファイル　    |  
| kd8430   | 切削日報兼実績ファイル 　   |  
| km8420   | 切削設備マスタ　　　　　    |  
| km8430   | 切削コード票マスタ　　　    |  

## アセンブリ情報  

- 著作権： © 2025 koken-kogyo CO,LTD.

