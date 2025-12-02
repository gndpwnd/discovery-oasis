function extractNotebookLMConversation() {
  let markdown = "# NotebookLM Conversation\n\n";
  let messageCount = 0;

  // Find all message pairs - the main container structure
  const messagePairs = document.querySelectorAll('.chat-message-pair');
  
  if (messagePairs.length > 0) {
    messagePairs.forEach((pair, index) => {
      // Extract user message
      const userContainer = pair.querySelector('.from-user-container');
      if (userContainer) {
        messageCount++;
        markdown += `## User Message ${messageCount}\n\n`;
        
        const userMessageText = userContainer.querySelector('.message-text-content p, .message-text-content');
        if (userMessageText) {
          markdown += `${userMessageText.textContent.trim()}\n\n`;
        }
      }
      
      // Extract NotebookLM response
      const responseContainer = pair.querySelector('.to-user-container');
      if (responseContainer) {
        markdown += `### NotebookLM Response\n\n`;
        
        const messageContent = responseContainer.querySelector('.message-text-content');
        
        if (messageContent) {
          // Process all structural elements
          const structuralElements = messageContent.querySelectorAll('labs-tailwind-structural-element-view-v2');
          
          if (structuralElements.length > 0) {
            structuralElements.forEach(element => {
              const responseText = processNotebookLMStructuralElement(element);
              if (responseText) {
                markdown += responseText;
              }
            });
          } else {
            // Fallback: extract all text if no structural elements found
            const allText = messageContent.textContent.trim();
            if (allText) {
              markdown += `${allText}\n\n`;
            }
          }
          
          // Extract citations/sources if present
          const citations = extractNotebookLMCitations(messageContent);
          if (citations.length > 0) {
            markdown += `\n#### Sources\n\n`;
            citations.forEach((citation, idx) => {
              markdown += `${idx + 1}. ${citation}\n`;
            });
            markdown += '\n';
          }
        }
        
        markdown += '---\n\n';
      }
    });
  }
  
  // Fallback approach: look for individual message containers
  if (messageCount === 0) {
    const userMessages = document.querySelectorAll('.from-user-container');
    const responseContainers = document.querySelectorAll('.to-user-container');
    
    userMessages.forEach((userContainer, index) => {
      messageCount++;
      markdown += `## User Message ${messageCount}\n\n`;
      
      const userMessageText = userContainer.querySelector('.message-text-content p, .message-text-content');
      if (userMessageText) {
        markdown += `${userMessageText.textContent.trim()}\n\n`;
      }
      
      // Find corresponding response
      if (responseContainers[index]) {
        markdown += `### NotebookLM Response\n\n`;
        
        const messageContent = responseContainers[index].querySelector('.message-text-content');
        
        if (messageContent) {
          const structuralElements = messageContent.querySelectorAll('labs-tailwind-structural-element-view-v2');
          
          if (structuralElements.length > 0) {
            structuralElements.forEach(element => {
              const responseText = processNotebookLMStructuralElement(element);
              if (responseText) {
                markdown += responseText;
              }
            });
          } else {
            const allText = messageContent.textContent.trim();
            if (allText) {
              markdown += `${allText}\n\n`;
            }
          }
          
          // Extract citations
          const citations = extractNotebookLMCitations(messageContent);
          if (citations.length > 0) {
            markdown += `\n#### Sources\n\n`;
            citations.forEach((citation, idx) => {
              markdown += `${idx + 1}. ${citation}\n`;
            });
            markdown += '\n';
          }
        }
        
        markdown += '---\n\n';
      }
    });
  }

  if (messageCount === 0) {
    return "No NotebookLM conversation found. Please make sure you're on a NotebookLM chat page with an active conversation.";
  }

  markdown += `\n\n---\n*Exported on ${new Date().toLocaleString()}*`;
  return markdown;
}

// Helper function to process structural elements - returns the markdown text
function processNotebookLMStructuralElement(element) {
  let result = '';
  
  // Check if this is a code block
  const preElement = element.querySelector('pre');
  if (preElement) {
    const codeElement = preElement.querySelector('code');
    if (codeElement) {
      const codeText = codeElement.textContent.trim();
      if (codeText) {
        result += `\`\`\`markdown\n${codeText}\n\`\`\`\n\n`;
      }
    }
    return result;
  }
  
  // Get the main container div (paragraph, list, etc.)
  const container = element.querySelector('div[class*="paragraph"], div[class*="list"]');
  
  if (!container) {
    // If no container found, try to get all text from the element
    const allText = element.textContent.trim();
    if (allText) {
      result += extractTextWithFormatting(element) + '\n\n';
    }
    return result;
  }
  
  // Check if it's a list item (starts with bullet)
  const containerText = container.textContent.trim();
  if (containerText.startsWith('•') || containerText.startsWith('*')) {
    const listText = extractTextWithFormatting(container);
    if (listText.trim()) {
      result += `${listText}\n`;
    }
  } else {
    // Regular paragraph
    const paragraphText = extractTextWithFormatting(container);
    if (paragraphText.trim()) {
      result += `${paragraphText}\n\n`;
    }
  }
  
  return result;
}

// Helper function to extract text while preserving bold, citations, etc.
function extractTextWithFormatting(element) {
  // Clone the element to avoid modifying the original DOM
  const clone = element.cloneNode(true);
  
  // Remove citation buttons but keep their markers
  const citationButtons = clone.querySelectorAll('button.citation-marker');
  citationButtons.forEach(button => {
    const citationSpan = button.querySelector('span[aria-label]');
    if (citationSpan) {
      const ariaLabel = citationSpan.getAttribute('aria-label');
      // Skip "Show additional citations" button
      if (ariaLabel === 'Show additional citations' || button.textContent.trim() === '...') {
        button.remove();
        return;
      }
      // Extract just the number
      const match = ariaLabel.match(/^(\d+):/);
      if (match) {
        const marker = document.createTextNode(`[${match[1]}]`);
        button.parentNode.replaceChild(marker, button);
      } else {
        const marker = document.createTextNode(`[${button.textContent.trim()}]`);
        button.parentNode.replaceChild(marker, button);
      }
    } else {
      // No aria-label, check button text content
      const buttonText = button.textContent.trim();
      if (buttonText && buttonText !== '...') {
        const marker = document.createTextNode(`[${buttonText}]`);
        button.parentNode.replaceChild(marker, button);
      } else {
        button.remove();
      }
    }
  });
  
  // Now process the cleaned clone to extract formatted text
  let result = '';
  
  const walkNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      
      if (tagName === 'b' || tagName === 'strong') {
        result += `**${node.textContent.trim()}**`;
      } else if (tagName === 'i' || tagName === 'em') {
        result += `*${node.textContent.trim()}*`;
      } else if (tagName === 'code') {
        result += `\`${node.textContent.trim()}\``;
      } else if (tagName === 'a') {
        const href = node.getAttribute('href');
        const text = node.textContent.trim();
        if (href) {
          result += `[${text}](${href})`;
        } else {
          result += text;
        }
      } else {
        // For all other elements, process children
        for (const child of node.childNodes) {
          walkNode(child);
        }
      }
    }
  };
  
  for (const child of clone.childNodes) {
    walkNode(child);
  }
  
  return result.trim();
}

// Helper function to extract citations from the message
function extractNotebookLMCitations(messageContent) {
  const citations = [];
  const citationButtons = messageContent.querySelectorAll('button.citation-marker');
  
  citationButtons.forEach(button => {
    const citationSpan = button.querySelector('span[aria-label]');
    if (citationSpan) {
      const ariaLabel = citationSpan.getAttribute('aria-label');
      // Skip "Show additional citations" button
      if (ariaLabel && ariaLabel !== 'Show additional citations' && !citations.includes(ariaLabel)) {
        citations.push(ariaLabel);
      }
    }
  });
  
  return citations;
}

// Execute the extractor
extractNotebookLMConversation();