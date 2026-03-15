# Chrome Setup Findings

## Problem

Running selenium-based scripts on WSL2 failed — no Chrome binary is installed in the Linux environment.

## What We Tried

### Attempt: Download Chrome for Testing into the repo

Downloaded Chrome for Testing + matching ChromeDriver from Google's CfT API into a local `./chrome/` directory. Multiple issues hit:

1. **Permission errors** — `chrome_crashpad_handler` needed execute permissions too, not just the main `chrome` binary
2. **Version mismatch** — `webdriver_manager` installed ChromeDriver v114, but CfT Chrome was v146, causing crashes
3. **Fixed both** — downloaded both Chrome + ChromeDriver from the same CfT API. Headless mode worked.
4. **GUI mode still failed** — WSL2's WSLg display forwarding is unreliable for full Chrome GUI sessions needed for manual login flows

### Conclusion

Running Chrome GUI apps inside WSL2 is fragile. The scraper needs a visible browser for manual login, which makes WSL2 a poor fit.

## Solution

**Run the script from native Windows** using Windows Python + the system's Chrome browser. This is how the other scripts in this repo (`linkedin_learning_course_downloader.py`, `get_yt_transcripts.py`, etc.) have always worked.

The script uses `webdriver_manager` which automatically finds and manages ChromeDriver to match the system Chrome — no manual binary downloads needed.

## Usage

From Windows (PowerShell/cmd):
```bash
python peterson_acad_scraper.py            # normal mode (visible browser)
python peterson_acad_scraper.py --headless # headless mode
```
