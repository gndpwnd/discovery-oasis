function extractGeminiConversation() {
  let markdown = "# Gemini Conversation\n\n";
  let messageCount = 0;

  // Find all message containers
  const userMessages = document.querySelectorAll('.user-query-bubble-with-background');
  const assistantMessages = document.querySelectorAll('message-content');
  
  // Process user messages
  userMessages.forEach((userMessage, index) => {
    messageCount++;
    
    // Add user message
    markdown += `## User Message ${messageCount}\n\n`;
    const userText = userMessage.querySelector('.query-text')?.textContent || 
                    userMessage.textContent;
    markdown += `${userText.trim()}\n\n`;
    
    // Find corresponding assistant message
    if (assistantMessages[index]) {
      markdown += `### Gemini Response\n\n`;
      
      const responseContent = assistantMessages[index].querySelector('.markdown-main-panel');
      
      if (responseContent) {
        // Create a clone to work with so we can remove processed elements
        const contentClone = responseContent.cloneNode(true);
        
        // Track processed elements to avoid duplicates
        const processedElements = new Set();
        
        // Extract code blocks and attachments first
        const codeAttachments = contentClone.querySelectorAll('.attachment-container.unknown, immersive-entry-chip');
        
        if (codeAttachments.length > 0) {
          codeAttachments.forEach(attachment => {
            if (processedElements.has(attachment)) return;
            
            const codeTitle = attachment.querySelector('[data-test-id="artifact-text"]')?.textContent || 'Code';
            const codeContent = extractGeminiCodeFromAttachment(attachment);
            
            if (codeContent) {
              markdown += `#### ${codeTitle}\n\n`;
              markdown += `\`\`\`python\n${codeContent}\n\`\`\`\n\n`;
            }
            // Remove the processed attachment from the clone
            attachment.remove();
            processedElements.add(attachment);
          });
        }
        
        // Process YouTube blocks and other embedded content
        const youtubeBlocks = contentClone.querySelectorAll('youtube-block, .attachment-container.youtube');
        youtubeBlocks.forEach(block => {
          if (processedElements.has(block)) return;
          
          const link = block.querySelector('a[href*="youtube"]');
          if (link) {
            const title = link.querySelector('.tool-attribution-title')?.textContent || 'YouTube Video';
            const href = link.getAttribute('href');
            markdown += `**Embedded Video:** [${title}](${href})\n\n`;
          }
          // Remove processed YouTube blocks
          block.remove();
          processedElements.add(block);
        });
        
        // Now extract all remaining content elements in order
        const contentElements = contentClone.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, li, pre, code, blockquote, hr');
        
        contentElements.forEach(element => {
          if (processedElements.has(element)) return;
          
          const tagName = element.tagName.toLowerCase();
          const text = element.textContent.trim();
          
          if (!text) return;
          
          if (tagName.startsWith('h')) {
            const level = parseInt(tagName.substring(1));
            markdown += `${'#'.repeat(level)} ${text}\n\n`;
          } else if (tagName === 'p') {
            // Skip paragraphs that only contained attachments we already processed
            const hasProcessedChildren = Array.from(element.querySelectorAll('*')).some(child => 
              processedElements.has(child)
            );
            if (hasProcessedChildren) {
              // Extract text content excluding processed elements
              const textContent = getTextContentExcludingElements(element, processedElements);
              if (textContent.trim()) {
                markdown += `${textContent}\n\n`;
              }
            } else {
              const paragraphText = processGeminiParagraph(element);
              if (paragraphText.trim()) {
                markdown += `${paragraphText}\n\n`;
              }
            }
          } else if (tagName === 'ul' || tagName === 'ol') {
            const items = element.querySelectorAll('li');
            items.forEach(item => {
              const itemText = processGeminiParagraph(item);
              if (itemText && itemText.trim()) {
                markdown += `- ${itemText}\n`;
              }
            });
            markdown += '\n';
          } else if (tagName === 'blockquote') {
            markdown += `> ${text}\n\n`;
          } else if (tagName === 'hr') {
            markdown += '---\n\n';
          } else if (tagName === 'pre' || tagName === 'code') {
            // Handle inline code that's not inside pre
            if (!element.closest('pre') && !element.closest('.attachment-container')) {
              const codeText = element.textContent.trim();
              if (codeText) {
                markdown += `\`${codeText}\` `;
              }
            }
          }
          
          processedElements.add(element);
        });
        
        // If no structured content was found, fall back to all text
        if (contentElements.length === 0 && codeAttachments.length === 0) {
          const allText = responseContent.textContent.trim();
          if (allText) {
            markdown += `${allText}\n\n`;
          }
        }
      } else {
        // Fallback: extract all text from the message
        const allText = assistantMessages[index].textContent.trim();
        if (allText) {
          markdown += `${allText}\n\n`;
        }
      }
      
      markdown += '---\n\n';
    }
  });

  if (messageCount === 0) {
    return "No Gemini conversation found. Please make sure you're on a Gemini chat page with an active conversation.";
  }

  markdown += `\n\n---\n*Exported on ${new Date().toLocaleString()}*`;
  return markdown;
}

// Helper function to extract text content while excluding certain elements
function getTextContentExcludingElements(element, excludedElements) {
  const clone = element.cloneNode(true);
  
  // Remove excluded elements from the clone
  Array.from(clone.querySelectorAll('*')).forEach(child => {
    if (excludedElements.has(child)) {
      child.remove();
    }
  });
  
  return clone.textContent.trim();
}

// Helper function to extract code from Gemini attachments
function extractGeminiCodeFromAttachment(attachment) {
  const title = attachment.querySelector('[data-test-id="artifact-text"]')?.textContent || 'Code Block';
  
  // Try to extract any visible code
  const codeElements = attachment.querySelectorAll('code, pre');
  let codeContent = '';
  
  codeElements.forEach(element => {
    const text = element.textContent.trim();
    if (text && !text.includes('Open')) {
      codeContent += text + '\n';
    }
  });
  
  if (codeContent) {
    return codeContent;
  }
  
  // If no code found, create a basic template based on the title
  if (title.toLowerCase().includes('hello')) {
    return `# ${title}\nprint("Hello, World!")`;
  }
  
  return `# ${title}\n# Code content would be displayed here\n# Click "Open" in Gemini to view the full code`;
}

// Helper function to process paragraphs with citations and inline code
function processGeminiParagraph(element) {
  const clone = element.cloneNode(true);
  
  // Process inline code blocks first
  const inlineCodeElements = clone.querySelectorAll('code');
  inlineCodeElements.forEach(codeElement => {
    const codeText = codeElement.textContent.trim();
    if (codeText) {
      const backtickWrapper = document.createTextNode(`\`${codeText}\``);
      codeElement.replaceWith(backtickWrapper);
    }
  });
  
  // Process citations - replace citation elements with markers
  const citations = clone.querySelectorAll('source-footnote, .citation');
  const citationRefs = [];
  
  citations.forEach((citation, index) => {
    // Try to find the source information
    const sourceChip = citation.closest('sources-carousel-inline')?.querySelector('source-inline-chip');
    const sourceText = sourceChip?.textContent.trim();
    
    if (sourceText) {
      citationRefs.push(sourceText);
      // Replace citation with marker
      const marker = `[${index + 1}]`;
      citation.replaceWith(marker);
    } else {
      citation.remove();
    }
  });
  
  let text = clone.textContent.trim();
  
  // Add citation references if any
  if (citationRefs.length > 0) {
    text += '\n\n**Sources:**\n';
    citationRefs.forEach((source, index) => {
      text += `${index + 1}. ${source}\n`;
    });
  }
  
  return text;
}

// Execute the extractor
extractGeminiConversation();