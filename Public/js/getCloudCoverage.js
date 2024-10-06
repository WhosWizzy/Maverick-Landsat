async function getCloudCoverage(lat, lng, cloudThreshold, callback) {
    try {
        const response = await fetch('/cloud-coverage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                lat: lat,
                lng: lng,
                startDate: "2023-01-01",  // Example date, adjust as necessary
                endDate: "2023-12-31",
                cloudThreshold: cloudThreshold
            })
        });

        const data = await response.json();
        if (data.error) {
            callback(data.error);
        } else {
            callback(null, data); // Return the fetched data
        }
    } catch (error) {
        callback(error.message);
    }
}
