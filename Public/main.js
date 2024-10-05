// Initialize the map
var map = L.map('map').setView([51.505, -0.09], 13);  // Default location is London

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Function to log messages to the custom console box
function logToConsole(message) {
    const consoleBox = document.getElementById('console');
    consoleBox.innerHTML += message + '<br>';  // Add new messages to the console
    consoleBox.scrollTop = consoleBox.scrollHeight;  // Scroll to the bottom
}

// Variable to hold parsed KML layers, but don't add them to the map immediately
var parsedKmlLayers = [];

// Load KML file without immediately adding to the map
var kmlLayer = omnivore.kml('WRS-2_bound_world_0.kml')
    .on('ready', function() {
        logToConsole('KML file loaded successfully');

        // Store KML layer polygons, but don't add them to the map yet
        kmlLayer.eachLayer(function(layer) {
            if (layer instanceof L.Polygon) {
                parsedKmlLayers.push(layer);  // Store the polygon but don't add to the map
            }
        });
    })
    .on('error', function() {
        logToConsole('Error loading KML file');
    });

// On map click, get Path/Row data and filter specific grids based on retrieved data
map.on('click', function (e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    logToConsole(`Map clicked at: ${lat}, ${lng}`);  // Log map click location

    // Display coordinates to the user
    document.getElementById('location-info').innerHTML = 'Selected Location: ' + lat + ', ' + lng;

    // Clear previously added grids before adding new ones
    map.eachLayer(function (layer) {
        if (layer instanceof L.Polygon) {
            map.removeLayer(layer);
        }
    });

    // Call the backend API to get Path/Row from USGS tool
    axios.post('/get-path-row', { latitude: lat, longitude: lng })
        .then(response => {
            const pathRowData = response.data;  // Array of Path/Row data

            if (pathRowData && pathRowData.length > 0) {
                logToConsole(`Fetched ${pathRowData.length} Path/Row combinations`);

                // Create a table to display all path/row information
                let locationInfoTable = `<table border="1">
                    <thead>
                        <tr>
                            <th>Path</th>
                            <th>Row</th>
                            <th>L8 Next Acq</th>
                            <th>L9 Next Acq</th>
                        </tr>
                    </thead>
                    <tbody>`;

                // Clear addedGrids before processing
                addedGrids = {};

                // Loop through each Path/Row and filter the KML layer
                pathRowData.forEach((data) => {
                    locationInfoTable += `
                        <tr>
                            <td>${data.path}</td>
                            <td>${data.row}</td>
                            <td>${data.L8NextAcq}</td>
                            <td>${data.L9NextAcq}</td>
                        </tr>
                    `;

                    // Log each Path/Row for debugging
                    logToConsole(`Path: ${data.path}, Row: ${data.row}`);

                    // Construct a unique key for each path/row
                    const key = `${data.path}-${data.row}`;

                    // Filter the KML layer for the specific Path/Row polygon and display it
                    if (!addedGrids[key] && kmlLayer) {
                        addedGrids[key] = true;  // Mark this path/row as added

                        kmlLayer.eachLayer(function (layer) {
                            if (layer instanceof L.Polygon && layer.feature && layer.feature.properties) {
                                const path = layer.feature.properties.PATH;
                                const row = layer.feature.properties.ROW;

                                // Check if the polygon matches the Path/Row returned by the backend
                                if (path == data.path && row == data.row) {
                                    logToConsole(`Displaying grid for Path: ${data.path}, Row: ${data.row}`);
                                    map.addLayer(layer);  // Add the filtered polygon to the map
                                }
                            }
                        });
                    } else {
                        logToConsole(`Grid for Path: ${data.path}, Row: ${data.row} already added`);
                    }
                });

                locationInfoTable += `</tbody></table>`;
                document.getElementById('location-info').innerHTML += locationInfoTable;
            } else {
                document.getElementById('location-info').innerHTML += '<br>No Path/Row data available.';
                logToConsole('No Path/Row data found.');
            }
        })
        .catch(error => {
            logToConsole('Error fetching Path/Row: ' + error);  // Log error
            document.getElementById('location-info').innerHTML += `<br>Error fetching Path/Row`;
        });

    // Create a 3x3 grid of Landsat pixels and zoom to the grid
    createGrid(lat, lng);
});

// Function to create the 3x3 grid of Landsat pixels and zoom to it
function createGrid(lat, lng) {
    const pixelSize = 0.00027;  // Approximate size of a Landsat pixel in degrees (~30m)
    var minLat = lat, maxLat = lat;
    var minLng = lng, maxLng = lng;

    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const bounds = [
                [lat + i * pixelSize, lng + j * pixelSize],
                [lat + (i + 1) * pixelSize, lng + j * pixelSize],
                [lat + (i + 1) * pixelSize, lng + (j + 1) * pixelSize],
                [lat + i * pixelSize, lng + (j + 1) * pixelSize]
            ];

            // Create a polygon representing the pixel and add it to the map
            L.polygon(bounds, { color: 'blue' }).addTo(map);

            minLat = Math.min(minLat, lat + i * pixelSize);
            maxLat = Math.max(maxLat, lat + (i + 1) * pixelSize);
            minLng = Math.min(minLng, lng + j * pixelSize);
            maxLng = Math.max(maxLng, lng + (j + 1) * pixelSize);
        }
    }

    const gridBounds = [[minLat, minLng], [maxLat, maxLng]];
    logToConsole('Grid Bounds: ' + JSON.stringify(gridBounds));

    map.setView([lat, lng], 16);  // Set zoom level to 16
    map.fitBounds(gridBounds, { padding: [50, 50] });
}

// Check if the point is within a Landsat scene polygon
function isPointInScene(lat, lng, geoJsonLayer) {
    const point = L.latLng(lat, lng);
    let isInScene = false;

    geoJsonLayer.eachLayer(function(layer) {
        if (layer instanceof L.Polygon && layer.getBounds().contains(point)) {
            isInScene = true;
        }
    });

    return isInScene;
}
