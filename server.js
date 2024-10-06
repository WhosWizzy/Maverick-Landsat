const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

// Middleware to parse JSON requests
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database with name and pinned column
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
                row INTEGER,
                name TEXT,
                pinned INTEGER DEFAULT 0
            )
        `);
    }
});

// API to save lat/lng/path/row data with a custom name to SQLite
app.post('/save-data', (req, res) => {
    const { latitude, longitude, path, row, name } = req.body;
    
    if (!latitude || !longitude || !path || !row || !name) {
        return res.status(400).json({ error: 'Missing data fields.' });
    }

    // Insert data into the SQLite database
    const query = `INSERT INTO coordinates (latitude, longitude, path, row, name) VALUES (?, ?, ?, ?, ?)`;
    db.run(query, [latitude, longitude, path, row, name], function (err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to save data.' });
        }
        res.json({ success: true, id: this.lastID });
    });
});

// API to get all distinct latitude/longitude pairs, ordered by pinned status and id
app.get('/history', (req, res) => {
    const query = `SELECT DISTINCT latitude, longitude, name, pinned FROM coordinates ORDER BY pinned DESC, id DESC`;

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

// API to delete specific latitude/longitude pair
app.post('/delete-location', (req, res) => {
    const { latitude, longitude } = req.body;

    const query = `DELETE FROM coordinates WHERE latitude = ? AND longitude = ?`;
    db.run(query, [latitude, longitude], function (err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete location.' });
        }
        res.json({ success: true });
    });
});

// API to clear all saved locations
app.post('/clear-all', (req, res) => {
    const query = `DELETE FROM coordinates`;
    db.run(query, [], function (err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete all locations.' });
        }
        res.json({ success: true });
    });
});

// API to pin or unpin a location
app.post('/pin-location', (req, res) => {
    const { latitude, longitude, pinStatus } = req.body;

    const query = `UPDATE coordinates SET pinned = ? WHERE latitude = ? AND longitude = ?`;
    db.run(query, [pinStatus, latitude, longitude], function (err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to pin/unpin location.' });
        }
        res.json({ success: true });
    });
});

// Define the cache file location and cache duration (2 hours)
const TLE_CACHE_FILE = path.join(__dirname, 'tle_cache.json');
const TLE_CACHE_DURATION = 4 * 60 * 60 * 1000; // 2 hours in milliseconds
const TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=49260&FORMAT=tle';

// Function to fetch TLE data from Celestrak
async function fetchTLEData() {
    try {
        const response = await axios.get(TLE_URL);
        const tleLines = response.data.split('\n');
        const tleLine1 = tleLines[1].trim();
        const tleLine2 = tleLines[2].trim();
        return { tleLine1, tleLine2 };
    } catch (error) {
        console.error('Error fetching TLE data from Celestrak:', error.message);
        throw new Error('Failed to fetch TLE data from Celestrak');
    }
}

// Function to get cached TLE data from file
function getCachedTLEData() {
    try {
        if (fs.existsSync(TLE_CACHE_FILE)) {
            const cacheContent = fs.readFileSync(TLE_CACHE_FILE, 'utf8');
            const cacheData = JSON.parse(cacheContent);
            const now = Date.now();
            
            // Check if cache is still valid
            if ((now - cacheData.cacheTime) < TLE_CACHE_DURATION) {
                console.log('Serving TLE data from file cache');
                return cacheData.tleData;
            }
        }
        return null;  // No valid cache found
    } catch (error) {
        console.error('Error reading TLE cache file:', error.message);
        throw new Error('Failed to read cached TLE data');
    }
}

// Function to save TLE data to cache file
function cacheTLEData(tleData) {
    try {
        const now = Date.now();
        const cacheData = {
            tleData: tleData,
            cacheTime: now
        };
        fs.writeFileSync(TLE_CACHE_FILE, JSON.stringify(cacheData), 'utf8');
        console.log('TLE data cached to file');
    } catch (error) {
        console.error('Error writing TLE cache file:', error.message);
        throw new Error('Failed to cache TLE data');
    }
}

// API to get TLE data (with file-based caching)
app.get('/tle', async (req, res) => {
    try {
        // First, try to get cached TLE data from the file
        const cachedData = getCachedTLEData();
        if (cachedData) {
            return res.json(cachedData);  // Serve cached TLE data
        }

        // If no valid cache, fetch fresh data from Celestrak
        const tleData = await fetchTLEData();
        cacheTLEData(tleData);  // Cache the fetched data to file
        res.json(tleData);      // Serve the fresh data
    } catch (error) {
        console.error('Error processing /tle request:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
