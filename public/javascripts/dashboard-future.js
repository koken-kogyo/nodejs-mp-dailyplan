/*
    チャート関連
*/

const strcolorm = 'rgba(174, 88, 27, 1)';       /* 手動機 */
const strdarkm = 'rgba(174, 88, 27, 0.5)';      /* 手動機ダーク */
const strcolora = 'rgba(55, 133, 224, 1)';      /* 自動機 */
const strdarka = 'rgba(55, 133, 224, 0.5)';     /* 自動機ダーク */


// 1rem を px に変換
function remToPx(rem) {
    const bodyElement = document.body;      // body要素を取得
    const style = window.getComputedStyle(bodyElement).getPropertyValue('font-size'); // body要素のcssプロパティを全て取得し、その中からフォントサイズを取得
    const stFontSize = parseFloat(style);   // float型の数値に変換
    return rem * stFontSize;
}


// チャート１
function drawChart1(labels, ktnkbn, thisweekworks, thisweekdandori, nextweekworks, nextweekdandori) {
    // グラフデザイン時のサンプル初期値設定
    if (labels=="") ktnkbn = ['1', '1', '1', '1', '1', '1', '1', '2', '2', '2', '2'];
    if (labels=="") thisweekworks = [6.08, 2.94, 2.02, 5.06, 3.02, 5.03, 1.58, 9.68, 6.19, 9.47, 7.09];
    if (labels=="") thisweekdandori = [1.95, 0.64, 0.68, 1.03, 0.73, 0.25, 0.93, 1.25, 2.59, 0.83, 0.63];
    if (labels=="") nextweekworks = [5.27, 2.95, 2.02, 6.19, 2.81, 5.05, 2.23, 9.90, 7.87, 8.26, 7.25];
    if (labels=="") nextweekdandori = [1.85, 0.55, 0.75, 0.95, 0.65, 0.25, 1.13, 1.17, 3.08, 0.90, 0.73];
    if (labels=="") labels = ['SW', 'NC', 'MC1', 'MC2', 'MC3', 'SK', 'TN', 'SS', 'XT', 'CN', 'MS'];
    const tickDesign1Y = {color: 'rgba(250, 250, 250, 0.6)',font: {size: remToPx(2.0),weight: "bold"},padding: remToPx(1.0),};
    const tickDesign1X = {color: 'rgba(250, 250, 250, 0.6)',font: {size: remToPx(1.5),weight: "bold"},};
    // グラフ要素を取得
    const ctx1 = document.getElementById("chart1");
    // チャートデータ
    const data1 = {
        labels,
        datasets: [
        {
            label: '今週',
            backgroundColor: Array(thisweekworks.length).fill(strcolora),
            data: thisweekworks,
            datalabels: {                               // 個別プラグイン
                font: {size: remToPx(1.2)},
                color: '#EEE',
                formatter: (value) => value + 'h'
            },
            stack: 'Stack 1', // 系統1の積み上げグループ
        },
        {
            label: '段取　　',
            backgroundColor: Array(thisweekworks.length).fill(strdarka),
            data: thisweekdandori,
            datalabels: {
                font: {size: remToPx(1.0)},
                color: '#AAA',
            },
            stack: 'Stack 1',
        },
        {
            label: '来週',
            backgroundColor: Array(thisweekworks.length).fill(strcolorm),
            data: nextweekworks,
            datalabels: {
                font: {size: remToPx(1.2)},
                color: '#EEE',
                formatter: (value) => value + 'h'
            },
            stack: 'Stack 2', // 系統1の積み上げグループ
        },
        {
            label: '段取',
            backgroundColor: Array(thisweekworks.length).fill(strdarkm),
            data: nextweekdandori,
            datalabels: {
                font: {size: remToPx(1.0)},
                color: '#AAA',
            },
            stack: 'Stack 2',
        },
    ]
    };
    // 軸の設定
    const options1 = {
        indexAxis: 'y',                             // 横棒グラフに設定
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                stacked: true, // X軸方向に積み上げ
                ticks: {
                    callback: function(value) {
                        return (value=="0") ? value : value + ' 時間';     // 軸ラベルに「時間」を付ける
                    },
                    ...tickDesign1X,
                },
            },
            y: {
                stacked: true, // Y軸方向に積み上げ
                ticks: tickDesign1Y,
            },
        },
        plugins: {
            legend: {
                labels: {
                    font: {size: remToPx(1.5)},     // 凡例フォント
                },
            },
            datalabels: {                           // 共通プラグイン
                anchor: 'center',                   // 横棒データラベルの左右中央に配置
                align: 'center',                    // 横棒データラベルの上下中央に配置   
            }
        },
        onClick: (event, elements) => {
            // elements はクリックされた要素の配列
            if (elements.length > 0) {
                const chart = elements[0].element.$context.chart;
                const datasetIndex = elements[0].datasetIndex;
                const index = elements[0].index;

                const label = chart.data.labels[index];
                const value = chart.data.datasets[datasetIndex].data[index];

                //alert(`クリックされた項目: ${label}, 値: ${value}`);
                if (label == "SW" || label == "SS" || label == "TN" || label == "XT") {  // MCGCDとMCCDが同一行程なので直接chart3へ
                    getDashboardFutureQTY(label, label);
                } else if (label == "SK") {                                              // MCCDがSK2 しかないので直接chart3へ
                    getDashboardFutureQTY("SK", "SK2");
                } else if (label == "MC3") {                                             // MCCDがS500しかないので直接chart3へ
                    getDashboardFutureQTY("ON", "S500");
                } else {
                    getDashboardFutureGCD(label);                                        // 設備選択chart2へ
                } 
            }     
        },
        onHover: (event, elements) => {
            // 要素がある場合はカーソルを pointer に
            event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
        },
    }
    window.chart1 = new Chart(ctx1, {
        plugins: [ChartDataLabels],
        type: 'bar',
        data: data1,
        options: options1,
    });
}

// チャート２
function drawChart2(labels, ktnkbn, thisweekworks, thisweekdandori, nextweekworks, nextweekdandori) {
    // グラフデザイン時のサンプル初期値設定
    if (labels=="") ktnkbn = ['1', '1', '1', '1', '1'];
    if (labels=="") thisweekworks = [0.54, 5.64, 2.37, 3.77, 1.43];
    if (labels=="") thisweekdandori = [0.56, 0.73, 0.47, 0.80, 0.60];
    if (labels=="") nextweekworks = [0.97, 7.17, 2.65, 3.25, 0.72];
    if (labels=="") nextweekdandori = [0.40, 0.93, 0.53, 0.53, 0.33];
    if (labels=="") labels = ['NC-4', 'NC-5', 'NC-6', 'NC-7', 'NC-8'];
    const tickDesign1Y = {color: 'rgba(250, 250, 250, 0.6)',font: {size: remToPx(2.0),weight: "bold"},padding: remToPx(1.0),};
    const tickDesign1X = {color: 'rgba(250, 250, 250, 0.6)',font: {size: remToPx(1.5),weight: "bold"},};
    // グラフ要素を取得
    const ctx2 = document.getElementById("chart2");
    // チャートデータ
    const data2 = {
        labels,
        datasets: [
        {
            label: '今週',
            backgroundColor: Array(thisweekworks.length).fill(strcolora),
            data: thisweekworks,
            datalabels: {                               // 個別プラグイン
                font: {size: remToPx(1.2)},
                color: '#EEE',
                formatter: (value) => value + 'h'
            },
            stack: 'Stack 1', // 系統1の積み上げグループ
        },
        {
            label: '段取　　',
            backgroundColor: Array(thisweekworks.length).fill(strdarka),
            data: thisweekdandori,
            datalabels: {
                font: {size: remToPx(1.0)},
                color: '#AAA',
            },
            stack: 'Stack 1',
        },
        {
            label: '来週',
            backgroundColor: Array(thisweekworks.length).fill(strcolorm),
            data: nextweekworks,
            datalabels: {
                font: {size: remToPx(1.2)},
                color: '#EEE',
                formatter: (value) => value + 'h'
            },
            stack: 'Stack 2', // 系統1の積み上げグループ
        },
        {
            label: '段取',
            backgroundColor: Array(thisweekworks.length).fill(strdarkm),
            data: nextweekdandori,
            datalabels: {
                font: {size: remToPx(1.0)},
                color: '#AAA',
            },
            stack: 'Stack 2',
        },
    ]
    };
    // 軸の設定
    const options2 = {
        indexAxis: 'y',                             // 横棒グラフに設定
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                stacked: true, // X軸方向に積み上げ
                ticks: {
                    callback: function(value) {
                        return (value=="0") ? value : value + ' 時間';     // 軸ラベルに「時間」を付ける
                    },
                    ...tickDesign1X,
                },
            },
            y: {
                stacked: true, // Y軸方向に積み上げ
                ticks: tickDesign1Y,
            },
        },
        plugins: {
            legend: {
                labels: {
                    font: {size: remToPx(1.5)},     // 凡例フォント
                },
            },
            datalabels: {                           // 共通プラグイン
                anchor: 'center',                   // 横棒データラベルの左右中央に配置
                align: 'center',                    // 横棒データラベルの上下中央に配置   
            }
        },
        onClick: (event, elements) => {
            // elements はクリックされた要素の配列
            if (elements.length > 0) {
                const chart = elements[0].element.$context.chart;
                const datasetIndex = elements[0].datasetIndex;
                const index = elements[0].index;

                const label = chart.data.labels[index];
                const value = chart.data.datasets[datasetIndex].data[index];

                if (label.toString().indexOf("-") == -1) {
                    alert(`クリックされた項目: ${label}, 値: ${value}`);
                } else {
                    const mcgcd = label.toString().split("-")[0]
                    const mccd = label.toString().split("-")[1]
                    getDashboardFutureQTY(mcgcd, mccd);
                }
            } else {
                toDashboardTop();
            }
        },
        onHover: (event, elements) => {
            // 要素がある場合はカーソルを pointer に
            event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
        },
    }
    window.chart2 = new Chart(ctx2, {
        plugins: [ChartDataLabels],
        type: 'bar',
        data: data2,
        options: options2,
    });
}
// チャート２ データ取得
function getDashboardFutureGCD(mcgcd) {
    fetch(`/mysqlsv/dashboard/future/${mcgcd}` )
    .then(res => res.json())
    .then(data => {
        const dashboardObj1 = document.getElementById("f-dashboard1");
        const dashboardObj2 = document.getElementById("f-dashboard2");
        const dashboardObj3 = document.getElementById("f-dashboard3");
        dashboardObj1.style.opacity = 0;
        dashboardObj1.style.zIndex = -9;
        dashboardObj2.style.opacity = 1;
        dashboardObj2.style.zIndex = 1;
        dashboardObj3.style.opacity = 0;
        dashboardObj3.style.zIndex = -9;
        updateChart2(data.labels, data.ktnkbn, data.thisweekworks, data.thisweekdandori, data.nextweekworks, data.nextweekdandori);
    })
    .catch(err => {alert(err);});
}
// チャート２ データ更新
function updateChart2(labels, ktnkbn, thisweekworks, thisweekdandori, nextweekworks, nextweekdandori) {
    chart2.data.labels = labels;
    chart2.data.datasets[0].data = thisweekworks;
    chart2.data.datasets[0].backgroundColor = Array(thisweekworks.length).fill(strcolora);
    chart2.data.datasets[1].data = thisweekdandori;
    chart2.data.datasets[1].backgroundColor = Array(thisweekdandori.length).fill(strdarka);
    chart2.data.datasets[2].data = nextweekworks;
    chart2.data.datasets[2].backgroundColor = Array(nextweekworks.length).fill(strcolorm);
    chart2.data.datasets[3].data = nextweekdandori;
    chart2.data.datasets[3].backgroundColor = Array(nextweekdandori.length).fill(strdarkm);
    chart2.update();
}






// チャート３（設備ごと注文）
function drawChart3(title, labels, weekkbn, qtys, works, dandori) {
    // サンプル初期値設定
    if (labels=="") title = "NC-4";
    if (labels=="") weekkbn = ['1','1','1','2','2','2','2','2'];
    if (labels=="") qtys = [94, 56, 80, 73, 66, 8, 47, 4];
    if (labels=="") works = [0.63, 1, 0, 0, 3.14, 0, 1.59, 0.13];
    if (labels=="") dandori = [1, 0.67, 0, 0.33, 0.67, 0.33, 0.33, 0.33];
    if (labels=="") labels = ['12/22','12/23','12/25','1/5','1/6','1/7','1/8','1/9'];
    const tickDesign3X = {color: 'rgba(250, 250, 250, 0.6)',font: {size: remToPx(1.2),weight: "bold"},};
    const tickDesign3Y = {color: 'rgba(250, 250, 250, 0.6)',font: {size: remToPx(1.2),weight: "bold"},};
    const gridLineDesign3 = {color: 'rgba(150, 150, 150, 0.5)',lineWidth: 1,};
    // グラフ要素を取得
    const ctx3 = document.getElementById("chart3");
    // チャートデータ
    const data3 = {
        labels,
        datasets: [{
            type: 'line',
            label: '注文本数　　',
            tension: 0.2,                                       // 線の曲線の柔らかさ（0〜1の値、0は直線）
            borderWidth: remToPx(0.625),                        // 線の太さ
            borderColor: 'rgba(0, 150, 0, 1)',                // 線の色（境界線の色）
            backgroundColor: 'rgba(50, 200, 50, 1)',          // 背景色
            pointBackgroundColor: 'rgba(100, 250, 100, 1)',   // データポイントの背景色
            pointRadius: remToPx(0.625),                        // データポイントの大きさ
            pointHoverRadius: remToPx(1.25),                    // ホバーした時の大きさ
            data: qtys,
            datalabels: {                                       // 個別プラグイン
                font: {size: remToPx(1.2)},
                color: '#EEE',
                align: 'end',                                   // 上方向に配置
                offset: remToPx(1.0),                           // 上にずらす距離(px)
                formatter: (value) => value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '本'
            },
            yAxisID: 'yAxis1',
        },
        {
            type: 'bar',
            label: '注文時間',
            backgroundColor: 'rgba(0, 150, 0, 1)',
            data: works,
            datalabels: {                                       // 個別プラグイン
                font: {size: remToPx(1.2)},
                color: '#EEE',
                formatter: (value) => (value == "0") ? '' : value + 'h'
            },
            yAxisID: 'yAxis2',
            stack: 'Stack 1',                                   // 系統1の積み上げグループ
        },
        {
            type: 'bar',
            label: '段取時間',
            backgroundColor: 'rgba(80, 80, 80, 0.9)',
            data: dandori,
            datalabels: {                                       // 個別プラグイン
                font: {size: remToPx(1.1)},
                color: '#aaa',
                formatter: (value) => (value == "0") ? '' : value + 'h'
            },
            yAxisID: 'yAxis2',
            stack: 'Stack 1',                                   // 系統1の積み上げグループ
        },
       ],
    };
    // 軸の設定
    const options3 = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                ticks: tickDesign3X,
                grid: gridLineDesign3,
                /*
                type: 'time',
                time: {
                    unit: 'day',
                    displayFormats: {day: 'MM/dd'} // 日付のフォーマット [chartjs-adapter-date-fns]
                },
                */
            },
            yAxis1: {
                position: 'right',
                ticks: {
                    /*stepSize: 50,*/
                    callback: function(value) {
                        return (value == "0") ? '' : value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' 本';
                    },
                    ...tickDesign3Y,
                },
            },
            yAxis2: {
                position: 'left',
                ticks: {
                    /*stepSize: 1,*/
                    callback: function(value) {
                        return (value == "0") ? '' : value + ' 時間';
                    },
                    ...tickDesign3Y,
                },
                grid: gridLineDesign3,
            },
        },
        plugins: {
            title: {
                display: true,                      // タイトルを表示する
                text: title,                        // タイトル文字列（戻り先）
                font: {
                size: remToPx(1.5),                 // フォントサイズ
                weight: 'bold'                      // 太字
                },
                color: '#888',                    // 文字色
                padding: {
                    top: 10,
                    bottom: 10,
                },
                align: 'center',                    // 'start', 'center', 'end' が指定可能
            },
            legend: {
                labels: {
                    font: {size: remToPx(1.5)},     // 凡例フォント
                },
                display: false,                     // 凡例非表示
            },
        },
        onClick: (event, elements) => {
            if (elements.length > 0) {
                const chart = elements[0].element.$context.chart;
                const index = elements[0].index;
                // データラベルから手配日を取得
                const label = chart.data.labels[index];
                const eddt = myConvertOmitDateString(label);
                // タイトルから設備コードを取得
                const title = chart.options.plugins.title.text;
                const mcgcd = myFuncGetMCGCD(title)
                const mccd = myFuncGetMCCD(title);
                // ポップアップデータの取得を描画
                getDashboardFuturePopup(mcgcd, mccd, eddt)

            } else {
                const title = chart3.options.plugins.title.text;
                if (title.toString().indexOf("-") == -1 || title == "SK-SK2" || title == "ON-S500") {
                    toDashboardTop();
                } else {
                    toDashboardGCD();
                }
            }
        },
    };
    window.chart3 = new Chart(ctx3, {
        plugins: [ChartDataLabels],
        type: 'bar',
        data: data3,
        options: options3,
    });
}
// チャート３更新
function getDashboardFutureQTY(mcgcd, mccd) {
    fetch(`/mysqlsv/dashboard/future/${mcgcd}/${mccd}` )
    .then(res => res.json())
    .then(data => {
        const dashboardObj1 = document.getElementById("f-dashboard1");
        const dashboardObj2 = document.getElementById("f-dashboard2");
        const dashboardObj3 = document.getElementById("f-dashboard3");
        dashboardObj1.style.opacity = 0;
        dashboardObj1.style.zIndex = -9;
        dashboardObj2.style.opacity = 0;
        dashboardObj2.style.zIndex = -9;
        dashboardObj3.style.opacity = 1;
        dashboardObj3.style.zIndex = 1;
        chart3.options.plugins.title.text = data.title;
        chart3.data.labels = data.labels;
        let bgColor = data.weekkbn.map(val => (val=="1") ? strcolora : (val=="2") ? strcolorm : 'rgba(150, 150, 150, 0.6)');
        chart3.data.datasets[0].data = data.qty;
        chart3.data.datasets[1].data = data.works;
        chart3.data.datasets[1].backgroundColor = bgColor;
        chart3.data.datasets[2].data = data.dandori;
        chart3.update();
    })
    .catch(err => {alert(err);});
}

// チャート３ポップアップデータ取得
function getDashboardFuturePopup(mcgcd, mccd, eddt) {
    fetch(`/mysqlsv/dashboard/future/popup/${mcgcd}/${mccd}/${eddt}` )
    .then(res => res.json())
    .then(data => {
        if (data.length == 0) return;
        // APIで取得したデータをテーブ行に追加
        const table = document.getElementById("delayPopupTable");
        // 一覧を一旦削除
        do {
            if (table.rows.length > 1) {table.deleteRow(-1);}
        } while (table.rows.length > 1);
        data.forEach(function (d) {
            let newRow = table.insertRow();
            appendTD(newRow, d.品番, "small", 1);
            appendTD(newRow, d.品名, "small", 1);
            appendTD(newRow, d.材料, "small lef", 1);
            appendTD(newRow, d.工程経路, "", 1);
            appendTD(newRow, d.注文数, "small rig", 1);
            appendTD(newRow, d.CT, "small rig", 1);
            appendTD(newRow, d.OT, "small rig", 1);
        });
        popDelayObj.style.display = "flex";
        popDelayObj.style.zIndex = 99;
    })
    .catch(err => {alert(err);});
}

function noneDelayList() {
    popDelayObj.style.display = "none";
    popDelayObj.style.zIndex = -9;
}

// 列の追加
function appendTD(newrow, str, name, colspan){
    let newCell = newrow.insertCell();
    let newText = document.createTextNode(str);
    newCell.appendChild(newText);
    if (colspan != "") newCell.setAttribute("colspan", colspan);
    if (name != "") newCell.className = name;
}
