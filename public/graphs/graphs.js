import * as THREE from '../js/three.module.js';
import { OrbitControls } from '../js/OrbitControls.js';

// Global variables for Three.js scene management
let scene, camera, renderer, controls;
let currentAnimationId;

window.addEventListener('DOMContentLoaded', () => {
    if (typeof THREE === 'undefined') {
        console.error('THREE is not defined!');
        return;
    } else {
        console.log('THREE is defined:', THREE.REVISION);
    }

    // Initialize Three.js scene once
    initThreeJS();
});

window.addEventListener('load', init);

function init() {
    console.log("init");
    PopulateMapSelect();

    const mapSelect = document.getElementById('select-map');
    const GenButton = document.getElementById('genButton');
    //mapSelect.addEventListener("change", ShowGraph);
    GenButton.addEventListener("click", ShowGraph);
}

renderer.domElement.addEventListener('wheel', onMouseWheel, false);


function initThreeJS() {
    const container = document.getElementById('three');
    
    // Create scene
    scene = new THREE.Scene();
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 150);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    container.appendChild(renderer.domElement);
    
    // Create controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // Add lighting
    const light = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(light);
    
    // Start animation loop
    animate();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    const container = document.getElementById('three');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    currentAnimationId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Fetch available maps for the select dropdown
function PopulateMapSelect() {
    const mapSelect = document.getElementById('select-map');
    fetch('/maps')
        .then(response => response.json())
        .then(data => {
            console.log("PopulateMapSelect", data);
            for (const map in data) {
                const option = document.createElement('option');
                option.value = data[map];
                option.innerHTML = data[map];
                mapSelect.appendChild(option);
            }
        })
        .catch(err => {
            console.error("Error fetching maps:", err);
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

function clearScene() {
    // Remove all objects except camera
    while(scene.children.length > 0) {
        const object = scene.children[0];
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            if (object.material.map) object.material.map.dispose();
            object.material.dispose();
        }
        scene.remove(object);
    }
}

function autoFitCamera(xValues, yValues, zValues) {
    if (xValues.length === 0) return;

    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const zMin = Math.min(...zValues);
    const zMax = Math.max(...zValues);

    const xRange = xMax - xMin;
    const yRange = yMax - yMin;
    const zRange = zMax - zMin;
    const maxRange = Math.max(xRange, yRange, zRange);

    // Position camera to see all data
    const distance = maxRange * 2;
    camera.position.set(distance, distance, distance);
    
    // Set target to center of data
    const centerX = (xMin + xMax) / 2;
    const centerY = (yMin + yMax) / 2;
    const centerZ = (zMin + zMax) / 2;
    
    controls.target.set(centerX, centerY, centerZ);
    controls.update();
}

function PlotGraph(data, xField, yField, zField) {
    if (!data || data.length === 0) {
        console.log('No data to display.');
        return;
    }

    // Clear existing objects from scene (but keep the scene, camera, renderer)
    clearScene();

    const xKey = 'avg_' + xField;
    const yKey = 'avg_' + yField;
    const zKey = 'avg_' + zField;

    // Re-add lighting after clearing
    const light = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(light);

    // Extract raw values
    const xRaw = data.map(s => parseFloat(s[xKey])).filter(v => !isNaN(v));
    const yRaw = data.map(s => parseFloat(s[yKey])).filter(v => !isNaN(v));
    const zRaw = data.map(s => parseFloat(s[zKey])).filter(v => !isNaN(v));
    const Games = data.map(s => s['total_games'] || 1);

    // Calculate ranges for scaling
    const xMin = Math.min(...xRaw), xMax = Math.max(...xRaw);
    const yMin = Math.min(...yRaw), yMax = Math.max(...yRaw);
    const zMin = Math.min(...zRaw), zMax = Math.max(...zRaw);
    
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    const zRange = zMax - zMin || 1;

    console.log('Raw data ranges:');
    console.log(`X: ${xMin.toFixed(3)} to ${xMax.toFixed(3)} (range: ${xRange.toFixed(3)})`);
    console.log(`Y: ${yMin.toFixed(3)} to ${yMax.toFixed(3)} (range: ${yRange.toFixed(3)})`);
    console.log(`Z: ${zMin.toFixed(3)} to ${zMax.toFixed(3)} (range: ${zRange.toFixed(3)})`);

    // Scale all axes to similar range (e.g., 0 to 100) for visual representation only
    const VISUAL_SCALE = 100;
    
    function scaleForVisualization(value, min, range) {
        return (value - min) / range * VISUAL_SCALE;
    }

    // Create visually scaled positions (for rendering only)
    const xVisual = data.map(s => scaleForVisualization(parseFloat(s[xKey]), xMin, xRange));
    const yVisual = data.map(s => scaleForVisualization(parseFloat(s[yKey]), yMin, yRange));
    const zVisual = data.map(s => scaleForVisualization(parseFloat(s[zKey]), zMin, zRange));

    console.log('Visual scaling ranges (0-100):');
    console.log(`X: ${Math.min(...xVisual).toFixed(1)} to ${Math.max(...xVisual).toFixed(1)}`);
    console.log(`Y: ${Math.min(...yVisual).toFixed(1)} to ${Math.max(...yVisual).toFixed(1)}`);
    console.log(`Z: ${Math.min(...zVisual).toFixed(1)} to ${Math.max(...zVisual).toFixed(1)}`);

    const ftanks = data.map(s => {
        const tankName = (s.tank || 'Unknown:Unknown_Tank').split(':')[1] || 'Unknown_Tank';
        const parts = tankName.split('_');
        return parts.slice(1).join('_');
    });

    const loader = new THREE.TextureLoader();

    const gridSize = 120;
    const gridDivisions = 12;

    // Position grids at the minimum bounds of your scaled data
    const gridXY = new THREE.GridHelper(gridSize, gridDivisions, 0x444444, 0x222222);
    gridXY.rotateX(Math.PI / 2); // Rotate to XY plane
    gridXY.position.set(VISUAL_SCALE/2, VISUAL_SCALE/2, 0); // Center the grid in the data space
    scene.add(gridXY);

    const gridXZ = new THREE.GridHelper(gridSize, gridDivisions, 0x444444, 0x222222);
    gridXZ.position.set(VISUAL_SCALE/2, 0, VISUAL_SCALE/2); // Center the grid in the data space
    scene.add(gridXZ);

    const gridYZ = new THREE.GridHelper(gridSize, gridDivisions, 0x444444, 0x222222);
    gridYZ.rotateZ(Math.PI / 2); // Rotate to YZ plane
    gridYZ.position.set(0, VISUAL_SCALE/2, VISUAL_SCALE/2); // Center the grid in the data space
    scene.add(gridYZ);

    // Also update the axes helper to be positioned appropriately
    const axesHelper = new THREE.AxesHelper(60);
    axesHelper.position.set(0, 0, 0); // Keep at origin, or move to data minimum if preferred
    scene.add(axesHelper);

    // Create axis labels with actual data value ranges
    createDataAxisLabels(xField, yField, zField, 
        { min: xMin, max: xMax },
        { min: yMin, max: yMax },
        { min: zMin, max: zMax }
    );

    data.forEach((item, i) => {
        // Use original data values for positioning
        const x = parseFloat(item[xKey]);
        const y = parseFloat(item[yKey]);
        const z = parseFloat(item[zKey]);
        
        // But use visual scaling for actual 3D positioning
        const xPos = xVisual[i];
        const yPos = yVisual[i];
        const zPos = zVisual[i];

        // Skip invalid data points
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            return;
        }

        const size = Math.sqrt(Games[i]) * 2;
        const tankName = ftanks[i];
        const imageUrl = `../images/tonk.png`;

        loader.load(
            imageUrl, 
            (texture) => {
                const material = new THREE.SpriteMaterial({ map: texture });
                const sprite = new THREE.Sprite(material);
                sprite.position.set(xPos, yPos, zPos); // Use visual positions
                sprite.scale.set(size, size, 1);
                
                // Store original data values (unchanged)
                sprite.userData = {
                    tankName: tankName,
                    x: x, y: y, z: z, // Original data values
                    games: Games[i]
                };
                
                scene.add(sprite);
            }, 
            undefined, 
            (err) => {
                console.warn("Failed to load", imageUrl, "for", tankName);
                
                // Fallback: create a colored sphere
                const geometry = new THREE.SphereGeometry(Math.max(size * 0.3, 1), 8, 8);
                const color = new THREE.Color();
                color.setHSL((i / data.length) * 0.8, 0.8, 0.6);
                const material = new THREE.MeshBasicMaterial({ color: color });
                const sphere = new THREE.Mesh(geometry, material);
                sphere.position.set(xPos, yPos, zPos); // Use visual positions
                sphere.userData = {
                    tankName: tankName,
                    x: x, y: y, z: z, // Original data values
                    games: Games[i]
                };
                scene.add(sphere);
            }
        );
    });

    // Position camera to see the scaled data
    camera.position.set(80, 80, 80);
    controls.target.set(0, 0, 0);
    controls.update();
}

function createDataAxisLabels(xField, yField, zField, xRange, yRange, zRange) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    context.font = '14px Arial';
    
    // X-axis label (Red)
    context.clearRect(0, 0, 256, 64);
    context.fillStyle = 'red';
    context.fillText(`X: ${xField}`, 10, 20);
    context.fillText(`${xRange.min.toFixed(2)} → ${xRange.max.toFixed(2)}`, 10, 40);
    const xTexture = new THREE.CanvasTexture(canvas);
    const xSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: xTexture }));
    xSprite.position.set(70, -10, 0);
    xSprite.scale.set(25, 8, 1);
    scene.add(xSprite);
    
    // Y-axis label (Green)
    context.clearRect(0, 0, 256, 64);
    context.fillStyle = 'green';
    context.fillText(`Y: ${yField}`, 10, 20);
    context.fillText(`${yRange.min.toFixed(2)} → ${yRange.max.toFixed(2)}`, 10, 40);
    const yTexture = new THREE.CanvasTexture(canvas);
    const ySprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: yTexture }));
    ySprite.position.set(-10, 70, 0);
    ySprite.scale.set(25, 8, 1);
    scene.add(ySprite);
    
    // Z-axis label (Blue)
    context.clearRect(0, 0, 256, 64);
    context.fillStyle = 'blue';
    context.fillText(`Z: ${zField}`, 10, 20);
    context.fillText(`${zRange.min.toFixed(2)} → ${zRange.max.toFixed(2)}`, 10, 40);
    const zTexture = new THREE.CanvasTexture(canvas);
    const zSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTexture }));
    zSprite.position.set(0, -10, 70);
    zSprite.scale.set(25, 8, 1);
    scene.add(zSprite);
}

// Updated click handler to show original data values
function onMouseClick(event) {
    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);
    
    if (intersects.length > 0) {
        const object = intersects[0].object;
        if (object.userData.tankName) {
            console.log('Clicked tank:', {
                name: object.userData.tankName,
                values: {
                    x: object.userData.x,
                    y: object.userData.y,
                    z: object.userData.z
                },
                games: object.userData.games
            });
        }
    }
}

function onMouseWheel(event) {
    event.preventDefault();
    
    const zoomSpeed = 0.1;
    const minDistance = 5;
    const maxDistance = 500;
    
    // Get zoom direction
    const delta = event.deltaY > 0 ? 1 : -1;
    
    // Calculate new camera position
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    
    // Move camera forward/backward
    const distance = camera.position.length();
    const newDistance = Math.max(minDistance, Math.min(maxDistance, distance + delta * zoomSpeed * distance));
    
    camera.position.normalize().multiplyScalar(newDistance);
    camera.lookAt(scene.position);
}

// Add click listener
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const container = document.getElementById('three');
        if (container) {
            container.addEventListener('click', onMouseClick);
        }
    }, 100);
});