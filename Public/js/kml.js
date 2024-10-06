function extractPathRowFromDescription(description) {
    const pathMatch = description.match(/<strong>PATH<\/strong>:\s*([\d.]+)/);
    const rowMatch = description.match(/<strong>ROW<\/strong>:\s*([\d.]+)/);

    const path = pathMatch ? parseFloat(pathMatch[1]) : null;
    const row = rowMatch ? parseFloat(rowMatch[1]) : null;

    return { path, row };
}

function getPathRowForCoordinates(lat, lng) {
    return { path: Math.floor(Math.random() * 200), row: Math.floor(Math.random() * 100) };
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

loadKmlFile('WRS-2_bound_world_0.kml');
