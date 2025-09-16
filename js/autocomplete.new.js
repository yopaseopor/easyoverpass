class TagInfoAutocomplete {
    constructor(input, type = 'key', onSelect = null) {
        this.input = input;
        this.type = type; // 'key' or 'value'
        this.onSelect = onSelect;
        this.container = input.parentElement;
        this.dropdown = this.container.querySelector('.autocomplete-items') || this.createDropdown();
        this.currentFocus = -1;
        this.timer = null;
        this.lastQuery = '';
        
        // Add event listeners
        this.input.addEventListener('input', () => this.handleInput());
        this.input.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('click', (e) => {
            if (e.target !== this.input) {
                this.closeAllLists();
            }
        });
    }

    createDropdown() {
        const dropdown = document.createElement('div');
        dropdown.className = 'autocomplete-items';
        this.container.appendChild(dropdown);
        return dropdown;
    }

    async handleInput() {
        const query = this.input.value.trim();
        if (query.length < 2 || query === this.lastQuery) {
            this.closeAllLists();
            return;
        }
        
        this.lastQuery = query;
        
        if (this.timer) {
            clearTimeout(this.timer);
        }
        
        this.timer = setTimeout(async () => {
            try {
                const results = await this.fetchSuggestions(query);
                this.showSuggestions(results);
            } catch (error) {
                console.error('Error fetching suggestions:', error);
                this.closeAllLists();
            }
        }, 300);
    }

    async fetchSuggestions(query) {
        let url;
        if (this.type === 'key') {
            url = `https://taginfo.openstreetmap.org/api/4/keys/all?query=${encodeURIComponent(query)}&page=1&rp=10&sortname=count_all&sortorder=desc`;
        } else {
            const conditionGroup = this.input.closest('.condition-group, .csv-condition-group');
            const keyInput = conditionGroup ? conditionGroup.querySelector('.key, .csv-key') : null;
            const key = keyInput ? keyInput.value.trim() : '';
            if (!key) return [];
            url = `https://taginfo.openstreetmap.org/api/4/key/values?key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}&page=1&rp=10&sortname=count_all&sortorder=desc`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch suggestions');
        const data = await response.json();
        return data.data || [];
    }

    showSuggestions(items) {
        this.closeAllLists();
        this.currentFocus = -1;
        
        if (items.length === 0) return;
        
        items.forEach((item, index) => {
            const value = this.type === 'key' ? item.key : item.value;
            const count = item.count || item.count_all || 0;
            const formattedCount = count.toLocaleString();
            
            const itemElement = document.createElement('div');
            itemElement.className = 'autocomplete-item';
            itemElement.innerHTML = `
                <span>${this.highlightMatch(value, this.lastQuery)}</span>
                <span class="autocomplete-count">${formattedCount}</span>
            `;
            
            itemElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.input.value = value;
                this.closeAllLists();
                if (this.onSelect) this.onSelect(value);
                
                // If this is a key selection, focus on the value input
                if (this.type === 'key') {
                    const conditionGroup = this.input.closest('.condition-group, .csv-condition-group');
                    if (conditionGroup) {
                        const valueInput = conditionGroup.querySelector('.value, .csv-value');
                        if (valueInput) {
                            valueInput.focus();
                            // Trigger input event to show suggestions for the value
                            valueInput.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }
                }
            });
            
            this.dropdown.appendChild(itemElement);
        });
    }

    highlightMatch(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<strong>$1</strong>');
    }

    handleKeyDown(e) {
        const items = this.dropdown.getElementsByClassName('autocomplete-item');
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.currentFocus = Math.min(this.currentFocus + 1, items.length - 1);
                this.setActive(items);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.currentFocus = Math.max(this.currentFocus - 1, -1);
                this.setActive(items);
                break;
                
            case 'Enter':
                e.preventDefault();
                if (this.currentFocus > -1 && items[this.currentFocus]) {
                    items[this.currentFocus].click();
                }
                break;
                
            case 'Escape':
                this.closeAllLists();
                break;
        }
    }

    setActive(items) {
        for (let i = 0; i < items.length; i++) {
            items[i].classList.remove('active');
            if (i === this.currentFocus) {
                items[i].classList.add('active');
                items[i].scrollIntoView({ block: 'nearest' });
            }
        }
    }

    closeAllLists() {
        const items = this.dropdown.getElementsByClassName('autocomplete-item');
        for (let i = 0; i < items.length; i++) {
            items[i].innerHTML = '';
            items[i].style.display = 'none';
        }
        this.currentFocus = -1;
    }
}

// Initialize autocomplete for all key and value inputs
function initAutocomplete() {
    // Function to initialize autocomplete for a single input
    const initKeyAutocomplete = (input) => {
        if (input.hasAttribute('data-autocomplete-initialized')) return;
        
        new TagInfoAutocomplete(input, 'key', (value) => {
            // When a key is selected, focus on the value input
            const conditionGroup = input.closest('.condition-group, .csv-condition-group');
            if (!conditionGroup) return;
            
            const valueInput = conditionGroup.querySelector('.value, .csv-value');
            if (valueInput) {
                valueInput.focus();
                // Trigger input event to show suggestions for the value
                valueInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        
        input.setAttribute('data-autocomplete-initialized', 'true');
    };

    // Initialize key inputs in both tabs
    document.querySelectorAll('.key, .csv-key').forEach(initKeyAutocomplete);
    
    // Initialize value inputs in both tabs
    document.querySelectorAll('.value, .csv-value').forEach(input => {
        if (!input.hasAttribute('data-autocomplete-initialized')) {
            new TagInfoAutocomplete(input, 'value');
            input.setAttribute('data-autocomplete-initialized', 'true');
        }
    });
    
    // Set up a mutation observer to handle dynamically added condition groups
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    // Check for key inputs in the added node
                    const keyInputs = node.querySelectorAll ? 
                        node.querySelectorAll('.key, .csv-key') : [];
                    
                    keyInputs.forEach(initKeyAutocomplete);
                    
                    // Initialize any value inputs in the added node
                    const valueInputs = node.querySelectorAll ? 
                        node.querySelectorAll('.value, .csv-value:not([data-autocomplete-initialized])') : [];
                        
                    valueInputs.forEach(input => {
                        if (!input.hasAttribute('data-autocomplete-initialized')) {
                            new TagInfoAutocomplete(input, 'value');
                            input.setAttribute('data-autocomplete-initialized', 'true');
                        }
                    });
                }
            });
        });
    });
    
    // Start observing the document with the configured parameters
    observer.observe(document.body, { 
        childList: true, 
        subtree: true,
        attributes: false,
        characterData: false
    });
}

// Initialize when the DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutocomplete);
} else {
    initAutocomplete();
}
