// Display appropriate input based on the notification method
document.getElementById('notification-method').addEventListener('change', function() {
    const method = this.value;
    const contactInfoDiv = document.getElementById('contact-info');
    contactInfoDiv.innerHTML = ''; // Clear previous inputs

    if (method === 'email') {
        contactInfoDiv.innerHTML = `
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" placeholder="Enter your email">
        `;
    } else if (method === 'sms') {
        contactInfoDiv.innerHTML = `
            <label for="phone">Phone number:</label>
            <input type="tel" id="phone" name="phone" placeholder="Enter your phone number">
        `;
    }
});

// Function to set notification
function setNotification() {
    // Get selected lead time
    const leadTime = document.getElementById('lead-time').value;

    // Get selected notification method
    const notificationMethod = document.getElementById('notification-method').value;
    let contactInfo = '';

    if (notificationMethod === 'email') {
        contactInfo = document.getElementById('email').value;
    } else if (notificationMethod === 'sms') {
        contactInfo = document.getElementById('phone').value;
    }

    // Ensure contact info is provided
    if (!contactInfo) {
        alert('Please provide valid contact information.');
        return;
    }

    // Get the overpass prediction from the last clicked location
    const selectedDate = document.getElementById('overpass-date').value;
    if (!lastClickedLat || !lastClickedLng || !selectedDate) {
        alert('Please select a location and a date for the overpass prediction.');
        return;
    }

    // Call the function to calculate overpass and set notification
    calculateOverpass(lastClickedLat, lastClickedLng, selectedDate, function(err, overpass) {
        if (err) {
            document.getElementById('notification-result').innerHTML = 'Error: ' + err;
            return;
        }

        // Calculate notification time based on the lead time
        const notificationTime = new Date(overpass.time.getTime() - leadTime * 60 * 1000);

        // Display confirmation
        const message = `
            Notification set for: ${notificationTime.toUTCString()}<br>
            Notification method: ${notificationMethod}<br>
            Contact: ${contactInfo}
        `;
        document.getElementById('notification-result').innerHTML = message;

        // Send the notification schedule request to the server
        scheduleNotification(overpass.time, notificationTime, notificationMethod, contactInfo);
    });
}

// Function to schedule the notification (calls the server)
function scheduleNotification(overpassTime, notificationTime, method, contactInfo) {
    fetch('/schedule-notification', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            overpassTime: overpassTime,
            notificationTime: notificationTime,
            method: method,
            contactInfo: contactInfo
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Notification scheduled successfully');
        } else {
            console.error('Failed to schedule notification:', data.error);
        }
    })
    .catch(error => {
        console.error('Error scheduling notification:', error);
    });
}
