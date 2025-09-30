document.getElementById('startBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('linkFile');
  const delayInput = document.getElementById('delay');
  const status = document.getElementById('status');
  const startBtn = document.getElementById('startBtn');
  
  if (!fileInput.files[0]) {
    showStatus('Please select a file containing YouTube links', 'error');
    return;
  }
  
  startBtn.disabled = true;
  showStatus('Reading links file...', 'info');
  
  try {
    const text = await fileInput.files[0].text();
    const links = text.split('\n')
      .map(line => line.trim())
      .filter(line => line && (line.includes('youtube.com') || line.includes('youtu.be')));
    
    if (links.length === 0) {
      showStatus('No valid YouTube links found in file', 'error');
      startBtn.disabled = false;
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
      delay: parseInt(delayInput.value) * 1000
    });
    
    // Listen for progress updates
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'progress') {
        updateOverallProgress(message.current - 1, message.total);
        document.getElementById('currentItem').textContent = 
          `Processing: ${message.title}`;
      } else if (message.action === 'playlistProgress') {
        showPlaylistProgress(message.current, message.total, message.videoTitle);
      } else if (message.action === 'playlistComplete') {
        hidePlaylistProgress();
      } else if (message.action === 'complete') {
        document.getElementById('progressContainer').classList.remove('active');
        showStatus(`✅ Complete! Processed ${message.total} link(s)`, 'success');
        startBtn.disabled = false;
      } else if (message.action === 'error') {
        document.getElementById('progressContainer').classList.remove('active');
        showStatus(`❌ Error: ${message.error}`, 'error');
        startBtn.disabled = false;
      }
    });
    
  } catch (error) {
    showStatus(`Error reading file: ${error.message}`, 'error');
    startBtn.disabled = false;
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

// Check if processing is ongoing
chrome.runtime.sendMessage({ action: 'checkStatus' }, (response) => {
  if (response && response.processing) {
    document.getElementById('startBtn').disabled = true;
    document.getElementById('progressContainer').classList.add('active');
    showStatus('Processing in progress...', 'info');
  }
});