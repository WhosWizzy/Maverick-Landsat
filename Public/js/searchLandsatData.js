async function searchLandsatData(latitude, longitude, maxCloudCover, startDate = null, endDate = null) {
    try {
        const requestBody = {
            datasetName: 'LANDSAT_8_C1',
            spatialFilter: {
                filterType: 'mbr',
                lowerLeft: { latitude: latitude - 0.05, longitude: longitude - 0.05 },
                upperRight: { latitude: latitude + 0.05, longitude: longitude + 0.05 }
            },
            additionalCriteria: {
                cloudCover: { max: parseFloat(maxCloudCover) }
            },
            maxResults: 10,
            sortOrder: 'DESC'
        };

        // Add temporal filter if user specified custom date range
        if (startDate && endDate) {
            requestBody.temporalFilter = {
                startDate: startDate,
                endDate: endDate
            };
        }

        const response = await fetch('https://m2m.cr.usgs.gov/api/api/json/stable/scene-search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': USGS_API_TOKEN  // Use your valid token
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        if (data.error) {
            console.error('Error fetching data:', data.errorMessage);
            alert('Error fetching data: ' + data.errorMessage);
        } else {
            displayResults(data.data.results);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error fetching Landsat data.');
    }
}

// Function to display search results
function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';  // Clear previous results

    if (results.length === 0) {
        resultsDiv.innerHTML = '<p>No scenes found matching the criteria.</p>';
        return;
    }

    results.forEach(scene => {
        const sceneDiv = document.createElement('div');
        sceneDiv.innerHTML = `
            <h3>Scene ID: ${scene.entityId}</h3>
            <p>Cloud Cover: ${scene.cloudCover}%</p>
            <p>Date Acquired: ${scene.acquisitionDate}</p>
        `;
        resultsDiv.appendChild(sceneDiv);
    });
}
