// Initialize the map
var map = L.map('map').setView([51.505, -0.09], 13);  // Default location is London

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// On map click, create the grid and check which scene contains the point
map.on('click', function(e) {
    console.log('Map clicked at: ', e.latlng);  // Ensure this logs when map is clicked
    var lat = e.latlng.lat;
    var lng = e.latlng.lng;
    
    // Display coordinates to the user
    document.getElementById('location-info').innerHTML = 'Selected Location: ' + lat + ', ' + lng;

    // Clear previous grid
    map.eachLayer(function (layer) {
        if (layer instanceof L.Polygon) {
            map.removeLayer(layer);
        }
    });
    
    // Call the backend API to get Path/Row from USGS tool
    axios.post('/get-path-row', { latitude: lat, longitude: lng })
        .then(response => {
            // Display the Path/Row to the user
            document.getElementById('location-info').innerHTML += `<br>Path: ${response.data.path}, Row: ${response.data.row}`;
        })
        .catch(error => {
            console.error('Error fetching Path/Row:', error);
            document.getElementById('location-info').innerHTML += `<br>Error fetching Path/Row`;
        });

    // Create a 3x3 grid of Landsat pixels and zoom to the grid
    createGrid(lat, lng);

    // Check if the clicked point is within a Landsat scene
    if (isPointInScene(lat, lng, kmlLayer)) {
        alert('This location is within a Landsat scene!');
        // Zoom to the scene boundary or highlight it
        kmlLayer.eachLayer(function(layer) {
            if (layer instanceof L.Polygon && layer.getBounds().contains(L.latLng(lat, lng))) {
                console.log('Zooming to scene boundary...');
                map.fitBounds(layer.getBounds(), { padding: [50, 50] });  // Added padding for better view
            }
        });
    } else {
        console.log('No scene found for this location.');
    }
});

// Function to create the 3x3 grid of Landsat pixels and zoom to it
function createGrid(lat, lng) {
    const pixelSize = 0.00027; // Approximate size of a Landsat pixel in degrees (~30m)
    
    // Variables to store the bounds of the grid
    var minLat = lat, maxLat = lat;
    var minLng = lng, maxLng = lng;

    // Loop to create 3x3 grid and track the bounds
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

            // Update bounds
            minLat = Math.min(minLat, lat + i * pixelSize);
            maxLat = Math.max(maxLat, lat + (i + 1) * pixelSize);
            minLng = Math.min(minLng, lng + j * pixelSize);
            maxLng = Math.max(maxLng, lng + (j + 1) * pixelSize);
        }
    }

    // Define the bounds for the entire grid (southwest and northeast corners)
    const gridBounds = [[minLat, minLng], [maxLat, maxLng]];

    console.log('Grid Bounds:', gridBounds);

    // Manual zoom as a test
    map.setView([lat, lng], 16);  // Set zoom level to 16 for testing purposes

    // Zoom the map to fit the grid bounds (with padding)
    map.fitBounds(gridBounds, { padding: [50, 50] });  // Added padding for better view
}

// Load WRS-2 KML file and add it to the map
var kmlLayer = omnivore.kml('WRS-2_bound_world_0.kml').addTo(map)
    .on('ready', function() {
        console.log('KML file loaded successfully');
    })
    .on('error', function() {
        console.error('Error loading KML file');
    });
    
// Check if the point is within a Landsat scene polygon
function isPointInScene(lat, lng, geoJsonLayer) {
    const point = L.latLng(lat, lng);
    let isInScene = false;
    
    // Loop through the features in the GeoJSON layer
    geoJsonLayer.eachLayer(function(layer) {
        if (layer instanceof L.Polygon && layer.getBounds().contains(point)) {
            isInScene = true;
        }
    });
    return isInScene;
}
