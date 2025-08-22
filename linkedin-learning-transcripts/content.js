// Content script for LinkedIn Learning Transcript Downloader

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ success: true, status: 'alive' });
    return true;
  } else if (request.action === 'getVideoList') {
    getVideoList().then(sendResponse);
    return true;
  } else if (request.action === 'downloadTranscript') {
    downloadTranscript(request.video).then(sendResponse);
    return true;
  } else if (request.action === 'getCourseTitle') {
    getCourseTitle().then(sendResponse);
    return true;
  }
});

async function getCourseTitle() {
  try {
    // Try multiple selectors for course title
    let titleElement = document.querySelector('.classroom-nav__title');
    
    if (!titleElement) {
      titleElement = document.querySelector('.course-header__title');
    }
    
    if (!titleElement) {
      titleElement = document.querySelector('h1[data-live-test="course-title"]');
    }
    
    if (!titleElement) {
      titleElement = document.querySelector('.top-card-layout__title h1');
    }
    
    let courseTitle = 'LinkedIn-Learning-Course';
    
    if (titleElement) {
      courseTitle = titleElement.textContent.trim();
      courseTitle = courseTitle.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '-');
    }
    
    return { success: true, courseTitle: courseTitle };
  } catch (error) {
    return { success: false, courseTitle: 'LinkedIn-Learning-Course' };
  }
}

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
        
        // Clean up the title by removing status indicators
        title = title.replace(/\s*\([^)]*\)\s*$/, '').trim();
        
        const href = link.getAttribute('href');
        
        return {
          title: title,
          url: href,
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
  let retries = 0;
  const maxRetries = 3;
  
  while (retries <= maxRetries) {
    try {
      console.log(`Attempting to download transcript for "${video.title}" (attempt ${retries + 1}/${maxRetries + 1})`);
      
      // Check if we're already on the correct video
      const currentVideoTitle = await getCurrentVideoTitle();
      if (currentVideoTitle !== video.title) {
        // Navigate to the video
        await navigateToVideo(video);
        // Wait for navigation to complete
        await waitForVideoToLoad(video.title, 25000);
      }
      
      // Add delay to let the page settle
      await sleep(3000);
      
      // Try to find and click the transcript button
      let transcriptBtn = await findTranscriptButton();
      
      if (!transcriptBtn) {
        throw new Error(`Transcript button not found for video: ${video.title}`);
      }
      
      // Ensure the button is visible and clickable
      await ensureElementVisible(transcriptBtn);
      await sleep(1000);
      
      // Click the transcript button with better error handling
      await clickElementSafely(transcriptBtn);
      
      // Wait for transcript content to load
      const transcriptContent = await waitForTranscriptContent(30000);
      if (!transcriptContent) {
        throw new Error(`Transcript content not loaded for video: ${video.title}`);
      }
      
      console.log(`✓ Successfully downloaded transcript for "${video.title}"`);
      return {
        success: true,
        transcript: transcriptContent
      };
      
    } catch (error) {
      console.warn(`Attempt ${retries + 1} failed for "${video.title}":`, error.message);
      retries++;
      
      if (retries <= maxRetries) {
        console.log(`Retrying "${video.title}" in ${3 * retries} seconds...`);
        await sleep(3000 * retries); // Increasing delay
        
        // On final retry, try to refresh the page
        if (retries === maxRetries) {
          console.log('Final retry, attempting page refresh...');
          try {
            location.reload();
            await sleep(8000); // Wait longer for page to reload
          } catch (refreshError) {
            console.error('Page refresh failed:', refreshError);
          }
        }
      }
    }
  }
  
  return {
    success: false,
    error: `Failed after ${maxRetries + 1} attempts. Video may be inaccessible or transcript unavailable.`
  };
}

async function getCurrentVideoTitle() {
  try {
    let titleEl = document.querySelector('.classroom-nav__subtitle');
    if (!titleEl) {
      titleEl = document.querySelector('.classroom-layout__video-title');
    }
    if (!titleEl) {
      titleEl = document.querySelector('[data-test-id="video-title"]');
    }
    if (!titleEl) {
      titleEl = document.querySelector('h1.video-title');
    }
    
    return titleEl ? titleEl.textContent.trim() : null;
  } catch (error) {
    return null;
  }
}

async function navigateToVideo(video) {
  // Find the video link more reliably
  const videoLinks = document.querySelectorAll('a.classroom-toc-item__link');
  let targetLink = null;
  
  for (const link of videoLinks) {
    const titleEl = link.querySelector('.classroom-toc-item__title');
    if (titleEl) {
      let linkTitle = titleEl.textContent.trim().replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (linkTitle === video.title) {
        targetLink = link;
        break;
      }
    }
  }
  
  if (!targetLink) {
    throw new Error(`Could not find link for video: ${video.title}`);
  }
  
  // Make sure the link is visible and clickable
  await ensureElementVisible(targetLink);
  await sleep(500);
  
  // Click the video link
  await clickElementSafely(targetLink);
}

async function ensureElementVisible(element) {
  try {
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'center'
    });
    
    // Wait for scroll to complete
    await sleep(1000);
    
    // Check if element is actually visible
    const rect = element.getBoundingClientRect();
    const isVisible = rect.top >= 0 && rect.left >= 0 && 
                     rect.bottom <= window.innerHeight && 
                     rect.right <= window.innerWidth;
    
    if (!isVisible) {
      console.warn('Element may not be fully visible after scroll');
    }
  } catch (error) {
    console.error('Error ensuring element visibility:', error);
  }
}

async function clickElementSafely(element) {
  try {
    // Try multiple click methods
    if (element.click) {
      element.click();
    } else {
      // Fallback to dispatching click event
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(clickEvent);
    }
  } catch (error) {
    console.error('Error clicking element:', error);
    throw error;
  }
}

async function findTranscriptButton() {
  // Try multiple approaches to find the transcript button
  const transcriptSelectors = [
    'button[data-live-test-classroom-layout-tab="TRANSCRIPT"]',
    'button[role="tab"][aria-controls*="transcript"]',
    'button[aria-label*="Transcript" i]',
    '.classroom-layout__workspace-tab[data-tab="transcript"]',
    '[data-tab-name="transcript"]'
  ];
  
  // First try direct selectors
  for (const selector of transcriptSelectors) {
    const btn = await waitForElement(selector, 2000);
    if (btn && isElementClickable(btn)) {
      console.log(`Found transcript button with selector: ${selector}`);
      return btn;
    }
  }
  
  // Then try looking for buttons with Transcript text
  const buttons = document.querySelectorAll('button, [role="tab"], a');
  for (const btn of buttons) {
    const text = btn.textContent || btn.getAttribute('aria-label') || '';
    if (text.toLowerCase().includes('transcript') && isElementClickable(btn)) {
      console.log('Found transcript button by text content');
      return btn;
    }
  }
  
  console.log('No transcript button found');
  return null;
}

function isElementClickable(element) {
  try {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           rect.width > 0 && 
           rect.height > 0 &&
           !element.disabled;
  } catch (error) {
    return false;
  }
}

async function waitForVideoToLoad(expectedTitle, timeout = 25000) {
  const startTime = Date.now();
  console.log(`Waiting for video "${expectedTitle}" to load...`);
  
  while (Date.now() - startTime < timeout) {
    const currentTitle = await getCurrentVideoTitle();
    
    if (currentTitle === expectedTitle) {
      console.log(`✓ Video "${expectedTitle}" loaded successfully`);
      return true;
    }
    
    // Also check if video player is present
    const videoPlayer = document.querySelector('video, .video-player');
    if (videoPlayer && currentTitle) {
      console.log(`Video player detected, current title: "${currentTitle}"`);
    }
    
    await sleep(300);
  }
  
  throw new Error(`Video "${expectedTitle}" did not load within ${timeout}ms`);
}

async function waitForElement(selector, timeout = 5000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element && isElementClickable(element)) {
      return element;
    }
    await sleep(100);
  }
  
  return null;
}

async function waitForTranscriptContent(timeout = 30000) {
  const startTime = Date.now();
  console.log('Waiting for transcript content to load...');
  
  while (Date.now() - startTime < timeout) {
    // Improved selectors based on the HTML structure you provided
    let transcriptEl = null;
    
    // Try the most specific selector first (from your HTML)
    const selectors = [
      '.classroom-transcript__content .classroom-transcript__lines p',
      '.classroom-transcript__content .classroom-transcript__lines', 
      '.classroom-transcript__lines p',
      '.classroom-transcript__lines',
      '.classroom-transcript__content',
      '[class*="transcript"] p',
      '[class*="transcript-lines"] p',
      '[class*="transcript-content"] p',
      '[data-test-id="transcript-content"]',
      // Fallback selectors
      '.transcript-content p',
      '.transcript-text p',
      '[role="tabpanel"] p' // Sometimes transcript is in a tab panel
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const textContent = element.textContent.trim();
        console.log(`Testing selector "${selector}": "${textContent.substring(0, 100)}..."`);
        
        // More flexible content validation
        if (textContent.length > 20 && // Reduced minimum length
            !textContent.toLowerCase().includes('loading') &&
            !textContent.toLowerCase().includes('transcript not available') &&
            !textContent.toLowerCase().includes('no transcript available') &&
            // Check if it looks like actual transcript content
            (textContent.includes('[Instructor]') || 
             textContent.includes('- ') || 
             textContent.length > 100)) { // If long enough, probably valid
          
          console.log(`✓ Transcript content loaded with selector "${selector}": ${textContent.length} characters`);
          
          // Get the full content from the container, preserving some structure
          const containerEl = element.closest('.classroom-transcript__content') || 
                            element.closest('.classroom-transcript') || 
                            element;
          
          const fullContent = containerEl.textContent.trim();
          return fullContent.replace(/\s+/g, ' '); // Normalize whitespace
        }
      }
    }
    
    // Additional debug logging
    const debugElements = document.querySelectorAll('[class*="transcript"]');
    if (debugElements.length > 0) {
      console.log(`Found ${debugElements.length} elements with 'transcript' in class name:`);
      debugElements.forEach((el, i) => {
        const text = el.textContent.trim().substring(0, 100);
        console.log(`  ${i + 1}. ${el.className}: "${text}..."`);
      });
    }
    
    await sleep(500);
  }
  
  console.log('Transcript content failed to load within timeout');
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
  console.log('LinkedIn Learning course page detected');
}

// Keep content script alive by responding to ping messages
setInterval(() => {
  // Just a heartbeat to keep the content script active
  if (document.visibilityState === 'visible') {
    console.debug('Content script heartbeat');
  }
}, 30000); // Every 30 seconds