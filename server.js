const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware to parse JSON requests
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
let db = new sqlite3.Database('./coordinates.db', (err) => {
    if (err) {
        console.error('Error opening database: ' + err.message);
    } else {
        console.log('Connected to SQLite database.');
        db.run(`
            CREATE TABLE IF NOT EXISTS coordinates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                latitude REAL,
                longitude REAL,
                path INTEGER,
                row INTEGER
            )
        `);
    }
});

// API to save lat/lng/path/row data to SQLite
app.post('/save-data', (req, res) => {
    const { latitude, longitude, path, row } = req.body;
    
    if (!latitude || !longitude || !path || !row) {
        return res.status(400).json({ error: 'Missing data fields.' });
    }

    // Insert data into the SQLite database
    const query = `INSERT INTO coordinates (latitude, longitude, path, row) VALUES (?, ?, ?, ?)`;
    db.run(query, [latitude, longitude, path, row], function (err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to save data.' });
        }
        res.json({ success: true, id: this.lastID });
    });
});

// API to get all distinct latitude/longitude pairs (for the history view)
app.get('/history', (req, res) => {
    const query = `SELECT DISTINCT latitude, longitude FROM coordinates`;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to retrieve history.' });
        }
        res.json(rows);  // Send back all distinct lat/lng pairs
    });
});

// API to get all path/row pairs for a given latitude/longitude
app.post('/get-path-row', (req, res) => {
    const { latitude, longitude } = req.body;

    const query = `SELECT path, row FROM coordinates WHERE latitude = ? AND longitude = ?`;
    db.all(query, [latitude, longitude], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to retrieve path/row data.' });
        }
        res.json(rows);  // Send back all path/row combinations for the given lat/lng
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
