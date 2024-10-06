function fetchLatestTLE(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/tle', true); 
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

function calculateOverpass(lat, lng, selectedDate, callback) {
    fetch('/tle')
        .then(response => response.json())
        .then(tleData => {
            const satrec = satellite.twoline2satrec(tleData.tleLine1, tleData.tleLine2);
            const observer = {
                latitude: lat,
                longitude: lng,
                height: 0  
            };

            const selectedDateTime = new Date(selectedDate);

            let foundOverpass = false;
            for (let i = 0; i < 1440; i++) {  
                const futureTime = new Date(selectedDateTime.getTime() + i * 60 * 1000); 
                const positionAndVelocity = satellite.propagate(satrec, futureTime);
                const gmst = satellite.gstime(futureTime);
                const positionEcf = satellite.eciToEcf(positionAndVelocity.position, gmst);
                const lookAngles = satellite.ecfToLookAngles(observer, positionEcf);

                if (lookAngles.elevation > 0) {
                    foundOverpass = true;
                    const overpassResult = {
                        time: futureTime,
                        azimuth: lookAngles.azimuth.toFixed(2),
                        elevation: lookAngles.elevation.toFixed(2)
                    };
                    callback(null, overpassResult);
                    return;
                }
            }
            if (!foundOverpass) {
                callback('No overpass found for the selected day.');
            }
        })
        .catch(error => {
            console.error('Error fetching TLE data:', error);
            callback('Failed to fetch TLE data');
        });
}
