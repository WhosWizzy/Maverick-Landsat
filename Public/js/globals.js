// Global variables to store the selected location data
let selectedData = [];
let selectedLocations = []; // For selected history locations (checkbox)
let parsedKmlLayers = [];
let polygonsVisible = false;  // By default, polygons are hidden
let gridData = []; // Store grid data for the 3x3 grid
let gridLayerGroup = L.layerGroup();  // Initialize the LayerGroup