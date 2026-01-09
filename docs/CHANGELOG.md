# Discovery Oasis Static Site - Changelog

## 2026-01-09 - Major Enhancement

### Added
- **Modular Configuration System**: YAML-based configs for easy source management
- **Dynamic Source Selection**: Checkboxes for each source within search categories
- **localStorage Persistence**: User preferences saved across sessions
- **Select All/Deselect All**: Quick toggle buttons for each category
- **Horizontal Layout**: Side-by-side source containers with individual scrolling
- **Custom Scrollbars**: Styled scrollbars matching the cyan theme

### Changed
- **Removed AI Search**: All AI sources require DOM manipulation (use Chrome extension)
- **Reduced Scholar Sources**: From 28 to 12 (kept only URL-compatible sources)
- **Improved Layout**: Containers now display horizontally instead of vertically
- **Fixed Scrolling**: Proper overflow handling for both horizontal and vertical scrolling
- **Updated CSS**: Modern flexbox layout with proper flex constraints

### Removed Sources (Use Chrome Extensions)
**Scholar**:
- Scopus, IEEE Xplore, ScienceDirect (complex JavaScript interfaces)
- Springer, Wiley, Nature, PLOS (authentication/paywalls)
- JSTOR, Web of Science (institutional access required)
- Mendeley, Jurn, ArchiveGrid, EconBiz (form-based search)
- PubPeer, SSRN (session-dependent)
- Microsoft Academic (deprecated service)

**AI**:
- All 13 AI sources (ChatGPT, Claude, Perplexity, etc.)
- Reason: All require DOM manipulation for chat interfaces

### Remaining Sources

**Web Search (7)**:
- Google, Bing, DuckDuckGo, Yahoo, Yandex, Mojeek, Searx

**Scholar Search (12)**:
- Google Scholar, PubMed, arXiv, Semantic Scholar
- CORE, BASE, RefSeek, ERIC
- Paperity, Fatcat, WorldCat, CiteSeerX

**Database Search (4)**:
- Internet Archive, Google Dataset Search, Data.gov, Elephind

**PDF Search (12)**:
- Anna's Archive, Library Genesis, Z-Library
- PDF Drive, Ocean of PDF, Project Gutenberg
- IT eBooks, Reddit FreeEBOOKS
- Multiple Google dork searches

### Technical Details

**New Files**:
- `configs/web/sites_config.yaml`
- `configs/scholar/sites_config.yaml`
- `configs/database/sites_config.yaml`
- `configs/pdf/sites_config.yaml`
- `js-yaml.min.js`
- `README.md`
- `USAGE.md`

**Modified Files**:
- `index.html` - Added source selection containers
- `do.js` - Complete rewrite with YAML loading and source management
- `do.css` - Enhanced with flexbox layout and scrollbar styling

### Bug Fixes
- Fixed vertical overflow in source lists
- Fixed inability to scroll to leftmost containers
- Fixed containers wrapping vertically when 3+ selected
- Fixed page scrolling to return to search bar

### Breaking Changes
- AI search category removed from static site
- Scholar sources reduced significantly
- localStorage keys changed (previous preferences will be reset)

### Migration Notes
For sources removed from static site:
1. Use the corresponding Chrome extension (scholar-search-extension or ai-search-extension)
2. Extensions provide form injection for complex search interfaces
3. See COMPONENT_SCOPE.md for decision matrix

## Previous Version (Legacy)

### Original Features
- Hardcoded source arrays in JavaScript
- Simple checkbox filters for categories
- Opens all selected category sources
- No source-level selection
- No preference persistence
