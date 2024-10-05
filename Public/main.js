// Initialize the map
var map = L.map('map').setView([51.505, -0.09], 13);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Global variables to store the selected location data
let selectedData = [];
let parsedKmlLayers = [];
let polygonsVisible = true;  // Track whether polygons are currently visible

// Custom logging function
function logToConsole(message) {
    const consoleBox = document.getElementById('console');
    consoleBox.innerHTML += message + '<br>';
    consoleBox.scrollTop = consoleBox.scrollHeight;
}

// Function to extract PATH and ROW from the description using regular expressions
function extractPathRowFromDescription(description) {
    const pathMatch = description.match(/<strong>PATH<\/strong>:\s*([\d.]+)/);
    const rowMatch = description.match(/<strong>ROW<\/strong>:\s*([\d.]+)/);

    const path = pathMatch ? parseFloat(pathMatch[1]) : null;
    const row = rowMatch ? parseFloat(rowMatch[1]) : null;

    return { path, row };
}

// Function to parse KML manually and extract polygons
function parseKmlFile(kmlText) {
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
    const placemarks = kmlDoc.getElementsByTagName('Placemark');
    let parsedPolygons = 0;

    // Iterate through each placemark and extract polygon data
    for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i];
        const polygon = placemark.getElementsByTagName('Polygon');

        if (polygon.length > 0) {
            parsedPolygons++;
            const coordinatesElement = polygon[0].getElementsByTagName('coordinates')[0];
            const coordinatesText = coordinatesElement.textContent.trim();
            const latLngs = coordinatesText.split(' ').map(coord => {
                const [lng, lat] = coord.split(',').map(Number);
                return [lat, lng];  // LatLng for Leaflet
            });

            // Extract the description field to get PATH and ROW
            const description = placemark.getElementsByTagName('description')[0]?.textContent || '';
            const { path, row } = extractPathRowFromDescription(description);

            // Create a Leaflet polygon and store it along with PATH/ROW
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

// Function to load KML file and trigger parsing
function loadKmlFile(kmlUrl) {
    fetch(kmlUrl)
        .then(response => response.text())
        .then(kmlText => {
            logToConsole('KML file loaded successfully.');
            parseKmlFile(kmlText);

            // Now add all polygons to the map for display
            parsedKmlLayers.forEach(layer => {
                layer.addTo(map);
            });

            logToConsole(`Added ${parsedKmlLayers.length} polygons to the map.`);
        })
        .catch(error => {
            logToConsole('Error loading KML file.');
            console.error('KML Fetch Error:', error);
        });
}

// Handle map click event to capture lat/lng/path/row
map.on('click', function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    let foundMatch = false;

    // Reset previous selected data
    selectedData = [];

    logToConsole(`Map clicked at: Latitude: ${lat}, Longitude: ${lng}`);
    document.getElementById('location-info').innerHTML = `Selected Location: Latitude: ${lat}, Longitude: ${lng}`;

    // Check if the clicked point is inside any of the polygons
    parsedKmlLayers.forEach(function(layer, index) {
        if (layer.getBounds().contains([lat, lng])) {
            foundMatch = true;
            const path = layer.feature.properties.PATH;
            const row = layer.feature.properties.ROW;

            logToConsole(`Point inside polygon ${index + 1} - Path: ${path}, Row: ${row}`);
            document.getElementById('location-info').innerHTML += `<br>Inside polygon ${index + 1} - Path: ${path}, Row: ${row}`;

            // Store each path/row combination as a separate object in selectedData array
            selectedData.push({ latitude: lat, longitude: lng, path: path, row: row });
        }
    });

    if (!foundMatch) {
        logToConsole('No matching polygon found for this location.');
        document.getElementById('location-info').innerHTML += '<br>No matching polygon found.';
    }
});

// Function to toggle polygon visibility
function togglePolygons() {
    if (polygonsVisible) {
        // Hide polygons
        parsedKmlLayers.forEach(layer => {
            map.removeLayer(layer);
        });
        document.getElementById('toggle-polygons').textContent = 'Show Polygons';
        logToConsole('Polygons hidden.');
    } else {
        // Show polygons
        parsedKmlLayers.forEach(layer => {
            map.addLayer(layer);
        });
        document.getElementById('toggle-polygons').textContent = 'Hide Polygons';
        logToConsole('Polygons shown.');
    }
    polygonsVisible = !polygonsVisible;  // Toggle the visibility flag
}

// Function to save data via API
function saveData() {
    if (selectedData.length === 0) {
        logToConsole('No location selected.');
        return;
    }

    // Iterate through each selected path/row combination and save it
    selectedData.forEach(data => {
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

// Load and display the saved history (all saved lat/lng pairs)
function loadHistory() {
    fetch('/history')
        .then(response => response.json())
        .then(data => {
            const historyList = document.getElementById('history-list');
            historyList.innerHTML = '';  // Clear the existing list

            // Populate the list with saved lat/lng pairs
            data.forEach(entry => {
                const li = document.createElement('li');
                li.textContent = `Lat: ${entry.latitude}, Lng: ${entry.longitude}`;
                li.dataset.latitude = entry.latitude;
                li.dataset.longitude = entry.longitude;

                // Add a click event to fetch path/row data for the clicked lat/lng
                li.addEventListener('click', () => {
                    fetchPathRow(entry.latitude, entry.longitude);
                });

                historyList.appendChild(li);
            });
        })
        .catch(error => {
            logToConsole(`Error loading history: ${error}`);
        });
}

// Fetch all path/row data for a given latitude/longitude
function fetchPathRow(latitude, longitude) {
    fetch('/get-path-row', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ latitude, longitude })
    })
    .then(response => response.json())
    .then(data => {
        const pathRowInfo = document.getElementById('path-row-info');
        pathRowInfo.innerHTML = `<h4>Path/Row for Lat: ${latitude}, Lng: ${longitude}</h4>`;
        data.forEach(row => {
            pathRowInfo.innerHTML += `Path: ${row.path}, Row: ${row.row}<br>`;
        });
    })
    .catch(error => {
        logToConsole(`Error fetching path/row data: ${error}`);
    });
}

// Add event listener to toggle button
document.getElementById('toggle-polygons').addEventListener('click', togglePolygons);

// Add event listener to save button
document.getElementById('save-data').addEventListener('click', saveData);

// Add event listener to load history button
document.getElementById('load-history').addEventListener('click', loadHistory);

// Load the KML file
loadKmlFile('WRS-2_bound_world_0.kml');
