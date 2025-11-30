function extractDeepSeekConversation() {
  let markdown = "# DeepSeek Conversation\n\n";
  let messageCount = 0;

  // Find all message containers
  const userMessages = document.querySelectorAll('.fbb737a4'); // User message container
  const assistantMessages = document.querySelectorAll('._4f9bf79._43c05b5'); // Assistant message container
  
  // Process messages in order (assuming they appear sequentially in the DOM)
  const allContainers = document.querySelectorAll('.fbb737a4, ._4f9bf79._43c05b5');
  
  allContainers.forEach((container, index) => {
    if (container.classList.contains('fbb737a4')) {
      // User message
      messageCount++;
      markdown += `## User Message ${messageCount}\n\n`;
      const userText = container.textContent.trim();
      markdown += `${userText}\n\n`;
      
    } else if (container.classList.contains('_4f9bf79') && container.classList.contains('_43c05b5')) {
      // Assistant message
      markdown += `### DeepSeek Response\n\n`;
      
      // Extract the main content
      const messageContent = container.querySelector('.ds-markdown');
      
      if (messageContent) {
        // Extract all content elements in order
        const contentElements = messageContent.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, li, pre, code, blockquote, .md-code-block');
        
        contentElements.forEach(element => {
          const tagName = element.tagName.toLowerCase();
          const text = element.textContent.trim();
          
          if (!text) return;
          
          if (tagName.startsWith('h')) {
            // Handle headings
            const level = parseInt(tagName.substring(1));
            markdown += `${'#'.repeat(level)} ${text}\n\n`;
          } else if (tagName === 'p') {
            // Handle paragraphs (exclude those inside code blocks)
            if (!element.closest('pre') && !element.closest('code') && !element.closest('.md-code-block')) {
              markdown += `${text}\n\n`;
            }
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
          } else if (element.classList.contains('md-code-block')) {
            // Handle code blocks specifically
            const codeElement = element.querySelector('pre');
            if (codeElement) {
              const codeText = codeElement.textContent.trim();
              if (codeText) {
                // Get language from the banner
                const languageElement = element.querySelector('.d813de27');
                const language = languageElement?.textContent || 'text';
                markdown += `\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
              }
            }
          } else if (tagName === 'pre') {
            // Handle standalone pre elements
            const codeText = element.textContent.trim();
            if (codeText && !element.closest('.md-code-block')) {
              markdown += `\`\`\`text\n${codeText}\n\`\`\`\n\n`;
            }
          } else if (tagName === 'code') {
            // Handle inline code that's not inside pre
            if (!element.closest('pre')) {
              markdown += `\`${text}\` `;
            }
          }
        });
        
        // If no structured content was found, fall back to all text
        if (contentElements.length === 0) {
          const allText = messageContent.textContent.trim();
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
      
      // Extract code blocks that might be outside the main content area
      const additionalCodeBlocks = container.querySelectorAll('.md-code-block');
      if (additionalCodeBlocks.length > 0) {
        additionalCodeBlocks.forEach(codeBlock => {
          const codeElement = codeBlock.querySelector('pre');
          if (codeElement) {
            const codeText = codeElement.textContent.trim();
            if (codeText) {
              // Get language from the banner
              const languageElement = codeBlock.querySelector('.d813de27');
              const language = languageElement?.textContent || 'text';
              markdown += `\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
            }
          }
        });
      }
      
      markdown += '---\n\n';
    }
  });

  // Alternative approach: look for message pairs if the first method didn't work
  if (messageCount === 0) {
    const messagePairs = document.querySelectorAll('[class*="message"]');
    
    messagePairs.forEach((pair, index) => {
      // Look for user content
      const userContent = pair.querySelector('.fbb737a4');
      if (userContent) {
        messageCount++;
        markdown += `## User Message ${messageCount}\n\n`;
        markdown += `${userContent.textContent.trim()}\n\n`;
      }
      
      // Look for assistant content
      const assistantContent = pair.querySelector('._4f9bf79._43c05b5, .ds-markdown');
      if (assistantContent) {
        markdown += `### DeepSeek Response\n\n`;
        
        // Extract code blocks from assistant content
        const codeBlocks = assistantContent.querySelectorAll('.md-code-block');
        if (codeBlocks.length > 0) {
          codeBlocks.forEach(codeBlock => {
            const codeElement = codeBlock.querySelector('pre');
            if (codeElement) {
              const codeText = codeElement.textContent.trim();
              if (codeText) {
                const languageElement = codeBlock.querySelector('.d813de27');
                const language = languageElement?.textContent || 'text';
                markdown += `\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
              }
            }
          });
        }
        
        // Extract regular text (excluding code blocks)
        const textContent = assistantContent.cloneNode(true);
        // Remove code blocks from the clone to get only text
        textContent.querySelectorAll('.md-code-block').forEach(el => el.remove());
        const text = textContent.textContent.trim();
        if (text) {
          markdown += `${text}\n\n`;
        }
        
        markdown += '---\n\n';
      }
    });
  }

  if (messageCount === 0) {
    return "No DeepSeek conversation found. Please make sure you're on a DeepSeek chat page with an active conversation.";
  }

  markdown += `\n\n---\n*Exported on ${new Date().toLocaleString()}*`;
  return markdown;
}

// Execute the extractor
extractDeepSeekConversation();