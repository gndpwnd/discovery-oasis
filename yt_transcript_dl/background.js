let processingState = {
  isProcessing: false,
  links: [],
  currentIndex: 0,
  delay: 3000,
  results: [],
  currentPlaylist: null
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startProcessing') {
    processingState.isProcessing = true;
    processingState.links = message.links;
    processingState.currentIndex = 0;
    processingState.delay = message.delay;
    processingState.results = [];
    
    processNextLink();
    sendResponse({ success: true });
  }
  
  if (message.action === 'checkStatus') {
    sendResponse({ processing: processingState.isProcessing });
  }
  
  if (message.action === 'transcriptExtracted') {
    // Save the result
    processingState.results.push(message.data);
    
    // Download JSON file
    downloadJSON(message.data);
    
    // Update playlist progress if in a playlist
    if (processingState.currentPlaylist) {
      processingState.currentPlaylist.currentIndex++;
      
      chrome.runtime.sendMessage({
        action: 'playlistProgress',
        current: processingState.currentPlaylist.currentIndex,
        total: processingState.currentPlaylist.total,
        videoTitle: message.data.title
      });
      
      // Check if playlist is complete
      if (processingState.currentPlaylist.currentIndex >= processingState.currentPlaylist.total) {
        processingState.currentPlaylist = null;
        chrome.runtime.sendMessage({
          action: 'playlistComplete'
        });
      }
    }
    
    // Process next link after delay
    setTimeout(() => {
      processingState.currentIndex++;
      processNextLink();
    }, processingState.delay);
    
    sendResponse({ success: true });
  }
  
  if (message.action === 'playlistVideos') {
    // Set up playlist tracking
    processingState.currentPlaylist = {
      videos: message.videos,
      currentIndex: 0,
      total: message.videos.length
    };
    
    // Add playlist videos to the queue
    const newLinks = message.videos.map(v => v.url);
    processingState.links.splice(processingState.currentIndex + 1, 0, ...newLinks);
    
    // Move to next link (first video in playlist)
    setTimeout(() => {
      processingState.currentIndex++;
      processNextLink();
    }, processingState.delay);
    
    sendResponse({ success: true });
  }
  
  if (message.action === 'extractionError') {
    console.error('Extraction error:', message.error);
    
    // Update playlist progress if in a playlist (mark as error but continue)
    if (processingState.currentPlaylist) {
      processingState.currentPlaylist.currentIndex++;
      
      chrome.runtime.sendMessage({
        action: 'playlistProgress',
        current: processingState.currentPlaylist.currentIndex,
        total: processingState.currentPlaylist.total,
        videoTitle: 'Error: ' + message.error
      });
      
      // Check if playlist is complete
      if (processingState.currentPlaylist.currentIndex >= processingState.currentPlaylist.total) {
        processingState.currentPlaylist = null;
        chrome.runtime.sendMessage({
          action: 'playlistComplete'
        });
      }
    }
    
    // Continue to next link
    setTimeout(() => {
      processingState.currentIndex++;
      processNextLink();
    }, processingState.delay);
    
    sendResponse({ success: true });
  }
  
  return true; // Keep channel open for async response
});

async function processNextLink() {
  if (processingState.currentIndex >= processingState.links.length) {
    // All done
    processingState.isProcessing = false;
    chrome.runtime.sendMessage({
      action: 'complete',
      total: processingState.results.length
    });
    return;
  }
  
  const currentLink = processingState.links[processingState.currentIndex];
  const isPlaylist = currentLink.includes('list=');
  
  // Send progress update
  chrome.runtime.sendMessage({
    action: 'progress',
    current: processingState.currentIndex + 1,
    total: processingState.links.length,
    title: isPlaylist ? 'Playlist' : 'Video'
  });
  
  try {
    // Create or update tab
    const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
    
    if (tabs.length > 0) {
      await chrome.tabs.update(tabs[0].id, { url: currentLink, active: true });
    } else {
      await chrome.tabs.create({ url: currentLink, active: true });
    }
  } catch (error) {
    console.error('Error navigating to link:', error);
    chrome.runtime.sendMessage({
      action: 'error',
      error: error.message
    });
    processingState.isProcessing = false;
  }
}

function downloadJSON(data) {
  const filename = `${sanitizeFilename(data.title)}_${data.videoId}.json`;
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  chrome.downloads.download({
    url: url,
    filename: `youtube_transcripts/${filename}`,
    saveAs: false
  }, () => {
    URL.revokeObjectURL(url);
  });
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
}