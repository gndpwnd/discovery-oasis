// Background service worker for LinkedIn Learning Transcript Downloader

let downloadState = {
  isDownloading: false,
  currentVideo: null,
  progress: {
    current: 0,
    total: 0,
    currentSection: '',
    currentVideoTitle: '',
    sectionsProcessed: 0,
    totalSections: 0,
    successCount: 0,
    failCount: 0,
    failedVideos: []
  }
};

// Persist state to storage to survive service worker restarts
async function saveState() {
  await chrome.storage.local.set({ downloadState });
}

async function loadState() {
  const result = await chrome.storage.local.get('downloadState');
  if (result.downloadState) {
    downloadState = result.downloadState;
  }
}

// Initialize state on startup
chrome.runtime.onStartup.addListener(loadState);
chrome.runtime.onInstalled.addListener(loadState);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startDownload') {
    startBackgroundDownload(request.selectedVideos, request.courseTitle);
    sendResponse({ success: true });
  } else if (request.action === 'getDownloadStatus') {
    sendResponse(downloadState);
  } else if (request.action === 'cancelDownload') {
    cancelDownload();
    sendResponse({ success: true });
  }
  return true;
});

async function startBackgroundDownload(selectedVideos, courseTitle = 'LinkedIn-Learning-Course') {
  if (downloadState.isDownloading) {
    return;
  }

  console.log('Starting download for', selectedVideos.length, 'videos');

  downloadState.isDownloading = true;
  downloadState.progress.current = 0;
  downloadState.progress.total = selectedVideos.length;
  downloadState.progress.successCount = 0;
  downloadState.progress.failCount = 0;
  downloadState.progress.failedVideos = [];

  // Save initial state
  await saveState();

  // Group videos by section
  let videosBySection = groupVideosBySection(selectedVideos);
  downloadState.progress.totalSections = Object.keys(videosBySection).length;
  downloadState.progress.sectionsProcessed = 0;

  console.log('Grouped into', downloadState.progress.totalSections, 'sections:', Object.keys(videosBySection));

  try {
    // Get the active LinkedIn tab with better error handling
    const linkedinTab = await findLinkedInTab();
    if (!linkedinTab) {
      throw new Error('No LinkedIn Learning tab found');
    }

    // Ensure content script is loaded
    await ensureContentScriptLoaded(linkedinTab.id);
    
    // Process each section with improved error handling
    for (const [sectionTitle, sectionVideos] of Object.entries(videosBySection)) {
      if (!downloadState.isDownloading) break;
      
      downloadState.progress.currentSection = sectionTitle;
      const sectionTranscripts = [];

      for (let i = 0; i < sectionVideos.length; i++) {
        if (!downloadState.isDownloading) break;
        
        const video = sectionVideos[i];
        downloadState.progress.currentVideoTitle = video.title;
        downloadState.progress.current++;
        
        // Save progress after each video
        await saveState();

        try {
          // Ensure tab is still available and content script is responsive
          const tabInfo = await chrome.tabs.get(linkedinTab.id);
          if (!tabInfo || tabInfo.discarded) {
            throw new Error('LinkedIn tab was discarded or closed');
          }

          // Try to bring tab to focus (but don't fail if it doesn't work)
          try {
            await chrome.tabs.update(linkedinTab.id, { active: true });
            await chrome.windows.update(linkedinTab.windowId, { focused: true });
          } catch (focusError) {
            console.warn('Could not focus tab, continuing anyway:', focusError);
            // Don't fail the download just because we can't focus the tab
          }
          
          const result = await downloadTranscriptWithRetry(linkedinTab.id, video, 3);
          
          if (result && result.success) {
            sectionTranscripts.push({
              title: video.title,
              transcript: result.transcript
            });
            downloadState.progress.successCount++;
            console.log(`✓ Successfully downloaded: "${video.title}"`);
          } else {
            downloadState.progress.failCount++;
            downloadState.progress.failedVideos.push({
              title: video.title,
              section: sectionTitle,
              error: result?.error || 'Unknown error'
            });
            console.error(`✗ Failed to get transcript for "${video.title}":`, result?.error || 'Unknown error');
          }
        } catch (error) {
          downloadState.progress.failCount++;
          downloadState.progress.failedVideos.push({
            title: video.title,
            section: sectionTitle,
            error: error.message || 'Unknown error'
          });
          console.error(`✗ Error processing "${video.title}":`, error);
        }
        
        // Longer delay between requests to prevent overwhelming LinkedIn
        await sleep(6000); // Increased delay
        
        // Save state periodically
        await saveState();
      }
      
      // Download the section file if we got any transcripts
      if (sectionTranscripts.length > 0) {
        await downloadSectionFile(sectionTitle, sectionTranscripts, courseTitle, downloadState.progress.sectionsProcessed + 1);
      }
      
      downloadState.progress.sectionsProcessed++;
      await saveState();
      
      // Additional cleanup between sections
      await sleep(3000);
      clearSectionFromMemory(sectionTitle, videosBySection);
    }
    
  } catch (error) {
    console.error('Download error:', error);
    // Add the error to failed videos if it's a critical failure
    downloadState.progress.failedVideos.push({
      title: 'Critical Error',
      section: 'System',
      error: error.message || 'Critical download failure'
    });
  } finally {
    // Reset download state but keep failed videos list for popup display
    downloadState.isDownloading = false;
    downloadState.currentVideo = null;
    
    // Save final state
    await saveState();
    
    // Clear any remaining video data from memory
    videosBySection = null;
    
    // Auto-clear state after 5 minutes of completion
    setTimeout(async () => {
      if (!downloadState.isDownloading) {
        downloadState.progress.failedVideos = [];
        await saveState();
      }
    }, 300000); // 5 minutes
  }
}

async function findLinkedInTab() {
  try {
    const tabs = await chrome.tabs.query({
      url: "*://www.linkedin.com/learning/*"
    });
    
    if (tabs.length === 0) {
      return null;
    }
    
    // Prefer active tab if available
    const activeTab = tabs.find(tab => tab.active);
    return activeTab || tabs[0];
  } catch (error) {
    console.error('Error finding LinkedIn tab:', error);
    return null;
  }
}

async function ensureContentScriptLoaded(tabId) {
  try {
    // Test if content script is responsive
    await chrome.tabs.sendMessage(tabId, { action: 'ping' }, { timeout: 5000 });
  } catch (error) {
    console.log('Content script not responsive, attempting to inject...');
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      // Wait a bit for the script to initialize
      await sleep(2000);
    } catch (injectError) {
      console.error('Failed to inject content script:', injectError);
      throw new Error('Could not ensure content script is loaded');
    }
  }
}

async function downloadTranscriptWithRetry(tabId, video, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} for "${video.title}"`);
      
      // Check if tab is still valid
      const tabInfo = await chrome.tabs.get(tabId);
      if (!tabInfo || tabInfo.discarded) {
        throw new Error('Tab is no longer available');
      }
      
      const result = await chrome.tabs.sendMessage(tabId, {
        action: 'downloadTranscript',
        video: video
      });
      
      if (result && result.success) {
        return result;
      } else {
        console.warn(`Attempt ${attempt} failed for "${video.title}":`, result?.error);
        if (attempt < maxRetries) {
          await sleep(5000 * attempt); // Increasing delay between retries
        }
      }
    } catch (error) {
      console.error(`Attempt ${attempt} error for "${video.title}":`, error);
      if (attempt < maxRetries) {
        // Check if it's a tab-related error
        if (error.message.includes('tab') || error.message.includes('Receiving end does not exist')) {
          try {
            await ensureContentScriptLoaded(tabId);
          } catch (reloadError) {
            console.error('Failed to reload content script:', reloadError);
          }
        }
        await sleep(5000 * attempt);
      }
    }
  }
  
  return {
    success: false,
    error: `Failed after ${maxRetries} attempts`
  };
}

function clearSectionFromMemory(sectionTitle, videosBySection) {
  if (videosBySection[sectionTitle]) {
    videosBySection[sectionTitle].forEach(video => {
      video.element = null;
      video.transcript = null;
    });
    delete videosBySection[sectionTitle];
    console.log(`Cleared section "${sectionTitle}" from memory`);
  }
}

function groupVideosBySection(videos) {
  const grouped = {};
  videos.forEach(video => {
    const sectionTitle = video.sectionTitle;
    if (!grouped[sectionTitle]) {
      grouped[sectionTitle] = [];
    }
    grouped[sectionTitle].push({
      title: video.title,
      url: video.url,
      sectionTitle: video.sectionTitle
    });
  });
  return grouped;
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .substring(0, 200);
}

function formatSectionFileName(sectionTitle, courseTitle, sectionNumber) {
  const sanitizedCourse = sanitizeFilename(courseTitle);
  const sanitizedSection = sanitizeFilename(sectionTitle);
  
  const filename = `${sanitizedCourse}/${sectionNumber.toString().padStart(2, '0')}-${sanitizedSection}.md`;
  
  return filename;
}

async function downloadSectionFile(sectionTitle, transcripts, courseTitle, sectionNumber) {
  const markdown = `# ${sectionTitle}\n\n` + 
    transcripts.map(t => `## ${t.title}\n\n${t.transcript}`).join('\n\n---\n\n');
  
  const base64Data = btoa(unescape(encodeURIComponent(markdown)));
  const dataUrl = `data:text/markdown;charset=utf-8;base64,${base64Data}`;
  
  const filename = formatSectionFileName(sectionTitle, courseTitle, sectionNumber);
  
  try {
    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false,
      conflictAction: 'uniquify'
    });
    
    console.log(`✓ Downloaded: ${filename}`);
  } catch (error) {
    console.error('Download failed:', error);
  }
  
  // Clear transcripts from memory after download
  transcripts.forEach(transcript => {
    transcript.transcript = null;
  });
  transcripts.length = 0;
}

async function cancelDownload() {
  downloadState.isDownloading = false;
  downloadState.progress.failedVideos = [];
  await saveState();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Keep the service worker alive during downloads
chrome.runtime.onSuspend.addListener(() => {
  console.log('Service worker is being suspended');
  if (downloadState.isDownloading) {
    console.log('Download in progress, attempting to keep alive...');
    // Save state before potential suspension
    saveState();
  }
});

// Restore state when service worker wakes up
loadState();