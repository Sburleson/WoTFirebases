window.addEventListener('load', init);

function init() {
    console.log("init");
    PopulateMapSelect();

    const mapSelect = document.getElementById('select-map');
    const GenButton = document.getElementById('genButton');
    mapSelect.addEventListener("change", ShowGraph);
    GenButton.addEventListener("click", ShowGraph);
}
// Fetch available maps for the select dropdown
function PopulateMapSelect() {
    const mapSelect = document.getElementById('select-map');
    fetch('/maps') // Fetch all stats to extract unique maps
        .then(response => response.json())
        .then(data => {
            console.log("PopulateMapSelect", data);
            for (const map in data) {
                const option = document.createElement('option');
                option.value = data[map];
                option.innerHTML = data[map];
                mapSelect.appendChild(option);
            }
        });
}

// Fetch stats for the selected map and plot
function ShowGraph() {
    const mapSelect = document.getElementById('select-map').value;
    const xField = document.getElementById('x-stat').value;
    const yField = document.getElementById('y-stat').value;
    const zField = document.getElementById('z-stat').value;

    let url = '/graph?x=' + encodeURIComponent(xField) +
              '&y=' + encodeURIComponent(yField) +
              '&z=' + encodeURIComponent(zField);

    if (mapSelect) url += `&map=${encodeURIComponent(mapSelect)}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            PlotGraph(data, xField, yField, zField);
        })
        .catch(err => {
            console.error("Error fetching graph data:", err);
        });
}

function PlotGraph(data, xField, yField, zField) {
    console.log("PlotGraph", data);

    const plotDiv = document.getElementById('plotly-graph');
    plotDiv.innerHTML = ''; // Clear previous plot

    if (!data || data.length === 0) {
        plotDiv.innerHTML = '<p style="color:white;">No data to display.</p>';
        return;
    }
// Prefix "avg_" to each field
    const xKey = 'avg_' + xField;
    const yKey = 'avg_' + yField;
    const zKey = 'avg_' + zField;

    const xValues = data.map(s => s[xKey]);
    const yValues = data.map(s => s[yKey]);
    const zValues = data.map(s => s[zKey]);
    const Games = data.map(s => s['total_games'] || 0);
    const ftanks = data.map(s => {
        const tankName = (s.tank || 'Unknown:Unknown_Tank').split(':')[1] || 'Unknown_Tank';
        const parts = tankName.split('_');
        return parts.slice(1).join('_'); // removes the first part before the first underscore
    });
    

    console.log("xValues:", xValues);
    console.log("yValues:", yValues);
    console.log("zValues:", zValues);

    const trace1 = {
        x: xValues,
        y: zValues,  // swapped here
        z: yValues,  // swapped here
        type: 'scatter3d',
        mode: 'markers+text',
        marker: {
            size: Games.map(val => Math.sqrt(val) * 5),
            color: yValues,  // keep color based on original yValues if you want
            colorscale: [
                ['0.0', 'rgb(165,0,38)'],
                ['0.111111111111', 'rgb(215,48,39)'],
                ['0.222222222222', 'rgb(244,109,67)'],
                ['0.333333333333', 'rgb(253,174,97)'],
                ['0.444444444444', 'rgb(240, 223, 75)'],
                ['0.555555555556', 'rgb(224, 243, 115)'],
                ['0.666666666667', 'rgb(75, 186, 223)'],
                ['0.777777777778', 'rgb(50, 70, 182)'],
                ['0.888888888889', 'rgb(80, 60, 170)'],
                ['1.0', 'rgb(66, 23, 107)']
            ],
            opacity: 0.9,
            colorbar: {
                title: yField
            }
        },
        text: ftanks,
        textposition: "top center",
        textfont: {
            family: "Arial, sans-serif",
            size: 12,
            color: "white"
        }
    };

    const layout = {
        width: 1000,    // in pixles, match to container size in css or html
        height: 1000,
        autosize: false,
        title: "Tank Performance: 3D Visualization",
        paper_bgcolor: "rgba(0, 0, 0, 0.75)",
        plot_bgcolor: "rgba(233, 233, 233, 0.86)",
        scene: {
            xaxis: {
                title: { text: xField, font: { color: "#ffffff" } },
                tickfont: { color: "#ffffff" },
                showline: true,
                linecolor: "#ffffff",
                gridcolor: "rgba(255, 255, 255, 0.2)"
            },
            yaxis: {
                title: { text: zField, font: { color: "#ffffff" } },
                tickfont: { color: "#ffffff" },
                showline: true,
                linecolor: "#ffffff",
                gridcolor: "rgba(255, 255, 255, 0.2)"
            },
            zaxis: {
                title: { text: yField, font: { color: "#ffffff" } },
                tickfont: { color: "#ffffff" },
                showline: true,
                linecolor: "#ffffff",
                gridcolor: "rgba(255, 255, 255, 0.2)"
            }
        },
        margin: { l: 0, r: 0, t: 0, b: 0 }
    };

    const config = {
        displayModeBar: true, // or false to hide completely
        displaylogo: false,   // remove the Plotly logo
        modeBarButtonsToRemove: ['toImage'] // customize as needed
      };
      
      Plotly.newPlot('plotly-graph', [trace1], layout, config);
}