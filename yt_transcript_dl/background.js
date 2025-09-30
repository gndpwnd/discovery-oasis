let processingState = {
  isProcessing: false,
  links: [],
  currentIndex: 0,
  delay: 3000,
  results: [],
  currentPlaylist: null,
  apiEndpoint: 'http://localhost:8000'
};

// Persist state to storage
async function saveState() {
  await chrome.storage.local.set({ processingState });
}

// Restore state from storage
async function restoreState() {
  const data = await chrome.storage.local.get('processingState');
  if (data.processingState) {
    processingState = data.processingState;
    if (processingState.isProcessing) {
      console.log('Resuming interrupted processing...');
      processNextLink();
    }
  }
}

chrome.runtime.onStartup.addListener(() => {
  restoreState();
});

chrome.runtime.onInstalled.addListener(() => {
  restoreState();
});

restoreState();

function sendMessageSafe(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startProcessing') {
    processingState.isProcessing = true;
    processingState.links = message.links;
    processingState.currentIndex = 0;
    processingState.delay = message.delay;
    processingState.results = [];
    processingState.apiEndpoint = message.apiEndpoint || 'http://localhost:8000';
    
    saveState();
    processNextLink();
    sendResponse({ success: true });
  }
  
  if (message.action === 'checkStatus') {
    sendResponse({ 
      processing: processingState.isProcessing,
      current: processingState.currentIndex,
      total: processingState.links.length,
      apiEndpoint: processingState.apiEndpoint
    });
  }
  
  if (message.action === 'testConnection') {
    testApiConnection(message.endpoint).then(result => {
      sendResponse(result);
    });
    return true;
  }
  
  if (message.action === 'stopProcessing') {
    processingState.isProcessing = false;
    saveState();
    sendMessageSafe({
      action: 'processingStop',
      completed: processingState.currentIndex
    });
    sendResponse({ success: true });
  }
  
  if (message.action === 'transcriptExtracted') {
    console.log('Transcript extracted for:', message.data.title);
    
    processingState.results.push(message.data);
    sendToApi(message.data);
    
    if (processingState.currentPlaylist) {
      processingState.currentPlaylist.currentIndex++;
      
      sendMessageSafe({
        action: 'playlistProgress',
        current: processingState.currentPlaylist.currentIndex,
        total: processingState.currentPlaylist.total,
        videoTitle: message.data.title
      });
      
      if (processingState.currentPlaylist.currentIndex >= processingState.currentPlaylist.total) {
        processingState.currentPlaylist = null;
        sendMessageSafe({
          action: 'playlistComplete'
        });
      }
    }
    
    setTimeout(() => {
      processingState.currentIndex++;
      saveState();
      processNextLink();
    }, processingState.delay);
    
    sendResponse({ success: true });
  }
  
  if (message.action === 'playlistVideos') {
    console.log('Playlist videos received:', message.videos.length);
    
    processingState.currentPlaylist = {
      videos: message.videos,
      currentIndex: 0,
      total: message.videos.length
    };
    
    const newLinks = message.videos.map(v => v.url);
    processingState.links.splice(processingState.currentIndex + 1, 0, ...newLinks);
    
    saveState();
    
    setTimeout(() => {
      processingState.currentIndex++;
      saveState();
      processNextLink();
    }, processingState.delay);
    
    sendResponse({ success: true });
  }
  
  if (message.action === 'extractionError') {
    console.error('Extraction error:', message.error);
    
    const errorData = {
      videoId: 'error',
      title: 'Error',
      error: message.error,
      url: processingState.links[processingState.currentIndex] || 'unknown',
      extractedAt: new Date().toISOString()
    };
    processingState.results.push(errorData);
    
    if (processingState.currentPlaylist) {
      processingState.currentPlaylist.currentIndex++;
      
      sendMessageSafe({
        action: 'playlistProgress',
        current: processingState.currentPlaylist.currentIndex,
        total: processingState.currentPlaylist.total,
        videoTitle: 'Error: ' + message.error
      });
      
      if (processingState.currentPlaylist.currentIndex >= processingState.currentPlaylist.total) {
        processingState.currentPlaylist = null;
        sendMessageSafe({
          action: 'playlistComplete'
        });
      }
    }
    
    setTimeout(() => {
      processingState.currentIndex++;
      saveState();
      processNextLink();
    }, processingState.delay);
    
    sendResponse({ success: true });
  }
  
  return true;
});

async function processNextLink() {
  if (!processingState.isProcessing) {
    console.log('Processing stopped by user');
    return;
  }
  
  if (processingState.currentIndex >= processingState.links.length) {
    processingState.isProcessing = false;
    await saveState();
    console.log('Processing complete! Total processed:', processingState.results.length);
    sendMessageSafe({
      action: 'complete',
      total: processingState.results.length
    });
    return;
  }
  
  const currentLink = processingState.links[processingState.currentIndex];
  const isPlaylist = currentLink.includes('list=');
  
  console.log(`Processing ${processingState.currentIndex + 1}/${processingState.links.length}: ${currentLink}`);
  
  sendMessageSafe({
    action: 'progress',
    current: processingState.currentIndex + 1,
    total: processingState.links.length,
    title: isPlaylist ? 'Playlist' : 'Video'
  });
  
  try {
    if (isPlaylist) {
      // For playlists, go to YouTube to extract video URLs
      const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
      if (tabs.length > 0) {
        await chrome.tabs.update(tabs[0].id, { url: currentLink, active: false });
      } else {
        await chrome.tabs.create({ url: currentLink, active: false });
      }
    } else {
      // For single videos, go to youtube-transcript.io
      const transcriptUrl = `https://www.youtube-transcript.io/?url=${encodeURIComponent(currentLink)}`;
      const tabs = await chrome.tabs.query({ url: 'https://www.youtube-transcript.io/*' });
      
      if (tabs.length > 0) {
        await chrome.tabs.update(tabs[0].id, { url: transcriptUrl, active: false });
      } else {
        await chrome.tabs.create({ url: transcriptUrl, active: false });
      }
    }
  } catch (error) {
    console.error('Error navigating to link:', error);
    sendMessageSafe({
      action: 'error',
      error: error.message
    });
    processingState.isProcessing = false;
    await saveState();
  }
}

async function sendToApi(data) {
  const endpoint = `${processingState.apiEndpoint}/transcript`;
  
  console.log('Sending to API:', endpoint);
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('API response:', result);
    
    sendMessageSafe({
      action: 'apiSuccess',
      filename: result.filename,
      videoTitle: data.title
    });
    
  } catch (error) {
    console.error('API error:', error);
    sendMessageSafe({
      action: 'apiError',
      error: error.message,
      videoTitle: data.title
    });
  }
}

async function testApiConnection(endpoint) {
  try {
    const response = await fetch(`${endpoint}/`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    return { success: true, data };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}