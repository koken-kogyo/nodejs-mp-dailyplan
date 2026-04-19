/*
    チャート関連
*/



// 1rem を px に変換
function remToPx(rem) {
    const bodyElement = document.body;      // body要素を取得
    const style = window.getComputedStyle(bodyElement).getPropertyValue('font-size'); // body要素のcssプロパティを全て取得し、その中からフォントサイズを取得
    const stFontSize = parseFloat(style);   // float型の数値に変換
    return rem * stFontSize;
}


// チャート２
function drawChart2(label, data1, data2) {
    /*
    chart2.data.labels = ['11/5', '11/6', '11/10', '11/11', '11/12', '11/13', '11/14','11/17','11/18'];
    chart2.data.datasets[0].data = [11024, 5562, 13353, 8564, 1634, 11925, 6919, 3945, 6364];
    chart2.data.datasets[1].data = [0, 0, 0, 0, 44, 75, 30, 25, 27, 36];
    */
    // サンプル初期値設定
    if (label=="") label = ['2025-11-06', '2025-11-07', '2025-11-10', '2025-11-11', '2025-11-12', '2025-11-13', '2025-11-14'];
    if (data1=="") data1 = [7017, 5652, 6995, 8592, 7419, 6069, 7060];
    if (data2=="") data2 = [0, 10, 0, 0, 44, 75, 30];
    const tickDesign2 = {color: 'rgba(250, 250, 250, 0.6)',font: {size: remToPx(1.0),weight: "bold"},};
    const gridLineDesign2 = {color: 'rgba(150, 150, 150, 0.5)',lineWidth: 1,};
    // グラフ要素を取得
    var ctx2 = document.getElementById("chart2");
    // チャートデータ
    var data2 = {
        labels: label,
        datasets: [{
            type: 'line',
            label: '生産数 (本数)',
            tension: 0.2,                                       // 線の曲線の柔らかさ（0〜1の値、0は直線）
            borderWidth: remToPx(0.625),                        // 線の太さ
            borderColor: 'rgba(54, 162, 235, 1.0)',             // 線の色（境界線の色）
            pointBackgroundColor: 'rgba(74, 182, 255, 1.0)',    // データポイントの背景色
            pointRadius: remToPx(0.625),                        // データポイントの大きさ
            pointHoverRadius: remToPx(1.25),                    // ホバーした時の大きさ
            data: data1,
            yAxisID: 'yAxis1',
        },
        {
            type: 'bar',
            label: '遅れ数 (点数)',
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1,
            data: data2,
            yAxisID: 'yAxis2',
        }]
    };
    // 軸の設定
    const options2 = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                ticks: tickDesign2,
                grid: gridLineDesign2,
                type: 'time',
                time: {
                    unit: 'day',
                    displayFormats: {day: 'M/d'} // 日付のフォーマット [chartjs-adapter-date-fns]
                },
            },
            yAxis1: {
                position: 'left',
                min: 0,
                ticks: {
                    callback: function(value) {
                        return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' 本';
                    },
                    ...tickDesign2,
                },
                grid: gridLineDesign2,
            },
            yAxis2: {
                position: 'right',
                beginAtZero: true,
                max: 200,
                ticks: {
                    stepSize: 40,
                    callback: function(value) {
                        if (value == 0) return;
                        return value + ' 点';
                    },
                    ...tickDesign2,
                }
            },
        },
    };
    // データラベルのプラグイン
    const dataLabelPlugin2 = {
        afterDatasetsDraw: function (chart, easing) {
            // To only draw at the end of animation, check for easing === 1
            var ctx = chart.ctx;

            chart.data.datasets.forEach(function (dataset, i) {
                var meta = chart.getDatasetMeta(i);
                if (!meta.hidden) {
                    meta.data.forEach(function (element, index) {
                        var dataString = dataset.data[index].toString();
                        if( dataString=="0" || dataString=="100") return; // データラベルの値が0, 100の場合は表示しない 

                        // Draw the text in black, with the specified font
                        ctx.fillStyle = 'rgb(255, 255, 255)';

                        var fontSize = remToPx(1.5);
                        var fontStyle = 'normal';
                        var fontFamily = 'Helvetica Neue';
                        ctx.font = Chart.helpers.fontString(fontSize, fontStyle, fontFamily);

                        // Just naively convert to string for now
                        var dataString = dataset.data[index].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); // 数字カンマ区切り

                        // Make sure alignment settings are correct
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';

                        var padding = 5;
                        var position = element.tooltipPosition();
                        ctx.fillText(dataString, position.x, position.y - (fontSize / 2) - padding);
                    });
                }
            });
        }
    };
    window.chart2 = new Chart(ctx2, {
        type: 'bar',
        data: data2,
        options: options2,
        plugins: [dataLabelPlugin2],
    });
}
// データ更新
function updateChart2(label, data1, data2) {
    chart2.options.scales.yAxis1.max = undefined;   // 自動スケーリングの有効化
    chart2.data.labels = label;
    chart2.data.datasets[0].data = data1;
    chart2.data.datasets[1].data = data2;
    chart2.update();
}






// チャート３（設備ごと進捗率）
function drawChart3(labelData, data1, data2) {
    // サンプル初期値設定
    if (labelData=="") labelData = ['SW', 'NC', 'MC', 'LF', 'TN', 'SS', 'XT', 'CN', 'MS', 'SK'];
    if (data1=="") data1 = [75, 31, 3, 11, 21, 31, 41, 0, 6, 94];
    if (data2=="") data2 = ['1', '1', '1', '1', '1', '2', '2', '2', '2', '2'];
    let bgColor = data2.map(val => (val=="1") ? 'rgba(220, 150, 100, 0.9)' : (val=="2") ? 'rgba(100, 150, 220, 0.9)' : 'rgba(150, 150, 150, 0.6)');
    const tickDesign3Y = {color: 'rgba(250, 250, 250, 0.6)',font: {size: remToPx(2.0),weight: "bold"},padding: remToPx(1.0),};
    const tickDesign3X = {color: 'rgba(250, 250, 250, 0.6)',font: {size: remToPx(1.5),weight: "bold"},};
    const gridLineDesign3 = {color: 'rgba(150, 150, 150, 0.5)',lineWidth: 1,};
    // グラフ要素を取得
    var ctx3 = document.getElementById("chart3");
    // チャートデータ
    const chartData = {
        labels: labelData,
        datasets: [{
            label: '進捗率',
            data: data1,
            backgroundColor: bgColor,
            borderColor: 'rgba(250, 250, 250, 0.3)',
            borderWidth: 2,
            datalabels: {
                color: 'rgb(255, 255, 255)',
                font: {
                    size: remToPx(1.5),
                    weight: 'bold',
                },
                anchor: 'end',                      // 横棒データラベルの左右位置（'end' は上端）
                align: 'end',                       // 横棒データラベルの上下位置（'end' は上側）
                clip: false,                        // グラフ領域外にもラベルが描画
                padding: { left: remToPx(1.5), },
                formatter: function (value, context) {
                    if (value==100) return "";
                    return value + '%';
                },
            },
        },
        ]
    };
    // チャートオプション
    const chartOptions = {
        indexAxis: 'y',                             // 横棒グラフに設定
        responsive: true,
        maintainAspectRatio: false,                 // 高さをCSSで指定できるようにする
        plugins: {
            legend: {display: false,},              // 凡例非表示
        },
        scales: {
            x: { 
                min: 0,
                max: 100,                           // 100%固定
                ticks: {
                    stepSize: 20,                   // 20%刻み
                    callback: function(value) {
                        return value + ' %';        // 軸ラベルに%を付ける
                    },
                    ...tickDesign3X,
                },
                grid: gridLineDesign3,
            }, 
            y: {
                ticks: tickDesign3Y,
                grid: gridLineDesign3,
            }, 
        },
    }
    window.chart3 = new Chart(ctx3, {
        plugins: [ChartDataLabels],
        type: 'bar',
        data: chartData,
        options: chartOptions,
    });
}
// データ更新
function updateChart3(labelData, data1, data2) {
    let bgColor = data2.map(val => (val=="1") ? 'rgba(220, 150, 100, 0.9)' : (val=="2") ? 'rgba(100, 150, 220, 0.9)' : 'rgba(150, 150, 150, 0.6)');
    chart3.data.labels = labelData;
    chart3.data.datasets[0].data = data1;
    chart3.data.datasets[0].backgroundColor = bgColor;
    chart3.update();
}

