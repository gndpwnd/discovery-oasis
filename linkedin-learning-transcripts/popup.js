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

  // Initialize
  loadVideos();
  checkDownloadStatus(); // Check if download is already in progress

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

  refreshBtn.addEventListener('click', loadVideos);

  downloadBtn.addEventListener('click', startDownload);

  async function loadVideos() {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      if (!tab.url.includes('linkedin.com/learning')) {
        document.getElementById('main-content').style.display = 'none';
        document.getElementById('not-linkedin').style.display = 'block';
        return;
      }

      const results = await chrome.tabs.sendMessage(tab.id, {action: 'getVideoList'});
      
      if (results.success) {
        videos = results.videos;
        sections = results.sections || [];
        displayVideos();
      } else {
        showStatus(results.error || 'Failed to load videos', 'error');
      }
    } catch (error) {
      showStatus('Error loading videos: ' + error.message, 'error');
    }
  }

  function displayVideos() {
    if (sections.length === 0) {
      videoListEl.innerHTML = '<div style="text-align: center; color: #666;">No sections found on this page.</div>';
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
              <span class="section-toggle">▼</span>
            </div>
          </div>
          <div class="section-videos" data-section-index="${sectionIndex}">
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

    // Start download in background
    try {
      await chrome.runtime.sendMessage({
        action: 'startDownload',
        selectedVideos: selectedVideos,
        courseTitle: courseTitle
      });
      
      showStatus('Download started in background! Files will be saved to your Downloads folder. You can close this popup or switch tabs.', 'info');
      
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
      }
    } catch (error) {
      // Service worker might not be ready, ignore error
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
        
        if (!status.isDownloading) {
          stopProgressMonitoring();
          const progress = status.progress;
          const finalMessage = `Completed! Downloaded ${progress.successCount} transcripts across ${progress.sectionsProcessed} sections. ${progress.failCount} failed.`;
          showStatus(finalMessage, 'success');
        }
      } catch (error) {
        console.error('Error checking status:', error);
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
        progressText += `Section: ${progress.currentSection}\n`;
      }
      if (progress.currentVideoTitle) {
        progressText += `Video: ${progress.currentVideoTitle}\n`;
      }
      progressText += `Progress: ${progress.current}/${progress.total} videos\n`;
      progressText += `Sections: ${progress.sectionsProcessed}/${progress.totalSections}\n`;
      progressText += `Success: ${progress.successCount} | Failed: ${progress.failCount}`;
      
      progressEl.textContent = progressText;
    }
  }

  async function cancelDownload() {
    try {
      await chrome.runtime.sendMessage({ action: 'cancelDownload' });
      showStatus('Download cancelled', 'info');
      stopProgressMonitoring();
    } catch (error) {
      showStatus('Error cancelling download: ' + error.message, 'error');
    }
  }

  function showStatus(message, type) {
    statusEl.innerHTML = `<div class="status ${type}">${message}</div>`;
    setTimeout(() => {
      if (statusEl.querySelector('.status.' + type)?.textContent === message) {
        statusEl.innerHTML = '';
      }
    }, 5000);
  }
});