document.addEventListener('DOMContentLoaded', function() {
  const videoListEl = document.getElementById('video-list');
  const downloadBtn = document.getElementById('download');
  const statusEl = document.getElementById('status');
  const loadingEl = document.getElementById('loading');
  const progressEl = document.getElementById('progress');
  const selectAllBtn = document.getElementById('selectAll');
  const deselectAllBtn = document.getElementById('deselectAll');
  const refreshBtn = document.getElementById('refresh');

  let videos = [];
  let sections = [];
  let statusCheckInterval = null;
  let failedVideosContainer = null;

  // Initialize
  loadVideos();
  checkDownloadStatus(); // Check if download is already in progress
  createFailedVideosContainer();

  function createFailedVideosContainer() {
    // Create failed videos display container if it doesn't exist
    failedVideosContainer = document.createElement('div');
    failedVideosContainer.id = 'failed-videos';
    failedVideosContainer.style.display = 'none';
    failedVideosContainer.innerHTML = `
      <div style="margin-top: 12px; background: #fff3cd; border: 1px solid #ffeeba; border-radius: 6px; padding: 10px; max-height: 150px; overflow-y: auto;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <strong>Failed Videos (<span id="failed-count">0</span>):</strong>
          <button id="close-failed" style="background: none; border: none; font-size: 16px; cursor: pointer; color: #666;">&times;</button>
        </div>
        <div id="failed-videos-list" style="font-size: 11px; color: #666;"></div>
      </div>
    `;
    document.body.appendChild(failedVideosContainer);

    // Add close button functionality
    document.getElementById('close-failed').addEventListener('click', () => {
      hideFailedVideosDisplay();
    });
  }

  function addEventListeners() {
    // Section header click to collapse/expand
    const sectionHeaders = videoListEl.querySelectorAll('.section-header');
    sectionHeaders.forEach(header => {
      header.addEventListener('click', function(e) {
        // Don't toggle if clicking on checkbox
        if (e.target.type === 'checkbox') return;
        
        const sectionIndex = this.dataset.sectionIndex;
        const videosContainer = videoListEl.querySelector(`.section-videos[data-section-index="${sectionIndex}"]`);
        const toggle = this.querySelector('.section-toggle');
        
        if (videosContainer.classList.contains('collapsed')) {
          videosContainer.classList.remove('collapsed');
          toggle.classList.remove('collapsed');
        } else {
          videosContainer.classList.add('collapsed');
          toggle.classList.add('collapsed');
        }
      });
    });

    // Section checkbox listeners
    const sectionCheckboxes = videoListEl.querySelectorAll('.section-checkbox');
    sectionCheckboxes.forEach(sectionCb => {
      sectionCb.addEventListener('change', function() {
        const sectionIndex = parseInt(this.dataset.sectionIndex);
        const videoCheckboxes = videoListEl.querySelectorAll(`input[data-section-index="${sectionIndex}"].video-checkbox:not(:disabled)`);
        
        videoCheckboxes.forEach(videoCb => {
          videoCb.checked = this.checked;
        });
        
        updateDownloadButton();
      });
    });

    // Video checkbox listeners
    const videoCheckboxes = videoListEl.querySelectorAll('.video-checkbox');
    videoCheckboxes.forEach(videoCb => {
      videoCb.addEventListener('change', function() {
        const sectionIndex = parseInt(this.dataset.sectionIndex);
        const sectionCheckbox = videoListEl.querySelector(`input[data-section-index="${sectionIndex}"].section-checkbox`);
        const sectionVideoCheckboxes = videoListEl.querySelectorAll(`input[data-section-index="${sectionIndex}"].video-checkbox:not(:disabled)`);
        
        // Update section checkbox based on video selections
        const checkedVideos = Array.from(sectionVideoCheckboxes).filter(cb => cb.checked);
        if (checkedVideos.length === 0) {
          sectionCheckbox.checked = false;
          sectionCheckbox.indeterminate = false;
        } else if (checkedVideos.length === sectionVideoCheckboxes.length) {
          sectionCheckbox.checked = true;
          sectionCheckbox.indeterminate = false;
        } else {
          sectionCheckbox.checked = false;
          sectionCheckbox.indeterminate = true;
        }
        
        updateDownloadButton();
      });
    });
  }

  function updateDownloadButton() {
    const checkedVideoBoxes = videoListEl.querySelectorAll('.video-checkbox:checked');
    downloadBtn.disabled = checkedVideoBoxes.length === 0;
    
    // Update button text with count
    const count = checkedVideoBoxes.length;
    if (count === 0) {
      downloadBtn.textContent = 'Download Selected Transcripts';
    } else {
      downloadBtn.textContent = `Download ${count} Selected Transcript${count > 1 ? 's' : ''}`;
    }
  }

  selectAllBtn.addEventListener('click', () => {
    const sectionCheckboxes = videoListEl.querySelectorAll('.section-checkbox:not(:disabled)');
    sectionCheckboxes.forEach(cb => {
      cb.checked = true;
      cb.dispatchEvent(new Event('change'));
    });
  });

  deselectAllBtn.addEventListener('click', () => {
    const sectionCheckboxes = videoListEl.querySelectorAll('.section-checkbox:not(:disabled)');
    sectionCheckboxes.forEach(cb => {
      cb.checked = false;
      cb.dispatchEvent(new Event('change'));
    });
  });

  refreshBtn.addEventListener('click', () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing...';
    loadVideos().finally(() => {
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh';
    });
  });

  downloadBtn.addEventListener('click', startDownload);

  async function loadVideos() {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      if (!tab.url.includes('linkedin.com/learning')) {
        document.getElementById('main-content').style.display = 'none';
        document.getElementById('not-linkedin').style.display = 'block';
        return;
      }

      // Show loading state
      videoListEl.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Loading videos...</div>';

      const results = await chrome.tabs.sendMessage(tab.id, {action: 'getVideoList'});
      
      if (results.success) {
        videos = results.videos;
        sections = results.sections || [];
        displayVideos();
        showStatus(`Loaded ${videos.length} videos from ${sections.length} sections`, 'success');
      } else {
        showStatus(results.error || 'Failed to load videos', 'error');
        videoListEl.innerHTML = `<div style="text-align: center; color: #ff6b6b; padding: 20px;">${results.error || 'Failed to load videos'}</div>`;
      }
    } catch (error) {
      showStatus('Error loading videos: ' + error.message, 'error');
      videoListEl.innerHTML = `<div style="text-align: center; color: #ff6b6b; padding: 20px;">Error: ${error.message}</div>`;
    }
  }

  function displayVideos() {
    if (sections.length === 0) {
      videoListEl.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No sections found on this page.</div>';
      return;
    }

    let html = '';
    let videoIndex = 0;

    sections.forEach((section, sectionIndex) => {
      const sectionId = `section-${sectionIndex}`;
      const nonQuizVideos = section.videos.filter(video => !video.title.toLowerCase().includes("quiz"));
      const hasNonQuizVideos = nonQuizVideos.length > 0;

      html += `
        <div class="section-group">
          <div class="section-header" data-section-index="${sectionIndex}">
            <div class="section-title">
              <input type="checkbox" id="${sectionId}" class="section-checkbox" data-section-index="${sectionIndex}" 
                    style="margin-right: 12px;" ${!hasNonQuizVideos ? 'disabled' : ''}>
              <span>${section.sectionTitle}</span>
              <span style="margin-left: auto; margin-right: 12px; font-size: 11px; color: #666; font-weight: normal;">(${nonQuizVideos.length} videos)</span>
              <span class="section-toggle collapsed">▼</span>
            </div>
          </div>
          <div class="section-videos collapsed" data-section-index="${sectionIndex}">
      `;

      section.videos.forEach(video => {
        const isQuiz = video.title.toLowerCase().includes("quiz");
        const titleStyle = isQuiz ? 'color: #888; font-style: italic;' : '';
        const labelText = isQuiz ? `${video.title} (no transcript - will be skipped)` : video.title;

        html += `
          <div class="video-item" style="margin-left: 20px; margin-bottom: 6px;">
            <label style="display: flex; align-items: flex-start; cursor: pointer;">
              <input type="checkbox" id="video-${videoIndex}" class="video-checkbox" 
                    data-video-index="${videoIndex}" data-section-index="${sectionIndex}"
                    style="margin-right: 8px; margin-top: 2px;" ${isQuiz ? 'disabled' : ''}>
              <span class="video-title" style="font-size: 13px; line-height: 1.3; ${titleStyle}">${labelText}</span>
            </label>
          </div>
        `;
        videoIndex++;
      });

      html += `
          </div>
        </div>
      `;
    });

    videoListEl.innerHTML = html;

    // Add event listeners
    addEventListeners();
    updateDownloadButton();
  }

  async function startDownload() {
    const checkedVideoBoxes = videoListEl.querySelectorAll('.video-checkbox:checked');
    const selectedVideos = Array.from(checkedVideoBoxes).map(cb => {
      const videoIndex = parseInt(cb.dataset.videoIndex);
      return videos[videoIndex];
    }).filter(video => !video.title.toLowerCase().includes("quiz"));

    if (selectedVideos.length === 0) {
      showStatus('Please select at least one video (Quiz videos are automatically skipped)', 'error');
      return;
    }

    // Get course name for organized folder structure
    const courseTitle = await getCourseTitle();

    // Confirm download
    const confirmMessage = `Ready to download ${selectedVideos.length} transcripts?\n\nFiles will be saved to: Downloads/${courseTitle}/\n\nThis process may take several minutes and will run in the background.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    // Start download in background
    try {
      await chrome.runtime.sendMessage({
        action: 'startDownload',
        selectedVideos: selectedVideos,
        courseTitle: courseTitle
      });
      
      showStatus('Download started! The process will continue in the background. You can close this popup or switch tabs.', 'info');
      
      // Start monitoring progress
      startProgressMonitoring();
      
    } catch (error) {
      showStatus('Error starting download: ' + error.message, 'error');
    }
  }

  async function getCourseTitle() {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      const result = await chrome.tabs.sendMessage(tab.id, {action: 'getCourseTitle'});
      return result.courseTitle || 'LinkedIn-Learning-Course';
    } catch (error) {
      return 'LinkedIn-Learning-Course';
    }
  }

  async function checkDownloadStatus() {
    try {
      const status = await chrome.runtime.sendMessage({ action: 'getDownloadStatus' });
      if (status.isDownloading) {
        startProgressMonitoring();
        updateFailedVideosDisplay(status.progress.failedVideos);
      } else if (status.progress.failedVideos && status.progress.failedVideos.length > 0) {
        // Show failed videos from previous download
        updateFailedVideosDisplay(status.progress.failedVideos);
      }
    } catch (error) {
      // Service worker might not be ready, ignore error
      console.log('Could not check download status:', error);
    }
  }

  function startProgressMonitoring() {
    downloadBtn.disabled = true;
    loadingEl.style.display = 'block';
    
    // Add cancel button
    if (!document.getElementById('cancelBtn')) {
      const cancelBtn = document.createElement('button');
      cancelBtn.id = 'cancelBtn';
      cancelBtn.textContent = 'Cancel Download';
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.style.width = '100%';
      cancelBtn.style.marginTop = '10px';
      cancelBtn.style.backgroundColor = '#dc3545';
      cancelBtn.style.color = 'white';
      cancelBtn.addEventListener('click', cancelDownload);
      downloadBtn.parentNode.insertBefore(cancelBtn, downloadBtn.nextSibling);
    }
    
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
    }
    
    statusCheckInterval = setInterval(async () => {
      try {
        const status = await chrome.runtime.sendMessage({ action: 'getDownloadStatus' });
        updateProgress(status);
        updateFailedVideosDisplay(status.progress.failedVideos);
        
        if (!status.isDownloading) {
          stopProgressMonitoring();
          const progress = status.progress;
          let finalMessage = `✅ Completed!\n`;
          finalMessage += `📁 Downloaded: ${progress.successCount} transcripts\n`;
          finalMessage += `📂 Sections: ${progress.sectionsProcessed}\n`;
          
          if (progress.failCount > 0) {
            finalMessage += `❌ Failed: ${progress.failCount}\n`;
            finalMessage += `Check the failed videos list for details.`;
          } else {
            finalMessage += `🎉 All downloads successful!`;
          }
          
          showStatus(finalMessage, progress.failCount > 0 ? 'error' : 'success');
        }
      } catch (error) {
        console.error('Error checking status:', error);
        // If we lose connection to background script, assume download stopped
        if (statusCheckInterval) {
          stopProgressMonitoring();
          showStatus('Lost connection to background download process', 'error');
        }
      }
    }, 1000);
  }

  function stopProgressMonitoring() {
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
      statusCheckInterval = null;
    }
    
    downloadBtn.disabled = false;
    loadingEl.style.display = 'none';
    updateDownloadButton(); // Restore proper button text
    
    // Remove cancel button
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
      cancelBtn.remove();
    }
  }

  function updateProgress(status) {
    if (status.isDownloading) {
      const progress = status.progress;
      let progressText = '';
      
      if (progress.currentSection) {
        progressText += `📁 Section: ${progress.currentSection}\n`;
      }
      if (progress.currentVideoTitle) {
        const truncatedTitle = progress.currentVideoTitle.length > 50 
          ? progress.currentVideoTitle.substring(0, 47) + '...'
          : progress.currentVideoTitle;
        progressText += `🎥 Video: ${truncatedTitle}\n`;
      }
      progressText += `⏱️ Progress: ${progress.current}/${progress.total} videos (${Math.round(progress.current/progress.total*100)}%)\n`;
      progressText += `📂 Sections: ${progress.sectionsProcessed}/${progress.totalSections}\n`;
      progressText += `✅ Success: ${progress.successCount} | ❌ Failed: ${progress.failCount}`;
      
      progressEl.textContent = progressText;
    }
  }

  function updateFailedVideosDisplay(failedVideos) {
    if (failedVideos && failedVideos.length > 0) {
      document.getElementById('failed-count').textContent = failedVideos.length;
      
      let html = '';
      failedVideos.forEach((failedVideo, index) => {
        const shortError = failedVideo.error.length > 50 
          ? failedVideo.error.substring(0, 47) + '...'
          : failedVideo.error;
        
        html += `
          <div style="margin-bottom: 6px; padding: 6px; background: #ffeaa7; border-radius: 3px; border-left: 3px solid #fdcb6e;">
            <div style="font-weight: bold; color: #333;">${failedVideo.title}</div>
            <div style="color: #666; font-size: 10px;">Section: ${failedVideo.section}</div>
            <div style="color: #e74c3c; font-size: 10px;">Error: ${shortError}</div>
          </div>
        `;
      });
      
      document.getElementById('failed-videos-list').innerHTML = html;
      failedVideosContainer.style.display = 'block';
    } else {
      hideFailedVideosDisplay();
    }
  }

  function hideFailedVideosDisplay() {
    if (failedVideosContainer) {
      failedVideosContainer.style.display = 'none';
      document.getElementById('failed-videos-list').innerHTML = '';
      document.getElementById('failed-count').textContent = '0';
    }
  }

  async function cancelDownload() {
    if (confirm('Are you sure you want to cancel the download? Any completed transcripts will still be saved.')) {
      try {
        await chrome.runtime.sendMessage({ action: 'cancelDownload' });
        showStatus('Download cancelled. Completed files have been saved.', 'info');
        stopProgressMonitoring();
        hideFailedVideosDisplay();
      } catch (error) {
        showStatus('Error cancelling download: ' + error.message, 'error');
      }
    }
  }

  function showStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.className = 'status ' + type;
    statusEl.style.display = 'block';
    
    // Auto-hide status after a delay (longer for errors)
    const hideDelay = type === 'error' ? 15000 : 8000;
    setTimeout(() => {
      if (statusEl.textContent === message) { // Only hide if message hasn't changed
        statusEl.style.display = 'none';
      }
    }, hideDelay);
  }

  // Handle popup close/reopen
  window.addEventListener('beforeunload', () => {
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
    }
  });

  // Auto-refresh video list if user navigates to different LinkedIn course
  let lastUrl = '';
  setInterval(async () => {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (tab && tab.url !== lastUrl && tab.url.includes('linkedin.com/learning')) {
        lastUrl = tab.url;
        // Small delay to let page load
        setTimeout(loadVideos, 2000);
      }
    } catch (error) {
      // Ignore errors during URL checking
    }
  }, 3000);
});