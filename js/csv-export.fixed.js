/**
 * CSV Export functionality for Overpass Query Builder
 * This file handles the CSV export functionality for the application.
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const queryConditions = document.getElementById('csv-queryConditions');
    const addConditionBtn = document.getElementById('csv-addCondition');
    const generateQueryBtn = document.getElementById('csv-generateQuery');
    const queryOutput = document.getElementById('csv-queryOutput');
    const copyQueryBtn = document.getElementById('csv-copyQuery');
    const openInOverpassTurbo = document.getElementById('csv-openInOverpassTurbo');
    const openInOverpassUltra = document.getElementById('csv-openInOverpassUltra');
    const useMyLocationBtn = document.getElementById('csv-useMyLocation');
    const showBboxOnMapBtn = document.getElementById('csv-showBboxOnMap');
    const clearBboxBtn = document.getElementById('csv-clearBbox');
    const addExampleBtn = document.getElementById('csv-addExample');
    const placeSearchInput = document.getElementById('csv-placeSearch');
    const searchPlaceBtn = document.getElementById('csv-searchPlace');
    const searchResultsContainer = document.getElementById('csv-searchResults');
    const searchResultsList = document.querySelector('.csv-search-results-list');
    const bboxAreaSpan = document.getElementById('csv-bboxArea');
    const timeoutSelect = document.getElementById('csv-timeout');
    const exportDataBtn = document.getElementById('csv-exportData');
    
    // State
    let lastQueryResult = null;
    
    // Bounding box inputs
    const bboxInputs = {
        south: document.getElementById('csv-south'),
        west: document.getElementById('csv-west'),
        north: document.getElementById('csv-north'),
        east: document.getElementById('csv-east')
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
            if (input) input.value = '';
        });
        
        // Clear the search input
        if (placeSearchInput) placeSearchInput.value = '';
        
        // Clear area display
        if (bboxAreaSpan) bboxAreaSpan.textContent = '';
        
        // Hide search results
        if (searchResultsContainer) searchResultsContainer.classList.add('d-none');
        
        // Generate query with default bbox
        generateQuery();
    }
    
    // Set bbox from coordinates
    function setBbox(south, west, north, east) {
        if (bboxInputs.south) bboxInputs.south.value = south.toFixed(6);
        if (bboxInputs.west) bboxInputs.west.value = west.toFixed(6);
        if (bboxInputs.north) bboxInputs.north.value = north.toFixed(6);
        if (bboxInputs.east) bboxInputs.east.value = east.toFixed(6);
        calculateBboxArea();
        generateQuery();
    }
    
    // Debounce function to limit API calls
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Search for a place using Nominatim
    async function searchPlace(query, isTyping = false) {
        if (!query.trim()) {
            if (!isTyping) {
                showToast('Please enter a place name to search', 'warning');
            }
            if (searchResultsContainer) searchResultsContainer.classList.add('d-none');
            return [];
        }
        
        try {
            // Show loading state only for explicit searches, not for typing
            const searchButton = document.getElementById('csv-searchPlace');
            const searchInput = document.getElementById('csv-placeSearch');
            let originalButtonText = '';
            
            if (!isTyping && searchButton) {
                originalButtonText = searchButton.innerHTML;
                searchButton.disabled = true;
                searchButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Searching...';
            }
            
            // Show results container when typing
            if (isTyping && searchResultsContainer) {
                searchResultsContainer.innerHTML = '<div class="list-group csv-search-results-list"></div>';
                searchResultsContainer.classList.remove('d-none');
            }
            
            const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&dedupe=1`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            let data = await response.json();
            
            // Reset button state if it exists
            if (searchButton) {
                searchButton.disabled = false;
                searchButton.innerHTML = originalButtonText || 'Search';
            }
            
            if (!Array.isArray(data) || data.length === 0) {
                if (searchResultsContainer) {
                    searchResultsContainer.innerHTML = '<div class="list-group-item">No results found</div>';
                    searchResultsContainer.classList.remove('d-none');
                }
                showToast('No results found for your search', 'info');
                return [];
            }
            
            // Sort by importance
            data.sort((a, b) => (b.importance || 0) - (a.importance || 0));
            
            // Get the results list container
            const resultsList = searchResultsContainer?.querySelector('.csv-search-results-list');
            if (!resultsList) return [];
            
            resultsList.innerHTML = '';
            
            // Process and display each result
            data.slice(0, 10).forEach(result => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'list-group-item list-group-item-action';
                
                // Get the full display name for the result item
                let resultDisplayName = result.display_name;
                if (resultDisplayName.length > 60) {
                    resultDisplayName = resultDisplayName.substring(0, 60) + '...';
                }
                
                // Get address from result or empty object if not available
                const address = result.address || {};
                // Use the first part of display_name as the primary name (first part before comma)
                const primaryName = result.display_name.split(',')[0].trim();
                // For display purposes, use the most specific name available
                const areaDisplayName = address.city || address.town || address.village || address.hamlet || 
                                     address.municipality || address.county || address.state || address.country || primaryName;
                
                // Store the primary name for query generation
                item.dataset.primaryName = primaryName;
                const type = result.type || 'place';
                
                // Build location hierarchy
                const locationHierarchy = [];
                if (address.city) locationHierarchy.push(address.city);
                else if (address.town) locationHierarchy.push(address.town);
                else if (address.village) locationHierarchy.push(address.village);
                
                if (address.county && !locationHierarchy.includes(address.county)) {
                    locationHierarchy.push(address.county);
                }
                if (address.state && !locationHierarchy.includes(address.state)) {
                    locationHierarchy.push(address.state);
                }
                if (address.country && !locationHierarchy.includes(address.country)) {
                    locationHierarchy.push(address.country);
                }
                
                const locationText = locationHierarchy.join(', ');
                
                // Set the HTML for the result item with selection options
                item.innerHTML = `
                    <div class="d-flex flex-column w-100">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <div>
                                <div class="fw-bold">${primaryName}</div>
                                <small class="text-muted">${locationText}</small>
                            </div>
                            <span class="badge bg-secondary">${type}</span>
                        </div>
                        <div class="d-flex align-items-center">
                            <select class="form-select form-select-sm me-2 search-result-type" style="width: auto;">
                                <option value="bbox">Use Bounding Box</option>
                                <option value="name">Use Place Name</option>
                                ${result.osm_type === 'relation' || result.osm_type === 'way' ? 
                                    `<option value="area">Use Area ID (${result.osm_type[0].toUpperCase()}${result.osm_id})</option>` : ''}
                            </select>
                            <button class="btn btn-sm btn-primary">Select</button>
                        </div>
                    </div>
                `;
                
                // Add click handler to the select button
                const selectBtn = item.querySelector('button');
                selectBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const selectEl = item.querySelector('.search-result-type');
                    const selectionType = selectEl ? selectEl.value : 'bbox';
                    
                    // Set the search input value
                    if (placeSearchInput) {
                        placeSearchInput.value = primaryName;
                    }
                    
                    // Store the selection type in the search input's data attribute
                    placeSearchInput.dataset.selectionType = selectionType;
                    
                    // Store the result data in the search input's data attributes
                    if (selectionType === 'area' && (result.osm_type === 'relation' || result.osm_type === 'way')) {
                        placeSearchInput.dataset.osmType = result.osm_type;
                        placeSearchInput.dataset.osmId = result.osm_id;
                    } else {
                        delete placeSearchInput.dataset.osmType;
                        delete placeSearchInput.dataset.osmId;
                    }
                    
                    // Hide the results
                    if (searchResultsContainer) {
                        searchResultsContainer.classList.add('d-none');
                    }
                    
                    // Handle different selection types
                    if (selectionType === 'bbox') {
                        // Set the bounding box
                        const bbox = result.boundingbox.map(Number); // [south, north, west, east]
                        setBbox(bbox[0], bbox[2], bbox[1], bbox[3]);
                        showToast(`Bounding box set for: ${primaryName}`, 'success');
                    } else if (selectionType === 'name') {
                        // Clear bbox to indicate we're using place name
                        clearBbox();
                        showToast(`Will search by name: ${primaryName}`, 'success');
                    } else if (selectionType === 'area' && (result.osm_type === 'relation' || result.osm_type === 'way')) {
                        // Clear bbox to indicate we're using area ID
                        clearBbox();
                        showToast(`Will search in area: ${result.osm_type[0].toUpperCase()}${result.osm_id} (${primaryName})`, 'success');
                    }
                    
                    // Update the query
                    generateQuery();
                });
                
                resultsList.appendChild(item);
            });
            
            // Show the results container if it's not already visible
            if (searchResultsContainer && !isTyping) {
                searchResultsContainer.classList.remove('d-none');
            }
            
            return data;
            
        } catch (error) {
            console.error('Search error:', error);
            
            // Reset button state if it exists
            const searchButton = document.getElementById('csv-searchPlace');
            if (searchButton) {
                searchButton.disabled = false;
                searchButton.innerHTML = 'Search';
            }
            
            showToast('Error searching for location. Please try again.', 'danger');
            return [];
        }
    }
    
    // Convert Overpass elements to CSV
    function convertToCSV(elements, columns = []) {
        if (!elements || elements.length === 0) return '';
        
        // If no columns specified, use all available keys
        if (columns.length === 0) {
            const allKeys = new Set();
            elements.forEach(element => {
                if (element.tags) {
                    Object.keys(element.tags).forEach(key => allKeys.add(key));
                }
            });
            columns = Array.from(allKeys);
        }
        
        // Add default columns if not present
        const defaultColumns = ['id', 'type', 'lat', 'lon'];
        defaultColumns.forEach(col => {
            if (!columns.includes(col)) {
                columns.unshift(col);
            }
        });
        
        // Create CSV header
        let csvContent = columns.map(col => {
            // Escape quotes and wrap in quotes
            const escapedCol = String(col).replace(/"/g, '""');
            return `"${escapedCol}"`;
        }).join(',') + '\r\n';
        
        // Add rows
        elements.forEach(element => {
            const row = [];
            
            columns.forEach(col => {
                let value = '';
                
                // Handle special columns
                if (col === 'id') {
                    value = element.id || '';
                } else if (col === 'type') {
                    value = element.type || '';
                } else if (col === 'lat') {
                    value = element.lat || (element.center ? element.center.lat : '');
                } else if (col === 'lon') {
                    value = element.lon || (element.center ? element.center.lon : '');
                } else if (element.tags && element.tags[col] !== undefined) {
                    value = element.tags[col];
                }
                
                // Convert to string and escape quotes
                const strValue = value !== null && value !== undefined ? String(value) : '';
                const escapedValue = strValue.replace(/"/g, '""');
                
                // Always wrap in quotes for proper CSV format
                row.push(`"${escapedValue}"`);
            });
            
            csvContent += row.join(',') + '\r\n';
        });
        
        // Add UTF-8 BOM for Excel compatibility
        return '\uFEFF' + csvContent;
    }
    
    // Add a new condition row
    function addCondition(condition = {}) {
        const conditionId = Date.now();
        const conditionGroup = document.createElement('div');
        conditionGroup.className = 'condition-group mb-3';
        conditionGroup.dataset.id = conditionId;
        
        conditionGroup.innerHTML = `
            <div class="row g-3">
                <div class="col-md-3">
                    <label class="form-label small text-muted mb-1 d-block">Element Type</label>
                    <select class="form-select csv-element-type">
                        <option value="node" ${condition.elementType === 'node' ? 'selected' : ''}>Node</option>
                        <option value="way" ${condition.elementType === 'way' ? 'selected' : ''}>Way</option>
                        <option value="relation" ${condition.elementType === 'relation' ? 'selected' : ''}>Relation</option>
                        <option value="nwr" ${!condition.elementType || condition.elementType === 'nwr' ? 'selected' : ''}>Node/Way/Relation</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <label class="form-label small text-muted mb-1 d-block">Key</label>
                    <div class="autocomplete">
                        <input type="text" class="form-control csv-key" placeholder="e.g., amenity, shop" value="${condition.key || ''}" required autocomplete="off">
                        <div class="autocomplete-items"></div>
                    </div>
                </div>
                <div class="col-md-2">
                    <label class="form-label small text-muted mb-1 d-block">Operator</label>
                    <select class="form-select csv-operator">
                        <option value="=" ${!condition.operator || condition.operator === '=' ? 'selected' : ''}>=</option>
                        <option value="!=" ${condition.operator === '!=' ? 'selected' : ''}>≠</option>
                        <option value="~" ${condition.operator === '~' ? 'selected' : ''}>~</option>
                        <option value="!~" ${condition.operator === '!~' ? 'selected' : ''}>!~</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <label class="form-label small text-muted mb-1 d-block">Value</label>
                    <div class="autocomplete">
                        <input type="text" class="form-control csv-value" placeholder="e.g., restaurant, cafe" value="${condition.value || ''}" autocomplete="off">
                        <div class="autocomplete-items"></div>
                    </div>
                </div>
                <div class="col-md-1 d-flex align-items-end">
                    <button type="button" class="btn btn-outline-danger btn-sm delete-condition" title="Remove condition">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Add the new condition to the container
        queryConditions.appendChild(conditionGroup);
        
        // Initialize autocomplete for the new inputs
        const keyInput = conditionGroup.querySelector('.csv-key');
        const valueInput = conditionGroup.querySelector('.csv-value');
        
        if (keyInput) {
            new TagInfoAutocomplete(keyInput, 'key', () => {
                // When a key is selected, clear the value input
                if (valueInput) valueInput.value = '';
                generateQuery();
            });
        }
        
        if (valueInput) {
            new TagInfoAutocomplete(valueInput, 'value', generateQuery);
        }
        
        // Add event listener for delete button
        const deleteBtn = conditionGroup.querySelector('.delete-condition');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                conditionGroup.remove();
                generateQuery();
            });
        }
        
        // Add change listeners to form controls
        const inputs = conditionGroup.querySelectorAll('select, input');
        inputs.forEach(input => {
            input.addEventListener('change', generateQuery);
            input.addEventListener('input', generateQuery);
        });
        
        return conditionGroup;
    }
    
    // Get current timeout value in seconds
    function getTimeout() {
        return parseInt(timeoutSelect?.value) || 60;
    }
    
    // Get CSV columns from input
    function getCSVColumns() {
        const columnsInput = document.getElementById('csv-columns');
        if (!columnsInput) return [];
        return columnsInput.value
            .split(',')
            .map(col => col.trim())
            .filter(Boolean);
    }
    
    // Generate Overpass QL query
    function generateQuery() {
        try {
            // Get all condition groups
            const conditionGroups = document.querySelectorAll('#csv-queryConditions .condition-group');
            
            if (conditionGroups.length === 0) {
                if (queryOutput) queryOutput.textContent = '// Add at least one condition to generate a query';
                return;
            }
            
            // Check if we have a bounding box or area search
            const hasBbox = ![
                bboxInputs.south?.value,
                bboxInputs.west?.value,
                bboxInputs.north?.value,
                bboxInputs.east?.value
            ].some(v => v === '' || v === undefined);
            
            const placeSearch = placeSearchInput?.value.trim() || '';
            const hasPlaceSearch = placeSearch !== '';
            const useCSV = document.getElementById('csv-output-format')?.checked;
            let columns = useCSV ? getCSVColumns() : [];
            
            // Ensure we have at least one column for CSV output
            if (useCSV && columns.length === 0) {
                columns = ['id', 'type', 'lat', 'lon'];
            }
            
            // Start building the query
            let query = '';
            
            // Always use CSV format for the CSV tab
            const csvColumns = columns.map(col => {
                // Handle special columns
                if (col === 'lat' || col === 'lon' || col === 'id' || col === 'type') {
                    return `::${col}`;
                }
                // Quote column names that contain special characters
                if (/[^a-zA-Z0-9_]/.test(col)) {
                    return `"${col.replace(/"/g, '\\"')}"`;
                }
                return col;
            });
            
            // Add CSV output format and timeout
            query = `[out:csv(${csvColumns.join(',')}; true; ",")][timeout:${getTimeout()}];
`;
            
            // Handle place search based on selection type
            if (hasPlaceSearch) {
                const selectionType = placeSearchInput?.dataset.selectionType || 'bbox';
                
                if (selectionType === 'area' && placeSearchInput.dataset.osmType && placeSearchInput.dataset.osmId) {
                    // Use area ID (relation or way)
                    const osmType = placeSearchInput.dataset.osmType; // 'relation' or 'way'
                    const osmId = parseInt(placeSearchInput.dataset.osmId);
                    // For relations, we need to use area ID (relation ID + 3600000000)
                    // For ways, we can use the way ID directly
                    const areaId = osmType === 'relation' ? 
                        (osmId < 3600000000 ? osmId + 3600000000 : osmId) : 
                        osmId;
                    
                    query += `/* Search in ${osmType} ID: ${osmId} */\n`;
                    query += osmType === 'relation' ? 
                        `area(${areaId})->.searchArea;\n\n` : 
                        `way(${areaId});
map_to_area -> .searchArea;\n\n`;
                    
                } else if (selectionType === 'name') {
                    // Search by place name
                    query += `/* Search in area: ${placeSearch} */\narea["name"~"^${placeSearch.replace(/([\[\]\\^$.*+?(){}|])/g, '\\$1')}$",i]->.searchArea;\n\n`;
                } else {
                    // Default to bbox (already handled by hasBbox check)
                }
            } else if (hasBbox) {
                query += `/* Search within bounding box */\n`;
            }
            
            // Start the main query section with a comment
            query += '// Gather results\n(\n';

            // Get the selected element type
            const elementTypeSelect = document.querySelector('.csv-element-type');
            const elementType = elementTypeSelect ? elementTypeSelect.value : 'nwr';
            
            // Handle different element types
            const elementTypes = elementType === 'nwr' ? ['node', 'way', 'relation'] : [elementType];
            
            // Add query parts for each element type
            elementTypes.forEach((type, typeIndex) => {
                if (typeIndex > 0) query += '\n';
                
                // Start element type query with filter
                query += `  ${type}`;
                
                // Add area, bbox, or name filter based on selection
                if (hasPlaceSearch && placeSearchInput?.dataset.selectionType === 'name') {
                    // Search by name within the area
                    query += '(area.searchArea)';
                } else if (hasPlaceSearch && placeSearchInput?.dataset.selectionType === 'area') {
                    // Search within the area ID
                    query += '(area.searchArea)';
                } else if (hasBbox) {
                    query += `(${bboxInputs.south.value},${bboxInputs.west.value},${bboxInputs.north.value},${bboxInputs.east.value})`;
                } else {
                    query += '(if:1==1)'; // Global query if no area/bbox specified
                }
                
                // Add opening bracket for conditions
                query += '[';
                
                // Add conditions for each group
                const conditions = [];
                conditionGroups.forEach((group) => {
                    const key = group.querySelector('.csv-key')?.value.trim() || '';
                    const operator = group.querySelector('.csv-operator')?.value || '=';
                    const value = group.querySelector('.csv-value')?.value.trim() || '';
                    
                    // Skip incomplete conditions
                    if (!key) return;
                    
                    // Add key and value if provided
                    if (value) {
                        conditions.push(`"${key}"${operator}"${value.replace(/"/g, '\\\\"')}"`);
                    } else {
                        conditions.push(`"${key}"`);
                    }
                });
                
                // Add conditions to query
                query += conditions.join(' ');
                
                // Close the condition
                query += ']';
                
                // Add semicolon to end the statement
                query += ';';
            });
            
            // Close the query block and add output statements
            query += '\n);\n\n';
            query += '// Print results\n';
            query += 'out center;\n';
            query += '>;\n';
            query += 'out skel qt;';
            
            // Update the query output
            if (queryOutput) {
                queryOutput.textContent = query;
                Prism.highlightElement(queryOutput);
            }
            
            // Update export buttons
            updateExportButtons(query);
            
            return query;
            
        } catch (error) {
            console.error('Error generating query:', error);
            if (queryOutput) {
                queryOutput.textContent = `// Error generating query: ${error.message}`;
            }
            return null;
        }
    }
    
    // Execute the query against the Overpass API
    async function executeQuery(query) {
        if (!query) {
            showToast('No query to execute', 'warning');
            return null;
        }
        
        try {
            // Show loading state
            const originalText = generateQueryBtn.innerHTML;
            generateQueryBtn.disabled = true;
            generateQueryBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Querying...';
            
            // Check if this is a CSV query
            const isCSV = query.includes('[out:csv(');
            
            // Execute the query
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                },
                body: `data=${encodeURIComponent(query)}`
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            
            let data;
            if (isCSV) {
                // For CSV responses, we get plain text
                const csvText = await response.text();
                // Convert CSV to array of objects for consistency
                const lines = csvText.trim().split('\n');
                if (lines.length < 2) {
                    // No results
                    showToast('Query successful! No results found.', 'info');
                    return { elements: [] };
                }
                
                const headers = lines[0].split('\t');
                data = {
                    elements: lines.slice(1).map(line => {
                        const values = line.split('\t');
                        const obj = {};
                        headers.forEach((header, i) => {
                            obj[header] = values[i] || '';
                        });
                        return obj;
                    })
                };
            } else {
                // For JSON responses
                data = await response.json();
            }
            
            lastQueryResult = data;
            
            // Show success message
            const elementCount = data.elements ? data.elements.length : 0;
            showToast(`Query successful! Found ${elementCount} elements.`, 'success');
            
            return data;
            
        } catch (error) {
            console.error('Query execution error:', error);
            showToast(`Query failed: ${error.message}`, 'danger');
            return null;
            
        } finally {
            // Reset button state
            if (generateQueryBtn) {
                generateQueryBtn.disabled = false;
                generateQueryBtn.innerHTML = originalText || 'Generate Query';
            }
        }
    }
    
    // Update export buttons with the current query
    function updateExportButtons(query) {
        if (!openInOverpassTurbo || !openInOverpassUltra) return;
        
        // Encode the query for URL
        const encodedQuery = encodeURIComponent(query);
        
        // Update Overpass Turbo link
        openInOverpassTurbo.href = `https://overpass-turbo.eu/?Q=${encodedQuery}&R`;
        
        // Update Overpass Ultra link
        openInOverpassUltra.href = `https://overpass.ultra.zone/?Q=${encodedQuery}&R`;
    }
    
    // Copy query to clipboard
    async function copyToClipboard() {
        try {
            const query = queryOutput?.textContent;
            if (!query) {
                showToast('No query to copy', 'warning');
                return;
            }
            
            await navigator.clipboard.writeText(query);
            showToast('Query copied to clipboard', 'success');
            
        } catch (error) {
            console.error('Failed to copy query:', error);
            showToast('Failed to copy query', 'danger');
        }
    }
    
    // Show toast notification
    function showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.position = 'fixed';
            toastContainer.style.top = '20px';
            toastContainer.style.right = '20px';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toastId = `toast-${Date.now()}`;
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.role = 'alert';
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        // Add toast content
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Initialize and show the toast
        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: 3000
        });
        
        bsToast.show();
        
        // Remove the toast after it's hidden
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }
    
    // Get user's current location
    function getCurrentLocation() {
        if (!navigator.geolocation) {
            showToast('Geolocation is not supported by your browser', 'warning');
            return;
        }
        
        // Show loading state
        const originalText = useMyLocationBtn.innerHTML;
        useMyLocationBtn.disabled = true;
        useMyLocationBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Locating...';
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                // Calculate a small bbox around the current location (0.01 degree ≈ 1.1 km)
                const delta = 0.01;
                const south = (lat - delta).toFixed(6);
                const west = (lon - delta).toFixed(6);
                const north = (lat + delta).toFixed(6);
                const east = (lon + delta).toFixed(6);
                
                // Update bbox inputs
                if (bboxInputs.south) bboxInputs.south.value = south;
                if (bboxInputs.west) bboxInputs.west.value = west;
                if (bboxInputs.north) bboxInputs.north.value = north;
                if (bboxInputs.east) bboxInputs.east.value = east;
                
                // Update area display
                calculateBboxArea();
                
                // Update the query
                generateQuery();
                
                // Show success message
                showToast(`Location set to: ${lat.toFixed(6)}, ${lon.toFixed(6)}`, 'success');
                
            },
            (error) => {
                console.error('Geolocation error:', error);
                let errorMessage = 'Unable to retrieve your location';
                
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access was denied. Please enable location services and try again.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'The request to get user location timed out.';
                        break;
                }
                
                showToast(errorMessage, 'danger');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
        
        // Reset button state
        useMyLocationBtn.disabled = false;
        useMyLocationBtn.innerHTML = originalText || 'Use My Location';
    }
    
    // Add example query
    function addExample() {
        // Clear existing conditions
        queryConditions.innerHTML = '';
        
        // Add example conditions
        addCondition({
            elementType: 'nwr',
            key: 'amenity',
            operator: '=',
            value: 'cafe'
        });
        
        // Set a default bbox (central London as an example)
        setBbox(51.5072, -0.1276, 51.5076, -0.1268);
        
        // Generate the query
        generateQuery();
        
        showToast('Example query loaded. Click "Generate Query" to see the results.', 'info');
    }
    
    // Initialize the application
    function init() {
        // Add initial condition
        addCondition();
        
        // Add event listeners
        if (addConditionBtn) {
            addConditionBtn.addEventListener('click', () => {
                addCondition();
                generateQuery();
            });
        }
        
        if (generateQueryBtn) generateQueryBtn.addEventListener('click', generateQuery);
        if (copyQueryBtn) copyQueryBtn.addEventListener('click', copyToClipboard);
        
        if (useMyLocationBtn) useMyLocationBtn.addEventListener('click', getCurrentLocation);
        if (showBboxOnMapBtn) showBboxOnMapBtn.addEventListener('click', showBboxOnMap);
        if (clearBboxBtn) clearBboxBtn.addEventListener('click', clearBbox);
        if (addExampleBtn) addExampleBtn.addEventListener('click', addExample);
        
        if (searchPlaceBtn) {
            searchPlaceBtn.addEventListener('click', () => {
                const query = placeSearchInput?.value.trim();
                if (query) {
                    searchPlace(query, false);
                }
            });
        }
        
        if (placeSearchInput) {
            // Add debounced search on input
            placeSearchInput.addEventListener('input', debounce((e) => {
                const query = e.target.value.trim();
                if (query.length > 2) {
                    searchPlace(query, true);
                } else if (searchResultsContainer) {
                    searchResultsContainer.classList.add('d-none');
                }
            }, 500));
            
            // Handle Enter key
            placeSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const query = placeSearchInput.value.trim();
                    if (query) {
                        searchPlace(query, false);
                    }
                }
            });
        }
        
        // Add change listeners to bbox inputs
        Object.values(bboxInputs).forEach(input => {
            if (input) {
                input.addEventListener('change', calculateBboxArea);
                input.addEventListener('change', generateQuery);
            }
        });
        
        // Add change listener to timeout select
        if (timeoutSelect) {
            timeoutSelect.addEventListener('change', generateQuery);
        }
        
        // Add click handler for export data button
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', exportData);
        }
        
        // Initialize autocomplete for existing key inputs
        document.querySelectorAll('.csv-key').forEach(input => {
            new TagInfoAutocomplete(input, 'key', () => {
                // When a key is selected, clear the value input
                const valueInput = input.closest('.condition-group')?.querySelector('.csv-value');
                if (valueInput) valueInput.value = '';
                generateQuery();
            });
        });
        
        // Initialize autocomplete for existing value inputs
        document.querySelectorAll('.csv-value').forEach(input => {
            new TagInfoAutocomplete(input, 'value', generateQuery);
        });
        
        // Close search results when clicking outside
        if (searchResultsContainer) {
            document.addEventListener('click', (e) => {
                if (!searchResultsContainer.contains(e.target) && e.target !== placeSearchInput && e.target !== searchPlaceBtn) {
                    searchResultsContainer.classList.add('d-none');
                }
            });
        }
    }
    
    // Show bbox on map
    function showBboxOnMap() {
        const south = parseFloat(bboxInputs.south?.value);
        const west = parseFloat(bboxInputs.west?.value);
        const north = parseFloat(bboxInputs.north?.value);
        const east = parseFloat(bboxInputs.east?.value);
        
        if (isNaN(south) || isNaN(west) || isNaN(north) || isNaN(east)) {
            showToast('Please set a valid bounding box first', 'warning');
            return;
        }
        
        // Calculate center and zoom level
        const centerLat = (south + north) / 2;
        const centerLon = (west + east) / 2;
        const latDiff = north - south;
        const lonDiff = east - west;
        
        // Simple zoom level calculation (very approximate)
        const maxDiff = Math.max(latDiff, lonDiff);
        let zoom = Math.round(Math.log(360 / maxDiff) / Math.LN2) - 1;
        zoom = Math.min(Math.max(zoom, 1), 18);
        
        // Open in a new tab with OpenStreetMap
        const url = `https://www.openstreetmap.org/#map=${zoom}/${centerLat.toFixed(6)}/${centerLon.toFixed(6)}`;
        window.open(url, '_blank');
    }
    
    // Export data to CSV or JSON
    async function exportData() {
        const query = document.getElementById('csv-queryOutput')?.textContent.trim();
        if (!query) {
            showToast('Please generate a query first', 'warning');
            return;
        }
        
        // Get export format and columns
        const useCSV = document.getElementById('csv-output-format')?.checked;
        const columns = useCSV ? getCSVColumns() : [];
        
        // Show loading state
        const originalText = exportDataBtn.innerHTML;
        exportDataBtn.disabled = true;
        exportDataBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Exporting...';
        
        try {
            // Check if this is a CSV query
            const isCSVQuery = query.includes('[out:csv(');
            
            // If it's a CSV query, we can download it directly
            if (isCSVQuery) {
                const response = await fetch('https://overpass-api.de/api/interpreter', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                    },
                    body: `data=${encodeURIComponent(query)}`
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                }
                
                const csvContent = await response.text();
                
                // Create a filename with timestamp
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `overpass-export-${timestamp}.csv`;
                
                // Create and trigger download
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                
                // Clean up
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 100);
                
                showToast('CSV export completed successfully', 'success');
            } 
            // For JSON queries, we need to convert to CSV if needed
            else {
                // Execute the query to get the data
                const data = await executeQuery(query);
                
                if (!data || !data.elements || data.elements.length === 0) {
                    showToast('No data found for the current query', 'info');
                    return;
                }
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                
                if (useCSV) {
                    // Convert to CSV with proper encoding
                    const csvContent = convertToCSV(data.elements, columns);
                    
                    // Create and trigger download
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.setAttribute('href', url);
                    link.setAttribute('download', `overpass-export-${timestamp}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    
                    // Clean up
                    setTimeout(() => {
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                    }, 100);
                    
                    showToast('CSV export completed successfully', 'success');
                } else {
                    // Export as JSON
                    const jsonContent = JSON.stringify(data, null, 2);
                    
                    // Create and trigger download
                    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.setAttribute('href', url);
                    link.setAttribute('download', `overpass-export-${timestamp}.json`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    
                    // Clean up
                    setTimeout(() => {
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                    }, 100);
                    
                    showToast('JSON export completed successfully', 'success');
                }
            }
        } catch (error) {
            console.error('Export error:', error);
            showToast(`Export failed: ${error.message}`, 'danger');
        } finally {
            // Reset button state
            if (exportDataBtn) {
                exportDataBtn.disabled = false;
                exportDataBtn.innerHTML = originalText;
            }
        }
    }
    
    // Toggle CSV columns visibility based on checkbox
    const csvOutputCheckbox = document.getElementById('csv-output-format');
    const csvColumnsContainer = document.getElementById('csv-columns-container');
    
    if (csvOutputCheckbox && csvColumnsContainer) {
        // Initial state
        csvColumnsContainer.style.display = csvOutputCheckbox.checked ? 'block' : 'none';
        
        // Toggle on change
        csvOutputCheckbox.addEventListener('change', function() {
            csvColumnsContainer.style.display = this.checked ? 'block' : 'none';
            generateQuery();
        });
    }
    
    // Initialize the application when the DOM is fully loaded
    init();
});
