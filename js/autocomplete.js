class TagInfoAutocomplete {
    constructor(input, type = 'key', onSelect = null) {
        this.input = input;
        this.type = type; // 'key' or 'value'
        this.onSelect = onSelect;
        this.container = input.parentElement;
        this.dropdown = this.container.querySelector('.autocomplete-items');
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

    async handleInput() {
        const query = this.input.value.trim();
        if (query.length < 2 || query === this.lastQuery) {
            this.closeAllLists();
            return;
        }
        
        this.lastQuery = query;
        
        // Clear previous timeout and set a new one
        if (this.timer) {
            clearTimeout(this.timer);
        }
        
        this.timer = setTimeout(async () => {
            try {
                const results = await this.fetchSuggestions(query);
                this.showSuggestions(results);
            } catch (error) {
                console.error('Error fetching suggestions:', error);
            }
        }, 300); // Debounce for 300ms
    }

    async fetchSuggestions(query) {
        let url;
        if (this.type === 'key') {
            url = `https://taginfo.openstreetmap.org/api/4/keys/all?query=${encodeURIComponent(query)}&page=1&rp=10&sortname=count_all&sortorder=desc`;
        } else {
            const keyInput = this.input.closest('.condition-group').querySelector('.key');
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
                e.stopPropagation(); // Prevent event from bubbling up to document
                this.input.value = value;
                // Manually trigger the input event to ensure the query is updated
                const event = new Event('input', {
                    bubbles: true,
                    cancelable: true,
                });
                this.input.dispatchEvent(event);
                
                this.closeAllLists();
                if (this.onSelect) this.onSelect(value);
                
                // If this is a key selection, focus on the value input
                if (this.type === 'key') {
                    const valueInput = this.input.closest('.condition-group').querySelector('.value');
                    if (valueInput) valueInput.focus();
                }
            });
            
            this.dropdown.appendChild(itemElement);
        });
        
        this.dropdown.style.display = 'block';
    }

    highlightMatch(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi');
        return text.replace(regex, '<span class="autocomplete-match">$1</span>');
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    handleKeyDown(e) {
        let items = this.dropdown ? this.dropdown.getElementsByClassName('autocomplete-item') : [];
        
        // Down arrow
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.currentFocus = (this.currentFocus + 1) % items.length;
            this.setActive(items);
        }
        // Up arrow
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.currentFocus = (this.currentFocus - 1 + items.length) % items.length;
            this.setActive(items);
        }
        // Enter key
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.currentFocus > -1 && items[this.currentFocus]) {
                items[this.currentFocus].click();
            }
        }
        // Escape key
        else if (e.key === 'Escape') {
            this.closeAllLists();
        }
    }

    setActive(items) {
        // Remove active class from all items
        for (let i = 0; i < items.length; i++) {
            items[i].classList.remove('autocomplete-active');
        }
        
        // Add active class to current item
        if (this.currentFocus >= 0 && this.currentFocus < items.length) {
            items[this.currentFocus].classList.add('autocomplete-active');
            items[this.currentFocus].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }

    closeAllLists() {
        const items = document.getElementsByClassName('autocomplete-items');
        for (let i = 0; i < items.length; i++) {
            items[i].innerHTML = '';
            items[i].style.display = 'none';
        }
        this.currentFocus = -1;
    }
}

// Initialize autocomplete for all key and value inputs
function initAutocomplete() {
    // Initialize for existing condition groups
    document.querySelectorAll('.condition-group').forEach(group => {
        const keyInput = group.querySelector('.key');
        const valueInput = group.querySelector('.value');
        
        if (keyInput) {
            new TagInfoAutocomplete(keyInput, 'key', () => {
                // When a key is selected, clear the value input
                if (valueInput) valueInput.value = '';
            });
        }
        
        if (valueInput) {
            new TagInfoAutocomplete(valueInput, 'value');
        }
    });
    
    // Set up a mutation observer to handle dynamically added condition groups
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    const keyInput = node.querySelector ? node.querySelector('.key') : null;
                    const valueInput = node.querySelector ? node.querySelector('.value') : null;
                    
                    if (keyInput && !keyInput.hasAttribute('data-autocomplete-initialized')) {
                        new TagInfoAutocomplete(keyInput, 'key', () => {
                            if (valueInput) valueInput.value = '';
                        });
                        keyInput.setAttribute('data-autocomplete-initialized', 'true');
                    }
                    
                    if (valueInput && !valueInput.hasAttribute('data-autocomplete-initialized')) {
                        new TagInfoAutocomplete(valueInput, 'value');
                        valueInput.setAttribute('data-autocomplete-initialized', 'true');
                    }
                }
            });
        });
    });
    
    // Start observing the document with the configured parameters
    observer.observe(document.body, { childList: true, subtree: true });
}

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initAutocomplete);
