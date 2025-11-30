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

// Execute the extractor
extractClaudeConversation();