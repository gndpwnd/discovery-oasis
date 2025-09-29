# Chrome Extension Debugging Guide

## Issues Fixed

### 1. Button ID Mismatch
**Problem:** popup-controller.js was trying to bind to `autoFillBtn` but the HTML had `sendToLLMBtn`

**Fixed:** Changed the event listener setup to use the correct ID

### 2. Buttons Not Enabling
**Problem:** After detecting fields, the "Send to LLM" button remained disabled

**Fixed:** Added button enable logic in the `detectFields()` method:
```javascript
document.getElementById('sendToLLMBtn').disabled = false;
document.getElementById('downloadBtn').disabled = false;
```

### 3. getCurrentValue Method Call
**Problem:** autoFillOrchestrator was calling `this.getCurrentFieldValue()` which didn't exist

**Fixed:** Changed to use the fieldDetector's method:
```javascript
const currentValue = this.fieldDetector.getCurrentValue(fieldData.element);
```

## Testing Steps

### 1. Reload the Extension
1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Find your extension
4. Click the reload icon 🔄

### 2. Test Field Detection
1. Navigate to any page with forms
2. Click the extension icon
3. Click "Detect Form Fields"
4. You should see:
   - Status change to "Scanning page..."
   - Number of fields detected
   - Field preview list
   - "Send to LLM" button should become enabled

### 3. Check Console for Errors
1. Right-click the extension popup → "Inspect"
2. Check the Console tab for errors
3. On the page with forms, open DevTools (F12)
4. Check Console for content script errors

### 4. Test LLM Connection
1. Make sure your FastAPI server is running:
   ```bash
   cd llm_app
   python main.py
   ```
2. In the extension popup, click ⚙️ Settings
3. Verify API URL is `http://localhost:8000/fill-form`
4. Click "Test Connection"
5. Should show "Connection successful!"

### 5. Test Auto-Fill
1. Detect fields first
2. Click "Send to LLM & Auto-Fill"
3. Watch the status messages
4. Fields should start filling automatically

## Common Issues & Solutions

### Extension Not Loading
- Check manifest.json is valid JSON
- Ensure all referenced files exist
- Check Chrome DevTools for syntax errors

### Fields Not Detected
- Page might load forms dynamically - wait a few seconds
- Try clicking "Refresh Detection"
- Check browser console: `universalFormFiller.detectFields()`

### LLM Not Responding
- Verify FastAPI is running: `curl http://localhost:8000/health`
- Check Ollama is running: `ollama list`
- Check FastAPI logs for errors
- Ensure CORS is enabled (already set in main.py)

### Buttons Greyed Out
- Must click "Detect Form Fields" first
- Check popup inspector console for errors
- Verify content script is injected

## Debug Commands

### In Browser Console (on form page):
```javascript
// Check if extension loaded
console.log(universalFormFiller);

// Manually detect fields
universalFormFiller.detectFields();

// Check detected fields
console.log(universalFormFiller.fieldDetector.getDetectedFields());

// Check field elements
console.log(universalFormFiller.fieldDetector.getAllFieldElements());
```

### In Popup Inspector:
```javascript
// Check current tab
popup.currentTab

// Check detected fields
popup.detectedFields

// Manually send message
popup.sendMessageToTab('detectFields').then(console.log);
```

### FastAPI Server:
```bash
# Check health
curl http://localhost:8000/health

# Test endpoint
curl -X POST http://localhost:8000/fill-form \
  -H "Content-Type: application/json" \
  -d '{"fields": {"test": ""}, "url": "test"}'
```

## Improving RAG Documentation

### Adding Question Preferences
Create `llm_app/md_docs/question_preferences.md`:

```markdown
# Question Preferences

## Job Opportunities
- If asked about being contacted for future opportunities: **YES**
- If asked about newsletters or updates: **YES**
- If asked about notifications: **YES**

## Availability
- Willing to relocate: **YES**
- Available to start: **Immediately**
- Able to work weekends: **NO**

## Communication Preferences
- Preferred contact method: **Email**
- Best time to reach: **Weekdays 9am-5pm EST**
```

### Adding Skills Documentation
Create `llm_app/md_docs/technical_skills.md`:

```markdown
# Technical Skills

## Programming Languages
- Python (Expert): 5+ years
- JavaScript (Advanced): 4 years
- TypeScript (Advanced): 2 years

## Frameworks & Libraries
- FastAPI, Flask, Django
- React, Vue.js
- Node.js, Express

## AI/ML Experience
- LLM integration (Ollama, OpenAI)
- RAG systems
- Vector databases
- Prompt engineering

## Tools & Platforms
- Git, Docker, Kubernetes
- AWS, GCP
- CI/CD (GitHub Actions, GitLab CI)
```

### Adding Project Documentation
Create `llm_app/md_docs/projects.md`:

```markdown
# Notable Projects

## Universal Form Filler (Current)
AI-powered Chrome extension that automatically fills web forms using local LLM.

**Technologies:**
- Python, FastAPI
- JavaScript, Chrome Extensions API
- Ollama, RAG
- Markdown documentation

**Achievements:**
- Built modular architecture
- Implemented intelligent field detection
- Created iterative auto-fill system

## Other Projects
[Add your actual projects here with similar structure]
```

## File Watcher Behavior
The RAG system automatically detects changes to markdown files:
- New files are loaded immediately
- Modified files are reloaded
- Deleted files are removed from context

No server restart needed! Just save your markdown files and the LLM will have the updated context.

## Next Steps for Testing

1. **Start with Simple Forms**
   - Test on basic contact forms first
   - Verify text inputs work
   - Check select dropdowns

2. **Test Complex Forms**
   - Multi-step forms
   - Dynamic forms (fields appear based on selections)
   - Various input types (date, checkbox, radio, etc.)

3. **Improve Documentation**
   - Add your actual work experience
   - Include specific skills
   - Document preferences clearly

4. **Monitor LLM Responses**
   - Check FastAPI logs
   - Review LLM's field matching accuracy
   - Adjust prompts if needed

5. **Tune Settings**
   - Adjust iteration delay for faster/slower forms
   - Increase max iterations for complex forms
   - Lower temperature for more consistent responses