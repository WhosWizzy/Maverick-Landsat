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

// Handle map click event to capture lat/lng/path/row
map.on('click', function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    let foundMatch = false;
	lastClickedLat = lat;  // Save last clicked location
    lastClickedLng = lng;

    // Reset previous selected data
    selectedData = [];

    logToConsole(`Map clicked at: Latitude: ${lat}, Longitude: ${lng}`);
    document.getElementById('location-info').innerHTML = `Selected Location: Latitude: ${lat}, Longitude: ${lng}`;
    
    createGrid(lat, lng);

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

// Trigger overpass prediction based on the selected date
function triggerOverpassPrediction() {
    // Get the selected date from the date input
    const selectedDate = document.getElementById('overpass-date').value;

    // Ensure a location has been clicked
    if (!lastClickedLat || !lastClickedLng) {
        alert('Please click on the map to select a location first.');
        return;
    }

    // Ensure a date is selected
    if (!selectedDate) {
        alert('Please select a date.');
        return;
    }

    // Call the calculateOverpass function from overpass.js
    calculateOverpass(lastClickedLat, lastClickedLng, selectedDate, function(err, overpass) {
        var overpassInfoDiv = document.getElementById('overpass-info');
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

// Store the last clicked location (so the user can click a location first)
let lastClickedLat = null;
let lastClickedLng = null;
