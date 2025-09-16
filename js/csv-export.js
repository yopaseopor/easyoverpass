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
            searchResultsContainer.classList.add('d-none');
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
            if (isTyping) {
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
            const resultsList = searchResultsContainer.querySelector('.csv-search-results-list');
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
                    'country': 'globe',
                    'state': 'geo-alt',
                    'region': 'geo-alt',
                    'county': 'geo-alt',
                    'municipality': 'building',
                    'postcode': 'mailbox',
                    'road': 'signpost',
                    'house': 'house',
                    'place': 'geo'
                };
                
                const icon = typeIcons[type] || 'geo-alt';
                
                // Create the result item content
                const itemContent = document.createElement('div');
                itemContent.className = 'd-flex w-100 justify-content-between align-items-center';
                
                // Left side: Icon and name
                const leftContent = document.createElement('div');
                leftContent.className = 'd-flex align-items-center';
                
                // Icon
                const iconDiv = document.createElement('div');
                iconDiv.className = 'me-2 text-primary';
                iconDiv.innerHTML = `<i class="bi bi-${icon}"></i>`;
                
                // Name
                const nameDiv = document.createElement('div');
                nameDiv.className = 'fw-bold';
                nameDiv.textContent = areaDisplayName;
                
                leftContent.appendChild(iconDiv);
                leftContent.appendChild(nameDiv);
                
                // Right side: Type badge
                const rightContent = document.createElement('div');
                const typeSpan = document.createElement('span');
                typeSpan.className = 'badge bg-secondary';
                typeSpan.textContent = type;
                rightContent.appendChild(typeSpan);
                
                // Add to item content
                itemContent.appendChild(leftContent);
                itemContent.appendChild(rightContent);
                
                // Address line with area size if available
                const addressDiv = document.createElement('div');
                addressDiv.className = 'small text-muted mt-1';
                
                // Calculate and display area size if bbox is available
                let areaSize = '';
                if (result.boundingbox) {
                    const [south, north, west, east] = result.boundingbox.map(Number);
                    const latDiff = Math.abs(north - south);
                    const lonDiff = Math.abs(east - west);
                    const latMid = (south + north) / 2;
                    
                    // Convert degrees to km (approximate)
                    const latKm = latDiff * 110.574;  // 1° latitude ≈ 110.574 km
                    const lonKm = lonDiff * (111.320 * Math.cos(latMid * Math.PI / 180));
                    
                    const areaKm2 = latKm * lonKm;
                    areaSize = areaKm2 < 1 ? 
                        `${Math.round(areaKm2 * 100)} ha` : 
                        areaKm2 < 100 ? 
                            `${areaKm2.toFixed(1)} km²` : 
                            `${Math.round(areaKm2)} km²`;
                }
                
                const addressContent = document.createElement('div');
                addressContent.className = 'd-flex justify-content-between align-items-center';
                
                const addressText = document.createElement('span');
                addressText.textContent = resultDisplayName;
                
                addressContent.appendChild(addressText);
                
                if (areaSize) {
                    const sizeBadge = document.createElement('span');
                    sizeBadge.className = 'badge bg-light text-dark ms-2';
                    sizeBadge.innerHTML = `<i class="bi bi-arrows-fullscreen me-1"></i>${areaSize}`;
                    addressContent.appendChild(sizeBadge);
                }
                
                addressDiv.appendChild(addressContent);
                
                // Add to item
                item.appendChild(itemContent);
                item.appendChild(addressDiv);
                
                // Store bounding box data
                if (result.boundingbox) {
                    item.dataset.boundingbox = result.boundingbox.join(',');
                    item.dataset.lat = result.lat;
                    item.dataset.lon = result.lon;
                }
                
                // Add click handler for the result item
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (e.shiftKey || e.ctrlKey) {
                        // Use area name - get the primary name (first part before comma)
                        const primaryName = result.display_name.split(',')[0].trim();
                        placeSearchInput.value = primaryName;
                        searchResultsContainer.classList.add('d-none');
                        
                        // Clear bbox inputs
                        document.getElementById('csv-south').value = '';
                        document.getElementById('csv-north').value = '';
                        document.getElementById('csv-west').value = '';
                        document.getElementById('csv-east').value = '';
                        
                        // Show success message
                        showToast(`Using area: ${primaryName}`, 'success');
                        
                        // Generate query with area name
                        generateQuery();
                    } else if (e.altKey && result.osm_id && result.osm_type) {
                        // Use relation ID if available (for administrative boundaries)
                        const relationId = result.osm_id;
                        const overpassRelationId = parseInt(relationId) + 3600000000;
                        placeSearchInput.value = `R${relationId}`;
                        searchResultsContainer.classList.add('d-none');
                        
                        // Clear bbox inputs
                        document.getElementById('csv-south').value = '';
                        document.getElementById('csv-north').value = '';
                        document.getElementById('csv-west').value = '';
                        document.getElementById('csv-east').value = '';
                        
                        // Show success message with both original and Overpass relation IDs
                        showToast(`Using relation ID: ${relationId} (Overpass ID: ${overpassRelationId})`, 'info');
                        
                        // Generate query with relation ID
                        generateQuery();
                    } else if (result.boundingbox) {
                        // Default: Use bounding box
                        const bbox = result.boundingbox.map(Number);
                        setBbox(bbox[0], bbox[2], bbox[1], bbox[3]);
                        
                        // Set the search input to the primary name
                        placeSearchInput.value = primaryName;
                        
                        // Hide the results
                        searchResultsContainer.classList.add('d-none');
                        
                        // Generate the query
                        generateQuery();
                    }
                });
                
                // Add tooltips and badges for keyboard shortcuts
                const isRelation = result.osm_type === 'relation' || 
                                 (result.type && result.type.includes('administrative'));
                const relationId = isRelation ? result.osm_id : null;
                
                // Add badges for keyboard shortcuts
                const shortcutsDiv = document.createElement('div');
                shortcutsDiv.className = 'd-flex flex-wrap gap-2 mt-2';
                
                // BBox badge
                const bboxBadge = document.createElement('span');
                bboxBadge.className = 'badge bg-primary';
                bboxBadge.innerHTML = '<i class="bi bi-bounding-box me-1"></i>Click for BBox';
                shortcutsDiv.appendChild(bboxBadge);
                
                // Area name badge
                const areaBadge = document.createElement('span');
                areaBadge.className = 'badge bg-success';
                areaBadge.innerHTML = '<i class="bi bi-signpost me-1"></i>Shift+Click for Area';
                shortcutsDiv.appendChild(areaBadge);
                
                // Relation ID badge (only if it's a relation)
                if (relationId) {
                    const relationBadge = document.createElement('span');
                    relationBadge.className = 'badge bg-info';
                    relationBadge.innerHTML = '<i class="bi bi-diagram-3 me-1"></i>Alt+Click for Relation';
                    shortcutsDiv.appendChild(relationBadge);
                }
                
                item.appendChild(shortcutsDiv);
                
                // Add tooltip with full instructions
                item.title = [
                    'Click: Use bounding box',
                    'Shift+Click: Use area name',
                    relationId ? 'Alt+Click: Use relation ID' : ''
                ].filter(Boolean).join(' | ');
                
                resultsList.appendChild(item);
            });
            
            // Show the results container
            searchResultsContainer.classList.remove('d-none');
            
            return data;
        } catch (error) {
            console.error('Error searching for place:', error);
            showToast('Error searching for place. Please try again later.', 'danger');
            
            // Reset button state if it exists
            const searchButton = document.getElementById('csv-searchPlace');
            if (searchButton) {
                searchButton.disabled = false;
                searchButton.innerHTML = '<i class="bi bi-search"></i>';
            }
            
            return [];
        }
    }
    
            return;
        }
        
        const useCSV = document.getElementById('csv-output-format')?.checked;
        
        if (useCSV) {
            // For CSV output mode, the data is already in CSV format
            if (typeof lastQueryResult === 'string') {
                csvContent = lastQueryResult;
            } else if (lastQueryResult.elements) {
                // Fallback to JSON conversion if we have elements
                csvContent = convertToCSV(lastQueryResult.elements);
            } else {
                throw new Error('No valid data to export');
            }
        } else {
            // For standard JSON output, convert to CSV
            if (lastQueryResult.elements && lastQueryResult.elements.length > 0) {
                csvContent = convertToCSV(lastQueryResult.elements);
            } else {
                throw new Error('No data to export');
            }
        }
        
        // Create a blob and download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `overpass-export-${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        
        // Add to the document, trigger download, and clean up
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Update status
        if (exportStatus) {
            exportStatus.innerHTML = '<div class="alert alert-success">Export completed successfully!</div>';
        }
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast(error.message || 'Error exporting data. Please try again.', 'danger');
    } finally {
        // Reset button state
        const exportButton = document.getElementById('csv-exportData');
        if (exportButton) {
            exportButton.disabled = false;
            exportButton.innerHTML = '<i class="bi bi-download"></i> Export as CSV';
            }
        }
    }
    
    // Convert Overpass elements to CSV
    function convertToCSV(elements) {
        if (!elements || elements.length === 0) {
            return '';
        }
        
        // Collect all unique keys from all elements
        const allKeys = new Set();
        elements.forEach(element => {
            if (element.tags) {
                Object.keys(element.tags).forEach(key => {
                    allKeys.add(key);
                });
            }
        });
        
        // Define the header row
        const headers = ['id', 'type', 'lat', 'lon', ...Array.from(allKeys)];
        
        // Build the CSV rows
        const rows = [headers.join(',')];
        
        // Add data rows
        elements.forEach(element => {
            const row = [
                element.id || '',
                element.type || '',
                element.lat || (element.center ? element.center.lat : ''),
                element.lon || (element.center ? element.center.lon : '')
            ];
            
            // Add tag values in the same order as headers
            headers.slice(4).forEach(header => {
                const value = element.tags && element.tags[header] ? 
                    `"${element.tags[header].replace(/"/g, '""')}"` : '';
                row.push(value);
            });
            
            rows.push(row.join(','));
        });
        
        return rows.join('\n');
    }
    
    // Add a new condition row
    function addCondition(condition = {}) {
        const conditionGroup = document.createElement('div');
        conditionGroup.className = 'condition-group mt-3';
        
        const row = document.createElement('div');
        row.className = 'row g-3';
        
        // Element Type
        const elementTypeCol = document.createElement('div');
        elementTypeCol.className = 'col-md-3';
        const elementTypeLabel = document.createElement('label');
        elementTypeLabel.className = 'form-label small text-muted mb-1 d-block';
        elementTypeLabel.textContent = 'Element Type';
        const elementTypeSelect = document.createElement('select');
        elementTypeSelect.className = 'form-select csv-element-type';
        elementTypeSelect.innerHTML = `
            <option value="node" ${condition.elementType === 'node' ? 'selected' : ''}>Node</option>
            <option value="way" ${condition.elementType === 'way' ? 'selected' : ''}>Way</option>
            <option value="relation" ${condition.elementType === 'relation' ? 'selected' : ''}>Relation</option>
            <option value="nwr" ${!condition.elementType || condition.elementType === 'nwr' ? 'selected' : ''}>Node/Way/Relation</option>
        `;
        elementTypeCol.appendChild(elementTypeLabel);
        elementTypeCol.appendChild(elementTypeSelect);
        
        // Key
        const keyCol = document.createElement('div');
        keyCol.className = 'col-md-3';
        const keyLabel = document.createElement('label');
        keyLabel.className = 'form-label small text-muted mb-1 d-block';
        keyLabel.textContent = 'Key';
        const keyDiv = document.createElement('div');
        keyDiv.className = 'autocomplete';
        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.className = 'form-control csv-key';
        keyInput.placeholder = 'e.g., amenity, shop';
        keyInput.required = true;
        keyInput.autocomplete = 'off';
        keyInput.value = condition.key || '';
        const keyAutocompleteDiv = document.createElement('div');
        keyAutocompleteDiv.className = 'autocomplete-items';
        keyDiv.appendChild(keyInput);
        keyDiv.appendChild(keyAutocompleteDiv);
        keyCol.appendChild(keyLabel);
        keyCol.appendChild(keyDiv);
        
        // Operator
        const operatorCol = document.createElement('div');
        operatorCol.className = 'col-md-2';
        const operatorLabel = document.createElement('label');
        operatorLabel.className = 'form-label small text-muted mb-1 d-block';
        operatorLabel.textContent = 'Operator';
        const operatorSelect = document.createElement('select');
        operatorSelect.className = 'form-select csv-operator';
        operatorSelect.innerHTML = `
            <option value="=" ${condition.operator === '=' ? 'selected' : ''}>=</option>
            <option value="!=" ${condition.operator === '!=' ? 'selected' : ''}>≠</option>
            <option value="~" ${condition.operator === '~' ? 'selected' : ''}>~</option>
            <option value="!~" ${condition.operator === '!~' ? 'selected' : ''}>!~</option>
            <option value="^~" ${condition.operator === '^~' ? 'selected' : ''}>^~</option>
            <option value="!^~" ${condition.operator === '!^~' ? 'selected' : ''}>!^~</option>
        `;
        operatorCol.appendChild(operatorLabel);
        operatorCol.appendChild(operatorSelect);
        
        // Value
        const valueCol = document.createElement('div');
        valueCol.className = 'col-md-3';
        const valueLabel = document.createElement('label');
        valueLabel.className = 'form-label small text-muted mb-1 d-block';
        valueLabel.textContent = 'Value';
        const valueDiv = document.createElement('div');
        valueDiv.className = 'autocomplete';
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'form-control csv-value';
        valueInput.placeholder = 'e.g., restaurant, cafe';
        valueInput.autocomplete = 'off';
        valueInput.value = condition.value || '';
        const valueAutocompleteDiv = document.createElement('div');
        valueAutocompleteDiv.className = 'autocomplete-items';
        valueDiv.appendChild(valueInput);
        valueDiv.appendChild(valueAutocompleteDiv);
        valueCol.appendChild(valueLabel);
        valueCol.appendChild(valueDiv);
        
        // Remove button
        const removeCol = document.createElement('div');
        removeCol.className = 'col-md-1 d-flex align-items-end';
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-outline-danger btn-sm csv-remove-condition';
        removeBtn.innerHTML = '<i class="bi bi-trash"></i>';
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            conditionGroup.remove();
            generateQuery();
        });
        removeCol.appendChild(removeBtn);
        
        // Assemble the row
        row.appendChild(elementTypeCol);
        row.appendChild(keyCol);
        row.appendChild(operatorCol);
        row.appendChild(valueCol);
        row.appendChild(removeCol);
        
        // Add the row to the condition group
        conditionGroup.appendChild(row);
        
        // Add the condition group to the container
        if (queryConditions) {
            queryConditions.appendChild(conditionGroup);
        }
        
        // Initialize autocomplete for key and value inputs
        new TagInfoAutocomplete(keyInput, 'key', () => {
            // When a key is selected, clear the value input
            valueInput.value = '';
            generateQuery();
        });
        
        new TagInfoAutocomplete(valueInput, 'value', generateQuery);
        
        // Add change listeners to update the query when inputs change
        [elementTypeSelect, operatorSelect].forEach(input => {
            input.addEventListener('change', generateQuery);
        });
        
        return conditionGroup;
    }
    
    // Initialize autocomplete for key/value inputs using TagInfoAutocomplete
    // This is now handled by the TagInfoAutocomplete class from autocomplete.js
    
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
            
            // Start building the query
            let query = '';
            
            // Add timeout and output format
            query += `[out:json][timeout:${getTimeout()}];\n\n`;
            
            // Add area search if place search is used
            if (hasPlaceSearch) {
                // Check if this is a relation ID (starts with R, r, or just a number)
                const relationMatch = placeSearch.match(/^[Rr]?\s*(\d+)$/);
                
                if (relationMatch) {
                    // It's a relation ID - add 3600000000 to get the Overpass relation ID
                    const relationId = parseInt(relationMatch[1]);
                    const overpassRelationId = relationId < 3600000000 ? relationId + 3600000000 : relationId;
                    query += `area(${overpassRelationId})->.searchArea;\n\n`;
                    showToast(`Using relation ID: ${relationId} (Overpass ID: ${overpassRelationId})`, 'info');
                } else {
                    // It's a place name
                    query += `area[name="${placeSearch}"]->.searchArea;\n\n`;
                }
            }
            
            // Add bbox filter if provided
            if (hasBbox) {
                query += `(
    // Search within bounding box
    `;
            } else if (hasPlaceSearch) {
                query += `(
    // Search within area
    `;
            }
            
            // Add conditions for each group
            conditionGroups.forEach((group, index) => {
                if (index > 0) {
                    query += '    ';
                }
                
                const elementType = group.querySelector('.csv-element-type')?.value || 'nwr';
                const key = group.querySelector('.csv-key')?.value.trim() || '';
                const operator = group.querySelector('.csv-operator')?.value || '=';
                const value = group.querySelector('.csv-value')?.value.trim() || '';
                
                // Skip incomplete conditions
                if (!key) {
                    return;
                }
                
                // Add the query part for this condition
                query += `${elementType}[${key}`;
                
                if (value) {
                    // Escape special characters in the value
                    const escapedValue = value
                        .replace(/\\/g, '\\\\')
                        .replace(/\//g, '\\/')
                        .replace(/"/g, '\\"');
                    
                    query += `${operator}"${escapedValue}"`;
                }
                
                // Add area or bbox filter
                if (hasPlaceSearch) {
                    query += '](area.searchArea)';
                } else if (hasBbox) {
                    query += ']';
                } else {
                    query += ']';
                }
                
                // Add semicolon and newline
                query += ';\n';
            });
            
            // Close the bbox filter if used
            if (hasBbox || hasPlaceSearch) {
                query += `);\n\n`;
            }
            
            // Add output statement
            query += 'out body;\n';
            query += '>;\n';
            query += 'out skel qt;';
            
            // Update the query output
            if (queryOutput) queryOutput.textContent = query;
            
            // Update the export buttons
            updateExportButtons(query);
            
            // Auto-execute the query if auto-update is enabled
            const autoUpdate = document.getElementById('csv-autoUpdate');
            if (autoUpdate && autoUpdate.checked) {
                executeQuery(query);
            }
            
            return query;
        } catch (error) {
            console.error('Error generating query:', error);
            if (queryOutput) queryOutput.textContent = '// Error generating query: ' + error.message;
            return null;
        }
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

    // Execute the query against the Overpass API
    async function executeQuery(query) {
        // Check if we should use CSV output
        const useCSV = document.getElementById('csv-output-format')?.checked;
        const columns = getCSVColumns();
        
        if (useCSV && columns.length > 0) {
            // Add CSV header - use @id instead of ::id for Overpass QL
            const csvHeader = `[out:csv("${columns.join('","')}"${columns.includes('@id') ? '; true' : ''})]\n`;
            query = csvHeader + query;
        }
        try {
            // Show loading state
            const exportButton = document.getElementById('csv-exportData');
            const exportStatus = document.getElementById('csv-exportStatus');
            
            if (exportButton) {
                exportButton.disabled = true;
                exportButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Querying...';
            }
            
            if (exportStatus) {
                exportStatus.innerHTML = '<div class="alert alert-info">Executing query...</div>';
            }
            
            // Execute the query
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `data=${encodeURIComponent(query)}`,
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            lastQueryResult = data;
            
            // Update status
            if (exportStatus) {
                const elementCount = data.elements ? data.elements.length : 0;
                exportStatus.innerHTML = `<div class="alert alert-success">Query completed. Found ${elementCount} elements.</div>`;
            }
            
            // Update the export button
            if (exportButton) {
                exportButton.disabled = false;
                exportButton.innerHTML = '<i class="bi bi-download"></i> Export as CSV';
            }
            
            return data;
            
        } catch (error) {
            console.error('Error executing query:', error);
            
            // Update status
            const exportStatus = document.getElementById('csv-exportStatus');
            if (exportStatus) {
                exportStatus.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
            }
            
            // Reset the export button
            const exportButton = document.getElementById('csv-exportData');
            if (exportButton) {
                exportButton.disabled = false;
                exportButton.innerHTML = '<i class="bi bi-download"></i> Export as CSV';
            }
            
            return null;
        }
    }
    
    // Update export buttons with the current query
    function updateExportButtons(query) {
        // Update Overpass Turbo link
        if (openInOverpassTurbo) {
            const turboUrl = `https://overpass-turbo.eu/?Q=${encodeURIComponent(query)}`;
            openInOverpassTurbo.href = turboUrl;
        }
        
        // Update Overpass Ultra link
        if (openInOverpassUltra) {
            const ultraUrl = `https://overpass-ultra.com/?Q=${encodeURIComponent(query)}`;
            openInOverpassUltra.href = ultraUrl;
        }
    }
    
    // Copy query to clipboard
    function copyToClipboard() {
        const query = queryOutput?.textContent;
        if (!query || query === '// Your generated Overpass QL query will appear here') {
            showToast('No query to copy', 'warning');
            return;
        }
        
        navigator.clipboard.writeText(query).then(() => {
            showToast('Query copied to clipboard', 'success');
            
            // Update button text temporarily
            if (copyQueryBtn) {
                const originalText = copyQueryBtn.innerHTML;
                copyQueryBtn.innerHTML = '<i class="bi bi-check"></i>';
                
                // Reset button text after 2 seconds
                setTimeout(() => {
                    copyQueryBtn.innerHTML = originalText;
                }, 2000);
            }
            
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            showToast('Failed to copy query', 'danger');
        });
    }
    
    // Show toast notification
    function showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.style.position = 'fixed';
            toastContainer.style.top = '20px';
            toastContainer.style.right = '20px';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type} border-0 show`;
        toast.role = 'alert';
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        // Set toast content
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
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
                
                // Remove container if empty
                if (toastContainer.children.length === 0) {
                    toastContainer.remove();
                }
            }, 300);
        }, 5000);
    }
    
    // Get user's current location
    function getCurrentLocation() {
        if (!navigator.geolocation) {
            showToast('Geolocation is not supported by your browser', 'warning');
            return;
        }
        
        // Show loading state
        const locationButton = document.getElementById('csv-useMyLocation');
        const originalButtonText = locationButton.innerHTML;
        locationButton.disabled = true;
        locationButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Locating...';
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Success callback
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                // Calculate a small bounding box around the current location (0.01 degrees ≈ 1.1 km)
                const delta = 0.01;
                const south = lat - delta;
                const north = lat + delta;
                const west = lon - delta;
                const east = lon + delta;
                
                // Set the bounding box
                setBbox(south, west, north, east);
                
                // Update the search input
                if (placeSearchInput) placeSearchInput.value = 'Current Location';
                
                // Show success message
                showToast('Location found! Bounding box set around your location.', 'success');
                
                // Reset button state
                locationButton.disabled = false;
                locationButton.innerHTML = originalButtonText;
                
                // Generate the query
                generateQuery();
                
            },
            (error) => {
                // Error callback
                console.error('Error getting location:', error);
                let errorMessage = 'Unable to retrieve your location';
                
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location permission denied. Please allow location access to use this feature.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'The request to get user location timed out.';
                        break;
                }
                
                showToast(errorMessage, 'danger');
                
                // Reset button state
                locationButton.disabled = false;
                locationButton.innerHTML = originalButtonText;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }
    
    // Add example query
    function addExample() {
        // Clear existing conditions
        if (queryConditions) queryConditions.innerHTML = '';
        
        // Add example conditions
        addCondition({
            elementType: 'nwr',
            key: 'amenity',
            operator: '=',
            value: 'cafe'
        });
        
        // Set a default bounding box (San Francisco)
        setBbox(37.7, -122.5, 37.8, -122.4);
        
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
    
    // Toggle CSV columns visibility based on checkbox
    const csvOutputCheckbox = document.getElementById('csv-output-format');
    const csvColumnsContainer = document.getElementById('csv-columns-container');
    
    if (csvOutputCheckbox && csvColumnsContainer) {
        // Initial state
        csvColumnsContainer.style.display = csvOutputCheckbox.checked ? 'block' : 'none';
        
        // Toggle on change
        csvOutputCheckbox.addEventListener('change', function() {
            csvColumnsContainer.style.display = this.checked ? 'block' : 'none';
        });
    }
    
    // Initialize the application when the DOM is fully loaded
    init();
});
