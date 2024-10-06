// Fetch latest TLE data from the server
function fetchLatestTLE(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/tle', true);  // Request TLE data from the server-side API
    xhr.onload = function() {
        if (xhr.status === 200) {
            var tleData = JSON.parse(xhr.responseText);
            callback(null, tleData);
        } else {
            callback('Failed to fetch TLE data');
        }
    };
    xhr.onerror = function() {
        callback('Error fetching TLE data');
    };
    xhr.send();
}

// Fetch TLE data from the server and calculate the overpass
function calculateOverpass(lat, lng, selectedDate, callback) {
    fetch('/tle')
        .then(response => response.json())
        .then(tleData => {
            // Use satellite.js to propagate the satellite's position
            const satrec = satellite.twoline2satrec(tleData.tleLine1, tleData.tleLine2);
            const observer = {
                latitude: lat,
                longitude: lng,
                height: 0  // Assuming observer is at sea level
            };

            // Parse the selected date into a Date object
            const selectedDateTime = new Date(selectedDate);

            // Loop to find the satellite overpass within the next 24 hours from the selected date
            let foundOverpass = false;
            for (let i = 0; i < 1440; i++) {  // Loop over 1440 minutes (24 hours)
                const futureTime = new Date(selectedDateTime.getTime() + i * 60 * 1000);  // Increment by 1 minute
                const positionAndVelocity = satellite.propagate(satrec, futureTime);
                const gmst = satellite.gstime(futureTime);
                const positionEcf = satellite.eciToEcf(positionAndVelocity.position, gmst);
                const lookAngles = satellite.ecfToLookAngles(observer, positionEcf);

                // Check if the satellite is above the horizon (elevation > 0)
                if (lookAngles.elevation > 0) {
                    foundOverpass = true;
                    const overpassResult = {
                        time: futureTime,
                        azimuth: lookAngles.azimuth.toFixed(2),
                        elevation: lookAngles.elevation.toFixed(2)
                    };
                    callback(null, overpassResult);  // Return the overpass result
                    return;
                }
            }

            // If no overpass is found, return an error message
            if (!foundOverpass) {
                callback('No overpass found for the selected day.');
            }
        })
        .catch(error => {
            console.error('Error fetching TLE data:', error);
            callback('Failed to fetch TLE data');
        });
}

