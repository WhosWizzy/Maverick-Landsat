// Function to save the grid data when the user clicks the Save button
function saveGridData() {
    const name = document.getElementById('location-name').value;
    if (!name) {
        logToConsole('Please enter a name for this location.');
        return;
    }

    // Iterate through each grid cell and save its metadata
    gridData.forEach(data => {
        data.name = name;  // Add the custom name

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
