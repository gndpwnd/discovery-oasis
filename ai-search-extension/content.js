// Content script for injecting into pages to check selectors
// This script is automatically injected into all pages when the extension is loaded

chrome.storage.sync.get('debugMode', function(data) {
  if (data.debugMode) {
    // Add a special query parameter to detect debug mode from the URL
    const url = new URL(window.location.href);
    if (!url.searchParams.has('debug')) {
      url.searchParams.set('debug', 'true');
      // Let the page know we're in debug mode
      window.sessionStorage.setItem('multiPromptDebugMode', 'true');
    }
  }
});

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkSelector') {
    const element = document.querySelector(request.selector);
    sendResponse({
      found: !!element,
      details: element ? {
        tagName: element.tagName,
        hasValue: 'value' in element,
        isContentEditable: element.isContentEditable
      } : null
    });
  }
  return true;
});