// Function to create the 3x3 grid of Landsat pixels and display it in a 3x3 table
function createGrid(lat, lng) {
    const pixelSize = 0.00027;  // Approximate size of a Landsat pixel in degrees (~30m)
    let minLat = lat, maxLat = lat;
    let minLng = lng, maxLng = lng;
    gridData = [];  // Clear the grid data

    // Clear previous grid from the map
    if (gridLayerGroup) {
        gridLayerGroup.clearLayers();  // Remove all grid polygons
    }

    // Clear the current grid info in the panel
    document.getElementById('location-info').innerHTML = '';

    // Create a table element for the 3x3 grid
    const gridTable = document.createElement('table');
    gridTable.setAttribute('id', 'grid-table');  // Optional for styling

    // Loop to create the 3x3 grid
    for (let i = -1; i <= 1; i++) {
        const row = document.createElement('tr');  // Create a new table row

        for (let j = -1; j <= 1; j++) {
            const cell = document.createElement('td');  // Create a new table cell

            // Calculate the latitude and longitude for the current pixel
            const cellLat = lat + i * pixelSize;
            const cellLng = lng + j * pixelSize;

            const bounds = [
                [cellLat, cellLng],
                [cellLat + pixelSize, cellLng],
                [cellLat + pixelSize, cellLng + pixelSize],
                [cellLat, cellLng + pixelSize]
            ];

            // Create the polygon for the grid and add it to the gridLayerGroup
            const gridPolygon = L.polygon(bounds, { color: 'blue', fillOpacity: 0.3 });
            gridLayerGroup.addLayer(gridPolygon);  // Add each grid polygon to the layer group

            // Store grid metadata for later saving
            gridData.push({
                latitude: cellLat,
                longitude: cellLng
            });

            // Set the cell content with lat/lng data
            const isTarget = i === 0 && j === 0 ? "(Target)" : "";  // Mark the central pixel
            cell.innerHTML = `Pixel ${i + 2},${j + 2} <br>Lat: ${cellLat.toFixed(6)} <br>Lng: ${cellLng.toFixed(6)} ${isTarget}`;

            // Add the cell to the row
            row.appendChild(cell);
        }

        // Add the row to the table
        gridTable.appendChild(row);
    }

    // Append the grid table to the location info section
    document.getElementById('location-info').appendChild(gridTable);

    // Add the gridLayerGroup to the map (this will display the grid on the map)
    gridLayerGroup.addTo(map);

    // Zoom to the 3x3 grid on the map
    const gridBounds = [[minLat - pixelSize, minLng - pixelSize], [maxLat + pixelSize, maxLng + pixelSize]];
    map.fitBounds(gridBounds, { padding: [50, 50] });
}