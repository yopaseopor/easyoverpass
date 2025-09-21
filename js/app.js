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
            document.getElementById('searchResults').classList.add('d-none');
            return [];
        }
        
        try {
            // Show loading state only for explicit searches, not for typing
            const searchButton = document.getElementById('searchPlace');
            const searchInput = document.getElementById('placeSearch');
            const resultsContainer = document.getElementById('searchResults');
            let originalButtonText = '';
            
            if (!isTyping && searchButton) {
                originalButtonText = searchButton.innerHTML;
                searchButton.disabled = true;
                searchButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Searching...';
            }
            
            // Show results container when typing
            if (isTyping) {
                resultsContainer.innerHTML = '<div class="list-group search-results-list"></div>';
                resultsContainer.classList.remove('d-none');
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
                if (resultsContainer) {
                    resultsContainer.innerHTML = '<div class="list-group-item">No results found</div>';
                    resultsContainer.classList.remove('d-none');
                }
                showToast('No results found for your search', 'info');
                return [];
            }
            
            // Sort by importance
            data.sort((a, b) => (b.importance || 0) - (a.importance || 0));
            
            // Get the results list container
            const resultsList = resultsContainer.querySelector('.search-results-list');
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
                const locationParts = [];
                const addIfExists = (key) => {
                    if (address && address[key] && !locationParts.includes(address[key])) {
                        locationParts.push(address[key]);
                    }
                };
                
                // Add relevant location parts in order of specificity
                ['city', 'town', 'village', 'hamlet', 'municipality', 'county', 'state', 'region', 'country'].forEach(addIfExists);
                
                // Type badge with icon
                const typeIcons = {
                    'city': 'building',
                    'town': 'building',
                    'village': 'house',
                    'hamlet': 'house',
                    'suburb': 'pin-map',
                    'neighbourhood': 'pin-map',
                    'administrative': 'geo-alt',
                    'state': 'geo-alt',
                    'country': 'globe',
                    'default': 'geo'
                };
                
                const typeIcon = typeIcons[type] || typeIcons.default;
                
                // Check if this is a relation (has osm_type='relation' or is an administrative boundary)
                const isRelation = result.osm_type === 'relation' || 
                                 (result.type && result.type.includes('administrative'));
                const relationId = isRelation ? result.osm_id : null;
                
                // Calculate area size if bbox is available
                let areaSize = null;
                if (result.boundingbox && result.boundingbox.length === 4) {
                    const [south, north, west, east] = result.boundingbox.map(parseFloat);
                    // Convert degrees to km (approximate)
                    const latLength = 111.32; // km per degree of latitude
                    const lngLength = 111.32 * Math.cos((south + north) * Math.PI / 360); // km per degree of longitude at this latitude
                    const width = (east - west) * lngLength;
                    const height = (north - south) * latLength;
                    areaSize = (width * height).toFixed(2); // in km²
                }
                
                item.innerHTML = `
                    <div class="d-flex w-100 justify-content-between align-items-start">
                        <div class="w-100">
                            <div class="d-flex align-items-center gap-2 mb-1">
                                <h6 class="mb-0 flex-grow-1">${name}</h6>
                                <span class="badge bg-secondary">
                                    <i class="bi bi-${typeIcon} me-1"></i>${type}
                                </span>
                                ${relationId ? `
                                    <span class="badge bg-info" title="Relation ID">
                                        <i class="bi bi-diagram-3 me-1"></i>${relationId}
                                    </span>
                                ` : ''}
                            </div>
                            
                            <div class="d-flex flex-wrap align-items-center gap-2 small text-muted mb-2">
                                ${locationParts.length > 0 ? `
                                    <span class="d-flex align-items-center">
                                        <i class="bi bi-geo-alt-fill me-1"></i>
                                        ${locationParts.join(' › ')}
                                    </span>
                                ` : ''}
                                ${areaSize ? `
                                    <span class="badge bg-light text-dark border d-flex align-items-center" title="Approximate area size">
                                        <i class="bi bi-arrows-fullscreen me-1"></i>${areaSize} km²
                                    </span>
                                ` : ''}
                            </div>
                            
                            <div class="d-flex flex-wrap gap-2 mt-2">
                                <span class="badge bg-primary">
                                    <i class="bi bi-bounding-box me-1"></i>Click for BBox
                                </span>
                                <span class="badge bg-success">
                                    <i class="bi bi-signpost me-1"></i>Shift+Click for Area Name
                                </span>
                                ${relationId ? `
                                    <span class="badge bg-info">
                                        <i class="bi bi-diagram-3 me-1"></i>Alt+Click for Relation ID
                                    </span>
                                ` : ''}
                            </div>
                `;
                
                // Add click handler for the result item
                // Create a closure to capture the result for this item
                (function(result) {
                    item.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Get the search input and results container
                        const searchInput = document.getElementById('placeSearch');
                        const resultsContainer = document.getElementById('searchResults');
                        const isRelation = result.osm_type === 'relation' || 
                                         (result.type && result.type.includes('administrative'));
                        const relationId = isRelation ? result.osm_id : null;
                        
                        if (e.altKey && relationId) {
                            // Use relation ID
                            const overpassRelationId = parseInt(relationId) + 3600000000;
                            searchInput.value = `relation:${relationId}`;
                            resultsContainer.classList.add('d-none');
                            
                            // Clear bbox inputs
                            document.getElementById('south').value = '';
                            document.getElementById('north').value = '';
                            document.getElementById('west').value = '';
                            document.getElementById('east').value = '';
                            
                            // Show success message with both original and Overpass relation IDs
                            showToast(`Using relation ID: ${relationId} (Overpass ID: ${overpassRelationId}) - ${result.display_name}`, 'info');
                            
                            // Generate query with relation ID
                            generateQuery();
                        }
                        else if (e.shiftKey || e.ctrlKey) {
                            // Use area name - get the primary name (first part before comma)
                            const primaryName = result.display_name.split(',')[0].trim();
                            searchInput.value = primaryName;
                            resultsContainer.classList.add('d-none');
                            
                            // Clear bbox inputs
                            document.getElementById('south').value = '';
                            document.getElementById('north').value = '';
                            document.getElementById('west').value = '';
                            document.getElementById('east').value = '';
                            
                            // Show success message
                            showToast(`Using area: ${primaryName}`, 'success');
                            
                            // Generate query with area name
                            generateQuery();
                        } else {
                            // Use bbox if available
                            if (result.boundingbox && result.boundingbox.length === 4) {
                                setBbox(
                                    parseFloat(result.boundingbox[0]), // south
                                    parseFloat(result.boundingbox[2]), // west
                                    parseFloat(result.boundingbox[1]), // north
                                    parseFloat(result.boundingbox[3])  // east
                                );
                                
                                searchInput.value = result.display_name;
                                resultsContainer.classList.add('d-none');
                                
                                // Show toast with the area size
                                const area = calculateBboxArea();
                                showToast(
                                    `Set bounding box for ${result.display_name.split(',')[0]} (${area.toFixed(2)} km²). ` + 
                                    `Hold Shift+Click to use area name. ` + 
                                    (relationId ? `Alt+Click to use relation ID ${relationId}` : ''), 
                                    'success'
                                );
                            }
                        }
                    });
                })(result);
                
                // Add the item to the results list
                resultsList.appendChild(item);
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
        // Get the active tab's output element
        const activeTab = document.querySelector('.tab-pane.active');
        const outputElement = activeTab ? activeTab.querySelector('.query-output') : null;
        
        if (!outputElement) {
            console.error('Could not find active query output element');
            return;
        }
        
        // Get all condition elements from the active tab
        const conditionElements = activeTab.querySelectorAll('.condition-group');
        
        if (conditionElements.length === 0) {
            outputElement.textContent = '// Add at least one condition to generate a query';
            return;
        }
        
        // Get area name/relation ID from search input if bbox is empty
        const areaInput = placeSearchInput.value.trim();
        const hasAreaInput = areaInput !== '';
        const isRelationId = areaInput.startsWith('relation:');
        const relationId = isRelationId ? areaInput.replace('relation:', '') : null;
        
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
                outputElement.textContent = '// Error: Invalid bounding box coordinates. Please check your values.';
                return;
            }
        }
        // If relation ID is provided, validate it
        else if (isRelationId && (!/^\d+$/.test(relationId) || !relationId)) {
            outputElement.textContent = '// Error: Invalid relation ID. Please use a valid numeric ID after "relation:"';
            return;
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
            if (hasAreaInput && !hasBbox) {
                // For area queries, we need to build it differently
                query = ''; // Reset query to build from scratch
                
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
                query = ''; // Reset query to include bbox info
                if (hasBbox) {
                    query += `// Using bounding box: ${bbox.south},${bbox.west},${bbox.north},${bbox.east}\n`;
                } else {
                    query += '// Using current map view bbox\n';
                }
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
    
    // Generate Overpass QL for OSM ID
    function generateOsmIdQuery() {
        const elementType = document.getElementById('osmElementType').value;
        const osmId = document.getElementById('osmId').value.trim();
        const recurseDown = document.getElementById('recurseDown').checked;
        const outputElement = document.getElementById('queryOutputId');
        
        if (!osmId) {
            showToast('Please enter an OSM ID', 'warning');
            return;
        }
        
        // Base query for Overpass Turbo and display
        let query = `[out:json][timeout:${getTimeout()}];
`;
        
        if (recurseDown) {
            query += `(
  ${elementType}(${osmId});
  >;
);
`;
        } else {
            query += `${elementType}(${osmId});
`;
        }
        
        query += `out body;
>;
out skel qt;`;
        
        outputElement.textContent = query;
        
        // Overpass Turbo link
        const turboUrl = 'https://overpass-turbo.eu/?Q=' + encodeURIComponent(query);
        document.getElementById('openInOverpassTurboId').href = turboUrl;
        
        // Overpass Ultra link - use direct URL format
        document.getElementById('openInOverpassUltraId').onclick = (e) => {
            e.preventDefault();
            // Overpass Ultra expects a simpler format for direct element queries
            const baseUrl = 'https://overpass-ultra.us/';
            const query = `[out:json];
${elementType}(${osmId});
out body;`;
            
            // Encode the query for URL
            const encodedQuery = encodeURIComponent(query);
            window.open(`${baseUrl}#${encodedQuery}`, '_blank');
        };
    }
    
    // Copy OSM ID query to clipboard
    document.getElementById('copyQueryId')?.addEventListener('click', () => {
        const query = document.getElementById('queryOutputId')?.textContent;
        if (query && query.trim() !== '// Your generated Overpass QL query will appear here') {
            navigator.clipboard.writeText(query.trim())
                .then(() => showToast('Query copied to clipboard!', 'success'))
                .catch(err => {
                    console.error('Failed to copy query: ', err);
                    showToast('Failed to copy query', 'danger');
                });
        } else {
            showToast('No query to copy', 'warning');
        }
    });

    // Event Listeners
    document.getElementById('generateOsmIdQuery')?.addEventListener('click', generateOsmIdQuery);
    
    // Handle Enter key in OSM ID input
    document.getElementById('osmId')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            generateOsmIdQuery();
        }
    });
    
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
    
    // Generate query when any input changes in the first tab
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
