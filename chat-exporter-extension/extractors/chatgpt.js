function extractChatGPTConversation() {
  let markdown = "# ChatGPT Conversation\n\n";
  let messageCount = 0;

  // Find all message containers
  const messageContainers = document.querySelectorAll('[data-message-author-role]');
  
  messageContainers.forEach((container, index) => {
    const role = container.getAttribute('data-message-author-role');
    
    if (role === 'user') {
      // User message
      messageCount++;
      markdown += `## User Message ${messageCount}\n\n`;
      
      // Extract user message content
      const userContent = container.querySelector('.whitespace-pre-wrap');
      if (userContent) {
        markdown += `${userContent.textContent.trim()}\n\n`;
      } else {
        // Fallback: get all text content
        markdown += `${container.textContent.trim()}\n\n`;
      }
      
    } else if (role === 'assistant') {
      // Assistant message
      markdown += `### ChatGPT Response\n\n`;
      
      // Extract the main content
      const messageContent = container.querySelector('.markdown.prose');
      
      if (messageContent) {
        // First, extract code blocks with proper language detection
        const codeBlocks = messageContent.querySelectorAll('.bg-token-sidebar-surface-primary');
        
        if (codeBlocks.length > 0) {
          codeBlocks.forEach(codeBlock => {
            // Get the code content
            const codeElement = codeBlock.querySelector('pre');
            if (codeElement) {
              const codeText = codeElement.textContent.trim();
              if (codeText) {
                // Get language from the banner
                const languageBanner = codeBlock.querySelector('.flex.items-center.text-token-text-secondary');
                let language = 'text';
                
                if (languageBanner) {
                  const bannerText = languageBanner.textContent.trim();
                  // Extract language from banner text
                  if (bannerText.includes('Copy code')) {
                    language = bannerText.replace('Copy code', '').trim();
                  } else {
                    language = bannerText;
                  }
                  
                  // Clean up common language names
                  if (language === 'bashCopy code' || language === 'bash') {
                    language = 'bash';
                  } else if (language === 'nginxCopy code' || language === 'nginx') {
                    language = 'nginx';
                  } else if (language === 'pgsqlCopy code' || language === 'pgsql') {
                    language = 'pgsql';
                  } else if (language === 'mathematicaCopy code' || language === 'mathematica') {
                    language = 'mathematica';
                  } else if (language === 'textCopy code') {
                    language = 'text';
                  } else if (language === 'scss') {
                    language = 'scss';
                  }
                  
                  // If language is empty after cleaning, default to text
                  if (!language) language = 'text';
                }
                
                markdown += `\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
              }
            }
          });
        }
        
        // Now extract regular text content (excluding code blocks we already processed)
        // Create a clone to work with
        const textContent = messageContent.cloneNode(true);
        
        // Remove code blocks from the clone
        textContent.querySelectorAll('.bg-token-sidebar-surface-primary').forEach(el => el.remove());
        
        // Extract all content elements in order
        const contentElements = textContent.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, li, blockquote, hr');
        
        contentElements.forEach(element => {
          const tagName = element.tagName.toLowerCase();
          const text = element.textContent.trim();
          
          if (!text) return;
          
          if (tagName.startsWith('h')) {
            // Handle headings
            const level = parseInt(tagName.substring(1));
            markdown += `${'#'.repeat(level)} ${text}\n\n`;
          } else if (tagName === 'p') {
            // Handle paragraphs
            markdown += `${text}\n\n`;
          } else if (tagName === 'ul' || tagName === 'ol') {
            // Handle lists
            const items = element.querySelectorAll('li');
            items.forEach(item => {
              const itemText = item.textContent.trim();
              if (itemText) {
                markdown += `- ${itemText}\n`;
              }
            });
            markdown += '\n';
          } else if (tagName === 'li') {
            // Handle list items that aren't inside a ul/ol (shouldn't happen, but just in case)
            if (!element.closest('ul') && !element.closest('ol')) {
              markdown += `- ${text}\n`;
            }
          } else if (tagName === 'blockquote') {
            // Handle blockquotes
            markdown += `> ${text}\n\n`;
          } else if (tagName === 'hr') {
            // Handle horizontal rules
            markdown += '---\n\n';
          }
        });
        
        // If no structured content was found, fall back to all text
        if (contentElements.length === 0) {
          const allText = textContent.textContent.trim();
          if (allText) {
            markdown += `${allText}\n\n`;
          }
        }
      } else {
        // Fallback: extract all text from the container
        const allText = container.textContent.trim();
        if (allText) {
          markdown += `${allText}\n\n`;
        }
      }
      
      // Check if there's a deep research block that follows this response
      const turnContainer = container.closest('[data-turn-id]');
      if (turnContainer) {
        // Look for deep research blocks that are siblings after this container
        const nextSiblings = getNextSiblings(turnContainer);
        
        for (const sibling of nextSiblings) {
          const deepResearchBlock = sibling.querySelector('.border-token-border-sharp, [class*="deep-research"]');
          if (deepResearchBlock) {
            markdown += `#### 🔍 Deep Research Response\n\n`;
            processDeepResearchContent(deepResearchBlock, markdown);
            break; // Only process the first deep research block after this response
          }
        }
      }
      
      markdown += '---\n\n';
    }
  });

  // Alternative approach: look for message pairs if the first method didn't work
  if (messageCount === 0) {
    // Try finding user messages by their specific container classes
    const userMessages = document.querySelectorAll('[class*="user-message"]');
    const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
    
    userMessages.forEach((userMessage, index) => {
      messageCount++;
      markdown += `## User Message ${messageCount}\n\n`;
      markdown += `${userMessage.textContent.trim()}\n\n`;
      
      // Try to find corresponding assistant message
      if (assistantMessages[index]) {
        markdown += `### ChatGPT Response\n\n`;
        
        // Extract code blocks from assistant content with proper language
        const codeBlocks = assistantMessages[index].querySelectorAll('.bg-token-sidebar-surface-primary');
        if (codeBlocks.length > 0) {
          codeBlocks.forEach(codeBlock => {
            const codeElement = codeBlock.querySelector('pre');
            if (codeElement) {
              const codeText = codeElement.textContent.trim();
              if (codeText) {
                // Get language from the banner
                const languageBanner = codeBlock.querySelector('.flex.items-center.text-token-text-secondary');
                let language = 'text';
                
                if (languageBanner) {
                  const bannerText = languageBanner.textContent.trim();
                  if (bannerText.includes('Copy code')) {
                    language = bannerText.replace('Copy code', '').trim();
                  } else {
                    language = bannerText;
                  }
                  
                  // Clean up language names
                  if (language === 'bashCopy code') language = 'bash';
                  else if (language === 'nginxCopy code') language = 'nginx';
                  else if (language === 'pgsqlCopy code') language = 'pgsql';
                  else if (language === 'mathematicaCopy code') language = 'mathematica';
                  else if (language === 'textCopy code') language = 'text';
                  else if (language === 'scss') language = 'scss';
                  
                  if (!language) language = 'text';
                }
                
                markdown += `\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
              }
            }
          });
        }
        
        // Extract regular text (excluding code blocks)
        const textContent = assistantMessages[index].cloneNode(true);
        // Remove code blocks from the clone to get only text
        textContent.querySelectorAll('.bg-token-sidebar-surface-primary').forEach(el => el.remove());
        const text = textContent.textContent.trim();
        if (text) {
          markdown += `${text}\n\n`;
        }
        
        markdown += '---\n\n';
      }
    });
  }

  if (messageCount === 0) {
    return "No ChatGPT conversation found. Please make sure you're on a ChatGPT chat page with an active conversation.";
  }

  markdown += `\n\n---\n*Exported on ${new Date().toLocaleString()}*`;
  return markdown;
}

// Helper function to get all next siblings of an element
function getNextSiblings(element) {
  const siblings = [];
  let nextSibling = element.nextElementSibling;
  
  while (nextSibling) {
    siblings.push(nextSibling);
    nextSibling = nextSibling.nextElementSibling;
  }
  
  return siblings;
}

// Helper function to process deep research content with citations
function processDeepResearchContent(deepResearchBlock, markdown) {
  // Extract research metadata
  const researchInfo = deepResearchBlock.querySelector('button.text-token-text-tertiary');
  if (researchInfo) {
    const researchText = researchInfo.textContent.trim();
    markdown += `*${researchText}*\n\n`;
  }
  
  // Extract the main content
  const messageContent = deepResearchBlock.querySelector('.markdown.prose, .deep-research-result');
  
  if (messageContent) {
    // Create a clone to work with
    const content = messageContent.cloneNode(true);
    
    // Process citations - extract them first
    const citations = content.querySelectorAll('[data-testid="webpage-citation-pill"]');
    const citationMap = new Map();
    
    citations.forEach((citation, index) => {
      const link = citation.querySelector('a');
      if (link) {
        const href = link.getAttribute('href') || '';
        const domainMatch = href.match(/https?:\/\/([^\/]+)/);
        const domain = domainMatch ? domainMatch[1] : 'Unknown source';
        citationMap.set(citation, `[${index + 1}]`);
        
        // Remove the citation from the content for clean text extraction
        citation.remove();
      }
    });
    
    // Now extract the text content with citation markers
    const contentElements = content.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, li, blockquote');
    
    contentElements.forEach(element => {
      const tagName = element.tagName.toLowerCase();
      let text = element.textContent.trim();
      
      if (!text) return;
      
      // Add citation markers back to the text
      citations.forEach((citation, index) => {
        if (element.contains(citation)) {
          const citationMarker = citationMap.get(citation);
          if (citationMarker) {
            // Simple approach: add citation at the end of the paragraph
            text += ` ${citationMarker}`;
          }
        }
      });
      
      if (tagName.startsWith('h')) {
        const level = parseInt(tagName.substring(1));
        markdown += `${'#'.repeat(level)} ${text}\n\n`;
      } else if (tagName === 'p') {
        markdown += `${text}\n\n`;
      } else if (tagName === 'ul' || tagName === 'ol') {
        const items = element.querySelectorAll('li');
        items.forEach(item => {
          const itemText = item.textContent.trim();
          if (itemText) {
            markdown += `- ${itemText}\n`;
          }
        });
        markdown += '\n';
      } else if (tagName === 'li') {
        if (!element.closest('ul') && !element.closest('ol')) {
          markdown += `- ${text}\n`;
        }
      } else if (tagName === 'blockquote') {
        markdown += `> ${text}\n\n`;
      }
    });
    
    // Add citation references at the end
    if (citationMap.size > 0) {
      markdown += `#### 📚 References\n\n`;
      citations.forEach((citation, index) => {
        const link = citation.querySelector('a');
        if (link) {
          const href = link.getAttribute('href') || '';
          const domainMatch = href.match(/https?:\/\/([^\/]+)/);
          const domain = domainMatch ? domainMatch[1] : 'Unknown source';
          markdown += `${index + 1}. ${domain} - ${href}\n`;
        }
      });
      markdown += '\n';
    }
  }
  
  // Extract sources section if available
  const sourcesSection = deepResearchBlock.querySelector('.flex.items-center.gap-2.py-2');
  if (sourcesSection) {
    const sourcesButton = sourcesSection.querySelector('button');
    if (sourcesButton && sourcesButton.textContent.includes('Sources')) {
      markdown += `#### 📚 Sources\n\n`;
      
      // Extract source domains from favicons
      const sourceDomains = sourcesSection.querySelectorAll('img[src*="favicons"]');
      const domains = Array.from(sourceDomains).map(img => {
        const src = img.getAttribute('src') || '';
        const match = src.match(/domain=([^&]+)/);
        return match ? decodeURIComponent(match[1]) : 'Unknown source';
      });
      
      if (domains.length > 0) {
        domains.forEach(domain => {
          markdown += `- ${domain}\n`;
        });
        markdown += '\n';
      }
    }
  }
}

// Execute the extractor
extractChatGPTConversation();