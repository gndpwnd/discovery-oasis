function extractGoogleScholarConversation() {
  let markdown = "# Google Scholar Labs Conversation\n\n";
  let conversationCount = 0;

  const conversationContainers = document.querySelectorAll('.gs_as_cp.gs_as_cp_sq_e');
  
  conversationContainers.forEach((container) => {
    const userMessage = container.querySelector('.gs_as_cp_tq[dir="auto"]');
    if (userMessage) {
      conversationCount++;
      markdown += `## Conversation ${conversationCount}\n\n`;
      markdown += `### User Question\n\n${userMessage.textContent}\n\n`;
      
      const responsePapers = container.querySelectorAll('.gs_r.gs_or.gs_scl');
      
      if (responsePapers.length > 0) {
        markdown += `### Research Papers (${responsePapers.length} found)\n\n`;
        
        responsePapers.forEach((paper, paperIndex) => {
          markdown += `#### Paper ${paperIndex + 1}\n\n`;
          
          const titleElement = paper.querySelector('.gs_rt a');
          if (titleElement) {
            markdown += `**Title:** [${titleElement.textContent}](${titleElement.href})\n\n`;
          }
          
          const authorsElement = paper.querySelector('.gs_a');
          if (authorsElement) {
            markdown += `**Authors/Publication:** ${authorsElement.textContent}\n\n`;
          }
          
          const summaryElement = paper.querySelector('.gs_rs > div');
          if (summaryElement) {
            markdown += `**Summary:** ${summaryElement.textContent}\n\n`;
          }
          
          const keyPoints = paper.querySelectorAll('.gs_asl li');
          if (keyPoints.length > 0) {
            markdown += `**Key Points:**\n`;
            keyPoints.forEach(point => {
              const boldElement = point.querySelector('b');
              let pointText = point.textContent;
              let boldText = '';
              
              if (boldElement) {
                boldText = boldElement.textContent;
                pointText = pointText.replace(boldText, '').trim();
              }
              
              markdown += `- **${boldText}** ${pointText}\n`;
            });
            markdown += '\n';
          }
          
          const citationLinks = paper.querySelectorAll('.gs_fl a');
          citationLinks.forEach(link => {
            if (link.textContent.includes('Cited by')) {
              markdown += `**${link.textContent}**\n\n`;
            }
          });
          
          markdown += '---\n\n';
        });
      } else {
        markdown += `*No research papers found for this question*\n\n`;
      }
    }
  });

  if (conversationCount === 0) {
    return "No Google Scholar conversations found.";
  }

  markdown += `\n\n---\n*Exported on ${new Date().toLocaleString()}*`;
  return markdown;
}

// Execute the extractor
extractGoogleScholarConversation();