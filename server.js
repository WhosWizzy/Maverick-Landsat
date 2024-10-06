const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
//const cloudCoverageRoutes = require('./routes/cloudCoverage.js');  // Import the cloud coverage routes

const app = express();
const port = 3000;


const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        return console.error('Error connecting to SQLite:', err.message);
    }
    console.log('Connected to SQLite database.');

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

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const USGS_API_URL = 'https://m2m.cr.usgs.gov/api/api/json/stable/scene-search';
let API_KEY = '';  // Obtain your API key from login-token

async function getApiKey() {
    try {
        const response = await axios.post('https://m2m.cr.usgs.gov/api/api/json/stable/login-token', {
            username: 'USENAME-HERE', 
            token: 'TOKEN-HERE' 
        });

        const apiKey = response.data.data;
        console.log('API Key received:', apiKey); 
        return apiKey; 
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
    { name: 'landsat_tm_c2_l1', label: 'Landsat 5 TM C2 L1' }  
];

app.post('/get-latest-cloud-coverage', async (req, res) => {
    const { lat, lon, startDate, endDate, cloudCoverageThreshold } = req.body;

    console.log('User clicked coordinates:', lat, lon);

    try {
        if (!API_KEY) {
            API_KEY = await getApiKey();
        }

        const boundingBoxOffset = 2.0;  

        let validResults = [];

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
                    startDate: "2018-01-01",  
                    endDate: endDate,
                },
                maxCloudCover: "80",  
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
                continue;  
            }

            const filteredResults = results.filter(scene => {
                const spatialBounds = scene.spatialBounds?.coordinates[0];
                return scene.cloudCover !== undefined && spatialBounds;  
            });

            validResults = [...validResults, ...filteredResults];  
        }

        if (validResults.length === 0) {
            console.log('No scenes found matching the clicked location across all datasets.');
            return res.status(404).json({ error: 'No scenes found matching the location across all datasets.' });
        }

        const sortedResults = validResults.sort((a, b) => new Date(b.temporalCoverage.startDate) - new Date(a.temporalCoverage.startDate));

        return res.json({
            scenes: sortedResults.map(scene => ({
                sceneId: scene.sceneId || 'undefined',
                acquisitionDate: scene.temporalCoverage?.startDate || 'undefined',
                cloudCover: scene.cloudCover !== null && scene.cloudCover !== undefined ? scene.cloudCover : 'Unavailable',  
                spatialBounds: scene.spatialBounds?.coordinates[0]  
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

const TLE_CACHE_FILE = path.join(__dirname, 'tle_cache.json');
const TLE_CACHE_DURATION = 4 * 60 * 60 * 1000; 
const TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=49260&FORMAT=tle';

// Got blocked which is why this was introduced
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

app.get('/tle', async (req, res) => {
    try {
        const cachedData = getCachedTLEData();
        if (cachedData) {
            return res.json(cachedData);
        }
        const tleData = await fetchTLEData();
        cacheTLEData(tleData);  
        res.json(tleData);     
    } catch (error) {
        console.error('Error processing /tle request:', error.message);
        res.status(500).json({ error: error.message });
    }
});
