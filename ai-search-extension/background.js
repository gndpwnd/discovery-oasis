// Background script for handling tab opening and form population

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openTabs') {
    openTabs(request.sites, request.prompt)
      .then(() => {
        sendResponse({ message: 'Sites opened and populated successfully!' });
      })
      .catch(error => {
        sendResponse({ message: `Error: ${error.message}` });
      });
    return true; // Keep the messaging channel open for async response
  }
});

// Function to open tabs and inject content scripts
async function openTabs(sites, prompt) {
  for (const site of sites) {
    // Open a new tab with the site URL
    const tab = await chrome.tabs.create({ url: site.baseUrl, active: false });
    
    // Wait for the tab to be fully loaded
    await new Promise(resolve => {
      const listener = (tabId, changeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
    
    // Give the page a little extra time to fully initialize JavaScript
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Inject the content script to fill in the form (without submitting)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: injectPrompt,
      args: [prompt, site.promptField]
    });
  }
}

// Function that will be injected into pages to fill various types of form elements
function injectPrompt(prompt, promptField) {
  return new Promise((resolve, reject) => {
    try {
      // Wait to make sure dynamic elements are loaded
      setTimeout(() => {
        // Try to locate the prompt input field
        const inputElement = document.querySelector(promptField.selector);
        
        if (!inputElement) {
          console.error(`Could not find element with selector: ${promptField.selector}`);
          reject(new Error(`Element not found: ${promptField.selector}`));
          return;
        }
        
        // Handle different element types and methods
        switch(promptField.type) {
          case 'input':
            // Handle standard input elements (text, textarea)
            inputElement.value = prompt;
            // Trigger input event to activate any listeners
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            // Also trigger change event for React and similar frameworks
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            // Focus the element
            inputElement.focus();
            break;
            
          case 'contenteditable':
            // Handle contenteditable divs (like in rich text editors)
            inputElement.textContent = prompt;
            // Also set innerHTML as some editors use that
            inputElement.innerHTML = prompt;
            // Trigger input event
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            // Focus the element
            inputElement.focus();
            break;
            
          default:
            // Fallback method - try both approaches
            if (typeof inputElement.value !== 'undefined') {
              inputElement.value = prompt;
              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
              inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              inputElement.textContent = prompt;
              inputElement.innerHTML = prompt;
              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            }
            inputElement.focus();
        }
        
        resolve();
      }, 1500); // Give more time for dynamic content to load
    } catch (error) {
      console.error('Error injecting prompt:', error);
      reject(error);
    }
  });
}