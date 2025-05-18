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
    // Connected Papers may need more time to fully initialize its components
    const waitTime = site.name === "Connected Papers" ? 2500 : 1500;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Inject the content script to fill in the form (without submitting)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: injectPrompt,
      args: [prompt, site.promptField, site.name]
    });
    
    // For sites that need extra verification
    if (site.name === "Connected Papers") {
      // Give a moment for the input to settle, then check if it worked
      await new Promise(resolve => setTimeout(resolve, 1000));
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: verifyInjection,
        args: [prompt, site.promptField.selector]
      });
    }
  }
}

// Function that will be injected into pages to fill various types of form elements
function injectPrompt(prompt, promptField, siteName) {
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
        
        console.log(`Found element for ${siteName}:`, inputElement);
        
        // Handle different element types and methods
        switch(promptField.type) {
          case 'input':
            // Handle standard input elements (text, textarea)
            inputElement.value = prompt;
            // Trigger input event to activate any listeners
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            // Also trigger change event for React and similar frameworks
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            // For Connected Papers specifically
            if (siteName === "Connected Papers") {
              // For frameworks like Vue.js or React that might not respond to normal events
              inputElement.dispatchEvent(new Event('keyup', { bubbles: true }));
              inputElement.dispatchEvent(new Event('keydown', { bubbles: true }));
              inputElement.dispatchEvent(new Event('keypress', { bubbles: true }));
              // Simulate user typing for frameworks with complex event handling
              inputElement.focus();
            }
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

// Verify if injection worked correctly
function verifyInjection(prompt, selector) {
  const inputElement = document.querySelector(selector);
  if (inputElement && (!inputElement.value || inputElement.value !== prompt)) {
    console.log("Injection verification failed. Trying alternative method...");
    // Try alternative method for stubborn inputs
    inputElement.value = prompt;
    
    // Create and dispatch multiple events to trigger all possible listeners
    const events = ['input', 'change', 'blur', 'focus', 'keydown', 'keyup', 'keypress'];
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true });
      inputElement.dispatchEvent(event);
    });
    
    // For some frameworks, we need to manually call internal handlers
    // This is a common pattern in Vue.js apps
    if (inputElement.__vue__) {
      console.log("Vue.js detected, trying to update directly");
      try {
        // Try to access Vue instance methods if available
        inputElement.__vue__.$emit('input', prompt);
      } catch (e) {
        console.log("Vue direct access failed:", e);
      }
    }
  } else {
    console.log("Injection verified successfully!");
  }
}