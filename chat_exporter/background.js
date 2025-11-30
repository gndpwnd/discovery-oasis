// Background script handles the extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Show working state
    chrome.action.setBadgeText({ text: '...', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#4285f4' });

    // Determine which platform we're on and execute appropriate extractor
    let extractorFunction;
    
    if (tab.url.includes('scholar.google.com')) {
      extractorFunction = extractGoogleScholarConversation;
    } else if (tab.url.includes('claude.ai')) {
      extractorFunction = extractClaudeConversation;
    } else {
      throw new Error('Unsupported platform. Currently supported: Google Scholar Labs and Claude.ai');
    }

    // Execute the content script to extract conversation
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractorFunction
    });

    if (results && results[0] && results[0].result) {
      const markdownContent = results[0].result;
      
      // Create filename with timestamp
      const filename = `chat-export-${new Date().toISOString().slice(0, 10)}.md`;
      
      // Convert content to data URL for download
      const dataUrl = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(markdownContent);
      
      // Download the file
      await chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: true
      });
      
      // Show success
      chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#00C853' });
      
    } else {
      throw new Error('No conversation content found');
    }
    
  } catch (error) {
    console.error('Export error:', error);
    
    // Show error
    chrome.action.setBadgeText({ text: '!', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
  } finally {
    // Clear badge after 2 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }, 2000);
  }
});

// Google Scholar Labs extractor
function extractGoogleScholarConversation() {
  let markdown = "# Google Scholar Labs Conversation\n\n";
  let conversationCount = 0;

  const conversationContainers = document.querySelectorAll('.gs_as_cp.gs_as_cp_sq_e');
  
  conversationContainers.forEach((container) => {
    const userMessage = container.querySelector('.gs_as_cp_tq[dir="auto"]');
    if (userMessage) {
      conversationCount++;
      markdown += `## Conversation ${conversationCount}\n\n`;
      markdown += `### User Question\n\n${userMessage.textContent}\n\n`;
      
      const responsePapers = container.querySelectorAll('.gs_r.gs_or.gs_scl');
      
      if (responsePapers.length > 0) {
        markdown += `### Research Papers (${responsePapers.length} found)\n\n`;
        
        responsePapers.forEach((paper, paperIndex) => {
          markdown += `#### Paper ${paperIndex + 1}\n\n`;
          
          const titleElement = paper.querySelector('.gs_rt a');
          if (titleElement) {
            markdown += `**Title:** [${titleElement.textContent}](${titleElement.href})\n\n`;
          }
          
          const authorsElement = paper.querySelector('.gs_a');
          if (authorsElement) {
            markdown += `**Authors/Publication:** ${authorsElement.textContent}\n\n`;
          }
          
          const summaryElement = paper.querySelector('.gs_rs > div');
          if (summaryElement) {
            markdown += `**Summary:** ${summaryElement.textContent}\n\n`;
          }
          
          const keyPoints = paper.querySelectorAll('.gs_asl li');
          if (keyPoints.length > 0) {
            markdown += `**Key Points:**\n`;
            keyPoints.forEach(point => {
              const boldElement = point.querySelector('b');
              let pointText = point.textContent;
              let boldText = '';
              
              if (boldElement) {
                boldText = boldElement.textContent;
                pointText = pointText.replace(boldText, '').trim();
              }
              
              markdown += `- **${boldText}** ${pointText}\n`;
            });
            markdown += '\n';
          }
          
          const citationLinks = paper.querySelectorAll('.gs_fl a');
          citationLinks.forEach(link => {
            if (link.textContent.includes('Cited by')) {
              markdown += `**${link.textContent}**\n\n`;
            }
          });
          
          markdown += '---\n\n';
        });
      } else {
        markdown += `*No research papers found for this question*\n\n`;
      }
    }
  });

  if (conversationCount === 0) {
    return "No Google Scholar conversations found.";
  }

  markdown += `\n\n---\n*Exported on ${new Date().toLocaleString()}*`;
  return markdown;
}

// Claude.ai extractor - IMPROVED VERSION
function extractClaudeConversation() {
  let markdown = "# Claude Conversation\n\n";
  let messageCount = 0;

  // Find all message containers - Claude uses specific structures for both user and assistant messages
  const messageContainers = document.querySelectorAll('[data-testid="user-message"], .group.relative.pb-3, .group.relative.pb-8');
  
  messageContainers.forEach((container, index) => {
    // Check if it's a user message
    if (container.hasAttribute('data-testid') && container.getAttribute('data-testid') === 'user-message') {
      messageCount++;
      
      // Add user message
      markdown += `## User Message ${messageCount}\n\n`;
      const userText = container.querySelector('p.whitespace-pre-wrap')?.textContent || 
                      container.textContent;
      markdown += `${userText}\n\n`;
      
    } else {
      // This is a Claude response - look for the actual response content
      const claudeResponse = container.querySelector('.font-claude-response, .standard-markdown, .progressive-markdown');
      
      if (claudeResponse) {
        markdown += `### Claude Response\n\n`;
        
        // Extract response title if present
        const titleElement = claudeResponse.querySelector('.font-claude-response-title, h1');
        if (titleElement) {
          markdown += `# ${titleElement.textContent}\n\n`;
        }
        
        // Extract all text content in a structured way
        const contentElements = claudeResponse.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, pre, code, blockquote');
        
        contentElements.forEach(element => {
          const tagName = element.tagName.toLowerCase();
          const text = element.textContent.trim();
          
          if (!text) return;
          
          if (tagName.startsWith('h')) {
            const level = parseInt(tagName.substring(1));
            markdown += `${'#'.repeat(level)} ${text}\n\n`;
          } else if (tagName === 'p') {
            // Don't include paragraphs that are inside code blocks
            if (!element.closest('pre') && !element.closest('code')) {
              markdown += `${text}\n\n`;
            }
          } else if (tagName === 'li') {
            markdown += `- ${text}\n`;
          } else if (tagName === 'pre' || tagName === 'code') {
            // Handle code blocks
            const codeText = element.textContent.trim();
            if (codeText) {
              // Check if it's mermaid or other specific code types
              const codeBlock = element.closest('.code-block__code');
              const language = codeBlock?.querySelector('.text-text-500')?.textContent || 'text';
              markdown += `\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
            }
          } else if (tagName === 'blockquote') {
            markdown += `> ${text}\n\n`;
          }
        });
        
        // If no structured content was found, fall back to all text
        if (contentElements.length === 0) {
          const allText = claudeResponse.textContent.trim();
          if (allText) {
            markdown += `${allText}\n\n`;
          }
        }
        
        markdown += '---\n\n';
      }
    }
  });

  // Alternative approach: look for conversation turns in the main chat container
  if (messageCount === 0) {
    const chatTurns = document.querySelectorAll('.flex.flex-col > div > div');
    
    chatTurns.forEach((turn, index) => {
      // User messages often have specific attributes or classes
      const userMessage = turn.querySelector('[data-testid="user-message"]');
      if (userMessage) {
        messageCount++;
        markdown += `## User Message ${messageCount}\n\n`;
        const userText = userMessage.querySelector('p.whitespace-pre-wrap')?.textContent || 
                        userMessage.textContent;
        markdown += `${userText}\n\n`;
      }
      
      // Claude responses
      const claudeResponse = turn.querySelector('.font-claude-response, [data-is-streaming]');
      if (claudeResponse && !claudeResponse.closest('[data-testid="user-message"]')) {
        markdown += `### Claude Response\n\n`;
        
        // Extract all readable text
        const paragraphs = claudeResponse.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
        if (paragraphs.length > 0) {
          paragraphs.forEach(p => {
            const text = p.textContent.trim();
            if (text) {
              if (p.tagName.toLowerCase().startsWith('h')) {
                const level = parseInt(p.tagName.substring(1));
                markdown += `${'#'.repeat(level)} ${text}\n\n`;
              } else {
                markdown += `${text}\n\n`;
              }
            }
          });
        } else {
          markdown += `${claudeResponse.textContent}\n\n`;
        }
        
        markdown += '---\n\n';
      }
    });
  }

  if (messageCount === 0) {
    return "No Claude conversation found. Please make sure you're on a Claude chat page with an active conversation.";
  }

  markdown += `\n\n---\n*Exported on ${new Date().toLocaleString()}*`;
  return markdown;
}