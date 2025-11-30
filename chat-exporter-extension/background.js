// Background script handles the extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Show working state
    chrome.action.setBadgeText({ text: '...', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#4285f4' });

    // Determine which platform we're on
    let platform;
    let scriptFile;
    
    if (tab.url.includes('scholar.google.com')) {
      platform = 'google_scholar_labs';
      scriptFile = 'extractors/google_scholar_labs.js';
    } else if (tab.url.includes('claude.ai')) {
      platform = 'claude';
      scriptFile = 'extractors/claude.js';
    } else if (tab.url.includes('chat.deepseek.com')) {
      platform = 'deepseek';
      scriptFile = 'extractors/deepseek.js';
    } else if (tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com')) {
      platform = 'chatgpt';
      scriptFile = 'extractors/chatgpt.js';
    } else if (tab.url.includes('copilot.microsoft.com')) {
      platform = 'microsoft_copilot';
      scriptFile = 'extractors/microsoft_copilot.js';
    } else if (tab.url.includes('grok.com') || tab.url.includes('x.ai')) {
      platform = 'grok';
      scriptFile = 'extractors/grok.js';
    } else if (tab.url.includes('perplexity.ai')) {
      platform = 'perplexity';
      scriptFile = 'extractors/perplexity.js';
    } else if (tab.url.includes('phind.com')) {
      platform = 'phind';
      scriptFile = 'extractors/phind.js';
    } else if (tab.url.includes('gemini.google.com')) {
      platform = 'gemini';
      scriptFile = 'extractors/gemini.js';
    } else {
      throw new Error('Unsupported platform. Currently supported: Google Scholar Labs, Claude.ai, DeepSeek, ChatGPT, Microsoft Copilot, Grok, and Gemini');
    }

    console.log(`Detected platform: ${platform}, using script: ${scriptFile}`);
    
    // Execute the appropriate extractor script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [scriptFile]
    });

    if (results && results[0] && results[0].result) {
      const markdownContent = results[0].result;
      
      // Create filename with timestamp
      const filename = `chat-export-${platform}-${new Date().toISOString().slice(0, 10)}.md`;
      
      // Convert content to data URL for download
      const dataUrl = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(markdownContent);
      
      // Download the file
      await chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: true
      });
      
      // Show success
      chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#00C853' });
      
    } else {
      throw new Error('No conversation content found');
    }
    
  } catch (error) {
    console.error('Export error:', error);
    
    // Show error
    chrome.action.setBadgeText({ text: '!', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
  } finally {
    // Clear badge after 2 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }, 2000);
  }
});