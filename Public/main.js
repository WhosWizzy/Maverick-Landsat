// Define the bounds for the map (adjust this to fit your area of interest)
var southWest = L.latLng(-90, -140);  // Adjust these coordinates based on your KML data
var northEast = L.latLng(90, 140);    // Adjust these coordinates based on your KML data
var bounds = L.latLngBounds(southWest, northEast);  // Create the bounds object

// Initialize the map with a zoom range and bounds restrictions
var map = L.map('map', {
    minZoom: 2,   // Minimum zoom level (adjust based on your KML data area)
    maxZoom: 18,  // Maximum zoom level
    maxBounds: bounds,  // Restrict the view to the given bounds
    maxBoundsViscosity: 1.0,  // Adds resistance when trying to pan out of bounds
	worldCopyJump: false, 
    noWrap: true  // Prevent horizontal map wrapping
}).setView([51.505, -0.09], 5);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
	noWrap: true
}).addTo(map);

// Ensure the map stays within the bounds on drag events
map.on('drag', function() {
    map.panInsideBounds(bounds, { animate: true });
});

// Global variables to store the selected location data
let selectedData = [];
let selectedLocations = []; // For selected history locations (checkbox)
let parsedKmlLayers = [];
let polygonsVisible = false;  // By default, polygons are hidden

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
            parsedKmlLayers.push(leafletPolygon);  // Add polygons to an array but don't add them to the map yet
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
            logToConsole(`Parsed ${parsedKmlLayers.length} polygons from the KML.`);
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

    const name = document.getElementById('location-name').value;
    if (!name) {
        logToConsole('Please enter a name for this location.');
        return;
    }

    // Iterate through each selected path/row combination and save it
    selectedData.forEach(data => {
        data.name = name;  // Add the custom name

        console.log('Saving data:', data);  // Log the data being sent for debugging

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

                // Check if the item is pinned and append the 📌 emoji if pinned
                const pinnedSymbol = entry.pinned === 1 ? '📌 ' : '';

                li.innerHTML = `<input type="checkbox" class="history-checkbox" data-lat="${entry.latitude}" data-lng="${entry.longitude}"> 
                                ${pinnedSymbol}${entry.name} (Lat: ${entry.latitude}, Lng: ${entry.longitude})`;
                historyList.appendChild(li);
            });

            // Show or hide action buttons based on checkbox selections
            const checkboxes = document.querySelectorAll('.history-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', function() {
                    handleCheckboxChange();
                });
            });

            // Show "Clear All" button only if history exists
            document.getElementById('clear-all').style.display = data.length > 0 ? 'inline-block' : 'none';
        })
        .catch(error => {
            logToConsole(`Error loading history: ${error}`);
        });
}

// Function to handle checkbox changes
function handleCheckboxChange() {
    const checkboxes = document.querySelectorAll('.history-checkbox:checked');
    selectedLocations = Array.from(checkboxes).map(checkbox => ({
        latitude: checkbox.dataset.lat,
        longitude: checkbox.dataset.lng
    }));

    // Show or hide delete/pin buttons based on selections
    const showActionButtons = selectedLocations.length > 0;
    document.getElementById('delete-btn').style.display = showActionButtons ? 'inline-block' : 'none';
    document.getElementById('pin-btn').style.display = showActionButtons ? 'inline-block' : 'none';
    document.getElementById('view-path-btn').style.display = showActionButtons ? 'inline-block' : 'none'; // Show view path button
}

// Function to fetch path/row for selected locations
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

// Function to delete selected locations
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
            loadHistory();  // Reload history
        })
        .catch(error => {
            logToConsole(`Error deleting location: ${error}`);
        });
    });
}

// Function to pin/unpin selected locations
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
            loadHistory();  // Reload history
        })
        .catch(error => {
            logToConsole(`Error pinning/unpinning location: ${error}`);
        });
    });
}

// Function to clear all saved locations
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
        loadHistory();  // Reload history
    })
    .catch(error => {
        logToConsole(`Error clearing all locations: ${error}`);
    });
}

// Add event listener to the "Show Polygons" button
document.getElementById('toggle-polygons').addEventListener('click', togglePolygons);

// Add event listener to save button
document.getElementById('save-data').addEventListener('click', saveData);

// Add event listener to load history button
document.getElementById('load-history').addEventListener('click', loadHistory);

// Add event listener to clear all button
document.getElementById('clear-all').addEventListener('click', clearAllLocations);

// Add event listener to delete selected locations button
document.getElementById('delete-btn').addEventListener('click', deleteSelectedLocations);

// Add event listener to pin selected locations button
document.getElementById('pin-btn').addEventListener('click', () => pinSelectedLocations(1));  // Pin selected

// Add event listener to view path/row button
document.getElementById('view-path-btn').addEventListener('click', viewPathRow);  // View path/row for selected locations

// Load the KML file
loadKmlFile('WRS-2_bound_world_0.kml');
