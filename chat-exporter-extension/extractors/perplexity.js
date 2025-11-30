function extractPerplexityConversation() {
  let markdown = "# Perplexity Conversation\n\n";
  let messageCount = 0;

  // Find all message pairs
  const messagePairs = document.querySelectorAll('.mx-auto.max-w-threadContentWidth');
  
  messagePairs.forEach((pair, index) => {
    // Find user message (the input area)
    const userInput = document.querySelector('[data-lexical-editor="true"]');
    let userText = '';
    
    if (userInput) {
      userText = userInput.textContent.trim();
    }
    
    // If we have a user message, process the response
    if (userText) {
      messageCount++;
      
      // Add user message
      markdown += `## User Message ${messageCount}\n\n`;
      markdown += `${userText}\n\n`;
      
      // Add Perplexity response
      markdown += `### Perplexity Response\n\n`;
      
      // Extract the main response content
      const responseContent = pair.querySelector('.prose');
      
      if (responseContent) {
        // Process code blocks first
        const codeBlocks = responseContent.querySelectorAll('.codeWrapper');
        
        if (codeBlocks.length > 0) {
          codeBlocks.forEach(codeBlock => {
            const languageElement = codeBlock.querySelector('[data-testid="code-language-indicator"]');
            const language = languageElement?.textContent?.trim() || 'text';
            
            const codeContent = codeBlock.querySelector('code');
            if (codeContent) {
              const codeText = extractPerplexityCodeText(codeContent);
              if (codeText) {
                markdown += `\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
              }
            }
          });
        }
        
        // Process all content elements in order
        const contentElements = responseContent.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, li, pre, code, blockquote');
        
        contentElements.forEach(element => {
          // Skip elements inside code blocks we already processed
          if (element.closest('.codeWrapper')) {
            return;
          }
          
          const tagName = element.tagName.toLowerCase();
          const text = element.textContent.trim();
          
          if (!text) return;
          
          if (tagName.startsWith('h')) {
            const level = parseInt(tagName.substring(1));
            markdown += `${'#'.repeat(level)} ${text}\n\n`;
          } else if (tagName === 'p') {
            const paragraphText = processPerplexityParagraph(element);
            if (paragraphText.trim()) {
              markdown += `${paragraphText}\n\n`;
            }
          } else if (tagName === 'ul' || tagName === 'ol') {
            const items = element.querySelectorAll('li');
            items.forEach(item => {
              const itemText = processPerplexityParagraph(item);
              if (itemText.trim()) {
                markdown += `- ${itemText}\n`;
              }
            });
            markdown += '\n';
          } else if (tagName === 'li') {
            if (!element.closest('ul') && !element.closest('ol')) {
              const itemText = processPerplexityParagraph(element);
              if (itemText.trim()) {
                markdown += `- ${itemText}\n`;
              }
            }
          } else if (tagName === 'blockquote') {
            markdown += `> ${text}\n\n`;
          } else if (tagName === 'pre' || tagName === 'code') {
            // Handle inline code
            if (!element.closest('.codeWrapper') && !element.closest('pre')) {
              const codeText = element.textContent.trim();
              if (codeText) {
                markdown += `\`${codeText}\` `;
              }
            }
          }
        });
        
        // If no structured content was found, fall back to all text
        if (contentElements.length === 0 && codeBlocks.length === 0) {
          const allText = responseContent.textContent.trim();
          if (allText) {
            markdown += `${allText}\n\n`;
          }
        }
      } else {
        // Fallback: extract all text from the pair
        const allText = pair.textContent.trim();
        if (allText) {
          markdown += `${allText}\n\n`;
        }
      }
      
      markdown += '---\n\n';
    }
  });

  // Alternative approach: look for user messages in the input area
  if (messageCount === 0) {
    const userMessages = document.querySelectorAll('[data-lexical-editor="true"]');
    const responseContainers = document.querySelectorAll('.mx-auto.max-w-threadContentWidth');
    
    userMessages.forEach((userMessage, index) => {
      const userText = userMessage.textContent.trim();
      if (userText) {
        messageCount++;
        
        markdown += `## User Message ${messageCount}\n\n`;
        markdown += `${userText}\n\n`;
        
        if (responseContainers[index]) {
          markdown += `### Perplexity Response\n\n`;
          
          // Extract code blocks
          const codeBlocks = responseContainers[index].querySelectorAll('.codeWrapper');
          if (codeBlocks.length > 0) {
            codeBlocks.forEach(codeBlock => {
              const languageElement = codeBlock.querySelector('[data-testid="code-language-indicator"]');
              const language = languageElement?.textContent?.trim() || 'text';
              
              const codeContent = codeBlock.querySelector('code');
              if (codeContent) {
                const codeText = extractPerplexityCodeText(codeContent);
                if (codeText) {
                  markdown += `\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
                }
              }
            });
          }
          
          // Extract regular text
          const textContent = responseContainers[index].cloneNode(true);
          textContent.querySelectorAll('.codeWrapper').forEach(el => el.remove());
          const text = textContent.textContent.trim();
          if (text) {
            markdown += `${text}\n\n`;
          }
        }
        
        markdown += '---\n\n';
      }
    });
  }

  if (messageCount === 0) {
    return "No Perplexity conversation found. Please make sure you're on a Perplexity chat page with an active conversation.";
  }

  markdown += `\n\n---\n*Exported on ${new Date().toLocaleString()}*`;
  return markdown;
}

// Helper function to extract clean code text from Perplexity code blocks
function extractPerplexityCodeText(codeElement) {
  const clone = codeElement.cloneNode(true);
  
  // Remove syntax highlighting spans but preserve text content
  const spans = clone.querySelectorAll('span');
  spans.forEach(span => {
    if (span.textContent) {
      const textNode = document.createTextNode(span.textContent);
      span.parentNode.replaceChild(textNode, span);
    } else {
      span.remove();
    }
  });
  
  return clone.textContent.trim();
}

// Helper function to process paragraphs
function processPerplexityParagraph(element) {
  const clone = element.cloneNode(true);
  
  // Process inline code
  const inlineCodeElements = clone.querySelectorAll('code');
  inlineCodeElements.forEach(codeElement => {
    const codeText = codeElement.textContent.trim();
    if (codeText) {
      const backtickWrapper = document.createTextNode(`\`${codeText}\``);
      codeElement.replaceWith(backtickWrapper);
    }
  });
  
  return clone.textContent.trim();
}

// Execute the extractor
extractPerplexityConversation();