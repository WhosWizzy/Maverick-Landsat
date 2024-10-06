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

map.on('click', function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    lastClickedLat = lat;
    lastClickedLng = lng;
    logToConsole(`Map clicked at: Latitude: ${lat}, Longitude: ${lng}`);
    document.getElementById('location-info').innerHTML = `Selected Location: Latitude: ${lat}, Longitude: ${lng}`;
    selectedData = [];
	createGrid(lat, lng)
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
    else {
        logToConsole('No valid click event.');
    }
});

function updateThresholdLabel(value) {
    document.getElementById('cloud-threshold-value').textContent = value + '%';
    cloudThreshold = value; 
}

document.getElementById('submitData').addEventListener('click', function () {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const cloudThreshold = document.getElementById('cloud-threshold').value;
    if (!lastClickedLat || !lastClickedLng) {
        alert('Please click on the map to select a location.');
        return;
    }

    if (!startDate || !endDate) {
        alert('Please select both start and end dates.');
        return;
    }

    fetchCloudCoverageFromUSGS(lastClickedLat, lastClickedLng, startDate, endDate, cloudThreshold);
});

async function fetchCloudCoverageFromUSGS(lat, lng, startDate, endDate, cloudThreshold) {
    const apiUrl = 'http://localhost:3000/get-latest-cloud-coverage'; 

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

        const data = await response.json();

        if (data.error) {
            document.getElementById('cloud-coverage').innerHTML = 'Error: ' + data.error;
            return;
        }

        const cloudCoverage = data.cloudCover; 

        if (typeof cloudCoverage !== 'number' || isNaN(cloudCoverage)) {
            document.getElementById('cloud-coverage').innerHTML = 'Invalid cloud coverage data received.';
            return;
        }

        document.getElementById('cloud-coverage').innerHTML = `Cloud Coverage: ${cloudCoverage}%`;

        if (cloudCoverage <= cloudThreshold) {
            console.log('Cloud coverage is below the threshold, fetching additional data...');
        } else {
            document.getElementById('additional-data').innerHTML = 'No additional data fetched due to high cloud coverage.';
        }

    } catch (err) {
        console.error('Error fetching cloud coverage data:', err);
        document.getElementById('cloud-coverage').innerHTML = 'Error fetching data: ' + err;
    }
}

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
let lastClickedLat = null;
let lastClickedLng = null;
let cloudThreshold = 15;  
