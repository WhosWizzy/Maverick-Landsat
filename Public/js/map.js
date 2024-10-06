// Initialize the map with bounds and zoom
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

// Add OpenStreetMap layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    noWrap: true
}).addTo(map);

// Ensure the map stays within the bounds on drag
map.on('drag', function() {
    map.panInsideBounds(bounds, { animate: true });
});

// Handle map click event
map.on('click', function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    lastClickedLat = lat;
    lastClickedLng = lng;

    logToConsole(`Map clicked at: Latitude: ${lat}, Longitude: ${lng}`);
    document.getElementById('location-info').innerHTML = `Selected Location: Latitude: ${lat}, Longitude: ${lng}`;

    // Reset previous data
    selectedData = [];
	
	createGrid(lat, lng)

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
    else {
        logToConsole('No valid click event.');
    }
});

// Update the threshold label dynamically
function updateThresholdLabel(value) {
    document.getElementById('cloud-threshold-value').textContent = value + '%';
    cloudThreshold = value; // Update global cloudThreshold value
}

// When the submit button is clicked
document.getElementById('submitData').addEventListener('click', function () {
    // Get user-selected start and end dates
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // Get cloud coverage threshold
    const cloudThreshold = document.getElementById('cloud-threshold').value;

    // Ensure the user clicked a location on the map before submitting
    if (!lastClickedLat || !lastClickedLng) {
        alert('Please click on the map to select a location.');
        return;
    }

    // Ensure both start and end dates are selected
    if (!startDate || !endDate) {
        alert('Please select both start and end dates.');
        return;
    }

    // Fetch cloud coverage using the function defined earlier
    fetchCloudCoverageFromUSGS(lastClickedLat, lastClickedLng, startDate, endDate, cloudThreshold);
});

// Function to fetch cloud coverage from USGS M2M API using Landsat 9
async function fetchCloudCoverageFromUSGS(lat, lng, startDate, endDate, cloudThreshold) {
    const apiUrl = 'http://localhost:3000/get-latest-cloud-coverage';  // Backend API endpoint

    const payload = {
        lat: lat,
        lon: lng,
        startDate: startDate,
        endDate: endDate,
        cloudCoverageThreshold: cloudThreshold
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        // Ensure the response is valid JSON
        const data = await response.json();

        if (data.error) {
            document.getElementById('cloud-coverage').innerHTML = 'Error: ' + data.error;
            return;
        }

        const cloudCoverage = data.cloudCover;  // Assuming backend returns "cloudCover"

        if (typeof cloudCoverage !== 'number' || isNaN(cloudCoverage)) {
            document.getElementById('cloud-coverage').innerHTML = 'Invalid cloud coverage data received.';
            return;
        }

        // Display cloud coverage in the UI
        document.getElementById('cloud-coverage').innerHTML = `Cloud Coverage: ${cloudCoverage}%`;

        if (cloudCoverage <= cloudThreshold) {
            console.log('Cloud coverage is below the threshold, fetching additional data...');
            // Additional logic if cloud coverage is below the threshold
        } else {
            document.getElementById('additional-data').innerHTML = 'No additional data fetched due to high cloud coverage.';
        }

    } catch (err) {
        console.error('Error fetching cloud coverage data:', err);
        document.getElementById('cloud-coverage').innerHTML = 'Error fetching data: ' + err;
    }
}

// Trigger overpass prediction based on selected date
function triggerOverpassPrediction() {
    const selectedDate = document.getElementById('overpass-date').value;

    if (!lastClickedLat || !lastClickedLng) {
        alert('Please click on the map to select a location first.');
        return;
    }

    if (!selectedDate) {
        alert('Please select a date.');
        return;
    }

    calculateOverpass(lastClickedLat, lastClickedLng, selectedDate, function(err, overpass) {
        const overpassInfoDiv = document.getElementById('overpass-info');
        if (err) {
            overpassInfoDiv.innerHTML = 'Error: ' + err;
            return;
        }

        var message = `
            Next Landsat overpass at: ${overpass.time.toUTCString()}<br>
            Azimuth: ${overpass.azimuth} degrees<br>
            Elevation: ${overpass.elevation} degrees
        `;
        overpassInfoDiv.innerHTML = message;
        logToConsole(message);
    });
}

// Add GEE Cloud Layer based on user interaction
async function addCloudLayer(lat, lng, startDate, endDate, cloudThreshold) {
    try {
        const cloudTileUrl = await getCloudCoverageTileUrl(lat, lng, startDate, endDate, cloudThreshold);

        const cloudLayer = L.tileLayer(cloudTileUrl, {
            attribution: 'Cloud data from Google Earth Engine'
        });

        map.addLayer(cloudLayer);

        const overlayMaps = {
            "Cloud Coverage": cloudLayer
        };

        L.control.layers(null, overlayMaps).addTo(map);
    } catch (error) {
        logToConsole('Error adding cloud layer: ' + error);
    }
}


// Fetch additional data if cloud coverage is below the threshold
/**function fetchAdditionalData(lat, lng, callback) {
    // Here, you'd call your backend or Earth Engine to fetch additional data (e.g., Surface Reflectance)
    // For now, we'll mock the response.
    setTimeout(() => {
        const additionalData = {
            surfaceReflectance: Math.random() * 1000,  // Mock data
            otherData: Math.random() * 500
        };
        callback(null, additionalData);
    }, 1000);
}**/

// Store last clicked location globally
let lastClickedLat = null;
let lastClickedLng = null;
let cloudThreshold = 15;  // Default cloud threshold
