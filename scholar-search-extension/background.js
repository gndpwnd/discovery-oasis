// Background script for handling tab opening and form population

/*

1. Page loads → waits for 'complete' status
2. Waits 1.5-2 seconds for initial JavaScript to load
3. Polls for the element every 250ms until found (or times out after 5 seconds)
4. Once element is found, fills it with the prompt
5. Simulates pressing Enter to trigger the search
6. For JSTOR, runs verification step with enhanced event handling

*/

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
    // Some sites may need more time to fully initialize their components
    const waitTime = (site.name === "JSTOR") ? 3000 : 1500;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Inject the content script to fill in the form and submit it
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: injectPrompt,
      args: [prompt, site.promptField, site.name]
    });
    
    // For sites that need extra verification
    if (site.name === "JSTOR") {
      // Give a moment for the input to settle, then check if it worked
      await new Promise(resolve => setTimeout(resolve, 1000));
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: verifyInjection,
        args: [prompt, site.promptField.selector, site.name]
      });
    }
  }
}

// Function that will be injected into pages to fill various types of form elements and submit
function injectPrompt(prompt, promptField, siteName) {
  return new Promise((resolve, reject) => {
    try {
      // Function to wait for element to appear
      function waitForElement(selector, maxAttempts = 40) {
        return new Promise((resolve, reject) => {
          let attempts = 0;
          
          function checkElement() {
            const element = document.querySelector(selector);
            if (element) {
              resolve(element);
              return;
            }
            
            attempts++;
            if (attempts >= maxAttempts) {
              // Don't reject immediately, try one more time after a longer wait
              console.log(`Element not found after ${maxAttempts} attempts, trying one final check...`);
              setTimeout(() => {
                const finalElement = document.querySelector(selector);
                if (finalElement) {
                  resolve(finalElement);
                } else {
                  reject(new Error(`Element not found after ${maxAttempts + 1} attempts: ${selector}`));
                }
              }, 1000);
              return;
            }
            
            setTimeout(checkElement, 200); // Check every 200ms (faster polling)
          }
          
          checkElement();
        });
      }
      
      // Function to submit the form
      function submitForm(inputElement) {
        // Method 1: Try to find and click the submit button
        const submitSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button:contains("Search")',
          '.search-button',
          '.search-btn',
          '[aria-label*="Search"]',
          '[aria-label*="search"]'
        ];
        
        let submitted = false;
        
        // Try to find and click a submit button
        for (const selector of submitSelectors) {
          const submitBtn = document.querySelector(selector);
          if (submitBtn && !submitted) {
            console.log(`Found submit button for ${siteName}:`, submitBtn);
            submitBtn.click();
            submitted = true;
            break;
          }
        }
        
        // Method 2: If no submit button found, simulate Enter key press
        if (!submitted) {
          console.log(`No submit button found for ${siteName}, simulating Enter key`);
          
          // Create Enter key event
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          
          // Dispatch Enter event on the input element
          inputElement.dispatchEvent(enterEvent);
          
          // Also try keyup event
          const enterUpEvent = new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          
          inputElement.dispatchEvent(enterUpEvent);
        }
        
        // Method 3: If still not submitted, try to submit the parent form
        if (!submitted) {
          const form = inputElement.closest('form');
          if (form) {
            console.log(`Submitting form for ${siteName}:`, form);
            form.submit();
            submitted = true;
          }
        }
        
        // Method 4: Last resort - try common search form selectors
        if (!submitted) {
          const formSelectors = ['form[role="search"]', 'form.search', 'form#search', 'form'];
          for (const selector of formSelectors) {
            const searchForm = document.querySelector(selector);
            if (searchForm && searchForm.contains(inputElement)) {
              console.log(`Found parent form for ${siteName}:`, searchForm);
              searchForm.submit();
              submitted = true;
              break;
            }
          }
        }
        
        return submitted;
      }
      
      // Wait for element to appear, then fill it and submit
      waitForElement(promptField.selector)
        .then(inputElement => {
          console.log(`Found element for ${siteName}:`, inputElement);
          
          // Handle different element types and methods
          switch(promptField.type) {
            case 'input':
            case 'textarea':
              // Handle standard input elements (text, textarea)
              inputElement.value = prompt;
              // Trigger input event to activate any listeners
              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
              // Also trigger change event for React and similar frameworks
              inputElement.dispatchEvent(new Event('change', { bubbles: true }));
              // For Connected Papers and JSTOR specifically
              if (siteName === "Connected Papers" || siteName === "JSTOR") {
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
          
          // Wait a brief moment for the input to register, then submit
          setTimeout(() => {
            const wasSubmitted = submitForm(inputElement);
            if (wasSubmitted) {
              console.log(`Successfully submitted search for ${siteName}`);
            } else {
              console.warn(`Could not find submission method for ${siteName}`);
            }
            resolve();
          }, 500); // Wait 500ms before attempting submission
          
        })
        .catch(error => {
          console.error('Error waiting for element:', error);
          reject(error);
        });
        
    } catch (error) {
      console.error('Error injecting prompt:', error);
      reject(error);
    }
  });
}

// Verify if injection worked correctly and submit if needed
function verifyInjection(prompt, selector, siteName) {
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
    
    // For React components, try to trigger React's internal event system
    if (inputElement._reactInternalFiber || inputElement._reactInternalInstance) {
      console.log("React detected, trying to trigger React events");
      try {
        // Create a more comprehensive React-compatible event
        const reactEvent = new Event('input', { bubbles: true });
        Object.defineProperty(reactEvent, 'target', { writable: false, value: inputElement });
        Object.defineProperty(reactEvent, 'currentTarget', { writable: false, value: inputElement });
        inputElement.dispatchEvent(reactEvent);
      } catch (e) {
        console.log("React event creation failed:", e);
      }
    }
    
    // After fixing the input, try to submit again
    setTimeout(() => {
      // Simulate Enter key press for verification
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      inputElement.dispatchEvent(enterEvent);
      
      // Also try form submission
      const form = inputElement.closest('form');
      if (form) {
        form.submit();
      }
    }, 500);
    
  } else {
    console.log("Injection verified successfully!");
    
    // Even if injection was successful initially, make sure to submit
    setTimeout(() => {
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      inputElement.dispatchEvent(enterEvent);
    }, 300);
  }
}