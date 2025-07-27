// Script to load YAML configuration and handle popup functionality

// Load the YAML configuration
async function loadSitesConfig() {
  try {
    const response = await fetch('sites_config.yaml');
    const yamlText = await response.text();
    
    // Parse YAML (requires js-yaml library to be included)
    const config = jsyaml.load(yamlText);
    
    // Store config in chrome.storage for debug mode to access
    chrome.storage.sync.set({ 'sitesConfig': config.sites });
    
    return config.sites;
  } catch (error) {
    console.error('Error loading configuration:', error);
    return [];
  }
}

// Create site checkboxes from the YAML config
async function initializePopup() {
  try {
    const sitesConfig = await loadSitesConfig();
    const sitesContainer = document.getElementById('sites-container');
    sitesContainer.innerHTML = '';
    
    // Create checkboxes for each site in the YAML config
    sitesConfig.forEach(site => {
      const siteItem = document.createElement('div');
      siteItem.className = 'site-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `site-${site.name.toLowerCase()}`;
      checkbox.checked = site.defaultChecked;
      checkbox.addEventListener('change', saveUserPreferences);
      
      const label = document.createElement('label');
      label.htmlFor = checkbox.id;
      label.textContent = site.name;
      
      siteItem.appendChild(checkbox);
      siteItem.appendChild(label);
      sitesContainer.appendChild(siteItem);
    });
    
    // Now load user preferences (which would override the defaults)
    loadUserPreferences();
    
    // Handle form submission with YAML config
    document.getElementById('search-form').addEventListener('submit', e => handleSubmit(e, sitesConfig));
    document.getElementById('search-button').addEventListener('click', e => handleSubmit(e, sitesConfig));
    
    // Set up debug mode toggle
    setupDebugMode();
  } catch (error) {
    console.error('Error initializing popup:', error);
  }
}

// Handle debug mode toggle
function setupDebugMode() {
  const debugCheckbox = document.getElementById('debug-checkbox');
  
  // Load previous debug mode setting
  chrome.storage.sync.get('debugMode', (data) => {
    debugCheckbox.checked = !!data.debugMode;
  });
  
  // Save debug mode setting when changed
  debugCheckbox.addEventListener('change', () => {
    chrome.storage.sync.set({ 'debugMode': debugCheckbox.checked });
  });
}

// Form submission handler
async function handleSubmit(e, sitesConfig) {
  e.preventDefault();
  const prompt = document.getElementById('prompt-input').value.trim();
  
  if (!prompt) {
    document.getElementById('status').textContent = 'Please enter a prompt';
    return;
  }
  
  // If sitesConfig not provided, load it
  if (!sitesConfig) {
    sitesConfig = await loadSitesConfig();
  }
  
  // Get selected sites based on YAML config
  const selectedSites = sitesConfig.filter(site => {
    const checkbox = document.getElementById(`site-${site.name.toLowerCase()}`);
    return checkbox && checkbox.checked;
  });
  
  if (selectedSites.length === 0) {
    document.getElementById('status').textContent = 'Please select at least one site';
    return;
  }
  
  document.getElementById('status').textContent = 'Opening sites...';
  
  // Send message to background script to open tabs and populate prompt fields
  chrome.runtime.sendMessage({
    action: 'openTabs',
    sites: selectedSites,
    prompt: prompt
  }, response => {
    document.getElementById('status').textContent = response.message;
    setTimeout(() => {
      document.getElementById('status').textContent = '';
    }, 3000);
  });
}

// Load user preferences from storage
function loadUserPreferences() {
  chrome.storage.sync.get('sitePreferences', (data) => {
    if (data.sitePreferences) {
      // Update checkboxes based on saved preferences
      data.sitePreferences.forEach(site => {
        const checkbox = document.getElementById(`site-${site.name.toLowerCase()}`);
        if (checkbox) {
          checkbox.checked = site.checked;
        }
      });
    }
  });
}

// Save user preferences to storage
async function saveUserPreferences() {
  try {
    const sitesConfig = await loadSitesConfig();
    const updatedSitePreferences = sitesConfig.map(site => {
      const checkbox = document.getElementById(`site-${site.name.toLowerCase()}`);
      return {
        name: site.name,
        checked: checkbox ? checkbox.checked : site.defaultChecked
      };
    });
    
    chrome.storage.sync.set({
      'sitePreferences': updatedSitePreferences
    });
  } catch (error) {
    console.error('Error saving preferences:', error);
  }
}

// Initialize the popup when the document is loaded
document.addEventListener('DOMContentLoaded', initializePopup);