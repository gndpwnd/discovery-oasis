function extractPhindConversation() {
  let markdown = "# Phind Conversation\n\n";
  let messageCount = 0;

  // Find all chat Q&A pairs
  const chatPairs = document.querySelectorAll('.chat-qa-pair');
  
  chatPairs.forEach((pair, index) => {
    messageCount++;
    
    // Extract user question
    const questionElement = pair.querySelector('.chat-question');
    if (questionElement) {
      markdown += `## User Message ${messageCount}\n\n`;
      markdown += `${questionElement.textContent.trim()}\n\n`;
    }
    
    // Extract Phind response
    markdown += `### Phind Response\n\n`;
    
    const answerContent = pair.querySelector('.chat-answer');
    
    if (answerContent) {
      // Extract model information
      const modelPill = pair.querySelector('.model-pill');
      if (modelPill) {
        const modelText = modelPill.textContent.replace('MODEL', '').trim();
        markdown += `**Model:** ${modelText}\n\n`;
      }
      
      // Extract code blocks first
      const codeBlocks = answerContent.querySelectorAll('.code-block-card');
      
      if (codeBlocks.length > 0) {
        codeBlocks.forEach(codeBlock => {
          const codeContent = codeBlock.querySelector('code');
          if (codeContent) {
            const language = codeContent.classList.contains('language-python') ? 'python' : 'text';
            const codeText = extractPhindCodeText(codeContent);
            if (codeText) {
              markdown += `\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
            }
          }
        });
      }
      
      // Process all content elements
      const contentElements = answerContent.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, li, pre, code, blockquote');
      
      contentElements.forEach(element => {
        // Skip elements inside code blocks we already processed
        if (element.closest('.code-block-card')) {
          return;
        }
        
        const tagName = element.tagName.toLowerCase();
        const text = element.textContent.trim();
        
        if (!text) return;
        
        if (tagName.startsWith('h')) {
          const level = parseInt(tagName.substring(1));
          markdown += `${'#'.repeat(level)} ${text}\n\n`;
        } else if (tagName === 'p') {
          const paragraphText = processPhindParagraph(element);
          if (paragraphText.trim()) {
            markdown += `${paragraphText}\n\n`;
          }
        } else if (tagName === 'ul' || tagName === 'ol') {
          const items = element.querySelectorAll('li');
          items.forEach(item => {
            const itemText = processPhindParagraph(item);
            if (itemText.trim()) {
              markdown += `- ${itemText}\n`;
            }
          });
          markdown += '\n';
        } else if (tagName === 'li') {
          if (!element.closest('ul') && !element.closest('ol')) {
            const itemText = processPhindParagraph(element);
            if (itemText.trim()) {
              markdown += `- ${itemText}\n`;
            }
          }
        } else if (tagName === 'blockquote') {
          markdown += `> ${text}\n\n`;
        } else if (tagName === 'pre' || tagName === 'code') {
          // Handle inline code
          if (!element.closest('.code-block-card') && !element.closest('pre')) {
            const codeText = element.textContent.trim();
            if (codeText) {
              markdown += `\`${codeText}\` `;
            }
          }
        }
      });
      
      // Extract sources
      const sources = pair.querySelectorAll('.chat-source-card');
      if (sources.length > 0) {
        markdown += `#### Sources\n\n`;
        sources.forEach(source => {
          const sourceTitle = source.querySelector('.chat-source-title')?.textContent.trim();
          const sourceLink = source.querySelector('.chat-source-link')?.getAttribute('href');
          if (sourceTitle) {
            if (sourceLink) {
              markdown += `- [${sourceTitle}](${sourceLink})\n`;
            } else {
              markdown += `- ${sourceTitle}\n`;
            }
          }
        });
        markdown += '\n';
      }
      
      // Extract follow-up questions
      const followUpQuestions = pair.querySelectorAll('.followup-suggestions-pill');
      if (followUpQuestions.length > 0) {
        markdown += `#### Follow-up Questions\n\n`;
        followUpQuestions.forEach(question => {
          const questionText = question.textContent.trim();
          if (questionText) {
            markdown += `- ${questionText}\n`;
          }
        });
        markdown += '\n';
      }
      
      // If no structured content was found, fall back to all text
      if (contentElements.length === 0 && codeBlocks.length === 0) {
        const allText = answerContent.textContent.trim();
        if (allText) {
          markdown += `${allText}\n\n`;
        }
      }
    }
    
    markdown += '---\n\n';
  });

  // Alternative approach for different page structure
  if (messageCount === 0) {
    const questions = document.querySelectorAll('.chat-question');
    const answers = document.querySelectorAll('.chat-answer');
    
    questions.forEach((question, index) => {
      messageCount++;
      
      markdown += `## User Message ${messageCount}\n\n`;
      markdown += `${question.textContent.trim()}\n\n`;
      
      if (answers[index]) {
        markdown += `### Phind Response\n\n`;
        
        // Extract code blocks
        const codeBlocks = answers[index].querySelectorAll('.code-block-card');
        if (codeBlocks.length > 0) {
          codeBlocks.forEach(codeBlock => {
            const codeContent = codeBlock.querySelector('code');
            if (codeContent) {
              const language = codeContent.classList.contains('language-python') ? 'python' : 'text';
              const codeText = extractPhindCodeText(codeContent);
              if (codeText) {
                markdown += `\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
              }
            }
          });
        }
        
        // Extract regular text
        const textContent = answers[index].cloneNode(true);
        textContent.querySelectorAll('.code-block-card').forEach(el => el.remove());
        const text = textContent.textContent.trim();
        if (text) {
          markdown += `${text}\n\n`;
        }
      }
      
      markdown += '---\n\n';
    });
  }

  if (messageCount === 0) {
    return "No Phind conversation found. Please make sure you're on a Phind chat page with an active conversation.";
  }

  markdown += `\n\n---\n*Exported on ${new Date().toLocaleString()}*`;
  return markdown;
}

// Helper function to extract clean code text from Phind code blocks
function extractPhindCodeText(codeElement) {
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

// Helper function to process paragraphs with citations
function processPhindParagraph(element) {
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
  
  // Process citations
  const citations = clone.querySelectorAll('.citation-inline');
  const citationRefs = [];
  
  citations.forEach((citation, index) => {
    const sourceText = citation.textContent.trim();
    if (sourceText) {
      citationRefs.push(sourceText);
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

// Execute the extractor
extractPhindConversation();