# Discovery Oasis - Static Web Interface

An enhanced static website that allows you to search multiple sources across different categories simultaneously with configurable source selection.

## Features

- **Multi-Category Search**: Search across Web, Scholar, Database, PDF, and AI sources
- **Dynamic Source Selection**: Select which specific sources to search within each category
- **Persistent Preferences**: Your source selections are saved in localStorage
- **Modular Configuration**: Easy-to-update YAML configuration files for each category
- **Select All/Deselect All**: Quickly toggle all sources in a category

## Quick Start

### Running Locally

Start a local web server to test the site:

```bash
cd docs
python3 -m http.server 8000
```

Then open your browser to: `http://localhost:8000`

### Using the Site

1. **Enter your search query** in the search box
2. **Select search categories** by checking Web, Scholar, Database, PDF, or AI
3. **Configure sources** - When you select a category, checkboxes for that category's sources will appear below
4. **Select/Deselect sources** - Choose which specific sources to include in your search
5. **Click Search** - Opens all selected sources in new tabs with your query

## Configuration Structure

The site uses a modular configuration system with YAML files:

```
docs/
├── index.html          # Main HTML interface
├── do.js              # Application logic
├── do.css             # Styling
├── js-yaml.min.js     # YAML parser library
└── configs/           # Configuration files
    ├── web/
    │   └── sites_config.yaml
    ├── scholar/
    │   └── sites_config.yaml
    ├── database/
    │   └── sites_config.yaml
    ├── pdf/
    │   └── sites_config.yaml
    └── ai/
        └── sites_config.yaml
```

## YAML Configuration Format

Each category's `sites_config.yaml` follows this structure:

```yaml
sites:
  - name: "Site Name"
    baseUrl: "https://example.com/search"
    queryParam: "q"                    # Query parameter name
    extraParams: "param1=value1"       # Optional: additional URL parameters
    usePlus: true                      # Optional: use + instead of %20 for spaces
    searchType: "native"               # Optional: for PDF searches (native/google/google-general)
    defaultChecked: true               # Whether checkbox is checked by default
```

### Configuration Examples

**Standard Search Engine:**
```yaml
- name: Google
  baseUrl: https://www.google.com/search
  queryParam: q
  defaultChecked: true
```

**With Extra Parameters:**
```yaml
- name: Google Scholar
  baseUrl: https://scholar.google.com/scholar
  queryParam: q
  extraParams: hl=en&as_sdt=0%2C2
  defaultChecked: true
```

**PDF Search (Google Dork):**
```yaml
- name: PDF Coffee
  baseUrl: https://pdfcoffee.com
  usePlus: true
  searchType: google
  defaultChecked: true
```

**Direct URL Concatenation:**
```yaml
- name: Library Genesis
  baseUrl: https://libgen.ac/s/
  usePlus: false
  searchType: native
  defaultChecked: true
```

## Adding New Sources

1. Open the appropriate YAML file in `docs/configs/[category]/`
2. Add a new entry following the format above
3. Save the file - changes take effect immediately on page reload

## Technical Details

### How It Works

1. **Initialization**: On page load, the app fetches all YAML configs
2. **Checkbox Generation**: Dynamically creates checkboxes for each source
3. **Preference Loading**: Restores user's previous selections from localStorage
4. **URL Building**: Constructs search URLs based on site configuration and user query
5. **Tab Opening**: Opens all selected sources in new browser tabs

### localStorage Keys

- `web-preferences`: Selected Web sources
- `scholar-preferences`: Selected Scholar sources
- `database-preferences`: Selected Database sources
- `pdf-preferences`: Selected PDF sources
- `ai-preferences`: Selected AI sources

### Browser Compatibility

- Requires modern browser with ES6+ support
- localStorage support required for preference persistence
- Popup blockers may interfere with opening multiple tabs

## Differences from Chrome Extensions

This static site differs from the Discovery Oasis Chrome extensions in the following ways:

| Feature | Chrome Extensions | Static Website |
|---------|------------------|----------------|
| **Search Method** | Auto-fills and submits forms | Opens pre-built search URLs |
| **Configuration** | YAML with form selectors | YAML with URL parameters |
| **Preferences** | Chrome Storage API | localStorage |
| **Tab Management** | Sequential with injection | Parallel with window.open() |
| **Complexity** | High (form detection) | Low (URL construction) |
| **Reliability** | Site-dependent | URL parameter-dependent |

## Troubleshooting

**Sources not loading?**
- Check browser console for YAML parsing errors
- Verify YAML files are accessible (check network tab)
- Ensure web server is serving YAML files with correct MIME type

**Too many tabs opening?**
- Check your browser's popup blocker settings
- Consider deselecting some sources
- Use Select All/Deselect All to manage selections

**Preferences not saving?**
- Ensure localStorage is enabled in your browser
- Check if you're in private/incognito mode (localStorage may not persist)

## License

Part of the Discovery Oasis project.
