document.getElementById('toggle-polygons').addEventListener('click', togglePolygons);
document.getElementById('save-data').addEventListener('click', saveData);
document.getElementById('load-history').addEventListener('click', loadHistory);
document.getElementById('clear-all-now').addEventListener('click', clearAllLocations);
document.getElementById('delete-btn').addEventListener('click', deleteSelectedLocations);
document.getElementById('pin-btn').addEventListener('click', () => pinSelectedLocations(1));
document.getElementById('view-path-btn').addEventListener('click', viewPathRow);

function togglePolygons() {
    if (polygonsVisible) {
        parsedKmlLayers.forEach(layer => {
            map.removeLayer(layer);
        });
        document.getElementById('toggle-polygons').textContent = 'Show Polygons';
        logToConsole('Polygons hidden.');
    } else {
        parsedKmlLayers.forEach(layer => {
            map.addLayer(layer);
        });
        document.getElementById('toggle-polygons').textContent = 'Hide Polygons';
        logToConsole('Polygons shown.');
    }
    polygonsVisible = !polygonsVisible;
}

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
    selectedData.forEach(data => {
        data.name = name; 
        console.log('Saving data:', data);

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

function loadHistory() {
    fetch('/history')
        .then(response => response.json())
        .then(data => {
            const historyList = document.getElementById('history-list');
            historyList.innerHTML = '';
            data.forEach(entry => {
                const li = document.createElement('li');
                const pinnedSymbol = entry.pinned === 1 ? '📌 ' : '';

                li.innerHTML = `<input type="checkbox" class="history-checkbox" data-lat="${entry.latitude}" data-lng="${entry.longitude}"> 
                                ${pinnedSymbol}${entry.name} (Lat: ${entry.latitude}, Lng: ${entry.longitude})`;
                historyList.appendChild(li);
            });
            const checkboxes = document.querySelectorAll('.history-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', function() {
                    handleCheckboxChange();
                });
            });
            document.getElementById('clear-all-now').style.display = data.length > 0 ? 'inline-block' : 'none';
        })
        .catch(error => {
            logToConsole(`Error loading history: ${error}`);
        });
}
function handleCheckboxChange() {
    const checkboxes = document.querySelectorAll('.history-checkbox:checked');
    selectedLocations = Array.from(checkboxes).map(checkbox => ({
        latitude: checkbox.dataset.lat,
        longitude: checkbox.dataset.lng
    }));
    const showActionButtons = selectedLocations.length > 0;
    document.getElementById('delete-btn').style.display = showActionButtons ? 'inline-block' : 'none';
    document.getElementById('pin-btn').style.display = showActionButtons ? 'inline-block' : 'none';
    document.getElementById('view-path-btn').style.display = showActionButtons ? 'inline-block' : 'none';
}
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
            loadHistory(); 
        })
        .catch(error => {
            logToConsole(`Error pinning/unpinning location: ${error}`);
        });
    });
}

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
function logToConsole(message) {
    const consoleBox = document.getElementById('console');
    consoleBox.innerHTML += message + '<br>';
    consoleBox.scrollTop = consoleBox.scrollHeight;
}
