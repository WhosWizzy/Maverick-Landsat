const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
//const cloudCoverageRoutes = require('./routes/cloudCoverage.js');  // Import the cloud coverage routes

const app = express();
const port = 3000;


// SQLite database initialization
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        return console.error('Error connecting to SQLite:', err.message);
    }
    console.log('Connected to SQLite database.');

    // Initialize your table for coordinates
    db.run(`
        CREATE TABLE IF NOT EXISTS coordinates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            latitude REAL,
            longitude REAL,
            path TEXT,
            row TEXT,
            name TEXT,
            pinned INTEGER DEFAULT 0
        )
    `, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('Table for coordinates created.');
        }
    });
});

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// USGS M2M API details
const USGS_API_URL = 'https://m2m.cr.usgs.gov/api/api/json/stable/scene-search';
let API_KEY = '';  // Obtain your API key from login-token
//const TOKEN = `SuRHkKw8keDfkrdsB4csQlxVvc7mALGNfb5wvlGa1jGrK7HV4HC!g_k@JVRVFSvK`;

// Function to get API key using login-token endpoint
async function getApiKey() {
    try {
        const response = await axios.post('https://m2m.cr.usgs.gov/api/api/json/stable/login-token', {
            username: 'WhosWizzy',   // Replace with your USGS username
            token: 'SuRHkKw8keDfkrdsB4csQlxVvc7mALGNfb5wvlGa1jGrK7HV4HC!g_k@JVRVFSvK' 
        });

        // Retrieve the API key from the response
        const apiKey = response.data.data;
        console.log('API Key received:', apiKey);  // Log the API key
        return apiKey;  // Return the API key to use it in subsequent requests
    } catch (error) {
        console.error('Error fetching API key:', error.response ? error.response.data : error.message);
        throw new Error('Failed to retrieve API key');
    }
}

const insidePolygon = (lat, lon, polygon) => {
    const x = lon, y = lat;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];

        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

const datasets = [
    { name: 'landsat_ot_c2_l1', label: 'Landsat 8-9 OLI/TIRS C2 L1' },
    { name: 'landsat_tm_c2_l1', label: 'Landsat 5 TM C2 L1' }  // Add Landsat 5 for historical data if needed
];

app.post('/get-latest-cloud-coverage', async (req, res) => {
    const { lat, lon, startDate, endDate, cloudCoverageThreshold } = req.body;

    console.log('User clicked coordinates:', lat, lon);

    try {
        if (!API_KEY) {
            API_KEY = await getApiKey();
        }

        const boundingBoxOffset = 2.0;  // Broaden the bounding box to increase the area searched

        let validResults = [];

        // Query each dataset and aggregate results
        for (const dataset of datasets) {
            const payload = {
                datasetName: dataset.name,
                spatialFilter: {
                    filterType: 'mbr',
                    lowerLeft: {
                        latitude: lat - boundingBoxOffset,
                        longitude: lon - boundingBoxOffset,
                    },
                    upperRight: {
                        latitude: lat + boundingBoxOffset,
                        longitude: lon + boundingBoxOffset,
                    },
                },
                temporalFilter: {
                    startDate: "2018-01-01",  // Broaden the temporal filter
                    endDate: endDate,
                },
                maxCloudCover: "80",  // Increase cloud cover threshold to allow more scenes
            };

            console.log(`Payload being sent to USGS API for ${dataset.label}:`, JSON.stringify(payload, null, 2));

            const response = await axios.post(USGS_API_URL, payload, {
                headers: {
                    'X-Auth-Token': API_KEY
                }
            });

            const results = response.data.data.results;

            if (!results || results.length === 0) {
                console.log(`No results found for dataset: ${dataset.label}`);
                continue;  // Skip to the next dataset if no results are found
            }

            // Collect all valid scenes
            const filteredResults = results.filter(scene => {
                const spatialBounds = scene.spatialBounds?.coordinates[0];
                return scene.cloudCover !== undefined && spatialBounds;  // Ensure we have valid cloud cover and spatial bounds
            });

            validResults = [...validResults, ...filteredResults];  // Combine results from different datasets
        }

        if (validResults.length === 0) {
            console.log('No scenes found matching the clicked location across all datasets.');
            return res.status(404).json({ error: 'No scenes found matching the location across all datasets.' });
        }

        // Sort by acquisition date (or temporalCoverage.startDate) in descending order (latest first)
        const sortedResults = validResults.sort((a, b) => new Date(b.temporalCoverage.startDate) - new Date(a.temporalCoverage.startDate));

        // Send scene details with spatial bounds to the client for visualization
        return res.json({
            scenes: sortedResults.map(scene => ({
                sceneId: scene.sceneId || 'undefined',
                acquisitionDate: scene.temporalCoverage?.startDate || 'undefined',
                cloudCover: scene.cloudCover !== null && scene.cloudCover !== undefined ? scene.cloudCover : 'Unavailable',  // Gracefully handle missing cloud cover
                spatialBounds: scene.spatialBounds?.coordinates[0]  // Return the spatial bounds for visualization
            }))
        });

    } catch (error) {
        console.error('Error fetching cloud coverage:', error.response ? error.response.data : error.message);
        return res.status(500).json({ error: 'Failed to retrieve cloud coverage data' });
    }
});


// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
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
const TLE_CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
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
