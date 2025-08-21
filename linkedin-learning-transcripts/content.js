// Content script for LinkedIn Learning Transcript Downloader

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVideoList') {
    getVideoList().then(sendResponse);
    return true;
  } else if (request.action === 'downloadTranscript') {
    downloadTranscript(request.video).then(sendResponse);
    return true;
  }
});

async function getVideoList() {
  try {
    // Look for sections and their videos
    const sections = document.querySelectorAll('section.classroom-toc-section');
    
    if (sections.length === 0) {
      return {
        success: false,
        error: 'No course sections found. Make sure you are on a LinkedIn Learning course page with the sidebar visible.'
      };
    }

    const courseStructure = [];

    sections.forEach(section => {
      // Get section title
      const titleElement = section.querySelector('.classroom-toc-section__toggle-title');
      const sectionTitle = titleElement ? titleElement.textContent.trim() : 'Unknown Section';
      
      // Get videos in this section
      const videoLinks = section.querySelectorAll('a.classroom-toc-item__link');
      const videos = Array.from(videoLinks).map(link => {
        const titleEl = link.querySelector('.classroom-toc-item__title');
        let title = titleEl ? titleEl.textContent.trim() : 'Unknown Title';
        
        // Clean up the title by removing status indicators like "(Viewed)", "(In progress)", etc.
        title = title.replace(/\s*\([^)]*\)\s*$/, '').trim();
        
        const href = link.getAttribute('href');
        
        return {
          title: title,
          url: href,
          element: link,
          sectionTitle: sectionTitle
        };
      });

      if (videos.length > 0) {
        courseStructure.push({
          sectionTitle: sectionTitle,
          videos: videos
        });
      }
    });

    // Flatten for backward compatibility while keeping section info
    const allVideos = courseStructure.flatMap(section => section.videos);

    return {
      success: true,
      videos: allVideos,
      sections: courseStructure
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function downloadTranscript(video) {
  try {
    // Navigate to the video by clicking its link
    const videoLinks = document.querySelectorAll('a.classroom-toc-item__link');
    let targetLink = null;
    
    for (const link of videoLinks) {
      const titleEl = link.querySelector('.classroom-toc-item__title');
      if (titleEl) {
        // Clean the title from the DOM the same way we did when creating the list
        let linkTitle = titleEl.textContent.trim().replace(/\s*\([^)]*\)\s*$/, '').trim();
        if (linkTitle === video.title) {
          targetLink = link;
          break;
        }
      }
    }
    
    if (!targetLink) {
      return {
        success: false,
        error: `Could not find link for video: ${video.title}`
      };
    }
    
    // Click the video link
    targetLink.click();
    
    // Wait longer for the video to load and add more robust checking
    await waitForVideoToLoad(video.title);
    
    // Add a longer delay to let LinkedIn settle
    await sleep(3000);
    
    // Try multiple approaches to find and click the transcript button
    let transcriptBtn = null;
    const transcriptSelectors = [
      'button[data-live-test-classroom-layout-tab="TRANSCRIPT"]',
      'button[role="tab"][aria-selected="false"]:contains("Transcript")',
      'button:contains("Transcript")',
      '.classroom-layout__workspace-tab:contains("Transcript")'
    ];
    
    for (const selector of transcriptSelectors) {
      transcriptBtn = await waitForElement(selector, 5000);
      if (transcriptBtn) break;
      
      // Also try looking for buttons with Transcript text
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.includes('Transcript')) {
          transcriptBtn = btn;
          break;
        }
      }
      if (transcriptBtn) break;
    }
    
    if (!transcriptBtn) {
      return {
        success: false,
        error: `Transcript button not found for video: ${video.title}`
      };
    }
    
    // Wait a bit before clicking transcript button
    await sleep(1000);
    transcriptBtn.click();
    
    // Wait longer for transcript content to load
    const transcriptContent = await waitForTranscriptContent(20000);
    if (!transcriptContent) {
      return {
        success: false,
        error: `Transcript content not loaded for video: ${video.title}`
      };
    }
    
    return {
      success: true,
      transcript: transcriptContent
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function waitForVideoToLoad(expectedTitle, timeout = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const titleEl = document.querySelector('.classroom-nav__subtitle');
    if (titleEl && titleEl.textContent.trim() === expectedTitle) {
      return true;
    }
    await sleep(100);
  }
  
  throw new Error(`Video "${expectedTitle}" did not load within ${timeout}ms`);
}

async function waitForElement(selector, timeout = 5000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
    await sleep(100);
  }
  
  return null;
}

async function waitForTranscriptContent(timeout = 15000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    // Try multiple selectors for transcript content
    let transcriptEl = document.querySelector('.classroom-transcript__content .classroom-transcript__lines');
    
    // Fallback selectors if the main one doesn't work
    if (!transcriptEl) {
      transcriptEl = document.querySelector('.classroom-transcript__lines');
    }
    if (!transcriptEl) {
      transcriptEl = document.querySelector('.classroom-transcript__content');
    }
    if (!transcriptEl) {
      transcriptEl = document.querySelector('[class*="transcript"] p');
    }
    
    if (transcriptEl) {
      // Extract text content, cleaning up extra whitespace
      const textContent = transcriptEl.textContent.trim();
      if (textContent.length > 0) {
        return textContent.replace(/\s+/g, ' ');
      }
    }
    
    await sleep(200);
  }
  
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to check if we're on a LinkedIn Learning course page
function isLinkedInLearningCoursePage() {
  return window.location.hostname === 'www.linkedin.com' && 
         window.location.pathname.includes('/learning/') &&
         document.querySelector('.classroom-toc-item__link');
}

// Log when content script loads
console.log('LinkedIn Learning Transcript Downloader content script loaded');

// Optional: Add some visual feedback when the extension is active
if (isLinkedInLearningCoursePage()) {
  // You could add a small indicator that the extension is active
  console.log('LinkedIn Learning course page detected');
}