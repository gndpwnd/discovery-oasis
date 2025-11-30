// Content script for Google Scholar Labs
(function() {
  // Make the extraction function available to the popup
  window.extractGoogleScholarConversation = function() {
    let markdown = "# Google Scholar Labs Conversation\n\n";
    
    // Extract user messages
    const userMessages = document.querySelectorAll('.gs_as_cp_tq[dir="auto"]');
    userMessages.forEach((message, index) => {
      markdown += `## User Message ${index + 1}\n\n`;
      markdown += `${message.textContent}\n\n`;
      
      // Find corresponding response (next .gs_ri element)
      const responseElement = message.closest('.gs_as_cp')?.nextElementSibling?.querySelector('.gs_ri');
      if (responseElement) {
        markdown += `### Response\n\n`;
        
        // Extract paper title and link
        const titleElement = responseElement.querySelector('.gs_rt a');
        if (titleElement) {
          markdown += `**Title:** [${titleElement.textContent}](${titleElement.href})\n\n`;
        }
        
        // Extract authors and publication info
        const authorsElement = responseElement.querySelector('.gs_a');
        if (authorsElement) {
          markdown += `**Authors/Publication:** ${authorsElement.textContent}\n\n`;
        }
        
        // Extract summary
        const summaryElement = responseElement.querySelector('.gs_rs > div');
        if (summaryElement) {
          markdown += `**Summary:** ${summaryElement.textContent}\n\n`;
        }
        
        // Extract key points
        const keyPoints = responseElement.querySelectorAll('.gs_asl li');
        if (keyPoints.length > 0) {
          markdown += `**Key Points:**\n`;
          keyPoints.forEach(point => {
            const boldElement = point.querySelector('b');
            const pointText = point.textContent.replace(boldElement?.textContent || '', '').trim();
            markdown += `- **${boldElement?.textContent || ''}** ${pointText}\n`;
          });
          markdown += '\n';
        }
        
        // Extract citation info
        const citationLinks = responseElement.querySelectorAll('.gs_fl a');
        citationLinks.forEach(link => {
          if (link.textContent.includes('Cited by')) {
            markdown += `**${link.textContent}**\n\n`;
          }
        });
      }
      
      markdown += '---\n\n';
    });
    
    return markdown;
  };
})();