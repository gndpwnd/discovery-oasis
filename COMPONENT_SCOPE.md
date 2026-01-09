# Discovery Oasis - Component Scope & Purpose

This document defines the clear separation between the static website and Chrome extensions.

## Static Website (docs/)

**Purpose**: Quick multi-source searches using URL parameters only

**Use Cases**:
- General web searches
- Basic scholarly database searches
- Dataset searches
- PDF/eBook searches

**Advantages**:
✅ No installation required
✅ Works in any browser
✅ Easy to update (just edit YAML files)
✅ Fast and lightweight
✅ Source preferences saved locally

**Limitations**:
❌ Cannot manipulate other websites' DOM
❌ Cannot auto-fill forms
❌ Only works with URL-based search
❌ Cannot bypass JavaScript-required interfaces

### Supported Search Types

#### 1. Web Search (7 sources)
All major search engines support URL parameters.
- Google, Bing, DuckDuckGo, Yahoo, Yandex, Mojeek, Searx

#### 2. Scholar Search (12 sources)
URL-friendly scholarly databases only:
- Google Scholar, PubMed, arXiv, Semantic Scholar
- CORE, BASE, RefSeek, ERIC
- Paperity, Fatcat, WorldCat, CiteSeerX

**Excluded** (require Chrome extension):
- Scopus, IEEE Xplore, ScienceDirect, Springer, Wiley, Nature
- JSTOR, Web of Science (authentication required)

#### 3. Database Search (4 sources)
All support URL parameters:
- Internet Archive, Google Dataset Search, Data.gov, Elephind

#### 4. PDF Search (12 sources)
Mix of direct search and Google dorking:
- Anna's Archive, Library Genesis, Z-Library
- PDF Drive, Ocean of PDF, Project Gutenberg
- IT eBooks, Reddit FreeEBOOKS
- Google PDF dorks for specific sites

---

## Chrome Extensions

**Purpose**: Advanced search with form auto-fill and DOM manipulation

### 1. Scholar Search Extension

**For**: Academic databases requiring form injection

**Sources** (28 total):
- Complex interfaces: Scopus, IEEE Xplore, ScienceDirect
- Authentication-required: JSTOR, Web of Science
- JavaScript-heavy: Springer, Wiley, Nature, PLOS
- Form-based: DOAJ, ScienceOpen, PubPeer

**When to Use**:
- Need comprehensive scholarly coverage
- Searching paywalled databases
- Institutions with database subscriptions

### 2. Web Search Extension

**For**: Standard search engines with form injection

**Sources** (7 total):
- Same as static site, but with form auto-fill
- Useful if you want automatic form submission

**When to Use**:
- Prefer form injection over URL parameters
- Want consistent behavior across all engines

### 3. AI Search Extension

**For**: AI chat interfaces and research assistants

**Sources** (13 total):
- ChatGPT, Claude, Gemini, Copilot
- Perplexity, Phind, You.com
- Consensus, Elicit, Deepseek
- Grok, Meta AI, Poe

**Why Extension Required**:
- All AI chat interfaces require DOM manipulation
- No URL-based query injection
- Need to find and fill chat input fields
- Often requires JavaScript interaction

**When to Use**:
- AI-assisted research
- Want to query multiple AI assistants simultaneously
- Comparative AI responses

---

## Decision Matrix: When to Use What?

### Use Static Website When:
- ✅ Quick general searches
- ✅ Open-access scholarly databases
- ✅ PDF/eBook searches
- ✅ No Chrome available
- ✅ Want lightweight tool

### Use Chrome Extensions When:
- ✅ Need form auto-fill
- ✅ Accessing paywalled databases
- ✅ Searching AI chat interfaces
- ✅ Want comprehensive scholarly coverage
- ✅ Have institutional subscriptions

---

## File Structure

```
discovery-oasis/
├── docs/                          # Static Website
│   ├── index.html                 # Main interface
│   ├── do.js                      # URL-based search logic
│   ├── do.css                     # Styling
│   ├── js-yaml.min.js             # YAML parser
│   └── configs/
│       ├── web/                   # 7 search engines
│       ├── scholar/               # 12 URL-friendly databases
│       ├── database/              # 4 data repositories
│       └── pdf/                   # 12 PDF sources
│
├── scholar-search-extension/      # Chrome Extension
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── background.js              # Tab management + DOM injection
│   ├── content.js                 # Debug mode
│   └── sites_config.yaml          # 28 scholarly sources
│
├── web-search-extension/          # Chrome Extension
│   └── sites_config.yaml          # 7 search engines
│
└── ai-search-extension/           # Chrome Extension
    └── sites_config.yaml          # 13 AI assistants
```

---

## Technical Comparison

| Feature | Static Website | Chrome Extensions |
|---------|---------------|------------------|
| **Search Method** | URL parameters | Form injection + submission |
| **Complexity** | Low | High |
| **Installation** | None | Required |
| **Permissions** | None | tabs, scripting, storage, <all_urls> |
| **Cross-Origin** | Blocked | Allowed |
| **DOM Access** | None | Full |
| **Reliability** | High (URL-based) | Medium (selector breakage) |
| **Maintenance** | Easy (update URLs) | Medium (monitor site changes) |
| **Speed** | Fast | Slower (waits for DOM) |

---

## Adding New Sources

### To Static Website:
1. Verify site supports URL parameters
2. Test the search URL format
3. Add to appropriate YAML file:
   ```yaml
   - name: "Site Name"
     baseUrl: https://example.com/search
     queryParam: q
     defaultChecked: true
   ```
4. Refresh browser

### To Chrome Extension:
1. Inspect search form elements
2. Find CSS selector for input field
3. Add to sites_config.yaml:
   ```yaml
   - name: "Site Name"
     baseUrl: https://example.com/
     promptField:
       selector: "#search-input"
       type: input
     defaultChecked: true
   ```
4. Reload extension
5. Test with debug mode

---

## Future Enhancements

### Static Website:
- Add more open-access databases
- Expand PDF sources
- Add news/media aggregators
- Video search sources (YouTube, Vimeo)
- Code repositories (GitHub, GitLab)

### Chrome Extensions:
- Auto-detect broken selectors
- Add retry logic for failed injections
- Support for more academic databases
- Bookmark integration
- Export search history

---

## Maintenance

### Static Website:
- Check URLs quarterly (sites rarely change URL patterns)
- Update YAML configs as needed
- No code changes typically required

### Chrome Extensions:
- Monitor for selector breakage
- Check monthly (sites frequently redesign)
- Update selectors in YAML configs
- Debug mode helps identify issues

---

## Summary

**Static Website**: Simple, fast, URL-based searches for most use cases

**Chrome Extensions**: Powerful, complex, DOM-manipulation for specialized needs

Both tools complement each other. Use the static website for 80% of searches, and Chrome extensions for the remaining 20% that require form injection or authentication.
