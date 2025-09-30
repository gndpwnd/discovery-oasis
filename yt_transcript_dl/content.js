if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  console.log('Content script initialized on:', window.location.href);
  
  const isPlaylist = window.location.href.includes('list=');
  const isTranscriptSite = window.location.href.includes('youtube-transcript.io');
  
  if (isPlaylist) {
    handlePlaylist();
  } else if (isTranscriptSite) {
    handleTranscriptSite();
  }
}

function handlePlaylist() {
  console.log('Detected playlist page');
  
  let attempts = 0;
  const maxAttempts = 40;
  
  const checkInterval = setInterval(() => {
    attempts++;
    const videoElements = document.querySelectorAll('ytd-playlist-video-renderer');
    
    console.log(`Playlist check attempt ${attempts}: Found ${videoElements.length} videos`);
    
    if (videoElements.length > 0) {
      clearInterval(checkInterval);
      
      const videos = Array.from(videoElements).map(el => {
        const linkEl = el.querySelector('a#video-title');
        const titleEl = el.querySelector('#video-title');
        
        return {
          url: linkEl ? 'https://www.youtube.com' + linkEl.getAttribute('href').split('&list=')[0] : null,
          title: titleEl ? titleEl.textContent.trim() : 'Unknown'
        };
      }).filter(v => v.url);
      
      console.log(`Found ${videos.length} videos in playlist`);
      
      chrome.runtime.sendMessage({
        action: 'playlistVideos',
        videos: videos
      });
    }
    
    if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
      console.error('Playlist loading timeout');
      chrome.runtime.sendMessage({
        action: 'extractionError',
        error: 'Playlist loading timeout'
      });
    }
  }, 500);
}

function handleTranscriptSite() {
  console.log('Detected youtube-transcript.io page');
  
  // Check if we're on the main page (need to submit URL) or results page
  const urlInput = document.querySelector('input[type="url"]');
  const submitButton = document.querySelector('button[type="submit"]');
  
  if (urlInput && submitButton) {
    console.log('On submission page - submitting YouTube URL');
    submitYouTubeUrl(urlInput, submitButton);
  } else {
    console.log('On results page - waiting for transcript to load');
    waitForTranscriptAndCopy();
  }
}

function submitYouTubeUrl(urlInput, submitButton) {
  // Extract YouTube URL from the current tab URL or use the one from background
  const currentUrl = new URL(window.location.href);
  const youtubeUrl = currentUrl.searchParams.get('url');
  
  if (youtubeUrl) {
    console.log('Submitting YouTube URL:', youtubeUrl);
    
    // Fill the input with the YouTube URL
    urlInput.value = youtubeUrl;
    
    // Trigger input event to make sure the form recognizes the change
    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Wait a moment then click submit
    setTimeout(() => {
      submitButton.click();
      console.log('Submitted URL, waiting for results...');
      
      // Wait for navigation to results page and then process
      setTimeout(() => {
        waitForTranscriptAndCopy();
      }, 2000);
    }, 500);
  } else {
    console.error('No YouTube URL found in parameters');
    chrome.runtime.sendMessage({
      action: 'extractionError',
      error: 'No YouTube URL provided to transcript service'
    });
  }
}

function waitForTranscriptAndCopy() {
  console.log('Waiting for transcript to load...');
  
  let attempts = 0;
  const maxAttempts = 30;
  
  const checkInterval = setInterval(() => {
    attempts++;
    
    // Look for the copy transcript button
    const copyButton = findCopyTranscriptButton();
    const videoTitle = document.querySelector('h1, h2, .title, [class*="title"]');
    
    console.log(`Transcript check attempt ${attempts}: Copy button found: ${!!copyButton}, Title found: ${!!videoTitle}`);
    
    if (copyButton && videoTitle) {
      clearInterval(checkInterval);
      console.log('Transcript loaded, clicking copy button...');
      clickCopyButtonAndExtract(copyButton, videoTitle);
    }
    
    if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
      console.error('Transcript loading timeout');
      chrome.runtime.sendMessage({
        action: 'extractionError',
        error: 'Transcript loading timeout'
      });
    }
  }, 1000);
}

function findCopyTranscriptButton() {
  // Look for button with "Copy Transcript" text or the SVG copy icon
  const buttons = document.querySelectorAll('button');
  
  for (const button of buttons) {
    const text = button.textContent?.toLowerCase() || '';
    const hasCopyIcon = button.querySelector('svg.lucide-copy');
    
    if (text.includes('copy transcript') || hasCopyIcon) {
      return button;
    }
  }
  
  // Also check for the specific grid layout you mentioned
  const gridButton = document.querySelector('.grid button:first-child');
  if (gridButton) {
    const text = gridButton.textContent?.toLowerCase() || '';
    if (text.includes('copy') || gridButton.querySelector('svg')) {
      return gridButton;
    }
  }
  
  return null;
}

async function clickCopyButtonAndExtract(copyButton, titleElement) {
  try {
    // Request clipboard permissions
    await requestClipboardPermission();
    
    // Click the copy button
    copyButton.click();
    console.log('Copy button clicked, waiting for clipboard...');
    
    // Wait for clipboard to be populated
    await wait(1000);
    
    // Read from clipboard
    const transcriptText = await readClipboard();
    
    if (!transcriptText || transcriptText.trim().length === 0) {
      throw new Error('Empty transcript copied to clipboard');
    }
    
    console.log('Transcript copied successfully, length:', transcriptText.length);
    
    // Extract video info
    const currentUrl = new URL(window.location.href);
    const youtubeUrl = currentUrl.searchParams.get('url') || window.location.href;
    const videoIdMatch = youtubeUrl.match(/[?&]v=([^&]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : 'unknown';
    const videoTitle = titleElement.textContent.trim();
    
    const metadata = {
      videoId: videoId,
      title: videoTitle,
      url: youtubeUrl,
      channel: 'Unknown',
      uploadDate: 'Unknown',
      views: 'Unknown',
      extractedAt: new Date().toISOString(),
      transcript: transcriptText,
      transcriptAvailable: transcriptText.length > 0
    };
    
    console.log('Transcript extracted successfully');
    
    chrome.runtime.sendMessage({
      action: 'transcriptExtracted',
      data: metadata
    });
    
  } catch (error) {
    console.error('Error extracting transcript via copy:', error);
    
    // Fallback: try to extract transcript directly from page
    try {
      console.log('Trying fallback extraction from page content...');
      const fallbackTranscript = extractTranscriptFromPage();
      if (fallbackTranscript && fallbackTranscript.length > 0) {
        console.log('Fallback extraction successful');
        
        const currentUrl = new URL(window.location.href);
        const youtubeUrl = currentUrl.searchParams.get('url') || window.location.href;
        const videoIdMatch = youtubeUrl.match(/[?&]v=([^&]+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : 'unknown';
        const videoTitle = titleElement.textContent.trim();
        
        const metadata = {
          videoId: videoId,
          title: videoTitle,
          url: youtubeUrl,
          channel: 'Unknown',
          uploadDate: 'Unknown',
          views: 'Unknown',
          extractedAt: new Date().toISOString(),
          transcript: fallbackTranscript,
          transcriptAvailable: fallbackTranscript.length > 0
        };
        
        chrome.runtime.sendMessage({
          action: 'transcriptExtracted',
          data: metadata
        });
        return;
      }
    } catch (fallbackError) {
      console.error('Fallback extraction also failed:', fallbackError);
    }
    
    chrome.runtime.sendMessage({
      action: 'extractionError',
      error: error.message
    });
  }
}

function extractTranscriptFromPage() {
  // Try to find transcript content in various elements
  const selectors = [
    '.transcript-content',
    '.prose',
    '[class*="transcript"]',
    '.content',
    'main > div',
    'article'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const text = element.textContent.trim();
      if (text.length > 100) { // Reasonable minimum length for transcript
        return text;
      }
    }
  }
  
  // If no specific selectors work, try to find the largest text block
  const allElements = document.querySelectorAll('p, div, span');
  let largestText = '';
  
  for (const el of allElements) {
    const text = el.textContent.trim();
    if (text.length > largestText.length && text.length > 100) {
      largestText = text;
    }
  }
  
  return largestText;
}

async function requestClipboardPermission() {
  try {
    // Request clipboard-read permission
    const result = await chrome.permissions.request({
      permissions: ['clipboardRead']
    });
    
    if (!result) {
      throw new Error('Clipboard permission denied');
    }
    
    console.log('Clipboard permission granted');
  } catch (error) {
    console.warn('Could not request clipboard permission:', error);
    // Continue anyway - might work without explicit permission
  }
}

async function readClipboard() {
  try {
    return await navigator.clipboard.readText();
  } catch (error) {
    console.error('Error reading clipboard:', error);
    
    // Fallback: try execCommand for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      document.execCommand('paste');
      const text = textArea.value;
      document.body.removeChild(textArea);
      return text;
    } catch (fallbackError) {
      console.error('Fallback clipboard read also failed:', fallbackError);
      throw new Error('Cannot read from clipboard');
    }
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Re-initialize on URL changes
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('URL changed, re-initializing...');
    setTimeout(init, 1000);
  }
}).observe(document, { subtree: true, childList: true });