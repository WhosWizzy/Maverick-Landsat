var southWest = L.latLng(-90, -140);  
var northEast = L.latLng(90, 140);   
var bounds = L.latLngBounds(southWest, northEast);  


var map = L.map('map', {
    minZoom: 2,   
    maxZoom: 18, 
    maxBounds: bounds, 
    maxBoundsViscosity: 1.0,  
	worldCopyJump: false, 
    noWrap: true  
}).setView([51.505, -0.09], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
	noWrap: true
}).addTo(map);
map.on('drag', function() {
    map.panInsideBounds(bounds, { animate: true });
});
let selectedData = [];
let selectedLocations = [];
let parsedKmlLayers = [];
let polygonsVisible = false;  /
let gridData = [];

function logToConsole(message) {
    const consoleBox = document.getElementById('console');
    consoleBox.innerHTML += message + '<br>';
    consoleBox.scrollTop = consoleBox.scrollHeight;
}

function extractPathRowFromDescription(description) {
    const pathMatch = description.match(/<strong>PATH<\/strong>:\s*([\d.]+)/);
    const rowMatch = description.match(/<strong>ROW<\/strong>:\s*([\d.]+)/);

    const path = pathMatch ? parseFloat(pathMatch[1]) : null;
    const row = rowMatch ? parseFloat(rowMatch[1]) : null;

    return { path, row };
}

function parseKmlFile(kmlText) {
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
    const placemarks = kmlDoc.getElementsByTagName('Placemark');
    let parsedPolygons = 0;

    for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i];
        const polygon = placemark.getElementsByTagName('Polygon');

        if (polygon.length > 0) {
            parsedPolygons++;
            const coordinatesElement = polygon[0].getElementsByTagName('coordinates')[0];
            const coordinatesText = coordinatesElement.textContent.trim();
            const latLngs = coordinatesText.split(' ').map(coord => {
                const [lng, lat] = coord.split(',').map(Number);
                return [lat, lng]; 
            });

            const description = placemark.getElementsByTagName('description')[0]?.textContent || '';
            const { path, row } = extractPathRowFromDescription(description);

            const leafletPolygon = L.polygon(latLngs, { color: 'blue' });
            leafletPolygon.feature = {
                properties: {
                    PATH: path,
                    ROW: row,
                    description: description
                }
            };
            parsedKmlLayers.push(leafletPolygon);  
        }
    }

    logToConsole(`Parsed ${parsedPolygons} polygons from KML manually.`);
}

function loadKmlFile(kmlUrl) {
    fetch(kmlUrl)
        .then(response => response.text())
        .then(kmlText => {
            logToConsole('KML file loaded successfully.');
            parseKmlFile(kmlText);
            logToConsole(`Parsed ${parsedKmlLayers.length} polygons from the KML.`);
        })
        .catch(error => {
            logToConsole('Error loading KML file.');
            console.error('KML Fetch Error:', error);
        });
}

function createGrid(lat, lng) {
    const pixelSize = 0.00027;  
    let minLat = lat, maxLat = lat;
    let minLng = lng, maxLng = lng;
    gridData = [];  

    document.getElementById('location-info').innerHTML = '';

    const gridTable = document.createElement('table');
    gridTable.setAttribute('id', 'grid-table');  
    for (let i = -1; i <= 1; i++) {
        const row = document.createElement('tr'); 

        for (let j = -1; j <= 1; j++) {
            const cell = document.createElement('td'); 

            const bounds = [
                [lat + i * pixelSize, lng + j * pixelSize],
                [lat + (i + 1) * pixelSize, lng + j * pixelSize],
                [lat + (i + 1) * pixelSize, lng + (j + 1) * pixelSize],
                [lat + i * pixelSize, lng + (j + 1) * pixelSize]
            ];

            const { path, row: rowNum } = getPathRowForCoordinates(lat + i * pixelSize, lng + j * pixelSize);

            gridData.push({
                latitude: lat + i * pixelSize,
                longitude: lng + j * pixelSize,
                path: path,
                row: rowNum
            });

            const isTarget = i === 0 && j === 0 ? "(Target)" : "";
            cell.innerHTML = `Pixel ${i + 2},${j + 2} <br>Path: ${path} <br>Row: ${rowNum} ${isTarget}`;

            row.appendChild(cell);
        }
        gridTable.appendChild(row);
    }

    document.getElementById('location-info').appendChild(gridTable);

    const gridBounds = [[minLat, minLng], [maxLat, maxLng]];
    map.fitBounds(gridBounds, { padding: [50, 50] });
}

function getPathRowForCoordinates(lat, lng) {
    return { path: Math.floor(Math.random() * 200), row: Math.floor(Math.random() * 100) };
}

function saveGridData() {
    const name = document.getElementById('location-name').value;
    if (!name) {
        logToConsole('Please enter a name for this location.');
        return;
    }

    gridData.forEach(data => {
        data.name = name; 

        fetch('/save-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(res => {
            if (res.success) {
                logToConsole(`Data saved successfully! ID: ${res.id}`);
            } else {
                logToConsole(`Failed to save data: ${res.error}`);
            }
        })
        .catch(error => {
            logToConsole(`Error: ${error}`);
        });
    });
}

map.on('click', function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    let foundMatch = false;

    selectedData = [];

    logToConsole(`Map clicked at: Latitude: ${lat}, Longitude: ${lng}`);
    document.getElementById('location-info').innerHTML = `Selected Location: Latitude: ${lat}, Longitude: ${lng}`;
    
    createGrid(lat, lng);

    parsedKmlLayers.forEach(function(layer, index) {
        if (layer.getBounds().contains([lat, lng])) {
            foundMatch = true;
            const path = layer.feature.properties.PATH;
            const row = layer.feature.properties.ROW;

            logToConsole(`Point inside polygon ${index + 1} - Path: ${path}, Row: ${row}`);
            document.getElementById('location-info').innerHTML += `<br>Inside polygon ${index + 1} - Path: ${path}, Row: ${row}`;

            selectedData.push({ latitude: lat, longitude: lng, path: path, row: row });
        }
    });

    if (!foundMatch) {
        logToConsole('No matching polygon found for this location.');
        document.getElementById('location-info').innerHTML += '<br>No matching polygon found.';
    }
});
function togglePolygons() {
    if (polygonsVisible) {

        parsedKmlLayers.forEach(layer => {
            map.removeLayer(layer);
        });
        document.getElementById('toggle-polygons').textContent = 'Show Polygons';
        logToConsole('Polygons hidden.');
    } else {

        parsedKmlLayers.forEach(layer => {
            map.addLayer(layer);
        });
        document.getElementById('toggle-polygons').textContent = 'Hide Polygons';
        logToConsole('Polygons shown.');
    }
    polygonsVisible = !polygonsVisible; 
}
 
function saveData() {
    if (selectedData.length === 0) {
        logToConsole('No location selected.');
        return;
    }

    const name = document.getElementById('location-name').value;
    if (!name) {
        logToConsole('Please enter a name for this location.');
        return;
    }
 
    selectedData.forEach(data => {
        data.name = name;   

        console.log('Saving data:', data);   

        fetch('/save-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(res => {
            if (res.success) {
                logToConsole(`Data saved successfully! ID: ${res.id}`);
            } else {
                logToConsole(`Failed to save data: ${res.error}`);
            }
        })
        .catch(error => {
            logToConsole(`Error: ${error}`);
        });
    });
}

 
function loadHistory() {
    fetch('/history')
        .then(response => response.json())
        .then(data => {
            const historyList = document.getElementById('history-list');
            historyList.innerHTML = '';  / 
 
            data.forEach(entry => {
                const li = document.createElement('li');
 
                const pinnedSymbol = entry.pinned === 1 ? '📌 ' : '';

                li.innerHTML = `<input type="checkbox" class="history-checkbox" data-lat="${entry.latitude}" data-lng="${entry.longitude}"> 
                                ${pinnedSymbol}${entry.name} (Lat: ${entry.latitude}, Lng: ${entry.longitude})`;
                historyList.appendChild(li);
            });

        
            const checkboxes = document.querySelectorAll('.history-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', function() {
                    handleCheckboxChange();
                });
            });

 
            document.getElementById('clear-all').style.display = data.length > 0 ? 'inline-block' : 'none';
        })
        .catch(error => {
            logToConsole(`Error loading history: ${error}`);
        });
}
 
function handleCheckboxChange() {
    const checkboxes = document.querySelectorAll('.history-checkbox:checked');
    selectedLocations = Array.from(checkboxes).map(checkbox => ({
        latitude: checkbox.dataset.lat,
        longitude: checkbox.dataset.lng
    }));
 
    const showActionButtons = selectedLocations.length > 0;
    document.getElementById('delete-btn').style.display = showActionButtons ? 'inline-block' : 'none';
    document.getElementById('pin-btn').style.display = showActionButtons ? 'inline-block' : 'none';
    document.getElementById('view-path-btn').style.display = showActionButtons ? 'inline-block' : 'none'; // Show view path button
}

 
function viewPathRow() {
    selectedLocations.forEach(loc => {
        fetch('/get-path-row', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ latitude: loc.latitude, longitude: loc.longitude })
        })
        .then(response => response.json())
        .then(data => {
            const pathRowInfo = document.getElementById('path-row-info');
            pathRowInfo.innerHTML = `<h4>Path/Row for Lat: ${loc.latitude}, Lng: ${loc.longitude}</h4>`;
            data.forEach(row => {
                pathRowInfo.innerHTML += `Path: ${row.path}, Row: ${row.row}<br>`;
            });
        })
        .catch(error => {
            logToConsole(`Error fetching path/row data: ${error}`);
        });
    });
}
 
function deleteSelectedLocations() {
    selectedLocations.forEach(loc => {
        fetch('/delete-location', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ latitude: loc.latitude, longitude: loc.longitude })
        })
        .then(response => response.json())
        .then(() => {
            logToConsole(`Location (Lat: ${loc.latitude}, Lng: ${loc.longitude}) deleted.`);
            loadHistory(); 
        })
        .catch(error => {
            logToConsole(`Error deleting location: ${error}`);
        });
    });
}
 
function pinSelectedLocations(pinStatus) {
    selectedLocations.forEach(loc => {
        fetch('/pin-location', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ latitude: loc.latitude, longitude: loc.longitude, pinStatus })
        })
        .then(response => response.json())
        .then(() => {
            logToConsole(`Location (Lat: ${loc.latitude}, Lng: ${loc.longitude}) ${pinStatus ? 'pinned' : 'unpinned'}.`);
            loadHistory();  
        })
        .catch(error => {
            logToConsole(`Error pinning/unpinning location: ${error}`);
        });
    });
}
 
function clearAllLocations() {
    fetch('/clear-all', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(() => {
        logToConsole('All locations cleared.');
        loadHistory();  
    })
    .catch(error => {
        logToConsole(`Error clearing all locations: ${error}`);
    });
}
 
document.getElementById('toggle-polygons').addEventListener('click', togglePolygons);
document.getElementById('save-data').addEventListener('click', saveData);
document.getElementById('load-history').addEventListener('click', loadHistory);
document.getElementById('clear-all').addEventListener('click', clearAllLocations);
document.getElementById('delete-btn').addEventListener('click', deleteSelectedLocations);
document.getElementById('pin-btn').addEventListener('click', () => pinSelectedLocations(1));
document.getElementById('view-path-btn').addEventListener('click', viewPathRow);  
loadKmlFile('WRS-2_bound_world_0.kml');
