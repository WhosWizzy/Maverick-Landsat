// Function to extract PATH and ROW from the description using regular expressions
function extractPathRowFromDescription(description) {
    const pathMatch = description.match(/<strong>PATH<\/strong>:\s*([\d.]+)/);
    const rowMatch = description.match(/<strong>ROW<\/strong>:\s*([\d.]+)/);

    const path = pathMatch ? parseFloat(pathMatch[1]) : null;
    const row = rowMatch ? parseFloat(rowMatch[1]) : null;

    return { path, row };
}

// Function to get path and row for given coordinates (use your own existing logic)
function getPathRowForCoordinates(lat, lng) {
    // Simulating path/row retrieval; replace this with your actual logic to get path/row
    return { path: Math.floor(Math.random() * 200), row: Math.floor(Math.random() * 100) };
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

// Load the KML file
loadKmlFile('WRS-2_bound_world_0.kml');