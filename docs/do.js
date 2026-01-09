// Discovery Oasis - Enhanced Static Site with Modular Search Configuration

// Hide the disclaimer on startup
const disclaimer = document.getElementById("disclaimer");
disclaimer.style.display = "none";

// Configuration for each search type
// NOTE: AI sources removed - they require DOM manipulation via Chrome extension
const searchTypes = {
  web: {
    configPath: 'configs/web/sites_config.yaml',
    checkboxContainer: 'web-checkboxes',
    sourceContainer: 'web-sources',
    filter: 'web-filter',
    sites: []
  },
  scholar: {
    configPath: 'configs/scholar/sites_config.yaml',
    checkboxContainer: 'scholar-checkboxes',
    sourceContainer: 'scholar-sources',
    filter: 'scholar-filter',
    sites: []
  },
  database: {
    configPath: 'configs/database/sites_config.yaml',
    checkboxContainer: 'database-checkboxes',
    sourceContainer: 'database-sources',
    filter: 'database-filter',
    sites: []
  },
  pdf: {
    configPath: 'configs/pdf/sites_config.yaml',
    checkboxContainer: 'pdf-checkboxes',
    sourceContainer: 'pdf-sources',
    filter: 'pdf-filter',
    sites: []
  }
};

// Load YAML configuration for a search type
async function loadConfig(type) {
  try {
    const response = await fetch(searchTypes[type].configPath);
    const yamlText = await response.text();
    const config = jsyaml.load(yamlText);
    searchTypes[type].sites = config.sites || [];
    return config.sites;
  } catch (error) {
    console.error(`Error loading ${type} config:`, error);
    return [];
  }
}

// Generate checkboxes for a search type
function generateCheckboxes(type, sites) {
  const container = document.getElementById(searchTypes[type].checkboxContainer);
  container.innerHTML = ''; // Clear existing checkboxes

  // Load saved preferences from localStorage
  const savedPrefs = JSON.parse(localStorage.getItem(`${type}-preferences`) || '{}');

  sites.forEach((site, index) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `${type}-site-${index}`;
    checkbox.dataset.siteName = site.name;
    checkbox.dataset.type = type;

    // Check if we have saved preference, otherwise use defaultChecked
    const isChecked = savedPrefs.hasOwnProperty(site.name)
      ? savedPrefs[site.name]
      : (site.defaultChecked !== false);

    checkbox.checked = isChecked;

    // Save preference on change
    checkbox.addEventListener('change', () => {
      savePreferences(type);
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(site.name));
    container.appendChild(label);
  });
}

// Save preferences to localStorage
function savePreferences(type) {
  const checkboxes = document.querySelectorAll(`input[data-type="${type}"]`);
  const preferences = {};

  checkboxes.forEach(checkbox => {
    preferences[checkbox.dataset.siteName] = checkbox.checked;
  });

  localStorage.setItem(`${type}-preferences`, JSON.stringify(preferences));
}

// Load preferences from localStorage
function loadPreferences() {
  Object.keys(searchTypes).forEach(type => {
    const savedPrefs = JSON.parse(localStorage.getItem(`${type}-preferences`) || '{}');
    const checkboxes = document.querySelectorAll(`input[data-type="${type}"]`);

    checkboxes.forEach(checkbox => {
      if (savedPrefs.hasOwnProperty(checkbox.dataset.siteName)) {
        checkbox.checked = savedPrefs[checkbox.dataset.siteName];
      }
    });
  });
}

// Initialize all configurations
async function initializeConfigs() {
  for (const type of Object.keys(searchTypes)) {
    const sites = await loadConfig(type);
    generateCheckboxes(type, sites);
  }
}

// Show/hide source containers based on filter selection
function setupFilterToggles() {
  Object.keys(searchTypes).forEach(type => {
    const filter = document.getElementById(searchTypes[type].filter);
    const sourceContainer = document.getElementById(searchTypes[type].sourceContainer);

    filter.addEventListener('change', () => {
      if (filter.checked) {
        sourceContainer.style.display = 'block';
      } else {
        sourceContainer.style.display = 'none';
      }
    });
  });
}

// Select All / Deselect All functionality
function setupSelectAllButtons() {
  const selectAllButtons = document.querySelectorAll('.select-all-btn');

  selectAllButtons.forEach(button => {
    button.addEventListener('click', () => {
      const type = button.dataset.type;
      const checkboxes = document.querySelectorAll(`input[data-type="${type}"]`);
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);

      checkboxes.forEach(checkbox => {
        checkbox.checked = !allChecked;
      });

      // Update button text
      button.textContent = allChecked ? 'Select All' : 'Deselect All';

      // Save preferences
      savePreferences(type);
    });
  });
}

// Build URL for a site based on its configuration
function buildUrl(site, query) {
  const queryPlus = query.replace(/ /g, '+');
  const queryEncoded = encodeURIComponent(query);

  // Handle PDF search types
  if (site.searchType === 'google') {
    // Google dork for specific site
    return `https://www.google.com/search?q=site:${site.baseUrl}+${queryPlus}+filetype:pdf`;
  } else if (site.searchType === 'google-general') {
    // General Google PDF search
    return `https://www.google.com/search?q=${queryPlus}+filetype:pdf`;
  }

  // Handle sites with queryParam
  if (site.queryParam) {
    const queryValue = site.usePlus ? queryPlus : queryEncoded;
    let url = `${site.baseUrl}?${site.queryParam}=${queryValue}`;

    // Add extra parameters if specified
    if (site.extraParams) {
      url += `&${site.extraParams}`;
    }

    return url;
  }

  // Handle sites with direct URL concatenation (like Library Genesis, Z-Library)
  const queryValue = site.usePlus ? queryPlus : queryEncoded;
  return `${site.baseUrl}${queryValue}`;
}

// Execute search and open tabs
function executeSearch() {
  const searchQuery = document.getElementById("search-input").value;

  // Validate search query
  if (!searchQuery || searchQuery.trim() === "") {
    disclaimer.style.display = "block";
    return;
  }

  disclaimer.style.display = "none";

  // Collect all URLs to open
  const urlsToOpen = [];

  Object.keys(searchTypes).forEach(type => {
    const filter = document.getElementById(searchTypes[type].filter);

    if (filter.checked) {
      const checkboxes = document.querySelectorAll(`input[data-type="${type}"]:checked`);

      checkboxes.forEach(checkbox => {
        const siteName = checkbox.dataset.siteName;
        const site = searchTypes[type].sites.find(s => s.name === siteName);

        if (site) {
          const url = buildUrl(site, searchQuery);
          urlsToOpen.push(url);
        }
      });
    }
  });

  // Open all tabs
  urlsToOpen.forEach(url => {
    window.open(url, '_blank');
  });
}

// Initialize the application
async function init() {
  await initializeConfigs();
  setupFilterToggles();
  setupSelectAllButtons();

  // Setup search button
  const searchBtn = document.getElementById('search-btn');
  searchBtn.addEventListener('click', executeSearch);

  // Setup Enter key for search
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      executeSearch();
    }
  });
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
