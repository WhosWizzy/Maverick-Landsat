const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

// Middleware to parse incoming JSON requests
app.use(express.json());

// Use CORS to handle cross-origin requests
app.use(cors());

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to get Path/Row from USGS tool
app.post('/get-path-row', async (req, res) => {
    const { latitude, longitude } = req.body;

    try {
        const pathRowData = await getPathRowForLocation(latitude, longitude);
        res.json(pathRowData);  // Send the Path/Row data back to the client
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Path/Row' });
    }
});

// Function to scrape Path/Row from USGS tool using Puppeteer
async function getPathRowForLocation(lat, lon) {
    const url = 'https://landsat.usgs.gov/landsat_acq#convertPathRow';  // Example URL

    // Launch Puppeteer
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    try {
        // Navigate to the USGS tool page
        await page.goto(url, { waitUntil: 'networkidle2' });
		console.log('Page loaded.');
		

        // Select the radio button to input latitude/longitude
		await page.waitForSelector('#llTOpr', { visible: true });
        await page.click('#llTOpr');

        // Enter latitude and longitude
        await page.type('#thelat', lat.toString());
        await page.type('#thelong', lon.toString());

        // Submit the form
		// Wait for the convert button to be visible
		await page.waitForSelector('#convert', { visible: true });
		console.log('Submitting form...');
        await page.click('#convert',);

        // Wait for the results table to appear
        console.log('Waiting for the results table...');
        await page.waitForSelector('#convertTable', { visible: true });
        console.log('Results table is visible.');

        // Add a delay to ensure everything is loaded
        console.log('Adding a delay to ensure the table is fully loaded...');
        //await page.waitForTimeout(3000);  // Wait for 3 seconds before extracting data		

        // Extract Path/Row data from the table
        const tableData = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#convertTableRows tr'));
            return rows.map(row => {
                const columns = row.querySelectorAll('td');
                return {
                    path: columns[0].innerText,
                    row: columns[1].innerText,
                    L8NextAcq: columns[4].innerText,
                    L9NextAcq: columns[5].innerText
                };
            })[0]; // Return the first result
        });

        if (tableData) {
            console.log(`Extracted Data: Path: ${tableData.path}, Row: ${tableData.row}`);
        } else {
            console.log('No data found in the table.');
        }
		
        await browser.close();
        return tableData;

    } catch (error) {
        console.error('Error during scraping:', error);
        await browser.close();
        throw error;
    }
}

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
