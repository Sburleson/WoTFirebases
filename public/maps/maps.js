window.addEventListener('load', init);

function init() {
    console.log("init");
    PopulateMapSelect();

    const mapSelect = document.getElementById('select-map');
    const GenButton = document.getElementById('genButton');
    GenButton.addEventListener("click", FetchData);
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

function FetchData() {
    const mapSelect = document.getElementById('select-map');
    const map = mapSelect.value;
    
    const positions = document.getElementById('show_positions').checked;
    console.log("show_positions:", positions);
    const shots = document.getElementById('show_shots').checked;
    console.log("show_shots:", shots);

    if (positions) {
        FetchPositionData();
    }

    if (shots) {
        FetchShotsData();
    }

    if (document.getElementById('show_winrate').checked) {
    FetchMLData().then(data => showWinrateHeatmap(map, data));
}
}

function FetchMLData() {
    const mapSelect = document.getElementById('select-map');
    const map = mapSelect.value;
    
    let url = '/ml?Q=';
    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log("FetchPositionData", data);
            return data;
        })
        .catch(err => {
            console.error("Error fetching position data:", err);
        });
        

}

function FetchShotsData() {
    const mapSelect = document.getElementById('select-map');
    const map = mapSelect.value;
    let name = document.getElementById('player-input').value;
    if (name === "") {
        name = null; 
    }
    console.log("name:",name);
    let url = '/shots?map=' + encodeURIComponent(map);
    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log("FetchShotsData", data);
            ShowShots(map, data);
        })
        .catch(err => {
            console.error("Error fetching shots data:", err);
        });
}

function FetchPositionData() {
    const mapSelect = document.getElementById('select-map');
    const map = mapSelect.value;
    let name = document.getElementById('player-input').value;
    if (name === "") {
            name = null; 
    }
    console.log("name:",name);  
    let url = '/positions?map=' + encodeURIComponent(map)+ '&name=' + encodeURIComponent(name) + '&cache=false';
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

function ensurePlotContainer(id, label) {
    let root = document.getElementById('plots-root');
    let container = document.getElementById(id);
    if (!container) {
        container = document.createElement('div');
        container.className = 'container mt-4';
        container.id = id;
        // Optionally add a label/title
        if (label) {
            const title = document.createElement('h3');
            title.textContent = label;
            container.appendChild(title);
        }
        const plotDiv = document.createElement('div');
        plotDiv.id = id.replace('_plot', '-plotly');
        plotDiv.style.height = '1100px';
        plotDiv.style.width = '700px';
        container.appendChild(plotDiv);
        root.appendChild(container);
        root.style.visibility = 'visible'; // Make sure the root is visible
    }
    return container.querySelector('div');
}

function removePlotContainer(id) {
    const container = document.getElementById(id);
    if (container) container.remove();
}

// Example usage in your plotting functions:
async function ShowHeatmap(map, data) {
    // Remove any existing heatmap container and controls
    removePlotContainer('positions_plot');
    const oldSlider = document.getElementById('heatmap-slider-container');
    if (oldSlider) oldSlider.remove();
    const oldToggle = document.getElementById('toggle-time-filter');
    if (oldToggle) oldToggle.remove();

    // Create heatmap container
    const heatmapContainer = ensurePlotContainer('positions_plot', 'Positions Heatmap');
    heatmapContainer.innerHTML = '';

    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'toggle-time-filter';
    toggleBtn.className = 'btn btn-outline-primary btn-sm mb-2';
    toggleBtn.textContent = 'Enable Time Filter';

    // Create and add time window controls inside the heatmap container
    const sliderContainer = document.createElement('div');
    sliderContainer.id = 'heatmap-slider-container';
    sliderContainer.style.marginBottom = '10px';
    sliderContainer.style.display = 'none'; // hidden by default
    sliderContainer.innerHTML = `
        <label for="heatmap-time">Time window (seconds): </label>
        <button id="heatmap-time-down" type="button" class="btn btn-secondary btn-sm">-</button>
        <span id="heatmap-time-value">0-10</span>
        <button id="heatmap-time-up" type="button" class="btn btn-secondary btn-sm">+</button>
    `;

    const timeValue = sliderContainer.querySelector('#heatmap-time-value');
    const upBtn = sliderContainer.querySelector('#heatmap-time-up');
    const downBtn = sliderContainer.querySelector('#heatmap-time-down');

    let startSec = 40;
    const maxSec = 600;
    const step = 10;
    let timeFilterEnabled = false;

    async function plotForWindow() {
        let allCoords;
        if (timeFilterEnabled) {
            const endSec = startSec + step;
            timeValue.textContent = `${startSec}-${endSec}`;
            allCoords = data.flatMap(item => {
                const positions = typeof item.positions === "string" ? JSON.parse(item.positions) : item.positions;
                return Object.entries(positions)
                    .filter(([time, pos]) => {
                        const t = parseFloat(time);
                        return t > startSec && t <= endSec;
                    })
                    .map(([time, pos]) => ({ x: pos.x, y: pos.y }));
            });
        } else {
            // Show all positions
            timeValue.textContent = 'All';
            allCoords = data.flatMap(item => {
                const positions = typeof item.positions === "string" ? JSON.parse(item.positions) : item.positions;
                return Object.entries(positions)
                    .filter(([time, pos]) => {
                        const t = parseFloat(time);
                        return t > 60;
                    })
                    .map(([time,pos]) => (time,{ x: pos.x, y: pos.y }));
            });
            console.log("All positions count:", allCoords.length);
        }

        const xvalues = allCoords.map(coord => coord.x);
        const yvalues = allCoords.map(coord => coord.y);

        const { xMin, yMin, xMax, yMax } = await loadAndParseXML(map);

        const trace = {
            x: xvalues,
            y: yvalues,
            type: 'histogram2dcontour',
            colorscale: [
                [0, 'rgba(0,0,0,0)'],
                [0.001, 'rgba(86, 71, 224, 0.8)'],
                [0.02, 'rgba(96, 184, 211, 0.5)'],
                [0.1, 'rgba(34, 235, 175, 0.5)'],
                [0.2, 'rgba(245, 226, 53, 0.69)'],
                [0.5, 'rgba(235, 69, 138, 0.88)'],
                [0.8, 'rgba(255, 0, 0, 0.6)'],
                [1, 'rgba(255, 0, 0, 0)']
            ],
            contours: {
                coloring: 'fill',
                showlines: false
            },
            zmin: 0,
            ncontours: 50,
            nbinsx: 100,
            nbinsy: 100,
            showscale: true,
            colorbar: {
                title: 'Intensity',
                titleside: 'right',
                tickformat: '.4f'
            }
        };

        const infoTrace = {
            x: [null],
            y: [null],
            mode: 'markers',
            marker: { opacity: 0 },
            showlegend: true,
            name: `Games: ${data.length}`,
            hoverinfo: 'skip'
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
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)',
            showlegend: true
        };

        heatmapContainer.querySelectorAll('.js-plotly-plot').forEach(e => e.remove());
        Plotly.newPlot(heatmapContainer, [trace, infoTrace], layout);
    }

    upBtn.onclick = async function () {
        if (startSec + step < maxSec) {
            startSec += step;
            await plotForWindow();
        }
    };
    downBtn.onclick = async function () {
        if (startSec - step >= 0) {
            startSec -= step;
            await plotForWindow();
        }
    };

    toggleBtn.onclick = async function () {
        timeFilterEnabled = !timeFilterEnabled;
        sliderContainer.style.display = timeFilterEnabled ? '' : 'none';
        toggleBtn.textContent = timeFilterEnabled ? 'Disable Time Filter' : 'Enable Time Filter';
        await plotForWindow();
    };

    // Initial plot (time filter off)
    await plotForWindow();
    heatmapContainer.prepend(toggleBtn);
    heatmapContainer.prepend(sliderContainer);
}

async function ShowShots(map, data) {
    const shotsContainer = ensurePlotContainer('shots_plot', 'Shots Map');
    const shotsPlot = document.getElementById('shots_plot');
    shotsPlot.style.visibility = 'visible';
    shotsContainer.innerHTML = '';
    let numGames = data.length;

    const { xMin, yMin, xMax, yMax } = await loadAndParseXML(map);

    const allCoords = data.flatMap(item => {
        const shots = typeof item.shots === "string" ? JSON.parse(item.shots) : item.shots;
        return Object.entries(shots)
            .map(([_, shot]) => {
                const origin = shot.shot_origin;
                const target = shot.recieve_pos;
                if ((origin.x === 0 && origin.y === 0) || (target.x === 0 && target.y === 0)) {
                    return null;
                }
                return { shot_origin: origin, recieve_pos: target };
            })
            .filter(s => s !== null);
    });

    // Trace for shot lines
    const linesTrace = {
        x: allCoords.flatMap(s => [s.shot_origin.x, s.recieve_pos.x, null]), // null separates line segments
        y: allCoords.flatMap(s => [s.shot_origin.y, s.recieve_pos.y, null]),
        mode: 'lines',
        type: 'scatter',
        name: 'Shot Lines',
        line: {
            color: 'rgba(255, 0, 0, 0.05)',
            width: 2
        },
        hoverinfo: 'skip'
    };

    // Trace for origins
    const originsTrace = {
        x: allCoords.map(s => s.shot_origin.x),
        y: allCoords.map(s => s.shot_origin.y),
        mode: 'markers',
        type: 'scatter',
        name: 'Shot Origins',
        marker: {
            size: 4,
            color: 'blue',
            opacity: 0.4,
            symbol: 'circle'
        }
    };

    // Trace for receivers
    const receiversTrace = {
        x: allCoords.map(s => s.recieve_pos.x),
        y: allCoords.map(s => s.recieve_pos.y),
        mode: 'markers',
        type: 'scatter',
        name: 'Shot Targets',
        marker: {
            size: 4,
            color: 'red',
            opacity: 0.4,
            symbol: 'x'
        }
    };

    const infoTrace = {
        x: [null],
        y: [null],
        mode: 'markers',
        marker: { opacity: 0 },
        showlegend: true,
        name: `Games: ${numGames}`,
        hoverinfo: 'skip'
    };

    const layout = {
        width: 1000,
        height: 1000,
        images: [{
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
        }],
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
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        showlegend: true
    };

    Plotly.newPlot(shotsContainer, [linesTrace, originsTrace, receiversTrace, infoTrace], layout);
}

// Optionally, before drawing new plots, remove old ones:
function clearPlots() {
    removePlotContainer('positions_plot');
    removePlotContainer('shots_plot');
}

const BIN_SIZE = 10;
const MIN_SAMPLES = 100;
const MIN_WINRATE = 0.75;
const SPAWN_TIME = 30.0;
const SPAWN_WINDOW = 2.0;

// Add this new function
async function showWinrateHeatmap(map, data) {
    const winrateContainer = ensurePlotContainer('winrate_plot', 'Winrate Heatmap');
    
    function getAverageCoordInRange(positions, centerTime, timeWindow = 2.0) {
        const minTime = centerTime - timeWindow;
        const maxTime = centerTime + timeWindow;
        const filtered = Object.entries(positions)
            .filter(([t, _]) => minTime <= parseFloat(t) && parseFloat(t) <= maxTime)
            .map(([_, pos]) => pos);
            
        if (filtered.length === 0) return null;
        
        const avgX = filtered.reduce((sum, p) => sum + p.x, 0) / filtered.length;
        const avgY = filtered.reduce((sum, p) => sum + p.y, 0) / filtered.length;
        return { x: avgX, y: avgY };
    }

    // Gather spawn coordinates
    const spawnCoords = [];
    const rowsWithSpawn = [];
    
    data.forEach(row => {
        const positions = typeof row.positions === "string" ? JSON.parse(row.positions) : row.positions;
        const spawnCoord = getAverageCoordInRange(positions, SPAWN_TIME, SPAWN_WINDOW);
        if (spawnCoord) {
            spawnCoords.push([spawnCoord.x, spawnCoord.y]);
            rowsWithSpawn.push(row);
        }
    });

    // Use ML5.js for KMeans clustering
    const kmeans = await ml5.kmeans(spawnCoords, 2);
    const spawnSides = kmeans.predict(spawnCoords);

    // Filter to one side
    const sideToAnalyze = 0;
    const filteredRows = rowsWithSpawn.filter((_, i) => spawnSides[i] === sideToAnalyze);

    // Determine bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    filteredRows.forEach(row => {
        const positions = typeof row.positions === "string" ? JSON.parse(row.positions) : row.positions;
        Object.values(positions).forEach(coord => {
            minX = Math.min(minX, coord.x);
            minY = Math.min(minY, coord.y);
            maxX = Math.max(maxX, coord.x);
            maxY = Math.max(maxY, coord.y);
        });
    });

    const gridWidth = Math.floor((maxX - minX) / BIN_SIZE) + 1;
    const gridHeight = Math.floor((maxY - minY) / BIN_SIZE) + 1;

    // Create heatmap arrays
    const heatmapTotal = Array(gridHeight).fill().map(() => Array(gridWidth).fill(0));
    const heatmapWins = Array(gridHeight).fill().map(() => Array(gridWidth).fill(0));

    // Fill heatmap
    filteredRows.forEach(row => {
        const positions = typeof row.positions === "string" ? JSON.parse(row.positions) : row.positions;
        const won = row.team === row.winnerTeam;
        
        Object.values(positions).forEach(coord => {
            const x = Math.floor((coord.x - minX) / BIN_SIZE);
            const y = Math.floor((coord.y - minY) / BIN_SIZE);
            
            if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
                heatmapTotal[y][x]++;
                if (won) heatmapWins[y][x]++;
            }
        });
    });

    // Calculate winrate map
    const winrateMap = heatmapTotal.map((row, i) => 
        row.map((total, j) => 
            total >= MIN_SAMPLES ? heatmapWins[i][j] / total : null
        )
    );

    // Create Plotly heatmap
    const { xMin, yMin, xMax, yMax } = await loadAndParseXML(map);

    const heatmapTrace = {
        z: winrateMap,
        type: 'heatmap',
        colorscale: 'RdBu',
        showscale: true,
        zmin: 0,
        zmax: 1,
        colorbar: { title: 'Winrate' }
    };

    const layout = {
        width: 1000,
        height: 1000,
        title: `Winrate Heatmap — Spawn Side ${sideToAnalyze}`,
        images: [{
            source: `../images/${map}.png`,
            xref: "x",
            yref: "y",
            x: xMin,
            y: yMax,
            sizex: xMax - xMin,
            sizey: yMax - yMin,
            sizing: "stretch",
            opacity: 0.5,
            layer: "below"
        }],
        xaxis: {
            range: [xMin, xMax],
            title: 'X Coordinate'
        },
        yaxis: {
            range: [yMin, yMax],
            title: 'Y Coordinate'
        }
    };

    Plotly.newPlot(winrateContainer, [heatmapTrace], layout);
}
// Call clearPlots() before generating new plots if needed.