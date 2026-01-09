# Discovery Oasis - User Guide

## Getting Started

### 1. Start the Local Server

```bash
cd docs
python3 -m http.server 8000
```

Open your browser to: **http://localhost:8000**

### 2. Basic Search

1. Type your query in the search box
2. Check the categories you want to search (Web, Scholar, Database, PDF, AI)
3. Click the **Search** button
4. New tabs will open with your search results from all selected sources

### 3. Customizing Sources

When you check a search category (e.g., "Scholar"), a list of sources appears below:

- **Select specific sources**: Check/uncheck individual sources
- **Select All**: Click the "Select All" button to check all sources in that category
- **Deselect All**: Click "Deselect All" (appears after clicking Select All) to uncheck all

### 4. Your Preferences Are Saved

Your source selections are automatically saved in your browser's localStorage:
- Selections persist across browser sessions
- Each category remembers your preferences independently
- No need to reconfigure every time

## Search Categories

### Web Search
General search engines like Google, DuckDuckGo, Bing, Yahoo, etc.

**Best for**: General information, current events, broad topics

### Scholar Search
Academic databases and research engines like Google Scholar, PubMed, arXiv, IEEE Xplore, etc.

**Best for**: Academic research, scientific papers, scholarly articles

### Database Search
Data repositories like Internet Archive, Google Dataset Search, Data.gov, etc.

**Best for**: Datasets, historical records, government data

### PDF Search
Specialized PDF and eBook sources like Anna's Archive, Library Genesis, Z-Library, etc.

**Best for**: Finding books, academic papers, technical documents in PDF format

### AI Search
AI-powered search and chat tools like ChatGPT, Claude, Perplexity, Gemini, etc.

**Best for**: AI-assisted research, conversational queries, synthesis of information

## Tips & Tricks

### Managing Many Tabs

If you're opening many sources:
1. Be selective with which sources you enable
2. Use browser tab grouping features
3. Consider your browser's popup blocker settings

### Keyboard Shortcuts

- Press **Enter** in the search box to execute the search
- Use **Ctrl+Click** (or **Cmd+Click** on Mac) when selecting checkboxes to manage multiple at once

### Finding the Right Sources

**For Academic Research:**
- Enable Scholar category
- Select: Google Scholar, PubMed, Scopus, IEEE Xplore
- Optionally add PDF sources for full-text access

**For Technical Documentation:**
- Enable Web and PDF categories
- Select: Google, DuckDuckGo
- PDF: IT eBooks Search, Library Genesis

**For Current Events:**
- Enable Web category
- Select: Google, Bing, DuckDuckGo

**For Data Analysis:**
- Enable Database category
- Select: Google Dataset Search, Data.gov, Internet Archive

**For AI-Assisted Research:**
- Enable AI category
- Select: Perplexity, Claude, ChatGPT, Consensus

## Troubleshooting

### Sources Not Opening

**Issue**: Tabs aren't opening when you click Search

**Solutions**:
- Check browser's popup blocker settings
- Allow popups for localhost:8000
- Try a different browser

### Checkboxes Not Appearing

**Issue**: No checkboxes show up when selecting a category

**Solutions**:
- Check browser console (F12) for JavaScript errors
- Ensure YAML files are loading (check Network tab)
- Verify web server is running correctly

### Preferences Not Saving

**Issue**: Source selections reset after closing browser

**Solutions**:
- Ensure you're not in incognito/private mode
- Check if localStorage is enabled in browser settings
- Try clearing browser cache and reloading

### YAML Loading Errors

**Issue**: Console shows "Error loading config"

**Solutions**:
- Verify YAML files exist in `configs/[category]/` folders
- Check YAML syntax (use a YAML validator)
- Ensure web server is serving YAML files

## Browser Compatibility

Tested and working on:
- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Privacy Note

- All searches are performed directly to the target websites
- No tracking or analytics on this static site
- Preferences stored locally in your browser
- No data sent to external servers (except the search sites you select)

## Need Help?

Check the main repository README or open an issue on GitHub for assistance.
