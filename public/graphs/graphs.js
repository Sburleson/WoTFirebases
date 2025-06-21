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
    const ftanks = data.map(s => {
    const parts = (s.tank || 'Unknown:Unknown Tank').split(':');
    return parts.length > 1 ? parts[1] : parts[0];
});

    console.log("xValues:", xValues);
    console.log("yValues:", yValues);
    console.log("zValues:", zValues);

    const trace1 = {
        x: xValues,
        y: yValues,
        z: zValues,
        type: 'scatter3d',
        mode: 'markers+text',
        marker: {
            size: zValues.map(val => Math.sqrt(val) * 2), // Scaled for better visibility
            color: zValues,
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
                title: zField
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
                title: { text: yField, font: { color: "#ffffff" } },
                tickfont: { color: "#ffffff" },
                showline: true,
                linecolor: "#ffffff",
                gridcolor: "rgba(255, 255, 255, 0.2)"
            },
            zaxis: {
                title: { text: zField, font: { color: "#ffffff" } },
                tickfont: { color: "#ffffff" },
                showline: true,
                linecolor: "#ffffff",
                gridcolor: "rgba(255, 255, 255, 0.2)"
            }
        },
        margin: { l: 0, r: 0, t: 30, b: 0 }
    };

    Plotly.newPlot('plotly-graph', [trace1], layout);
}
/// heatmaps


function showPlayerHeatmaps(playerName, mapName) {
    fetch(`http://localhost:8080/player/positions?name=${encodeURIComponent(playerName)}&map=${encodeURIComponent(mapName)}`)
        .then(res => res.json())
        .then(positions => {

            const xs = positions.map(p => p.x);
            const ys = positions.map(p => p.y);

            Plotly.newPlot('positions-heatmap', [{
                x: xs,
                y: ys,
                type: 'histogram2d',
                colorscale: 'Hot',
                nbinsx: 50,
                nbinsy: 50
            }], {
                title: `Position Heatmap for ${playerName} on ${mapName}`,
                xaxis: {title: 'X'},
                yaxis: {title: 'Y'}
            });
        });

    fetch(`http://localhost:8080/player/shots?name=${encodeURIComponent(playerName)}&map=${encodeURIComponent(mapName)}`)
        .then(res => res.json())
        .then(shots => {
            // Prepare data for shot origins
            const xs = shots.map(s => s.x);
            const ys = shots.map(s => s.y);

            Plotly.newPlot('shots-heatmap', [{
                x: xs,
                y: ys,
                type: 'histogram2d',
                colorscale: 'Blues',
                nbinsx: 50,
                nbinsy: 50
            }], {
                title: `Shot Origin Heatmap for ${playerName} on ${mapName}`,
                xaxis: {title: 'X'},
                yaxis: {title: 'Y'}
            });
        });
}

document.getElementById('show-positions').addEventListener('click', function() {
    document.getElementById('positions-heatmap').style.display = '';
    document.getElementById('shots-heatmap').style.display = 'none';
    this.classList.add('active');
    document.getElementById('show-shots').classList.remove('active');
});

document.getElementById('show-shots').addEventListener('click', function() {
    document.getElementById('positions-heatmap').style.display = 'none';
    document.getElementById('shots-heatmap').style.display = '';
    this.classList.add('active');
    document.getElementById('show-positions').classList.remove('active');
});