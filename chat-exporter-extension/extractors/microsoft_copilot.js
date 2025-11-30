function extractMicrosoftCopilotConversation() {
  let markdown = "# Microsoft Copilot Conversation\n\n";
  let messageCount = 0;

  // Find user messages
  const userMessages = document.querySelectorAll('[data-content="user-message"]');
  
  userMessages.forEach((userMessage, index) => {
    messageCount++;
    
    // Add user message
    markdown += `## User Message ${messageCount}\n\n`;
    const userText = userMessage.querySelector('.whitespace-pre-wrap')?.textContent || 
                    userMessage.textContent;
    markdown += `${userText.trim()}\n\n`;
    
    // Find the corresponding Copilot response
    // Look for the next element with class containing "ai-message-item" or "space-y-3"
    let nextElement = userMessage.closest('.relative.space-y-3')?.nextElementSibling;
    if (!nextElement) {
      nextElement = userMessage.parentElement?.nextElementSibling;
    }
    
    // Try multiple selectors to find the response
    let copilotResponse = nextElement?.querySelector('.group\\/ai-message-item') || 
                         nextElement?.querySelector('.space-y-3') ||
                         document.querySelectorAll('.group\\/ai-message-item')[index] ||
                         document.querySelectorAll('.space-y-3')[index + 1];
    
    if (copilotResponse) {
      markdown += `### Copilot Response\n\n`;
      
      // Extract all text content first
      const allText = copilotResponse.textContent.trim();
      
      // Extract code blocks
      const codeBlocks = copilotResponse.querySelectorAll('.rounded-xl.dark\\:border');
      
      if (codeBlocks.length > 0) {
        codeBlocks.forEach((codeBlock) => {
          const languageElement = codeBlock.querySelector('.capitalize');
          const language = languageElement?.textContent?.trim() || 'text';
          
          // Get the code from the pre element
          const codePre = codeBlock.querySelector('pre');
          if (codePre) {
            const codeText = codePre.textContent.trim();
            if (codeText) {
              markdown += `\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
            }
          }
        });
      }
      
      // Extract paragraphs and other content
      const paragraphs = copilotResponse.querySelectorAll('p');
      if (paragraphs.length > 0) {
        paragraphs.forEach(p => {
          // Skip paragraphs inside code blocks
          if (p.closest('.rounded-xl.dark\\:border')) {
            return;
          }
          
          const text = p.textContent.trim();
          if (text) {
            // Check if it's a heading by looking for strong tags or specific patterns
            const strongTags = p.querySelectorAll('strong');
            if (strongTags.length > 0 && text.length < 100) {
              markdown += `#### ${text}\n\n`;
            } else {
              markdown += `${text}\n\n`;
            }
          }
        });
      } else if (codeBlocks.length === 0) {
        // Fallback: use all text
        markdown += `${allText}\n\n`;
      }
      
      markdown += '---\n\n';
    }
  });

  // Alternative approach: find all response containers directly
  if (messageCount === 0) {
    const responseContainers = document.querySelectorAll('.group\\/ai-message-item, .space-y-3');
    
    responseContainers.forEach((container, index) => {
      // Skip if this looks like a user message container
      if (container.querySelector('[data-content="user-message"]')) {
        return;
      }
      
      messageCount++;
      
      // Try to find the corresponding user message
      const userMessage = document.querySelectorAll('[data-content="user-message"]')[index];
      if (userMessage) {
        markdown += `## User Message ${messageCount}\n\n`;
        const userText = userMessage.querySelector('.whitespace-pre-wrap')?.textContent || 
                        userMessage.textContent;
        markdown += `${userText.trim()}\n\n`;
      }
      
      markdown += `### Copilot Response\n\n`;
      
      // Extract code blocks
      const codeBlocks = container.querySelectorAll('.rounded-xl.dark\\:border');
      
      if (codeBlocks.length > 0) {
        codeBlocks.forEach((codeBlock) => {
          const languageElement = codeBlock.querySelector('.capitalize');
          const language = languageElement?.textContent?.trim() || 'text';
          
          const codePre = codeBlock.querySelector('pre');
          if (codePre) {
            const codeText = codePre.textContent.trim();
            if (codeText) {
              markdown += `\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
            }
          }
        });
      }
      
      // Extract text content
      const paragraphs = container.querySelectorAll('p');
      if (paragraphs.length > 0) {
        paragraphs.forEach(p => {
          if (p.closest('.rounded-xl.dark\\:border')) {
            return;
          }
          
          const text = p.textContent.trim();
          if (text) {
            markdown += `${text}\n\n`;
          }
        });
      } else {
        const allText = container.textContent.trim();
        if (allText) {
          markdown += `${allText}\n\n`;
        }
      }
      
      markdown += '---\n\n';
    });
  }

  // Last resort: try to find any text content in the main chat area
  if (messageCount === 0) {
    const mainContent = document.querySelector('main') || document.body;
    const allText = mainContent.textContent;
    
    // Look for patterns that indicate conversation
    const userMessageMatches = allText.match(/You said:?(.*?)(?=Copilot|$)/gi);
    const copilotMatches = allText.match(/Copilot:?(.*?)(?=You said|$)/gi);
    
    if (userMessageMatches && copilotMatches) {
      userMessageMatches.forEach((userMsg, index) => {
        messageCount++;
        markdown += `## User Message ${messageCount}\n\n`;
        markdown += `${userMsg.replace(/You said:?\s*/i, '').trim()}\n\n`;
        
        if (copilotMatches[index]) {
          markdown += `### Copilot Response\n\n`;
          markdown += `${copilotMatches[index].replace(/Copilot:?\s*/i, '').trim()}\n\n`;
        }
        
        markdown += '---\n\n';
      });
    }
  }

  if (messageCount === 0) {
    return "No Microsoft Copilot conversation found. Please make sure you're on a Copilot chat page with an active conversation.";
  }

  markdown += `\n\n---\n*Exported on ${new Date().toLocaleString()}*`;
  return markdown;
}

// Execute the extractor
extractMicrosoftCopilotConversation();