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
    failCount: 0
  }
};

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

  // Group videos by section
  const videosBySection = groupVideosBySection(selectedVideos);
  downloadState.progress.totalSections = Object.keys(videosBySection).length;
  downloadState.progress.sectionsProcessed = 0;

  console.log('Grouped into', downloadState.progress.totalSections, 'sections:', Object.keys(videosBySection));

  try {
    // Get the active LinkedIn tab
    const tabs = await chrome.tabs.query({
      url: "*://www.linkedin.com/learning/*"
    });
    
    if (tabs.length === 0) {
      throw new Error('No LinkedIn Learning tab found');
    }
    
    const linkedinTab = tabs[0];
    
    // Focus the LinkedIn tab
    await chrome.tabs.update(linkedinTab.id, { active: true });
    await chrome.windows.update(linkedinTab.windowId, { focused: true });

    // Process each section
    for (const [sectionTitle, sectionVideos] of Object.entries(videosBySection)) {
      if (!downloadState.isDownloading) break; // Check for cancellation
      
      downloadState.progress.currentSection = sectionTitle;
      const sectionTranscripts = [];

      for (let i = 0; i < sectionVideos.length; i++) {
        if (!downloadState.isDownloading) break; // Check for cancellation
        
        const video = sectionVideos[i];
        downloadState.progress.currentVideoTitle = video.title;
        downloadState.progress.current++;

        try {
          // Re-focus the tab before each request
          await chrome.tabs.update(linkedinTab.id, { active: true });
          
          const result = await chrome.tabs.sendMessage(linkedinTab.id, {
            action: 'downloadTranscript',
            video: video
          });
          
          if (result && result.success) {
            sectionTranscripts.push({
              title: video.title,
              transcript: result.transcript
            });
            downloadState.progress.successCount++;
          } else {
            downloadState.progress.failCount++;
            console.error(`Failed to get transcript for "${video.title}":`, result?.error || 'Unknown error');
          }
        } catch (error) {
          downloadState.progress.failCount++;
          console.error(`Error processing "${video.title}":`, error);
        }
        
        // Small delay between requests
        await sleep(2000);
      }
      
      // Download the section file if we got any transcripts
      if (sectionTranscripts.length > 0) {
        await downloadSectionFile(sectionTitle, sectionTranscripts, courseTitle, downloadState.progress.sectionsProcessed + 1);
      }
      
      downloadState.progress.sectionsProcessed++;
    }
    
  } catch (error) {
    console.error('Download error:', error);
  } finally {
    // Reset download state
    downloadState.isDownloading = false;
    downloadState.currentVideo = null;
  }
}

function groupVideosBySection(videos) {
  const grouped = {};
  videos.forEach(video => {
    const sectionTitle = video.sectionTitle;
    if (!grouped[sectionTitle]) {
      grouped[sectionTitle] = [];
    }
    grouped[sectionTitle].push(video);
  });
  return grouped;
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/\.+/g, '.') // Replace multiple dots with single dot
    .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
    .substring(0, 200); // Limit length
}

function formatSectionFileName(sectionTitle, courseTitle, sectionNumber) {
  const sanitizedCourse = sanitizeFilename(courseTitle);
  const sanitizedSection = sanitizeFilename(sectionTitle);
  
  // Create organized filename: Course/Section-Number-Section-Name.md
  const filename = `${sanitizedCourse}/${sectionNumber.toString().padStart(2, '0')}-${sanitizedSection}.md`;
  
  return filename;
}

async function downloadSectionFile(sectionTitle, transcripts, courseTitle, sectionNumber) {
  const markdown = `# ${sectionTitle}\n\n` + 
    transcripts.map(t => `## ${t.title}\n\n${t.transcript}`).join('\n\n---\n\n');
  
  // Convert markdown to base64 data URL for service worker
  const base64Data = btoa(unescape(encodeURIComponent(markdown)));
  const dataUrl = `data:text/markdown;charset=utf-8;base64,${base64Data}`;
  
  const filename = formatSectionFileName(sectionTitle, courseTitle, sectionNumber);
  
  try {
    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false, // Don't prompt for location
      conflictAction: 'uniquify' // Automatically handle filename conflicts
    });
    
    console.log(`Downloaded: ${filename}`);
  } catch (error) {
    console.error('Download failed:', error);
  }
}

function cancelDownload() {
  downloadState.isDownloading = false;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}