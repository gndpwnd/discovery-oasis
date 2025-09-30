// Wait for page to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  // Check if this is a playlist page
  const isPlaylist = window.location.href.includes('list=');
  
  if (isPlaylist) {
    handlePlaylist();
  } else {
    handleVideo();
  }
}

function handlePlaylist() {
  console.log('Detected playlist page');
  
  // Wait for playlist to load
  const checkInterval = setInterval(() => {
    const videoElements = document.querySelectorAll('ytd-playlist-video-renderer');
    
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
      
      // Send videos back to background script
      chrome.runtime.sendMessage({
        action: 'playlistVideos',
        videos: videos
      });
    }
  }, 500);
  
  // Timeout after 10 seconds
  setTimeout(() => {
    clearInterval(checkInterval);
    chrome.runtime.sendMessage({
      action: 'extractionError',
      error: 'Playlist loading timeout'
    });
  }, 10000);
}

function handleVideo() {
  console.log('Detected video page');
  
  // Wait for video to load
  const checkInterval = setInterval(() => {
    const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata yt-formatted-string');
    const videoIdMatch = window.location.href.match(/[?&]v=([^&]+)/);
    
    if (videoTitle && videoIdMatch) {
      clearInterval(checkInterval);
      
      const videoId = videoIdMatch[1];
      const title = videoTitle.textContent.trim();
      
      console.log(`Processing video: ${title} (${videoId})`);
      
      // Try to get transcript
      extractTranscript(videoId, title);
    }
  }, 500);
  
  // Timeout after 10 seconds
  setTimeout(() => {
    clearInterval(checkInterval);
    chrome.runtime.sendMessage({
      action: 'extractionError',
      error: 'Video loading timeout'
    });
  }, 10000);
}

async function extractTranscript(videoId, title) {
  try {
    // Get video metadata
    const metadata = {
      videoId: videoId,
      title: title,
      url: window.location.href,
      channel: document.querySelector('ytd-channel-name a')?.textContent.trim() || 'Unknown',
      uploadDate: document.querySelector('ytd-video-primary-info-renderer #info-strings yt-formatted-string')?.textContent.trim() || 'Unknown',
      views: document.querySelector('ytd-video-view-count-renderer span')?.textContent.trim() || 'Unknown',
      extractedAt: new Date().toISOString()
    };
    
    // Try to get transcript by opening transcript panel
    const transcriptButton = await findTranscriptButton();
    
    if (transcriptButton) {
      transcriptButton.click();
      
      // Wait for transcript to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const transcriptText = extractTranscriptText();
      metadata.transcript = transcriptText;
      metadata.transcriptAvailable = transcriptText.length > 0;
    } else {
      metadata.transcript = null;
      metadata.transcriptAvailable = false;
    }
    
    // Send back to background script
    chrome.runtime.sendMessage({
      action: 'transcriptExtracted',
      data: metadata
    });
    
  } catch (error) {
    console.error('Error extracting transcript:', error);
    chrome.runtime.sendMessage({
      action: 'extractionError',
      error: error.message
    });
  }
}

async function findTranscriptButton() {
  // Click on "Show more" if needed
  const showMoreButton = document.querySelector('tp-yt-paper-button#expand');
  if (showMoreButton) {
    showMoreButton.click();
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Find "Show transcript" button
  const buttons = Array.from(document.querySelectorAll('button, ytd-button-renderer'));
  const transcriptButton = buttons.find(btn => 
    btn.textContent.toLowerCase().includes('transcript') ||
    btn.getAttribute('aria-label')?.toLowerCase().includes('transcript')
  );
  
  return transcriptButton;
}

function extractTranscriptText() {
  const transcriptElements = document.querySelectorAll('ytd-transcript-segment-renderer');
  
  if (transcriptElements.length === 0) {
    return '';
  }
  
  const textParts = Array.from(transcriptElements).map(el => {
    const textEl = el.querySelector('yt-formatted-string.segment-text');
    return textEl ? textEl.textContent.trim() : '';
  }).filter(text => text);
  
  return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

// Re-initialize when URL changes (for SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(init, 1000);
  }
}).observe(document, { subtree: true, childList: true });