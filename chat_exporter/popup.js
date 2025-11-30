document.addEventListener('DOMContentLoaded', function() {
  const exportBtn = document.getElementById('exportBtn');
  const statusDiv = document.getElementById('status');

  exportBtn.addEventListener('click', async () => {
    try {
      statusDiv.textContent = 'Exporting conversation...';
      exportBtn.disabled = true;
      
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('scholar.google.com')) {
        statusDiv.textContent = 'Please navigate to Google Scholar Labs first.';
        exportBtn.disabled = false;
        return;
      }

      // Execute the extraction script
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractConversation
      });
      
      if (results && results[0] && results[0].result) {
        const markdownContent = results[0].result;
        
        // Create and download markdown file
        const blob = new Blob([markdownContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scholar-labs-conversation-${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        statusDiv.textContent = 'Conversation exported successfully!';
      } else {
        statusDiv.textContent = 'No conversation found to export.';
      }
    } catch (error) {
      console.error('Export error:', error);
      statusDiv.textContent = 'Error: ' + error.message;
    } finally {
      exportBtn.disabled = false;
    }
  });
});

// This function will be injected into the page
function extractConversation() {
  let markdown = "# Google Scholar Labs Conversation\n\n";
  let conversationCount = 0;

  // Find all conversation containers
  const conversationContainers = document.querySelectorAll('.gs_as_cp.gs_as_cp_sq_e');
  
  conversationContainers.forEach((container, index) => {
    // Extract user message
    const userMessage = container.querySelector('.gs_as_cp_tq[dir="auto"]');
    if (userMessage) {
      conversationCount++;
      markdown += `## Conversation ${conversationCount}\n\n`;
      markdown += `### User Question\n\n${userMessage.textContent}\n\n`;
      
      // Extract all response papers
      const responsePapers = container.querySelectorAll('.gs_r.gs_or.gs_scl');
      
      if (responsePapers.length > 0) {
        markdown += `### Research Papers (${responsePapers.length} found)\n\n`;
        
        responsePapers.forEach((paper, paperIndex) => {
          markdown += `#### Paper ${paperIndex + 1}\n\n`;
          
          // Extract title and link
          const titleElement = paper.querySelector('.gs_rt a');
          if (titleElement) {
            markdown += `**Title:** [${titleElement.textContent}](${titleElement.href})\n\n`;
          }
          
          // Extract authors and publication info
          const authorsElement = paper.querySelector('.gs_a');
          if (authorsElement) {
            markdown += `**Authors/Publication:** ${authorsElement.textContent}\n\n`;
          }
          
          // Extract summary
          const summaryElement = paper.querySelector('.gs_rs > div');
          if (summaryElement) {
            markdown += `**Summary:** ${summaryElement.textContent}\n\n`;
          }
          
          // Extract key points
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
          
          // Extract citation info
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
      
      markdown += '\\n\\n';
    }
  });

  if (conversationCount === 0) {
    return "No conversations found. Please make sure you're on Google Scholar Labs and have had some conversations.";
  }

  // Add timestamp
  markdown += `\n\n---\n*Exported on ${new Date().toLocaleString()}*`;
  
  return markdown;
}