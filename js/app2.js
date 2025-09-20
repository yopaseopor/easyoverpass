document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements for the second tab
    const queryConditions2 = document.getElementById('queryConditions-2');
    const addConditionBtn2 = document.getElementById('addCondition-2');
    const generateQueryBtn2 = document.getElementById('generateQuery-2');
    const queryOutput2 = document.getElementById('queryOutput-2');
    const copyQueryBtn2 = document.getElementById('copyQuery-2');
    const openInOverpassTurbo2 = document.getElementById('openInOverpassTurbo-2');
    const openInOverpassUltra2 = document.getElementById('openInOverpassUltra-2');
    const useMyLocationBtn2 = document.getElementById('useMyLocation-2');
    const showBboxOnMapBtn2 = document.getElementById('showBboxOnMap-2');
    const clearBboxBtn2 = document.getElementById('clearBbox-2');
    const addExampleBtn2 = document.getElementById('addExample-2');
    const placeSearchInput2 = document.getElementById('placeSearch-2');
    const searchPlaceBtn2 = document.getElementById('searchPlace-2');
    const searchResultsContainer2 = document.getElementById('searchResults-2');
    const searchResultsList2 = document.querySelector('.search-results-list-2');
    const bboxAreaSpan2 = document.getElementById('bboxArea-2');
    const timeoutSelect2 = document.getElementById('timeout-2');
    const exportCSVBtn2 = document.getElementById('exportCSV-2');
    const exportJSONBtn2 = document.getElementById('exportJSON-2');
    const exportGeoJSONBtn2 = document.getElementById('exportGeoJSON-2');
    
    // State
    let lastQueryResult2 = null;
    
    // Bounding box inputs
    const bboxInputs2 = {
        south: document.getElementById('south-2'),
        west: document.getElementById('west-2'),
        north: document.getElementById('north-2'),
        east: document.getElementById('east-2')
    };

    // CSV Output Elements
    const enableCsvOutput2 = document.getElementById('enableCsvOutput-2');
    const csvColumnsContainer2 = document.getElementById('csvColumnsContainer-2');
    const csvColumnsInput2 = document.getElementById('csvColumns-2');
    const addDefaultColumnsBtn2 = document.getElementById('addDefaultColumns-2');

    // Add event listeners for the second tab
    addConditionBtn2.addEventListener('click', () => addCondition2());
    generateQueryBtn2.addEventListener('click', generateQuery2);
    copyQueryBtn2.addEventListener('click', copyToClipboard2);
    useMyLocationBtn2.addEventListener('click', getCurrentLocation2);
    showBboxOnMapBtn2.addEventListener('click', showBboxOnMap2);
    clearBboxBtn2.addEventListener('click', clearBbox2);
    addExampleBtn2.addEventListener('click', addExample2);
    searchPlaceBtn2.addEventListener('click', () => searchPlace2(placeSearchInput2.value));
    placeSearchInput2.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchPlace2(placeSearchInput2.value);
        }
    });

    // Toggle CSV columns visibility
    enableCsvOutput2.addEventListener('change', function() {
        csvColumnsContainer2.style.display = this.checked ? 'block' : 'none';
        generateQuery2();
    });

    // Add default columns
    addDefaultColumnsBtn2.addEventListener('click', function() {
        csvColumnsInput2.value = '::id,::type,name,::lat,::lon,shop';
        generateQuery2();
    });

    // Update query when columns change
    csvColumnsInput2.addEventListener('input', debounce2(generateQuery2, 300));

    // Initialize the second tab with a default condition
    addCondition2();

    // Function to add a new condition row for the second tab
    function addCondition2(condition = {}) {
        const conditionGroup = document.createElement('div');
        conditionGroup.className = 'condition-group';
        
        const row = document.createElement('div');
        row.className = 'row g-3 mt-2';
        
        // Element type select
        const elementTypeCol = document.createElement('div');
        elementTypeCol.className = 'col-md-3';
        elementTypeCol.innerHTML = `
            <select class="form-select element-type-2">
                <option value="node" ${condition.type === 'node' ? 'selected' : ''}>Node</option>
                <option value="way" ${condition.type === 'way' ? 'selected' : ''}>Way</option>
                <option value="relation" ${condition.type === 'relation' ? 'selected' : ''}>Relation</option>
                <option value="nwr" ${!condition.type || condition.type === 'nwr' ? 'selected' : ''}>Node/Way/Relation</option>
            </select>
        `;
        
        // Key input with autocomplete
        const keyCol = document.createElement('div');
        keyCol.className = 'col-md-3';
        keyCol.innerHTML = `
            <div class="autocomplete">
                <input type="text" 
                       class="form-control key-2" 
                       placeholder="e.g., amenity, shop" 
                       value="${condition.key || ''}" 
                       required 
                       autocomplete="off">
                <div class="autocomplete-items"></div>
            </div>
        `;
        
        // Operator select
        const operatorCol = document.createElement('div');
        operatorCol.className = 'col-md-2';
        operatorCol.innerHTML = `
            <select class="form-select operator-2">
                <option value="=" ${condition.operator === '=' ? 'selected' : ''}>=</option>
                <option value="!=" ${condition.operator === '!=' ? 'selected' : ''}>≠</option>
                <option value="~" ${condition.operator === '~' ? 'selected' : ''}>~</option>
                <option value="!~" ${condition.operator === '!~' ? 'selected' : ''}>!~</option>
                <option value="^~" ${condition.operator === '^~' ? 'selected' : ''}>^~</option>
                <option value="!^~" ${condition.operator === '!^~' ? 'selected' : ''}>!^~</option>
            </select>
        `;
        
        // Value input with autocomplete
        const valueCol = document.createElement('div');
        valueCol.className = 'col-md-3';
        valueCol.innerHTML = `
            <div class="autocomplete">
                <input type="text" 
                       class="form-control value-2" 
                       placeholder="e.g., restaurant, cafe" 
                       value="${condition.value || ''}" 
                       autocomplete="off">
                <div class="autocomplete-items"></div>
            </div>
        `;
        
        // Remove button
        const removeCol = document.createElement('div');
        removeCol.className = 'col-md-1 d-flex align-items-end';
        removeCol.innerHTML = `
            <button type="button" class="btn btn-outline-danger btn-sm remove-condition-2">
                <i class="bi bi-trash"></i>
            </button>
        `;
        
        // Assemble the row
        row.appendChild(elementTypeCol);
        row.appendChild(keyCol);
        row.appendChild(operatorCol);
        row.appendChild(valueCol);
        row.appendChild(removeCol);
        
        conditionGroup.appendChild(row);
        queryConditions2.appendChild(conditionGroup);
        
        // Add event listener to the remove button
        const removeBtn = conditionGroup.querySelector('.remove-condition-2');
        removeBtn.addEventListener('click', () => {
            conditionGroup.classList.add('fade-out');
            setTimeout(() => {
                conditionGroup.remove();
            }, 300);
        });
        
        // Initialize autocomplete for the new inputs
        initializeAutocomplete(keyCol.querySelector('.key-2'));
        initializeAutocomplete(valueCol.querySelector('.value-2'));
        
        return conditionGroup;
    }
    
    // Function to generate query for the second tab
    function generateQuery2() {
        // Get all condition elements for the second tab
        const conditionElements = document.querySelectorAll('#queryConditions-2 .condition-group');
        
        if (conditionElements.length === 0) {
            queryOutput2.textContent = '// Add at least one condition to generate a query';
            return;
        }
        
        // Get area name/relation ID from search input if bbox is empty
        const areaInput = placeSearchInput2.value.trim();
        const hasAreaInput = areaInput !== '';
        const isRelationId = !isNaN(areaInput) || (areaInput.startsWith('r') && !isNaN(areaInput.substring(1)));
        const relationId = isRelationId ? areaInput.replace('r', '') : null;
        
        // Get bounding box values for the second tab
        const bbox = {
            south: bboxInputs2.south.value,
            west: bboxInputs2.west.value,
            north: bboxInputs2.north.value,
            east: bboxInputs2.east.value
        };
        
        // Check if all bbox values are filled
        const hasBbox = Object.values(bbox).every(val => val !== '');
        
        // Get timeout value for the second tab
        const timeout = parseInt(timeoutSelect2.value, 10) || 30;
        
        // If no bbox and no area input, use default bbox
        if (!hasBbox && !hasAreaInput) {
            // This will use the default {{bbox}} in the query
        } 
        // If bbox is provided, validate it
        else if (hasBbox) {
            const bboxValues = Object.values(bbox).map(Number);
            const isValidBbox = bboxValues.every(val => !isNaN(val)) && 
                              bboxValues[0] < bboxValues[2] && 
                              bboxValues[1] < bboxValues[3];
            
            if (!isValidBbox) {
                queryOutput2.textContent = '// Error: Invalid bounding box coordinates. Please check your values.';
                return;
            }
        }
        // If relation ID is provided, validate it
        else if (isRelationId && (!/^\d+$/.test(relationId) || !relationId)) {
            queryOutput2.textContent = '// Error: Invalid relation ID. Please use a valid numeric ID';
            return;
        }
        
        // Process each condition for the second tab
        const conditions = Array.from(conditionElements).map(condEl => {
            const elementType = condEl.querySelector('.element-type-2').value;
            const key = condEl.querySelector('.key-2').value.trim();
            const operator = condEl.querySelector('.operator-2').value;
            const value = condEl.querySelector('.value-2').value.trim();
            
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
            queryOutput2.textContent = '// Add at least one valid condition to generate a query';
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
        // Check if CSV output is enabled
        const isCsvOutput = enableCsvOutput2.checked;
        const csvColumns = isCsvOutput ? csvColumnsInput2.value.trim() : '';
        
        // Add settings first (Overpass Ultra is picky about this)
        const outputFormat = isCsvOutput ? 'csv' : 'json';
        if (isCsvOutput) {
            // For CSV output, include the columns in the output format
            const columns = csvColumns || '@id,@type,name';
            query += `[out:csv(${columns})][timeout:${timeout}];
`;
        } else {
            // For JSON output
            query += `[out:json][timeout:${timeout}];
`;
        }
        
        const queries = [];
        
        // Helper function to build query parts
        const buildQueryPart = (elementType, conditions) => {
            if (hasAreaInput && !hasBbox) {
                // For area name or relation ID, we'll use area filter
                return `  ${elementType}${conditions.join('')}(area.searchArea)`;
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
            // Set the output format and columns
            let columns = '';
            if (isCsvOutput) {
                // Convert special column names to Overpass format (with double colons)
                const defaultColumns = '::id,::type,name,::lat,::lon,shop';
                columns = csvColumns 
                    ? csvColumns
                        .replace(/@id/g, '::id')
                        .replace(/@type/g, '::type')
                        .replace(/@lat/g, '::lat')
                        .replace(/@lon/g, '::lon')
                        .replace(/@/g, '')  // Remove any remaining @ symbols
                    : defaultColumns;
            }
            const outputFormat = isCsvOutput ? `csv(${columns})` : 'json';
            
            if (hasAreaInput && !hasBbox) {
                // For area queries, we need to build it differently
                query = `[out:${outputFormat}][timeout:${timeout}];\n`;
                
                // Add area definition at the beginning
                if (isRelationId) {
                    // Add 3600000000 to the relation ID for Overpass compatibility
                    const overpassRelationId = parseInt(relationId) + 3600000000;
                    query += `// Using relation ID: ${relationId} (Overpass ID: ${overpassRelationId})\n`;
                    query += `area(${overpassRelationId})->.searchArea;\n\n`;
                } else {
                    query += `// Using area name: ${areaInput}\n`;
                    query += `area[name="${areaInput}"]->.searchArea;\n\n`;
                }
                
                // Add the main query part
                query += '(\n' + queries.join(';\n') + ';\n);\n';
            } else {
                // For bbox queries, use the standard format
                query = `[out:${outputFormat}][timeout:${timeout}];\n`;
                if (hasBbox) {
                    query += `// Using bounding box: ${bbox.south},${bbox.west},${bbox.north},${bbox.east}\n`;
                } else {
                    query += '// Using current map view bbox\n';
                }
                query += '(\n' + queries.join(';\n') + ';\n);\n';
            }
        }
        
        // Add output statements
        query += '\n// Print results\n';
        if (isCsvOutput) {
            // For CSV output, use the standard format for closed ways
            query += 'out center;\n';
            query += '>;\n';
            query += 'out skel qt;\n';
        } else {
            // For JSON output, use the standard format
            query += 'out body;\n';
            query += '>;\n';
            query += 'out skel qt;';
        }
        
        // Update the output
        queryOutput2.textContent = query;
        
        // Update the open in Overpass Turbo/Ultra links
        const encodedQuery = encodeURIComponent(query);
        openInOverpassTurbo2.href = `https://overpass-turbo.eu/?Q=${encodedQuery}`;
        // For Overpass Ultra, we need to use the 'query' parameter in the hash
        openInOverpassUltra2.href = `https://overpass-ultra.us/#query=${encodedQuery}`;
        
        // Store the query and bbox for export
        lastQueryResult2 = {
            query,
            bbox: hasBbox ? bbox : null,
            conditions: Array.from(conditionElements).map(el => ({
                elementType: el.querySelector('.element-type-2').value,
                key: el.querySelector('.key-2').value,
                operator: el.querySelector('.operator-2').value,
                value: el.querySelector('.value-2').value
            }))
        };
    }
    
    // Function to copy query to clipboard for the second tab
    function copyToClipboard2() {
        const query = queryOutput2.textContent;
        if (!query || query.startsWith('// Add at least')) {
            showToast2('No query to copy', 'warning');
            return;
        }
        
        // Create a temporary textarea to copy from
        const textarea = document.createElement('textarea');
        textarea.value = query;
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showToast2('Query copied to clipboard!', 'success');
            } else {
                // Fallback to Clipboard API if execCommand fails
                navigator.clipboard.writeText(query.trim())
                    .then(() => showToast2('Query copied to clipboard!', 'success'))
                    .catch(err => {
                        console.error('Failed to copy query: ', err);
                        showToast2('Failed to copy query', 'danger');
                    });
            }
        } catch (err) {
            console.error('Failed to copy query: ', err);
            showToast2('Failed to copy query', 'danger');
        } finally {
            document.body.removeChild(textarea);
        }
    }
    
    // Function to download a file
    function downloadFile(content, mimeType, extension) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `overpass-export-${new Date().toISOString().slice(0, 10)}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Function to show toast notification for the second tab
    function showToast2(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast show align-items-center text-white bg-${type} border-0`;
        toast.role = 'alert';
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        
        const toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            const container = document.createElement('div');
            container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(container);
            container.appendChild(toast);
        } else {
            toastContainer.appendChild(toast);
        }
        
        // Auto-remove the toast after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 150);
        }, 5000);
    }
    
    // Function to get current location for the second tab
    function getCurrentLocation2() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    const radius = 0.01; // ~1.1km at the equator
                    
                    // Set the bounding box around the current location
                    bboxInputs2.south.value = (lat - radius).toFixed(6);
                    bboxInputs2.north.value = (lat + radius).toFixed(6);
                    bboxInputs2.west.value = (lon - radius).toFixed(6);
                    bboxInputs2.east.value = (lon + radius).toFixed(6);
                    
                    // Show the area
                    updateBboxArea2();
                    
                    // Show success message
                    showToast2('Location set to your current position');
                },
                (error) => {
                    console.error('Error getting location:', error);
                    showToast2('Could not get your location. Please enable location services and try again.', 'danger');
                }
            );
        } else {
            showToast2('Geolocation is not supported by your browser', 'danger');
        }
    }
    
    // Function to show bbox on map for the second tab
    function showBboxOnMap2() {
        const south = parseFloat(bboxInputs2.south.value);
        const north = parseFloat(bboxInputs2.north.value);
        const west = parseFloat(bboxInputs2.west.value);
        const east = parseFloat(bboxInputs2.east.value);
        
        if (isNaN(south) || isNaN(north) || isNaN(west) || isNaN(east)) {
            showToast2('Please set a valid bounding box first', 'warning');
            return;
        }
        
        const bbox = [west, south, east, north].join(',');
        const url = `https://www.openstreetmap.org/?bbox=${bbox}&layers=H`;
        window.open(url, '_blank');
    }
    
    // Function to clear bbox for the second tab
    function clearBbox2() {
        bboxInputs2.south.value = '';
        bboxInputs2.west.value = '';
        bboxInputs2.north.value = '';
        bboxInputs2.east.value = '';
        bboxAreaSpan2.textContent = '';
        
        // Clear the search input
        placeSearchInput2.value = '';
        
        // Clear area display
        bboxAreaSpan2.textContent = '';
        
        // Hide search results
        searchResultsContainer2.classList.add('d-none');
        
        // Show success message
        showToast2('Bounding box cleared');
    }
    
    // Function to add example query for the second tab
    function addExample2() {
        // Clear existing conditions
        queryConditions2.innerHTML = '';
        
        // Add example conditions
        addCondition2({ type: 'nwr', key: 'amenity', operator: '=', value: 'restaurant' });
        
        // Set a sample bounding box (e.g., Manhattan, NY)
        bboxInputs2.south.value = '40.7';
        bboxInputs2.west.value = '-74.02';
        bboxInputs2.north.value = '40.8';
        bboxInputs2.east.value = '-73.92';
        
        // Update the area display
        updateBboxArea2();
        
        // Show success message
        showToast2('Example query loaded. Click "Generate Query" to see the result.');
    }
    
    // Function to update bbox area display for the second tab
    function updateBboxArea2() {
        const south = parseFloat(bboxInputs2.south.value);
        const north = parseFloat(bboxInputs2.north.value);
        const west = parseFloat(bboxInputs2.west.value);
        const east = parseFloat(bboxInputs2.east.value);
        
        if (isNaN(south) || isNaN(north) || isNaN(west) || isNaN(east)) {
            bboxAreaSpan2.textContent = '';
            return 0;
        }
        
        // Simple approximation for small areas (not accounting for Earth's curvature)
        const latDiff = Math.abs(north - south);
        const lonDiff = Math.abs(east - west);
        const latMid = (south + north) / 2;
        
        // Convert degrees to km (approximate)
        const latToKm = 111.32; // 1 degree of latitude is ~111.32 km
        const lonToKm = 111.32 * Math.cos(latMid * Math.PI / 180); // Adjust for longitude
        
        const areaKm2 = (latDiff * latToKm) * (lonDiff * lonToKm);
        
        // Update the display
        bboxAreaSpan2.textContent = `Area: ${areaKm2.toFixed(2)} km²`;
        
        return areaKm2;
    }
    
    // Function to search place for the second tab
    async function searchPlace2(query, isTyping = false) {
        if (!query.trim()) {
            if (!isTyping) {
                showToast2('Please enter a place name to search', 'warning');
            }
            searchResultsContainer2.classList.add('d-none');
            return [];
        }
        
        try {
            // Show loading state only for explicit searches, not for typing
            let originalButtonText = '';
            
            if (!isTyping && searchPlaceBtn2) {
                originalButtonText = searchPlaceBtn2.innerHTML;
                searchPlaceBtn2.disabled = true;
                searchPlaceBtn2.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Searching...';
            }
            
            // Show results container when typing
            if (isTyping) {
                searchResultsList2.innerHTML = '<div class="list-group-item">Searching...</div>';
                searchResultsContainer2.classList.remove('d-none');
            }
            
            const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&dedupe=1`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            let data = await response.json();
            
            // Reset button state if it exists
            if (searchPlaceBtn2) {
                searchPlaceBtn2.disabled = false;
                searchPlaceBtn2.innerHTML = originalButtonText || 'Search';
            }
            
            if (!Array.isArray(data) || data.length === 0) {
                if (searchResultsContainer2) {
                    searchResultsList2.innerHTML = '<div class="list-group-item">No results found</div>';
                    searchResultsContainer2.classList.remove('d-none');
                }
                showToast2('No results found for your search', 'info');
                return [];
            }
            
            // Sort by importance
            data.sort((a, b) => (b.importance || 0) - (a.importance || 0));
            
            // Clear previous results
            searchResultsList2.innerHTML = '';
            
            // Process and display each result
            data.slice(0, 5).forEach(result => {
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
                const locationParts = [];
                if (address.city) locationParts.push(address.city);
                else if (address.town) locationParts.push(address.town);
                else if (address.village) locationParts.push(address.village);
                
                if (address.state) locationParts.push(address.state);
                else if (address.region) locationParts.push(address.region);
                
                if (address.country) locationParts.push(address.country);
                
                const locationString = locationParts.join(', ');
                
                // Calculate and format the area if bounding box is available
                let areaInfo = '';
                if (result.boundingbox && result.boundingbox.length === 4) {
                    const [south, north, west, east] = result.boundingbox.map(parseFloat);
                    const latDiff = Math.abs(north - south);
                    const lonDiff = Math.abs(east - west);
                    const latMid = (south + north) / 2;
                    const latToKm = 110.574; // 1 degree of latitude is ~110.574 km
                    const lonToKm = 111.32 * Math.cos(latMid * Math.PI / 180); // Adjust for longitude
                    
                    const areaKm2 = (latDiff * latToKm) * (lonDiff * lonToKm);
                    
                    // Format the area with appropriate units
                    if (areaKm2 < 0.01) {
                        areaInfo = `${(areaKm2 * 1000000).toFixed(0)} m²`; // square meters
                    } else if (areaKm2 < 1) {
                        areaInfo = `${(areaKm2 * 100).toFixed(2)} ha`; // hectares
                    } else if (areaKm2 < 1000) {
                        areaInfo = `${areaKm2.toFixed(2)} km²`; // square kilometers
                    } else if (areaKm2 < 1000000) {
                        areaInfo = `${(areaKm2 / 100).toFixed(1)} km²`; // thousands of km²
                    } else {
                        areaInfo = `${(areaKm2 / 1000).toFixed(1)}k km²`; // millions of km²
                    }
                }

                // Set the item content with area information
                item.innerHTML = `
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${areaDisplayName}</h6>
                        <div class="d-flex flex-column align-items-end">
                            <small class="text-nowrap">${type}</small>
                            ${areaInfo ? `<small class="text-nowrap text-muted">${areaInfo}</small>` : ''}
                        </div>
                    </div>
                    <small class="text-muted d-block">${locationString}</small>
                `;
                
                // Add click handler for the result item
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (e.altKey) {
                        // Use relation ID if available
                        if (result.osm_type === 'relation') {
                            const relationId = result.osm_id;
                            placeSearchInput2.value = `r${relationId}`;
                            // Clear bbox inputs
                            bboxInputs2.south.value = '';
                            bboxInputs2.north.value = '';
                            bboxInputs2.west.value = '';
                            bboxInputs2.east.value = '';
                            // Show success message
                            showToast2(`Using relation ID: r${relationId}`, 'success');
                            // Generate query with relation ID
                            generateQuery2();
                        } else {
                            showToast2('No relation ID available for this location', 'warning');
                        }
                    } else if (e.shiftKey || e.ctrlKey) {
                        // Use area name - get the primary name (first part before comma)
                        const primaryName = result.display_name.split(',')[0].trim();
                        placeSearchInput2.value = primaryName;
                        searchResultsContainer2.classList.add('d-none');
                        // Clear bbox inputs
                        bboxInputs2.south.value = '';
                        bboxInputs2.north.value = '';
                        bboxInputs2.west.value = '';
                        bboxInputs2.east.value = '';
                        // Show success message
                        showToast2(`Using area: ${primaryName}`, 'success');
                        // Generate query with area name
                        generateQuery2();
                    } else {
                        // Default: use bounding box
                        if (result.boundingbox && result.boundingbox.length === 4) {
                            bboxInputs2.south.value = result.boundingbox[0];
                            bboxInputs2.west.value = result.boundingbox[2];
                            bboxInputs2.north.value = result.boundingbox[1];
                            bboxInputs2.east.value = result.boundingbox[3];
                            
                            // Update the area display
                            updateBboxArea2();
                            
                            // Set the search input to the display name
                            placeSearchInput2.value = areaDisplayName;
                            
                            // Hide the results
                            searchResultsContainer2.classList.add('d-none');
                            
                            // Show success message
                            showToast2(`Bounding box set to ${areaDisplayName}`);
                        }
                    }
                });
                
                searchResultsList2.appendChild(item);
            });
            
            return data;
        } catch (error) {
            console.error('Error searching for place:', error);
            searchResultsList2.innerHTML = '<div class="list-group-item text-danger">Error searching for place. Please try again.</div>';
            return [];
        }
    }
    
    // Function to fetch values for a specific key from Taginfo
    async function fetchValuesForKey(key, valueInput) {
        if (!key || !valueInput) return;
        
        try {
            const response = await fetch(`https://taginfo.openstreetmap.org/api/4/key/values?key=${encodeURIComponent(key)}&page=1&rp=10&sortname=count&sortorder=desc`);
            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                const items = valueInput.nextElementSibling;
                items.innerHTML = '';
                
                data.data.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'autocomplete-item';
                    div.innerHTML = `
                        <div class="d-flex justify-content-between">
                            <span>${item.value}</span>
                            <span class="text-muted small">${item.count.toLocaleString()}</span>
                        </div>
                    `;
                    div.addEventListener('click', (e) => {
                        e.stopPropagation();
                        valueInput.value = item.value;
                        items.style.display = 'none';
                    });
                    items.appendChild(div);
                });
                
                items.style.display = 'block';
            }
        } catch (error) {
            console.error('Error fetching values for key:', error);
        }
    }
    
    // Initialize autocomplete for the second tab
    function initializeAutocomplete(input) {
        input.addEventListener('input', debounce2(function() {
            const query = this.value.trim();
            const items = this.nextElementSibling;
            
            if (!query) {
                items.innerHTML = '';
                items.style.display = 'none';
                return;
            }
            
            // Show loading state
            items.innerHTML = '<div class="autocomplete-item text-muted">Searching...</div>';
            items.style.display = 'block';
            
            // Determine if this is a key or value input
            const isKeyInput = this.classList.contains('key-2');
            let url;
            
            if (isKeyInput) {
                // Search for keys
                url = `https://taginfo.openstreetmap.org/api/4/keys/all?query=${encodeURIComponent(query)}&page=1&rp=10&sortname=count_all&sortorder=desc`;
            } else {
                // Search for values within the current key
                const keyInput = this.closest('.row').querySelector('.key-2');
                const key = keyInput ? keyInput.value.trim() : '';
                
                if (!key) {
                    items.innerHTML = '<div class="autocomplete-item text-muted">Enter a key first</div>';
                    return;
                }
                
                url = `https://taginfo.openstreetmap.org/api/4/key/values?key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}&page=1&rp=10&sortname=count&sortorder=desc`;
            }
            
            fetch(url)
                .then(response => response.json())
                .then(data => {
                    items.innerHTML = '';
                    
                    if (!data.data || data.data.length === 0) {
                        items.innerHTML = '<div class="autocomplete-item text-muted">No results found</div>';
                        return;
                    }
                    
                    data.data.forEach(item => {
                        const div = document.createElement('div');
                        div.className = 'autocomplete-item';
                        
                        if (isKeyInput) {
                            // For keys, show key name and total count
                            div.innerHTML = `
                                <div class="d-flex justify-content-between">
                                    <span>${item.key}</span>
                                    <span class="text-muted small">${item.count_all.toLocaleString()}</span>
                                </div>
                                <div class="small text-muted">${item.values_all.toLocaleString()} values</div>
                            `;
                            
                            div.addEventListener('click', () => {
                                this.value = item.key;
                                items.style.display = 'none';
                                
                                // If this is a key input, fetch and show values
                                if (isKeyInput) {
                                    const valueInput = this.closest('.row').querySelector('.value-2');
                                    if (valueInput) {
                                        valueInput.value = '';
                                        fetchValuesForKey(item.key, valueInput);
                                    }
                                }
                            });
                        } else {
                            // For values, show value and count
                            div.innerHTML = `
                                <div class="d-flex justify-content-between">
                                    <span>${item.value}</span>
                                    <span class="text-muted small">${item.count.toLocaleString()}</span>
                                </div>
                            `;
                            
                            div.addEventListener('click', (e) => {
                                e.stopPropagation();
                                this.value = item.value;
                                items.style.display = 'none';
                            });
                        }
                        
                        items.appendChild(div);
                    });
                    
                    items.style.display = 'block';
                })
                .catch(error => {
                    console.error('Error fetching autocomplete data:', error);
                    items.innerHTML = '<div class="autocomplete-item text-danger">Error loading results</div>';
                });
        }, 300));
        
        // Hide autocomplete when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target !== input) {
                const items = input.nextElementSibling;
                items.style.display = 'none';
            }
        });
    }
    
    // Debounce function for the second tab
    function debounce2(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
    
    // Initialize autocomplete for the initial inputs
    document.querySelectorAll('.key-2, .value-2').forEach(input => {
        initializeAutocomplete(input);
    });

    // Export functionality for the second tab
    document.getElementById('exportCSV-2')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (lastQueryResult2) {
            exportData2('csv');
        } else {
            showToast2('No query results to export', 'warning');
        }
    });

    document.getElementById('exportJSON-2')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (lastQueryResult2) {
            exportData2('json');
        } else {
            showToast2('No query results to export', 'warning');
        }
    });

    document.getElementById('exportGeoJSON-2')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (lastQueryResult2) {
            exportData2('geojson');
        } else {
            showToast2('No query results to export', 'warning');
        }
    });

    // Function to export data in different formats
    async function exportData2(format) {
        if (!lastQueryResult2) {
            showToast2('No query results to export', 'warning');
            return;
        }

        // Show loading state
        const exportButton = document.querySelector(`#export${format.toUpperCase()}-2`);
        const originalText = exportButton?.innerHTML;
        if (exportButton) {
            exportButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Exporting...';
            exportButton.disabled = true;
        }

        try {
            // For CSV, we need to handle the raw response
            if (format === 'csv') {
                // Get the current query
                let query = lastQueryResult2.query;
                
                // If the query doesn't already have CSV output, convert it
                if (!query.includes('[out:csv(')) {
                    // Replace JSON output with CSV output
                    query = query.replace(
                        /\[out:json\]\[timeout:\d+\];/,
                        `[out:csv(::id,::type,name,::lat,::lon,shop)][timeout:${timeout}];`
                    );
                    // Update the output statements for CSV
                    query = query.replace(/out body;\s*>[\s\S]*out skel qt;/, 'out;');
                }
                
                const response = await fetch('https://overpass-api.de/api/interpreter', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    },
                    body: `data=${encodeURIComponent(query)}`
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const csvText = await response.text();
                downloadFile(csvText, 'text/csv;charset=utf-8;', 'csv');
                showToast2('CSV export started!', 'success');
                return;
            }
            
            // For JSON and GeoJSON, use the standard approach
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                },
                body: `data=${encodeURIComponent(lastQueryResult2.query)}`
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            let exportContent = '';
            let mimeType = 'text/plain';
            let extension = 'txt';

            switch (format) {
                case 'csv':
                    exportContent = convertToCSV2(data.elements);
                    mimeType = 'text/csv';
                    extension = 'csv';
                    break;
                case 'json':
                    exportContent = JSON.stringify(data.elements, null, 2);
                    mimeType = 'application/json';
                    extension = 'json';
                    break;
                case 'geojson':
                    exportContent = convertToGeoJSON2(data.elements);
                    mimeType = 'application/geo+json';
                    extension = 'geojson';
                    break;
                default:
                    throw new Error('Unsupported export format');
            }

            // Create and trigger download
            const blob = new Blob([exportContent], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `overpass-export-${new Date().toISOString().slice(0, 10)}.${extension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast2(`Exported as ${format.toUpperCase()} successfully!`, 'success');
        } catch (error) {
            console.error('Export error:', error);
            showToast2(`Export failed: ${error.message}`, 'danger');
        } finally {
            // Reset button state
            if (exportButton) {
                exportButton.innerHTML = originalText;
                exportButton.disabled = false;
            }
        }
    }

    // Convert Overpass elements to CSV format
    function convertToCSV2(elements) {
        if (!elements || elements.length === 0) return '';
        
        // Get the specified columns or use all available keys
        const specifiedColumns = csvColumnsInput2.value.trim()
            .split(',')
            .map(col => col.trim())
            .filter(col => col.length > 0);
        
        // If no columns specified, collect all available keys
        let allKeys = [];
        if (specifiedColumns.length > 0) {
            // Use only the specified columns that exist in the data
            allKeys = specifiedColumns;
        } else {
            // Fallback: collect all unique keys from all elements
            const keysSet = new Set();
            elements.forEach(element => {
                if (element.tags) {
                    Object.keys(element.tags).forEach(key => keysSet.add(key));
                }
            });
            // Add special columns if they're not already included
            ['@id', '@type', '@lat', '@lon', '@user', '@version', '@changeset', '@timestamp'].forEach(key => {
                keysSet.add(key);
            });
            allKeys = Array.from(keysSet);
        }
        
        // Format headers
        const headers = allKeys.map(field => 
            `"${field.replace(/"/g, '""')}"`
        ).join(',');
        
        const rows = elements.map(element => {
            const values = [];
            
            // Process each column
            allKeys.forEach(key => {
                // Handle special columns
                switch(key) {
                    case '@id':
                        values.push(element.id);
                        break;
                    case '@type':
                        values.push(element.type);
                        break;
                    case '@lat':
                        values.push(element.lat || (element.center ? element.center.lat : ''));
                        break;
                    case '@lon':
                        values.push(element.lon || (element.center ? element.center.lon : ''));
                        break;
                    case '@user':
                        values.push(element.user || '');
                        break;
                    case '@version':
                        values.push(element.version || '');
                        break;
                    case '@changeset':
                        values.push(element.changeset || '');
                        break;
                    case '@timestamp':
                        values.push(element.timestamp || '');
                        break;
                    default:
                        // Handle regular tags
                        values.push(element.tags && element.tags[key] !== undefined ? element.tags[key] : '');
                }
            
                // Add the value to the row, properly escaping quotes
                const escapedValue = values[values.length - 1] !== undefined 
                    ? `"${String(values[values.length - 1]).replace(/"/g, '""')}"`
                    : '';
                return escapedValue;
            });
            
            return row.join(',');
        });
        
        return [headers, ...rows].join('\n');
    }

    // Convert Overpass elements to GeoJSON format
    function convertToGeoJSON2(elements) {
        const features = elements
            .filter(element => element.lat !== undefined && element.lon !== undefined)
            .map(element => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(element.lon), parseFloat(element.lat)]
                },
                properties: {
                    id: element.id,
                    type: element.type,
                    ...(element.tags || {})
                }
            }));
        
        return JSON.stringify({
            type: 'FeatureCollection',
            features: features
        }, null, 2);
    }
    
    // Add input event listener for search as you type
    const handleSearchInput = debounce2(() => {
        const query = placeSearchInput2.value.trim();
        if (query.length >= 2) {  // Only search if at least 2 characters
            searchPlace2(query, true);
        } else {
            searchResultsContainer2.classList.add('d-none');
        }
    }, 300);
    
    // Add event listeners for the search input
    placeSearchInput2.addEventListener('input', handleSearchInput);
    
    // Add click handler for the search button
    searchPlaceBtn2.addEventListener('click', (e) => {
        e.preventDefault();
        const query = placeSearchInput2.value.trim();
        if (query) {
            searchPlace2(query);
        } else {
            showToast2('Please enter a place to search', 'warning');
        }
    });
    
    // Add click outside to close results
    document.addEventListener('click', (e) => {
        if (!placeSearchInput2.contains(e.target) && 
            !searchResultsContainer2.contains(e.target) &&
            !searchPlaceBtn2.contains(e.target)) {
            searchResultsContainer2.classList.add('d-none');
        }
    });
    
    // Handle keyboard navigation in search results
    searchResultsContainer2.addEventListener('keydown', (e) => {
        const items = searchResultsContainer2.querySelectorAll('.list-group-item');
        const current = document.activeElement;
        let index = Array.from(items).indexOf(current);
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            index = (index + 1) % items.length;
            items[index].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            index = (index - 1 + items.length) % items.length;
            items[index].focus();
        } else if (e.key === 'Escape') {
            searchResultsContainer2.classList.add('d-none');
            placeSearchInput2.focus();
        }
    });
    
    // Handle enter key in search input
    placeSearchInput2.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = placeSearchInput2.value.trim();
            if (query) {
                searchPlace2(query);
            } else {
                showToast2('Please enter a place to search', 'warning');
            }
        } else if (e.key === 'ArrowDown' && !searchResultsContainer2.classList.contains('d-none')) {
            // Focus the first result when pressing down arrow
            const firstItem = searchResultsContainer2.querySelector('.list-group-item');
            if (firstItem) {
                e.preventDefault();
                firstItem.focus();
            }
        }
    });
    
    // Initialize with an empty search to set up the container
    searchPlace2('', true);
    
    // Add event listener for the clear button
    document.querySelector('.clear-search-2')?.addEventListener('click', () => {
        placeSearchInput2.value = '';
        searchResultsContainer2.classList.add('d-none');
        placeSearchInput2.focus();
    });
});
