function extractGrokConversation() {
  let markdown = "# Grok Conversation\n\n";
  let messageCount = 0;

  // Find all message containers
  const messageContainers = document.querySelectorAll('.relative.group.flex');
  
  messageContainers.forEach((container, index) => {
    // Check if it's a user message (items-end indicates user message)
    if (container.classList.contains('items-end')) {
      messageCount++;
      
      // Add user message
      markdown += `## User Message ${messageCount}\n\n`;
      const userText = container.querySelector('.response-content-markdown p')?.textContent || 
                      container.textContent;
      markdown += `${userText.trim()}\n\n`;
      
    } else if (container.classList.contains('items-start')) {
      // This is a Grok response
      markdown += `### Grok Response\n\n`;
      
      const responseContent = container.querySelector('.response-content-markdown');
      
      if (responseContent) {
        // Extract code blocks first
        const codeBlocks = responseContent.querySelectorAll('[data-testid="code-block"]');
        
        if (codeBlocks.length > 0) {
          codeBlocks.forEach(codeBlock => {
            const languageElement = codeBlock.querySelector('.font-mono.text-xs');
            const language = languageElement?.textContent?.trim() || 'text';
            
            const codeContent = codeBlock.querySelector('pre code');
            if (codeContent) {
              const codeText = extractGrokCodeText(codeContent);
              if (codeText) {
                markdown += `\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
              }
            }
          });
        }
        
        // Extract all content elements in order (excluding code blocks we already processed)
        const contentElements = responseContent.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, li, pre, code, blockquote, table');
        
        contentElements.forEach(element => {
          // Skip elements that are inside code blocks we already processed
          if (element.closest('[data-testid="code-block"]')) {
            return;
          }
          
          const tagName = element.tagName.toLowerCase();
          const text = element.textContent.trim();
          
          if (!text) return;
          
          if (tagName.startsWith('h')) {
            const level = parseInt(tagName.substring(1));
            markdown += `${'#'.repeat(level)} ${text}\n\n`;
          } else if (tagName === 'p') {
            // Handle paragraphs with citations
            const paragraphText = processGrokParagraph(element);
            markdown += `${paragraphText}\n\n`;
          } else if (tagName === 'ul' || tagName === 'ol') {
            const items = element.querySelectorAll('li');
            items.forEach(item => {
              const itemText = processGrokParagraph(item);
              if (itemText) {
                markdown += `- ${itemText}\n`;
              }
            });
            markdown += '\n';
          } else if (tagName === 'li') {
            if (!element.closest('ul') && !element.closest('ol')) {
              const itemText = processGrokParagraph(element);
              markdown += `- ${itemText}\n`;
            }
          } else if (tagName === 'blockquote') {
            markdown += `> ${text}\n\n`;
          } else if (tagName === 'table') {
            markdown += processGrokTable(element);
          } else if (tagName === 'pre' || tagName === 'code') {
            // Handle inline code that's not inside a code block
            if (!element.closest('[data-testid="code-block"]') && !element.closest('pre')) {
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
        
        // Extract follow-up buttons/suggestions
        const followUpButtons = container.querySelectorAll('button:has(.lucide-corner-down-right)');
        if (followUpButtons.length > 0) {
          markdown += `#### 💡 Follow-up Suggestions\n\n`;
          followUpButtons.forEach(button => {
            const buttonText = button.textContent.trim();
            if (buttonText) {
              markdown += `- ${buttonText}\n`;
            }
          });
          markdown += '\n';
        }
      } else {
        // Fallback: extract all text from the container
        const allText = container.textContent.trim();
        if (allText) {
          markdown += `${allText}\n\n`;
        }
      }
      
      markdown += '---\n\n';
    }
  });

  // Alternative approach: look for message pairs
  if (messageCount === 0) {
    const userMessages = document.querySelectorAll('.items-end .response-content-markdown');
    const assistantMessages = document.querySelectorAll('.items-start .response-content-markdown');
    
    userMessages.forEach((userMessage, index) => {
      messageCount++;
      markdown += `## User Message ${messageCount}\n\n`;
      markdown += `${userMessage.textContent.trim()}\n\n`;
      
      if (assistantMessages[index]) {
        markdown += `### Grok Response\n\n`;
        
        // Extract code blocks from assistant content
        const codeBlocks = assistantMessages[index].querySelectorAll('[data-testid="code-block"]');
        if (codeBlocks.length > 0) {
          codeBlocks.forEach(codeBlock => {
            const languageElement = codeBlock.querySelector('.font-mono.text-xs');
            const language = languageElement?.textContent?.trim() || 'text';
            
            const codeContent = codeBlock.querySelector('pre code');
            if (codeContent) {
              const codeText = extractGrokCodeText(codeContent);
              if (codeText) {
                markdown += `\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
              }
            }
          });
        }
        
        // Extract regular text (excluding code blocks)
        const textContent = assistantMessages[index].cloneNode(true);
        // Remove code blocks from the clone to get only text
        textContent.querySelectorAll('[data-testid="code-block"]').forEach(el => el.remove());
        const text = textContent.textContent.trim();
        if (text) {
          markdown += `${text}\n\n`;
        }
        
        markdown += '---\n\n';
      }
    });
  }

  if (messageCount === 0) {
    return "No Grok conversation found. Please make sure you're on a Grok chat page with an active conversation.";
  }

  markdown += `\n\n---\n*Exported on ${new Date().toLocaleString()}*`;
  return markdown;
}

// Helper function to extract clean code text from Grok code blocks
function extractGrokCodeText(codeElement) {
  const clone = codeElement.cloneNode(true);
  
  // Remove syntax highlighting spans but preserve text content
  const spans = clone.querySelectorAll('span');
  spans.forEach(span => {
    // Keep the text content but remove the span wrapper
    if (span.textContent) {
      const textNode = document.createTextNode(span.textContent);
      span.parentNode.replaceChild(textNode, span);
    } else {
      span.remove();
    }
  });
  
  return clone.textContent.trim();
}

// Helper function to process paragraphs with citations
function processGrokParagraph(element) {
  const clone = element.cloneNode(true);
  
  // Process inline code first
  const inlineCodeElements = clone.querySelectorAll('code:not(.citation)');
  inlineCodeElements.forEach(codeElement => {
    const codeText = codeElement.textContent.trim();
    if (codeText) {
      const backtickWrapper = document.createTextNode(`\`${codeText}\``);
      codeElement.replaceWith(backtickWrapper);
    }
  });
  
  // Process citations - replace citation chips with markers
  const citations = clone.querySelectorAll('.citation');
  const citationRefs = [];
  
  citations.forEach((citation, index) => {
    const source = citation.textContent.trim();
    if (source) {
      citationRefs.push(source);
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
    text += '\n\n**References:**\n';
    citationRefs.forEach((source, index) => {
      text += `${index + 1}. ${source}\n`;
    });
  }
  
  return text;
}

// Helper function to process tables
function processGrokTable(table) {
  let tableMarkdown = '\n';
  const rows = table.querySelectorAll('tr');
  
  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('th, td');
    let rowText = '|';
    
    cells.forEach(cell => {
      const cellText = cell.textContent.trim().replace(/\n/g, ' ');
      rowText += ` ${cellText} |`;
    });
    
    tableMarkdown += rowText + '\n';
    
    // Add header separator after first row
    if (rowIndex === 0) {
      let separator = '|';
      cells.forEach(() => {
        separator += ' --- |';
      });
      tableMarkdown += separator + '\n';
    }
  });
  
  tableMarkdown += '\n';
  return tableMarkdown;
}

// Execute the extractor
extractGrokConversation();