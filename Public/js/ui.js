// Add event listener to the "Show Polygons" button
document.getElementById('toggle-polygons').addEventListener('click', togglePolygons);

// Add event listener to save button
document.getElementById('save-data').addEventListener('click', saveData);

// Add event listener to load history button
document.getElementById('load-history').addEventListener('click', loadHistory);

// Add event listener to clear all button
document.getElementById('clear-all-now').addEventListener('click', clearAllLocations);

// Add event listener to delete selected locations button
document.getElementById('delete-btn').addEventListener('click', deleteSelectedLocations);

// Add event listener to pin selected locations button
document.getElementById('pin-btn').addEventListener('click', () => pinSelectedLocations(1));  // Pin selected

// Add event listener to view path/row button
document.getElementById('view-path-btn').addEventListener('click', viewPathRow);  // View path/row for selected locations

// Function to toggle polygon visibility
function togglePolygons() {
    if (polygonsVisible) {
        // Hide polygons
        parsedKmlLayers.forEach(layer => {
            map.removeLayer(layer);
        });
        document.getElementById('toggle-polygons').textContent = 'Show Polygons';
        logToConsole('Polygons hidden.');
    } else {
        // Show polygons
        parsedKmlLayers.forEach(layer => {
            map.addLayer(layer);
        });
        document.getElementById('toggle-polygons').textContent = 'Hide Polygons';
        logToConsole('Polygons shown.');
    }
    polygonsVisible = !polygonsVisible;  // Toggle the visibility flag
}

// Function to save data via API
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

    // Iterate through each selected path/row combination and save it
    selectedData.forEach(data => {
        data.name = name;  // Add the custom name

        console.log('Saving data:', data);  // Log the data being sent for debugging

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

// Load and display the saved history (all saved lat/lng pairs)
function loadHistory() {
    fetch('/history')
        .then(response => response.json())
        .then(data => {
            const historyList = document.getElementById('history-list');
            historyList.innerHTML = '';  // Clear the existing list

            // Populate the list with saved lat/lng pairs
            data.forEach(entry => {
                const li = document.createElement('li');

                // Check if the item is pinned and append the 📌 emoji if pinned
                const pinnedSymbol = entry.pinned === 1 ? '📌 ' : '';

                li.innerHTML = `<input type="checkbox" class="history-checkbox" data-lat="${entry.latitude}" data-lng="${entry.longitude}"> 
                                ${pinnedSymbol}${entry.name} (Lat: ${entry.latitude}, Lng: ${entry.longitude})`;
                historyList.appendChild(li);
            });

            // Show or hide action buttons based on checkbox selections
            const checkboxes = document.querySelectorAll('.history-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', function() {
                    handleCheckboxChange();
                });
            });

            // Show "Clear All" button only if history exists
            document.getElementById('clear-all-now').style.display = data.length > 0 ? 'inline-block' : 'none';
        })
        .catch(error => {
            logToConsole(`Error loading history: ${error}`);
        });
}

// Function to handle checkbox changes
function handleCheckboxChange() {
    const checkboxes = document.querySelectorAll('.history-checkbox:checked');
    selectedLocations = Array.from(checkboxes).map(checkbox => ({
        latitude: checkbox.dataset.lat,
        longitude: checkbox.dataset.lng
    }));

    // Show or hide delete/pin buttons based on selections
    const showActionButtons = selectedLocations.length > 0;
    document.getElementById('delete-btn').style.display = showActionButtons ? 'inline-block' : 'none';
    document.getElementById('pin-btn').style.display = showActionButtons ? 'inline-block' : 'none';
    document.getElementById('view-path-btn').style.display = showActionButtons ? 'inline-block' : 'none'; // Show view path button
}

// Function to fetch path/row for selected locations
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

// Function to delete selected locations
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

// Function to pin/unpin selected locations
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
            loadHistory();  // Reload history
        })
        .catch(error => {
            logToConsole(`Error pinning/unpinning location: ${error}`);
        });
    });
}

// Function to clear all saved locations
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

// Custom logging function
function logToConsole(message) {
    const consoleBox = document.getElementById('console');
    consoleBox.innerHTML += message + '<br>';
    consoleBox.scrollTop = consoleBox.scrollHeight;
}
