// Debug mode for troubleshooting selectors
// This script is injected when debug mode is enabled

// Function to highlight elements based on selectors from the config
function highlightConfiguredElements() {
  // Load the config from storage
  chrome.storage.sync.get(['sitesConfig', 'debugMode'], function(data) {
    if (!data.sitesConfig || !data.debugMode) return;
    
    const config = data.sitesConfig;
    const currentUrl = window.location.origin;
    
    // Find the matching site in config
    const matchingSite = config.find(site => 
      currentUrl.includes(new URL(site.baseUrl).hostname));
      
    if (!matchingSite) {
      console.log('Debug: No matching site found for', currentUrl);
      return;
    }
    
    console.log('Debug: Found matching site', matchingSite.name);
    
    // Try to locate the prompt field
    const selector = matchingSite.promptField.selector;
    const element = document.querySelector(selector);
    
    if (element) {
      console.log('Debug: Found element with selector', selector, element);
      
      // Highlight the element
      const originalBackground = element.style.background;
      const originalOutline = element.style.outline;
      
      element.style.background = 'rgba(255, 0, 0, 0.2)';
      element.style.outline = '2px solid red';
      
      // Add info overlay
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.bottom = '10px';
      overlay.style.right = '10px';
      overlay.style.background = 'rgba(0, 0, 0, 0.8)';
      overlay.style.color = 'white';
      overlay.style.padding = '10px';
      overlay.style.borderRadius = '5px';
      overlay.style.zIndex = '9999';
      overlay.style.maxWidth = '300px';
      overlay.style.fontSize = '12px';
      
      overlay.innerHTML = `
        <h4 style="margin:0 0 5px 0">Element Found</h4>
        <p style="margin:0 0 5px 0"><strong>Site:</strong> ${matchingSite.name}</p>
        <p style="margin:0 0 5px 0"><strong>Selector:</strong> ${selector}</p>
        <p style="margin:0 0 5px 0"><strong>Type:</strong> ${matchingSite.promptField.type}</p>
        <button id="close-debug-overlay" style="background:#fff;color:#000;border:0;padding:5px 10px;border-radius:3px;cursor:pointer">Close</button>
      `;
      
      document.body.appendChild(overlay);
      
      // Add close button functionality
      document.getElementById('close-debug-overlay').addEventListener('click', function() {
        element.style.background = originalBackground;
        element.style.outline = originalOutline;
        document.body.removeChild(overlay);
      });
    } else {
      console.log('Debug: Element not found with selector', selector);
      
      // Display "not found" message
      const notFoundOverlay = document.createElement('div');
      notFoundOverlay.style.position = 'fixed';
      notFoundOverlay.style.bottom = '10px';
      notFoundOverlay.style.right = '10px';
      notFoundOverlay.style.background = 'rgba(0, 0, 0, 0.8)';
      notFoundOverlay.style.color = 'white';
      notFoundOverlay.style.padding = '10px';
      notFoundOverlay.style.borderRadius = '5px';
      notFoundOverlay.style.zIndex = '9999';
      
      notFoundOverlay.innerHTML = `
        <h4 style="margin:0 0 5px 0">Element Not Found</h4>
        <p style="margin:0 0 5px 0"><strong>Site:</strong> ${matchingSite.name}</p>
        <p style="margin:0 0 5px 0"><strong>Selector:</strong> ${selector}</p>
        <button id="close-not-found-overlay" style="background:#fff;color:#000;border:0;padding:5px 10px;border-radius:3px;cursor:pointer">Close</button>
      `;
      
      document.body.appendChild(notFoundOverlay);
      
      document.getElementById('close-not-found-overlay').addEventListener('click', function() {
        document.body.removeChild(notFoundOverlay);
      });
    }
  });
}

// Check if we should run debug mode
chrome.storage.sync.get('debugMode', function(data) {
  if (data.debugMode) {
    // Wait for page to fully load
    window.addEventListener('load', function() {
      setTimeout(highlightConfiguredElements, 2000);
    });
  }
});