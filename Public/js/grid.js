function createGrid(lat, lng) {
    const pixelSize = 0.00027;
    let minLat = lat, maxLat = lat;
    let minLng = lng, maxLng = lng;
    gridData = [];

    if (gridLayerGroup) {
        gridLayerGroup.clearLayers(); 
    }
    
    document.getElementById('location-info').innerHTML = '';

    const gridTable = document.createElement('table');
    gridTable.setAttribute('id', 'grid-table'); 

    for (let i = -1; i <= 1; i++) {
        const row = document.createElement('tr'); 
        for (let j = -1; j <= 1; j++) {
            const cell = document.createElement('td');  
            const cellLat = lat + i * pixelSize;
            const cellLng = lng + j * pixelSize;

            const bounds = [
                [cellLat, cellLng],
                [cellLat + pixelSize, cellLng],
                [cellLat + pixelSize, cellLng + pixelSize],
                [cellLat, cellLng + pixelSize]
            ];

            const gridPolygon = L.polygon(bounds, { color: 'blue', fillOpacity: 0.3 });
            gridLayerGroup.addLayer(gridPolygon); 

            gridData.push({
                latitude: cellLat,
                longitude: cellLng
            });
            
            const isTarget = i === 0 && j === 0 ? "(Target)" : "";  
            cell.innerHTML = `Pixel ${i + 2},${j + 2} <br>Lat: ${cellLat.toFixed(6)} <br>Lng: ${cellLng.toFixed(6)} ${isTarget}`;

            row.appendChild(cell);
        }

        gridTable.appendChild(row);
    }
    
    document.getElementById('location-info').appendChild(gridTable);

    gridLayerGroup.addTo(map);

    const gridBounds = [[minLat - pixelSize, minLng - pixelSize], [maxLat + pixelSize, maxLng + pixelSize]];
    map.fitBounds(gridBounds, { padding: [50, 50] });
}
