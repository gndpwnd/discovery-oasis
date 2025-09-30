// Test API connection button
document.getElementById('testBtn').addEventListener('click', async () => {
  const endpoint = document.getElementById('apiEndpoint').value;
  const testBtn = document.getElementById('testBtn');
  const connectionStatus = document.getElementById('connectionStatus');
  
  testBtn.disabled = true;
  testBtn.textContent = 'Testing...';
  connectionStatus.className = 'connection-status';
  
  chrome.runtime.sendMessage({ 
    action: 'testConnection', 
    endpoint: endpoint 
  }, (response) => {
    testBtn.disabled = false;
    testBtn.textContent = 'Test';
    
    if (response.success) {
      connectionStatus.className = 'connection-status connected';
      showStatus(`✅ Connected to API! Service: ${response.data.service}`, 'success');
    } else {
      connectionStatus.className = 'connection-status disconnected';
      showStatus(`❌ Connection failed: ${response.error}`, 'error');
    }
  });
});

// Start processing button
document.getElementById('startBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('linkFile');
  const delayInput = document.getElementById('delay');
  const apiEndpoint = document.getElementById('apiEndpoint').value;
  const status = document.getElementById('status');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  if (!fileInput.files[0]) {
    showStatus('Please select a file containing YouTube links', 'error');
    return;
  }
  
  if (!apiEndpoint) {
    showStatus('Please enter an API endpoint', 'error');
    return;
  }
  
  startBtn.disabled = true;
  stopBtn.classList.add('active');
  showStatus('Reading links file...', 'info');
  
  try {
    const text = await fileInput.files[0].text();
    const links = text.split('\n')
      .map(line => line.trim())
      .filter(line => line && (line.includes('youtube.com') || line.includes('youtu.be')));
    
    if (links.length === 0) {
      showStatus('No valid YouTube links found in file', 'error');
      startBtn.disabled = false;
      stopBtn.classList.remove('active');
      return;
    }
    
    showStatus(`Found ${links.length} link(s). Starting processing...`, 'info');
    
    // Show progress container
    document.getElementById('progressContainer').classList.add('active');
    updateOverallProgress(0, links.length);
    
    // Send to background script
    chrome.runtime.sendMessage({
      action: 'startProcessing',
      links: links,
      delay: parseInt(delayInput.value) * 1000,
      apiEndpoint: apiEndpoint
    });
    
  } catch (error) {
    showStatus(`Error reading file: ${error.message}`, 'error');
    startBtn.disabled = false;
    stopBtn.classList.remove('active');
  }
});

// Stop processing button
document.getElementById('stopBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stopProcessing' });
  document.getElementById('stopBtn').disabled = true;
  showStatus('Stopping after current video...', 'info');
});

// Listen for progress updates
chrome.runtime.onMessage.addListener((message) => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  if (message.action === 'progress') {
    updateOverallProgress(message.current - 1, message.total);
    document.getElementById('currentItem').textContent = 
      `Processing: ${message.title}`;
  } else if (message.action === 'playlistProgress') {
    showPlaylistProgress(message.current, message.total, message.videoTitle);
  } else if (message.action === 'playlistComplete') {
    hidePlaylistProgress();
  } else if (message.action === 'apiSuccess') {
    console.log('Saved:', message.filename);
  } else if (message.action === 'apiError') {
    console.error('API error for', message.videoTitle, ':', message.error);
  } else if (message.action === 'complete') {
    document.getElementById('progressContainer').classList.remove('active');
    showStatus(`✅ Complete! Processed ${message.total} video(s). Files saved to ./yt_transcripts/`, 'success');
    startBtn.disabled = false;
    stopBtn.classList.remove('active');
    stopBtn.disabled = false;
  } else if (message.action === 'processingStop') {
    document.getElementById('progressContainer').classList.remove('active');
    showStatus(`⏹️ Stopped after processing ${message.completed} video(s)`, 'info');
    startBtn.disabled = false;
    stopBtn.classList.remove('active');
    stopBtn.disabled = false;
  } else if (message.action === 'error') {
    showStatus(`❌ Error: ${message.error}`, 'error');
    startBtn.disabled = false;
    stopBtn.classList.remove('active');
    stopBtn.disabled = false;
  }
});

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.innerHTML = message;
  status.className = type;
}

function updateOverallProgress(current, total) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  document.getElementById('overallProgress').style.width = `${percentage}%`;
  document.getElementById('overallProgress').textContent = `${percentage}%`;
  document.getElementById('overallNumbers').textContent = `${current} / ${total}`;
}

function showPlaylistProgress(current, total, videoTitle) {
  const playlistSection = document.getElementById('playlistSection');
  playlistSection.style.display = 'block';
  
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  document.getElementById('playlistProgress').style.width = `${percentage}%`;
  document.getElementById('playlistProgress').textContent = `${percentage}%`;
  document.getElementById('playlistNumbers').textContent = `${current} / ${total}`;
  document.getElementById('currentPlaylistItem').textContent = videoTitle;
}

function hidePlaylistProgress() {
  document.getElementById('playlistSection').style.display = 'none';
}

// Check if processing is ongoing when popup opens
chrome.runtime.sendMessage({ action: 'checkStatus' }, (response) => {
  if (response && response.processing) {
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').classList.add('active');
    document.getElementById('progressContainer').classList.add('active');
    updateOverallProgress(response.current, response.total);
    showStatus('Processing in progress... (runs in background)', 'info');
    
    // Set the API endpoint if available
    if (response.apiEndpoint) {
      document.getElementById('apiEndpoint').value = response.apiEndpoint;
    }
  }
});

// Auto-test connection on load
setTimeout(() => {
  document.getElementById('testBtn').click();
}, 500);