window.addEventListener('load', init);

function init() {
    console.log("init");
    PopulateMapSelect();

    const mapSelect = document.getElementById('select-map');
    const GenButton = document.getElementById('genButton');
    GenButton.addEventListener("click", FetchPositionData);
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

function FetchPositionData() {
    const mapSelect = document.getElementById('select-map');
    const map = mapSelect.value;
    const name = document.getElementById('player-input').value;
    console.log("name:",name);
    let url = '/positions?map=' + encodeURIComponent(map)+ '&name=' + encodeURIComponent(name);
    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log("FetchPositionData", data);
            ShowHeatmap(map, data);
        })
        .catch(err => {
            console.error("Error fetching position data:", err);
        });
}

async function loadAndParseXML(map) {
  try {
    const response = await fetch(`../map_xmls/${map}.xml`);
    const xmlText = await response.text();

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    const bottomLeft = xmlDoc.getElementsByTagName("bottomLeft")[0]?.textContent;
    const upperRight = xmlDoc.getElementsByTagName("upperRight")[0]?.textContent;
    console.log("Bottom Left:", bottomLeft);
    console.log("Upper Right:", upperRight);

    return {
        xMin: parseFloat(bottomLeft.split(" ")[0]),
        yMin: parseFloat(bottomLeft.split(" ")[1]),
        xMax: parseFloat(upperRight.split(" ")[0]),
        yMax: parseFloat(upperRight.split(" ")[1])
    };
  } catch (err) {
    console.error("Error loading or parsing XML:", err);
  }
}

async function ShowHeatmap(map, data) {
    const heatmapContainer = document.getElementById('plotly-positions');
    heatmapContainer.innerHTML = '';

    const allCoords = data.flatMap(item => {
        const positions = JSON.parse(item.positions);
        return Object.values(positions).map(pos => ({ x: pos.x, y: pos.y }));
    });

    const xvalues = allCoords.map(coord => coord.x);
    const yvalues = allCoords.map(coord => coord.y);

    console.log("ShowHeatmap", map, xvalues, yvalues);
    console.log("Data length:", data.length);
    //console.log("X range:", Math.min(...xvalues), "to", Math.max(...xvalues));
    //console.log("Y range:", Math.min(...yvalues), "to", Math.max(...yvalues));
    
    // Get world-coordinate bounds for this map
    const { xMin, yMin, xMax, yMax } = await loadAndParseXML(map);
    console.log("Map bounds:", { xMin, yMin, xMax, yMax });

    // TOPOGRAPHIC STYLE - Contour lines
    /*
    const trace = {
        x: xvalues,
        y: yvalues,
        type: 'histogram2dcontour',
        colorscale: 'Hot',
        contours: {
            coloring: 'lines',    // Just contour lines, no fill
            showlabels: true,     // Show density numbers on lines
            labelfont: {
                family: 'Arial',
                size: 10,
                color: 'white'
            }
        },
        line: {
            width: 2,
            smoothing: 0.85       // Smooth the contour lines
        },
        nbinsx: 50,
        nbinsy: 50,
        showscale: false
    };

    */

    // ALTERNATIVE: Smooth filled contours (uncomment to try)

    const trace = {
        x: xvalues,
        y: yvalues,
        type: 'histogram2dcontour',
        colorscale: [
            [0, 'rgba(0,0,0,0)'],
            [0.001, 'rgba(86, 71, 224, 0.8)'],     // Visible low-intensity blue
            [0.01, 'rgba(96, 184, 211, 0.8)'],
            [0.1, 'rgba(34, 235, 175, 0.8)'],
            [0.2, 'rgba(245, 226, 53, 0.69)'],
            [0.5, 'rgba(235, 69, 138, 0.88)'],
            [0.8, 'rgba(255, 0, 0, 0.6)'],         // More opaque red for high density
            [1, 'rgba(255, 0, 0, 0)']
        ],
        contours: {
            coloring: 'fill',
            showlines: false
        },
        zmin: 0,          // 👈 Essential for contrast near 0
        ncontours: 50,    // 👈 More smooth gradation
        nbinsx: 100,
        nbinsy: 100,
        showscale: true,
        colorbar: {
            title: 'Intensity',
            titleside: 'right',
            tickformat: '.4f'
        }
    };

    const layout = {
        width: 1000,
        height: 1000,
        images: [
            {
                source: `../images/${map}.png`,
                xref: "x",
                yref: "y",
                x: xMin,              
                y: yMax,              
                sizex: xMax - xMin,   
                sizey: yMax - yMin,   
                sizing: "stretch",
                opacity: 0.9,         
                layer: "below"
            }
        ],
        xaxis: {
            range: [xMin, xMax],
            fixedrange: true,
            scaleanchor: 'y',
            title: 'X Coordinate'
        },
        yaxis: {
            range: [yMin, yMax],
            fixedrange: true,
            title: 'Y Coordinate'
        },
        margin: { t: 20, r: 20, b: 40, l: 40 },
        plot_bgcolor: 'rgba(0,0,0,0)',  // Transparent plot background
        paper_bgcolor: 'rgba(0,0,0,0)'  // Transparent paper background
    };

    Plotly.newPlot(heatmapContainer, [trace], layout);
}

async function ShowShots(map, data) {
    const shots = data;

    const filtered = shots.filter(shot => shot.shooter_name === "Mitsua_Student_Of_Draps");

    const origin_xvalues = shots.map(shot => shot.shot_origin.x);
    const origin_yvalues = shots.map(shot => shot.shot_origin.y);

}
