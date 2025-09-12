document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const queryConditions = document.getElementById('queryConditions');
    const addConditionBtn = document.getElementById('addCondition');
    const generateQueryBtn = document.getElementById('generateQuery');
    const queryOutput = document.getElementById('queryOutput');
    const copyQueryBtn = document.getElementById('copyQuery');
    const openInOverpassTurbo = document.getElementById('openInOverpassTurbo');
    const openInOverpassUltra = document.getElementById('openInOverpassUltra');
    const useMyLocationBtn = document.getElementById('useMyLocation');
    const showBboxOnMapBtn = document.getElementById('showBboxOnMap');
    const clearBboxBtn = document.getElementById('clearBbox');
    const addExampleBtn = document.getElementById('addExample');
    const placeSearchInput = document.getElementById('placeSearch');
    const searchPlaceBtn = document.getElementById('searchPlace');
    const searchResultsContainer = document.getElementById('searchResults');
    const searchResultsList = document.querySelector('.search-results-list');
    const bboxAreaSpan = document.getElementById('bboxArea');
    const timeoutSelect = document.getElementById('timeout');
    const exportCSVBtn = document.getElementById('exportCSV');
    const exportJSONBtn = document.getElementById('exportJSON');
    const exportGeoJSONBtn = document.getElementById('exportGeoJSON');
    
    // State
    let lastQueryResult = null;
    
    // Bounding box inputs
    const bboxInputs = {
        south: document.getElementById('south'),
        west: document.getElementById('west'),
        north: document.getElementById('north'),
        east: document.getElementById('east')
    };

    // Calculate area of the current bbox in km²
    function calculateBboxArea() {
        const south = parseFloat(bboxInputs.south.value);
        const north = parseFloat(bboxInputs.north.value);
        const west = parseFloat(bboxInputs.west.value);
        const east = parseFloat(bboxInputs.east.value);
        
        if (isNaN(south) || isNaN(north) || isNaN(west) || isNaN(east)) {
            bboxAreaSpan.textContent = '';
            return 0;
        }
        
        // Simple approximation for small areas (not accounting for Earth's curvature)
        const latDiff = Math.abs(north - south);
        const lonDiff = Math.abs(east - west);
        const latMid = (south + north) / 2;
        
        // Convert degrees to km (approximate)
        const latKm = latDiff * 110.574;  // 1° latitude ≈ 110.574 km
        const lonKm = lonDiff * (111.320 * Math.cos(latMid * Math.PI / 180));  // 1° longitude varies with latitude
        
        const areaKm2 = latKm * lonKm;
        
        if (areaKm2 < 1) {
            const areaM2 = Math.round(areaKm2 * 1e6);
            bboxAreaSpan.textContent = `Area: ${areaM2.toLocaleString()} m²`;
        } else if (areaKm2 < 0.1) {
            bboxAreaSpan.textContent = `Area: ${(areaKm2 * 100).toFixed(0)} m²`;
        } else if (areaKm2 < 100) {
            bboxAreaSpan.textContent = `Area: ${areaKm2.toFixed(2)} km²`;
        } else if (areaKm2 < 10000) {
            bboxAreaSpan.textContent = `Area: ${Math.round(areaKm2)} km²`;
        } else {
            bboxAreaSpan.textContent = `Area: ${(areaKm2 / 1000).toFixed(1)}k km²`;
        }
        
        return areaKm2;
    }
    
    // Clear all bbox inputs and reset search
    function clearBbox() {
        // Clear bbox inputs
        Object.values(bboxInputs).forEach(input => {
            input.value = '';
        });
        
        // Clear the search input
        placeSearchInput.value = '';
        
        // Clear area display
        bboxAreaSpan.textContent = '';
        
        // Generate query with default bbox
        generateQuery();
    }
    
    // Set bbox from coordinates
    function setBbox(south, west, north, east) {
        bboxInputs.south.value = south.toFixed(6);
        bboxInputs.west.value = west.toFixed(6);
        bboxInputs.north.value = north.toFixed(6);
        bboxInputs.east.value = east.toFixed(6);
        calculateBboxArea();
        generateQuery();
    }
    
    // Search for a place using Nominatim
    async function searchPlace(query) {
        if (!query.trim()) {
            showToast('Please enter a place name to search', 'warning');
            return;
        }
        
        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=50`;
            const response = await fetch(url);
            let results = await response.json();
            
            if (results.length === 0) {
                showToast('No results found', 'info');
                return;
            }
            
            // Filter to get unique main keys (city, village, town, etc.)
            const uniqueResults = [];
            const seenTypes = new Set();
            
            // First pass: Get one result per main type
            for (const result of results) {
                const type = result.type || 'place';
                if (!seenTypes.has(type)) {
                    seenTypes.add(type);
                    uniqueResults.push(result);
                    if (uniqueResults.length >= 10) break;
                }
            }
            
            // If we don't have 10 unique types, fill with remaining results
            if (uniqueResults.length < 10) {
                for (const result of results) {
                    if (!uniqueResults.includes(result)) {
                        uniqueResults.push(result);
                        if (uniqueResults.length >= 10) break;
                    }
                }
            }
            
            results = uniqueResults.slice(0, 10);
            
            // Display results
            searchResultsList.innerHTML = '';
            results.forEach(result => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'list-group-item list-group-item-action';
                
                let displayName = result.display_name;
                if (displayName.length > 60) {
                    displayName = displayName.substring(0, 60) + '...';
                }
                
                item.innerHTML = `
                    <div class="d-flex w-100 justify-content-between align-items-start">
                        <div>
                            <div class="d-flex align-items-center gap-2 mb-1">
                                <h6 class="mb-0">${result.display_name.split(',')[0]}</h6>
                                <span class="badge bg-secondary">${result.type}</span>
                            </div>
                            <p class="mb-1 small text-muted">${displayName}</p>
                            <div class="d-flex gap-2 mt-2">
                                <span class="badge bg-primary">
                                    <i class="bi bi-bounding-box"></i> Click to use Bounding Box
                                </span>
                                <span class="badge bg-success">
                                    <i class="bi bi-signpost"></i> Shift+Click to use Area Name
                                </span>
                            </div>
                        </div>
                        <div class="text-muted small text-end">
                            <div>Lat: ${parseFloat(result.lat).toFixed(4)}</div>
                            <div>Lon: ${parseFloat(result.lon).toFixed(4)}</div>
                        </div>
                    </div>
                `;
                
                item.addEventListener('click', async (e) => {
                    if (e.shiftKey || e.ctrlKey) {
                        // If shift or ctrl is pressed, just use the area name in the query
                        placeSearchInput.value = result.display_name.split(',')[0];
                        searchResultsContainer.classList.add('d-none');
                        
                        // Clear bbox to indicate we're using area name
                        document.getElementById('south').value = '';
                        document.getElementById('west').value = '';
                        document.getElementById('north').value = '';
                        document.getElementById('east').value = '';
                        
                        // Update the bbox area display
                        bboxAreaSpan.textContent = 'Using area name: ' + result.display_name.split(',')[0];
                        
                        // Generate the query with the area name
                        generateQuery();
                        
                        showToast(`Using area name: ${result.display_name.split(',')[0]}`, 'success');
                    } else {
                        // Normal click - use bbox
                        if (result.boundingbox && result.boundingbox.length === 4) {
                            // Use the bounding box from the result
                            setBbox(
                                parseFloat(result.boundingbox[0]), // south
                                parseFloat(result.boundingbox[2]), // west
                                parseFloat(result.boundingbox[1]), // north
                                parseFloat(result.boundingbox[3])  // east
                            );
                        } else {
                            // Fallback to a small area around the point
                            const lat = parseFloat(result.lat);
                            const lon = parseFloat(result.lon);
                            const delta = 0.02; // ~2km radius
                            
                            setBbox(
                                lat - delta,
                                lon - delta,
                                lat + delta,
                                lon + delta
                            );
                        }
                        
                        // Close results
                        searchResultsContainer.classList.add('d-none');
                        placeSearchInput.value = result.display_name.split(',')[0];
                        
                        // Show toast with the area size
                        const area = calculateBboxArea();
                        showToast(`Set bounding box for ${result.display_name.split(',')[0]} (${area.toFixed(2)} km²). Hold Shift+Click to use area name instead.`, 'success');
                    }
                });
                
                searchResultsList.appendChild(item);
            });
            
            searchResultsContainer.classList.remove('d-none');
        } catch (error) {
            console.error('Error searching for place:', error);
            showToast('Error searching for place. Please try again.', 'danger');
        }
    }
    
    // Show bbox on a map
    function showBboxOnMap() {
        const south = parseFloat(bboxInputs.south.value);
        const west = parseFloat(bboxInputs.west.value);
        const north = parseFloat(bboxInputs.north.value);
        const east = parseFloat(bboxInputs.east.value);
        
        if (isNaN(south) || isNaN(west) || isNaN(north) || isNaN(east)) {
            showToast('Please set a valid bounding box first', 'warning');
            return;
        }
        
        // Calculate zoom level based on bbox size
        const latDiff = Math.abs(north - south);
        const lonDiff = Math.abs(east - west);
        const maxDiff = Math.max(latDiff, lonDiff);
        
        // Calculate zoom level (empirically determined)
        let zoom = Math.floor(Math.log2(360 / maxDiff));
        zoom = Math.min(Math.max(zoom, 10), 18); // Clamp zoom between 10 and 18
        
        // Calculate center of the bbox
        const centerLat = (south + north) / 2;
        const centerLon = (west + east) / 2;
        
        // Create a bbox string for the URL
        const bboxString = `${west},${south},${east},${north}`;
        
        // Open in a new tab with a map showing the bbox
        const url = `https://www.openstreetmap.org/?mlat=${centerLat}&mlon=${centerLon}&zoom=${zoom}&bbox=${bboxString}`;
        window.open(url, '_blank');
    }
    
    // Export data to various formats
    async function exportData(format) {
        if (!lastQueryResult) {
            showToast('No query results to export', 'warning');
            return;
        }
        
        try {
            // Execute the query to get the data
            showToast('Fetching data from Overpass API...', 'info');
            
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `data=${encodeURIComponent(lastQueryResult.query)}`
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.elements || data.elements.length === 0) {
                showToast('No data found for the current query', 'info');
                return;
            }
            
            let content, mimeType, extension;
            
            switch (format) {
                case 'csv':
                    content = convertToCSV(data.elements);
                    mimeType = 'text/csv';
                    extension = 'csv';
                    break;
                    
                case 'json':
                    content = JSON.stringify(data.elements, null, 2);
                    mimeType = 'application/json';
                    extension = 'json';
                    break;
                    
                case 'geojson':
                    content = convertToGeoJSON(data.elements);
                    mimeType = 'application/geo+json';
                    extension = 'geojson';
                    break;
                    
                default:
                    throw new Error('Unsupported export format');
            }
            
            // Create a download link
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `overpass-export-${new Date().toISOString().slice(0, 10)}.${extension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast(`Exported ${data.elements.length} features as ${format.toUpperCase()}`, 'success');
            
        } catch (error) {
            console.error('Export error:', error);
            showToast(`Export failed: ${error.message}`, 'danger');
        }
    }
    
    // Convert Overpass elements to CSV
    function convertToCSV(elements) {
        if (!elements.length) return '';
        
        // Collect all possible keys
        const allKeys = new Set();
        elements.forEach(element => {
            if (element.tags) {
                Object.keys(element.tags).forEach(key => allKeys.add(key));
            }
        });
        
        // Create header row
        const headers = ['id', 'type', 'lat', 'lon', ...Array.from(allKeys)];
        
        // Create CSV rows
        const rows = elements.map(element => {
            const row = [
                element.id,
                element.type,
                element.lat || '',
                element.lon || ''
            ];
            
            // Add tag values in the same order as headers
            headers.slice(4).forEach(key => {
                row.push(element.tags && element.tags[key] !== undefined ? 
                    `"${String(element.tags[key]).replace(/"/g, '""')}"` : '');
            });
            
            return row.join(',');
        });
        
        return [headers.join(','), ...rows].join('\n');
    }
    
    // Convert Overpass elements to GeoJSON
    function convertToGeoJSON(elements) {
        const features = elements.map(element => {
            let geometry = null;
            
            if (element.lat !== undefined && element.lon !== undefined) {
                // Node
                geometry = {
                    type: 'Point',
                    coordinates: [parseFloat(element.lon), parseFloat(element.lat)]
                };
            } else if (element.geometry) {
                // Way or relation with geometry
                if (element.geometry.length > 1) {
                    // Check if it's a closed way (polygon)
                    const first = element.geometry[0];
                    const last = element.geometry[element.geometry.length - 1];
                    const isClosed = first.lat === last.lat && first.lon === last.lon;
                    
                    if (isClosed && element.geometry.length >= 4) {
                        // Polygon
                        geometry = {
                            type: 'Polygon',
                            coordinates: [element.geometry.map(coord => [
                                parseFloat(coord.lon),
                                parseFloat(coord.lat)
                            ])]
                        };
                    } else {
                        // LineString
                        geometry = {
                            type: 'LineString',
                            coordinates: element.geometry.map(coord => [
                                parseFloat(coord.lon),
                                parseFloat(coord.lat)
                            ])
                        };
                    }
                } else if (element.geometry.length === 1) {
                    // Single point
                    geometry = {
                        type: 'Point',
                        coordinates: [
                            parseFloat(element.geometry[0].lon),
                            parseFloat(element.geometry[0].lat)
                        ]
                    };
                }
            }
            
            if (!geometry) {
                // Fallback to point at 0,0 if no geometry
                geometry = { type: 'Point', coordinates: [0, 0] };
            }
            
            // Create properties object
            const properties = { ...element.tags };
            properties.id = element.id;
            properties.type = element.type;
            
            return {
                type: 'Feature',
                properties,
                geometry
            };
        });
        
        return JSON.stringify({
            type: 'FeatureCollection',
            features
        }, null, 2);
    }
    
    // Add a new condition row
    function addCondition(condition = {}) {
        const conditionId = Date.now();
        const conditionHtml = `
            <div class="condition-group fade-in" id="condition-${conditionId}">
                <div class="row g-3">
                    <div class="col-md-3">
                        <label class="form-label small text-muted mb-1 d-block">Element Type</label>
                        <select class="form-select element-type">
                            <option value="node" ${condition.elementType === 'node' ? 'selected' : ''}>Node</option>
                            <option value="way" ${condition.elementType === 'way' ? 'selected' : ''}>Way</option>
                            <option value="relation" ${condition.elementType === 'relation' ? 'selected' : ''}>Relation</option>
                            <option value="nwr" ${!condition.elementType || condition.elementType === 'nwr' ? 'selected' : ''}>Node/Way/Relation</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label small text-muted mb-1 d-block">Key</label>
                        <div class="autocomplete">
                            <input type="text" class="form-control key" placeholder="e.g., amenity, shop" value="${condition.key || ''}" autocomplete="off">
                            <div class="autocomplete-items"></div>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label small text-muted mb-1 d-block">Operator</label>
                        <select class="form-select operator">
                            <option value="=" ${condition.operator === '=' ? 'selected' : ''}>=</option>
                            <option value="!=" ${condition.operator === '!=' ? 'selected' : ''}>≠</option>
                            <option value="~" ${condition.operator === '~' ? 'selected' : ''}>~</option>
                            <option value="!~" ${condition.operator === '!~' ? 'selected' : ''}>!~</option>
                            <option value="^~" ${condition.operator === '^~' ? 'selected' : ''}>^~</option>
                            <option value="!^~" ${condition.operator === '!^~' ? 'selected' : ''}>!^~</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label small text-muted mb-1 d-block">Value</label>
                        <div class="autocomplete">
                            <input type="text" class="form-control value" placeholder="e.g., restaurant, cafe" value="${condition.value || ''}" autocomplete="off">
                            <div class="autocomplete-items"></div>
                        </div>
                    </div>
                    <div class="col-md-1 d-flex align-items-end">
                        <button type="button" class="btn btn-outline-danger btn-sm remove-condition">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
            </div>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = conditionHtml.trim();
        const newCondition = tempDiv.firstChild;
        
        queryConditions.appendChild(newCondition);
        
        // Add event listener to the remove button
        newCondition.querySelector('.remove-condition').addEventListener('click', function() {
            newCondition.classList.add('fade-out');
            setTimeout(() => {
                newCondition.remove();
                generateQuery(); // Update query when a condition is removed
            }, 300);
        });
        
        return newCondition;
    }

    // Get current timeout value in seconds
    function getTimeout() {
        const timeout = parseInt(timeoutSelect.value, 10);
        return isNaN(timeout) || timeout < 1 ? 30 : Math.min(timeout, 1800);
    }
    
    function generateQuery() {
        // Get all condition elements
        const conditionElements = document.querySelectorAll('.condition-group');
        
        if (conditionElements.length === 0) {
            queryOutput.textContent = '// Add at least one condition to generate a query';
            return;
        }
        
        // Get area name from search input if bbox is empty
        const areaName = placeSearchInput.value.trim();
        const hasAreaName = areaName !== '';
        
        // Get bounding box values
        const bbox = {
            south: bboxInputs.south.value,
            west: bboxInputs.west.value,
            north: bboxInputs.north.value,
            east: bboxInputs.east.value
        };
        
        // Check if all bbox values are filled
        const hasBbox = Object.values(bbox).every(val => val !== '');
        
        // Get timeout value
        const timeout = getTimeout();
        
        // If no bbox and no area name, use default bbox
        if (!hasBbox && !hasAreaName) {
            // This will use the default {{bbox}} in the query
        } 
        // If bbox is provided, validate it
        else if (hasBbox) {
            const bboxValues = Object.values(bbox).map(Number);
            const isValidBbox = bboxValues.every(val => !isNaN(val)) && 
                              bboxValues[0] < bboxValues[2] && 
                              bboxValues[1] < bboxValues[3];
            
            if (!isValidBbox) {
                queryOutput.textContent = '// Error: Invalid bounding box coordinates. Please check your values.';
                return;
            }
        }
        
        // Process each condition
        const conditions = Array.from(conditionElements).map(condEl => {
            const elementType = condEl.querySelector('.element-type').value;
            const key = condEl.querySelector('.key').value.trim();
            const operator = condEl.querySelector('.operator').value;
            const value = condEl.querySelector('.value').value.trim();
            
            if (!key) return null;
            
            // For empty values, just use the key without operator or value
            if (value === '') {
                return { 
                    elementType, 
                    condition: `[\"${key}\"]` 
                };
            }
            
            // For regex or other operators, use the appropriate syntax
            if (operator === '~' || operator === '!~' || operator === '~^' || operator === '!~^') {
                return { 
                    elementType, 
                    condition: `[\"${key}\"${operator}\"${value}\"]` 
                };
            } else {
                return { 
                    elementType, 
                    condition: `[\"${key}\"${operator}\"${value}\"]` 
                };
            }
        }).filter(Boolean);
        
        if (conditions.length === 0) {
            queryOutput.textContent = '// Add at least one valid condition to generate a query';
            return;
        }
        
        // Group conditions by element type
        const conditionsByType = {};
        conditions.forEach(cond => {
            if (!conditionsByType[cond.elementType]) {
                conditionsByType[cond.elementType] = [];
            }
            conditionsByType[cond.elementType].push(cond.condition);
        });
        
        // Build the query
        let query = '';
        // Add settings first (Overpass Ultra is picky about this)
        query += `[out:json][timeout:${timeout}];\n`;
        
        const queries = [];
        
        // Helper function to build query parts
        const buildQueryPart = (elementType, conditions) => {
            if (hasAreaName && !hasBbox) {
                // For area name, we'll add the area query first
                return `  area[name="${areaName}"]->.searchArea;\n` +
                       `  ${elementType}${conditions.join('')}(area.searchArea)`;
            } else {
                // Use bbox for filtering
                const bboxStr = hasBbox 
                    ? `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`
                    : '({{bbox}})';
                return `  ${elementType}${conditions.join('')}${bboxStr}`;
            }
        };
        
        // Only include element types that have conditions
        if (conditionsByType.node && conditionsByType.node.length > 0) {
            queries.push(buildQueryPart('node', conditionsByType.node));
        }
        if (conditionsByType.way && conditionsByType.way.length > 0) {
            queries.push(buildQueryPart('way', conditionsByType.way));
        }
        if (conditionsByType.relation && conditionsByType.relation.length > 0) {
            queries.push(buildQueryPart('relation', conditionsByType.relation));
        }
        if (conditionsByType.nwr && conditionsByType.nwr.length > 0) {
            queries.push(buildQueryPart('nwr', conditionsByType.nwr));
        }
        
        if (queries.length > 0) {
            if (hasAreaName && !hasBbox) {
                // For area queries, we need to build it differently
                query += '(\n';
                queries.forEach((q, index) => {
                    query += q;
                    if (index < queries.length - 1) {
                        query += ';\n';
                    } else {
                        query += ';\n);\n';
                    }
                });
            } else {
                // For bbox queries, use the standard format
                query += '(\n' + queries.join(';\n') + ';\n);\n';
            }
        }
        // No need for else block since we always use a bbox now
        
        // Add output statements (Overpass Ultra is picky about output format)
        query += '\n// Print results\n';
        query += 'out body;\n';
        query += '>;\n';
        query += 'out skel qt;';
        
        // Update the output
        queryOutput.textContent = query;
        
        // Update the open in Overpass Turbo/Ultra links
        const encodedQuery = encodeURIComponent(query);
        openInOverpassTurbo.href = `https://overpass-turbo.eu/?Q=${encodedQuery}`;
        // For Overpass Ultra, we need to use the 'query' parameter in the hash
        openInOverpassUltra.href = `https://overpass-ultra.us/#query=${encodedQuery}`;
        
        // Store the query and bbox for export
        lastQueryResult = {
            query,
            bbox: hasBbox ? bbox : null,
            conditions: Array.from(conditionElements).map(el => ({
                elementType: el.querySelector('.element-type').value,
                key: el.querySelector('.key').value,
                operator: el.querySelector('.operator').value,
                value: el.querySelector('.value').value
            }))
        };
    }
    
    // Copy query to clipboard
    function copyToClipboard() {
        const query = queryOutput.textContent;
        if (!query || query.startsWith('// Add at least')) {
            showToast('No query to copy', 'warning');
            return;
        }
        
        navigator.clipboard.writeText(query).then(() => {
            showToast('Query copied to clipboard!', 'success');
            
            // Change icon to checkmark temporarily
            const icon = copyQueryBtn.querySelector('i');
            const originalClass = icon.className;
            icon.className = 'bi bi-check2';
            
            // Revert icon after 2 seconds
            setTimeout(() => {
                icon.className = originalClass;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            showToast('Failed to copy query', 'danger');
        });
    }
    
    // Show toast notification
    function showToast(message, type = 'info') {
        // Create toast element if it doesn't exist
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        const toastId = `toast-${Date.now()}`;
        const toastHtml = `
            <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <strong class="me-auto">Overpass Query Builder</strong>
                    <small>Just now</small>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = toastHtml.trim();
        const toastElement = tempDiv.firstChild;
        
        // Add to container and show
        toastContainer.appendChild(toastElement);
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
        
        // Remove toast after it's hidden
        toastElement.addEventListener('hidden.bs.toast', function() {
            toastElement.remove();
            if (toastContainer.children.length === 0) {
                toastContainer.remove();
            }
        });
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            toast.hide();
        }, 3000);
    }
    
    // Get user's current location
    function getCurrentLocation() {
        if (!navigator.geolocation) {
            showToast('Geolocation is not supported by your browser', 'warning');
            return;
        }
        
        showToast('Getting your location...', 'info');
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const delta = 0.01; // ~1km radius
                
                setBbox(
                    lat - delta,
                    lng - delta,
                    lat + delta,
                    lng + delta
                );
                
                showToast('Location set! Adjust the bbox as needed.', 'success');
            },
            (error) => {
                let errorMessage = 'Unable to retrieve your location';
                if (error.code === error.PERMISSION_DENIED) {
                    errorMessage = 'Location access was denied. Please enable it in your browser settings.';
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    errorMessage = 'Location information is unavailable.';
                } else if (error.code === error.TIMEOUT) {
                    errorMessage = 'The request to get user location timed out.';
                }
                showToast(errorMessage, 'danger');
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    }
    
    // Add example query
    function addExample() {
        // Clear existing conditions
        document.querySelectorAll('.condition-group').forEach(el => el.remove());
        
        // Add example conditions
        addCondition({
            elementType: 'nwr',
            key: 'amenity',
            operator: '=',
            value: 'restaurant'
        });
        
        addCondition({
            elementType: 'nwr',
            key: 'cuisine',
            operator: '~',
            value: 'italian|pizza|pasta'
        });
        
        // Set a default bbox (San Francisco)
        bboxInputs.south.value = '37.7';
        bboxInputs.west.value = '-122.5';
        bboxInputs.north.value = '37.8';
        bboxInputs.east.value = '-122.4';
        
        // Generate and show the query
        generateQuery();
        
        // Scroll to the query output
        queryOutput.scrollIntoView({ behavior: 'smooth' });
        
        showToast('Example query loaded! Click "Generate Query" to see the result.', 'info');
    }
    
    // Event Listeners
    addConditionBtn.addEventListener('click', () => {
        const newCondition = addCondition();
        newCondition.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    
    generateQueryBtn.addEventListener('click', generateQuery);
    copyQueryBtn.addEventListener('click', copyToClipboard);
    useMyLocationBtn.addEventListener('click', getCurrentLocation);
    clearBboxBtn.addEventListener('click', clearBbox);
    showBboxOnMapBtn.addEventListener('click', showBboxOnMap);
    addExampleBtn.addEventListener('click', addExample);
    
    // Export buttons
    exportCSVBtn.addEventListener('click', () => exportData('csv'));
    exportJSONBtn.addEventListener('click', () => exportData('json'));
    exportGeoJSONBtn.addEventListener('click', () => exportData('geojson'));
    
    // Search place when search button is clicked or Enter is pressed
    searchPlaceBtn.addEventListener('click', () => searchPlace(placeSearchInput.value));
    placeSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchPlace(placeSearchInput.value);
        }
    });
    
    // Update query when timeout changes
    timeoutSelect.addEventListener('change', generateQuery);
    
    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchResultsContainer.contains(e.target) && e.target !== placeSearchInput && e.target !== searchPlaceBtn) {
            searchResultsContainer.classList.add('d-none');
        }
    });
    
    // Generate query when any input changes
    queryConditions.addEventListener('input', (e) => {
        // Only regenerate if the input is part of a condition
        if (e.target.matches('.element-type, .key, .operator, .value')) {
            generateQuery();
        }
    });
    
    // Generate query when bbox changes and update area
    Object.values(bboxInputs).forEach(input => {
        input.addEventListener('change', () => {
            calculateBboxArea();
            generateQuery();
        });
        input.addEventListener('input', () => {
            clearTimeout(window.bboxUpdateTimeout);
            window.bboxUpdateTimeout = setTimeout(() => {
                calculateBboxArea();
                generateQuery();
            }, 300);
        });
    });
    
    // Initialize with one empty condition
    addCondition();
    
    // Generate initial empty query
    generateQuery();
});
