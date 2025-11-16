import os
import re
import sys
import time
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# --- CONFIG ---
BASE_URL = "https://youtubetotranscript.com/"
OUTPUT_DIR = "./transcripts"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def load_failed_videos(failed_log_path):
    """Load set of video IDs that previously failed to get transcripts"""
    failed_ids = set()
    
    if not os.path.exists(failed_log_path):
        return failed_ids
    
    try:
        with open(failed_log_path, "r", encoding="utf-8") as f:
            content = f.read()
            # Extract video IDs from URLs in the markdown file
            # Pattern: https://www.youtube.com/watch?v=VIDEO_ID
            matches = re.findall(r'youtube\.com/watch\?v=([0-9A-Za-z_-]{11})', content)
            failed_ids = set(matches)
            if failed_ids:
                print(f"[INFO] Loaded {len(failed_ids)} previously failed video IDs from {os.path.basename(failed_log_path)}")
    except Exception as e:
        print(f"[WARN] Could not load failed videos log: {e}")
    
    return failed_ids

def extract_video_id(url):
    """Extract video ID from YouTube URL"""
    patterns = [
        r'(?:v=|/)([0-9A-Za-z_-]{11}).*',
        r'(?:embed/)([0-9A-Za-z_-]{11})',
        r'(?:watch\?v=)([0-9A-Za-z_-]{11})'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def extract_playlist_id(url):
    """Extract playlist ID from YouTube URL"""
    match = re.search(r'list=([^&]+)', url)
    return match.group(1) if match else None

def is_playlist_url(url):
    """Check if URL is a playlist"""
    # Check if URL contains a playlist parameter
    # Playlist IDs typically start with PL, UU, LL, RD, or OL
    return 'list=' in url and any(x in url for x in ['list=PL', 'list=UU', 'list=LL', 'list=RD', 'list=OL'])

def get_playlist_videos(driver, playlist_url):
    """Extract all video URLs and titles from a playlist"""
    print(f"[PLAYLIST] Loading playlist: {playlist_url}")
    driver.get(playlist_url)
    time.sleep(5)
    
    # Get playlist title
    try:
        playlist_title = driver.find_element(By.CSS_SELECTOR, "h1.style-scope.ytd-playlist-header-renderer").text
        print(f"[PLAYLIST] Title: {playlist_title}")
    except:
        playlist_title = "Unknown Playlist"
    
    # Scroll to load all videos
    last_height = driver.execute_script("return document.documentElement.scrollHeight")
    while True:
        driver.execute_script("window.scrollTo(0, document.documentElement.scrollHeight);")
        time.sleep(2)
        new_height = driver.execute_script("return document.documentElement.scrollHeight")
        if new_height == last_height:
            break
        last_height = new_height
    
    # Extract video elements
    videos = []
    try:
        video_elements = driver.find_elements(By.CSS_SELECTOR, "ytd-playlist-video-renderer")
        for elem in video_elements:
            try:
                title_elem = elem.find_element(By.ID, "video-title")
                video_title = title_elem.get_attribute("title")
                video_url = title_elem.get_attribute("href")
                
                # Clean URL (remove playlist params to get base video URL)
                if video_url and 'watch?v=' in video_url:
                    video_id = extract_video_id(video_url)
                    clean_url = f"https://www.youtube.com/watch?v={video_id}"
                    videos.append({
                        'url': clean_url,
                        'title': video_title,
                        'id': video_id
                    })
            except Exception as e:
                print(f"[WARN] Could not extract video info: {e}")
                continue
        
        print(f"[PLAYLIST] Found {len(videos)} videos")
        return playlist_title, videos
    except Exception as e:
        print(f"[ERROR] Failed to extract playlist videos: {e}")
        return playlist_title, []

def save_playlist_manifest(playlist_id, playlist_title, videos):
    """Save playlist manifest file"""
    playlist_dir = os.path.join(OUTPUT_DIR, f"list_{playlist_id}")
    os.makedirs(playlist_dir, exist_ok=True)
    
    manifest_path = os.path.join(playlist_dir, f"list_{playlist_id}.md")
    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write(f"# {playlist_title}\n\n")
        f.write(f"**Playlist ID:** {playlist_id}\n")
        f.write(f"**Date Scraped:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"**Total Videos:** {len(videos)}\n\n")
        f.write("## Videos\n\n")
        for i, video in enumerate(videos, 1):
            f.write(f"{i}. [{video['title']}]({video['url']}) - `{video['id']}`\n")
    print(f"[SAVED] Playlist manifest: {manifest_path}")
    return playlist_dir

def log_failed_video(url, video_title, reason="No transcript available", failed_log_path=None):
    """Log videos that failed to get transcripts"""
    if failed_log_path is None:
        failed_log = os.path.join(OUTPUT_DIR, "transcribe.md")
    else:
        failed_log = failed_log_path
    
    # Check if file exists and read existing content
    if os.path.exists(failed_log):
        with open(failed_log, "r", encoding="utf-8") as f:
            content = f.read()
            # Check if this URL is already logged
            if url in content:
                return
    
    # Append to log file
    with open(failed_log, "a", encoding="utf-8") as f:
        if not os.path.exists(failed_log) or os.path.getsize(failed_log) == 0:
            # Write header if file is empty
            f.write("# Videos to Transcribe Manually\n\n")
            f.write(f"**Last Updated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("## Failed Videos\n\n")
        
        f.write(f"- [{video_title}]({url})\n")
        f.write(f"  - **Reason:** {reason}\n")
        f.write(f"  - **Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
    
    print(f"[LOGGED] Added to {os.path.basename(failed_log)}: {video_title}")

def get_transcript(driver, url, video_title="Unknown Title", save_dir=None, failed_video_ids=None, failed_log_path=None):
    """Get transcript for a single video"""
    video_id = extract_video_id(url)
    if not video_id:
        print(f"[ERROR] Could not extract video ID from {url}")
        return None
    
    # Use provided directory or default OUTPUT_DIR
    if save_dir is None:
        save_dir = OUTPUT_DIR
    
    # Check if video previously failed
    if failed_video_ids and video_id in failed_video_ids:
        print(f"[SKIP] Video previously failed (no transcript): {video_title}")
        return None
    
    # Check if already processed
    output_file = os.path.join(save_dir, f"transcript_{video_id}.md")
    if os.path.exists(output_file):
        print(f"[SKIP] Transcript already exists: {output_file}")
        return output_file
    
    print(f"[PROCESS] Getting transcript for: {video_title}")
    
    # Navigate directly to transcript page using video ID
    transcript_url = f"{BASE_URL}transcript?v={video_id}"
    driver.get(transcript_url)
    print(f"[OK] Navigated to transcript page")
    time.sleep(3)
    
    # Close any blocking ads/modals
    try:
        # Look for ad modal close buttons
        ad_close_selectors = [
            "button[onclick*='closeAdModal']",
            "button.btn-circle.btn-ghost",
            "#dismiss-button",
            "button.close-button",
            "div.close-button"
        ]
        
        for selector in ad_close_selectors:
            try:
                close_buttons = driver.find_elements(By.CSS_SELECTOR, selector)
                for btn in close_buttons:
                    if btn.is_displayed():
                        btn.click()
                        time.sleep(0.5)
                        print(f"[ACTION] Closed blocking element ({selector})")
                        break
            except:
                continue
                
    except Exception as e:
        print(f"[WARN] Error while closing ads: {e}")
    
    # Wait for transcript or error message
    print("[WAIT] Waiting for transcript...")
    transcript_text = ""
    
    for attempt in range(30):
        time.sleep(2)
        
        # Check for error message first
        try:
            error_div = driver.find_element(By.CSS_SELECTOR, "div.alert.alert-error")
            if "Failed to get transcript" in error_div.text:
                print(f"[ERROR] No transcript available for this video")
                log_failed_video(url, video_title, "Failed to get transcript - no captions available", failed_log_path=failed_log_path)
                # Add to failed set so subsequent runs skip it
                if failed_video_ids is not None:
                    failed_video_ids.add(video_id)
                return None
        except:
            pass  # No error message found, continue checking for transcript
        
        try:
            # Look for the transcript container with span elements
            transcript_spans = driver.find_elements(By.CSS_SELECTOR, "span.transcript-segment")
            if transcript_spans:
                transcript_text = " ".join([s.text.strip() for s in transcript_spans if s.text.strip()])
            
            # Fallback: check for any transcript content
            if not transcript_text:
                transcript_div = driver.find_element(By.ID, "transcript")
                all_spans = transcript_div.find_elements(By.TAG_NAME, "span")
                if all_spans:
                    transcript_text = " ".join([s.text.strip() for s in all_spans if s.text.strip()])
            
            if len(transcript_text) > 50:
                print(f"[SUCCESS] Transcript extracted ({len(transcript_text)} chars)")
                break
        except Exception as e:
            if attempt % 5 == 0:
                print(f"[WAIT] Still waiting... (attempt {attempt})")
    
    if not transcript_text:
        print("[ERROR] No transcript found after waiting")
        log_failed_video(url, video_title, "Timeout waiting for transcript", failed_log_path=failed_log_path)
        # Add to failed set so subsequent runs skip it
        if failed_video_ids is not None:
            failed_video_ids.add(video_id)
        # Save debug HTML
        debug_file = os.path.join(save_dir, f"debug_{video_id}.html")
        with open(debug_file, "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        print(f"[DEBUG] Saved page source to {debug_file}")
        return None
    
    # Save transcript with metadata
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f"# {video_title}\n\n")
        f.write(f"**Video ID:** {video_id}\n")
        f.write(f"**URL:** {url}\n")
        f.write(f"**Date Scraped:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("## Transcript\n\n")
        f.write(transcript_text)
    
    print(f"[SAVED] {output_file}")
    return output_file

def main():
    # Get input file from command line argument, default to list.txt
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    else:
        input_file = "list.txt"
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"[ERROR] Input file not found: {input_file}")
        print(f"[USAGE] python {sys.argv[0]} <input_file.txt>")
        sys.exit(1)
    
    # Load failed videos from previous runs based on input file name
    failed_log_path = f"{input_file}_transcribe.md"
    failed_video_ids = load_failed_videos(failed_log_path)
    
    # Load URLs
    with open(input_file, "r", encoding="utf-8-sig") as f:
        links = [line.strip() for line in f if line.strip()]
    
    print(f"[INFO] Loaded {len(links)} URLs from {input_file}")
    print(f"[INFO] Failed videos log: {failed_log_path}")
    
    # Setup Chrome
    chrome_options = Options()
    # Uncomment to run headless:
    # chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    
    print("[INFO] Launching Chrome...")
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=chrome_options
    )
    driver.set_window_size(1280, 800)
    
    try:
        # Group videos by source (playlist or single)
        playlist_videos = {}  # playlist_id -> (playlist_dir, [videos])
        single_videos = []
        
        # Process each URL
        for url in links:
            if is_playlist_url(url):
                # Handle playlist
                playlist_id = extract_playlist_id(url)
                playlist_dir = os.path.join(OUTPUT_DIR, f"list_{playlist_id}")
                manifest_file = os.path.join(playlist_dir, f"list_{playlist_id}.md")
                
                if os.path.exists(manifest_file):
                    print(f"[INFO] Playlist manifest exists: {manifest_file}")
                    # Parse existing manifest to get videos
                    with open(manifest_file, "r", encoding="utf-8") as f:
                        content = f.read()
                        # Extract video IDs and URLs from markdown
                        video_matches = re.findall(r'\[(.+?)\]\((https://www\.youtube\.com/watch\?v=([0-9A-Za-z_-]{11}))\)', content)
                        videos = [{'title': title, 'url': url, 'id': vid_id} for title, url, vid_id in video_matches]
                        if videos:
                            playlist_videos[playlist_id] = (playlist_dir, videos)
                            print(f"[INFO] Loaded {len(videos)} videos from existing manifest")
                else:
                    # Fetch playlist data
                    playlist_title, videos = get_playlist_videos(driver, url)
                    if videos:
                        playlist_dir = save_playlist_manifest(playlist_id, playlist_title, videos)
                        playlist_videos[playlist_id] = (playlist_dir, videos)
            else:
                # Single video
                video_id = extract_video_id(url)
                single_videos.append({
                    'url': url,
                    'title': f"Video {video_id}",
                    'id': video_id
                })
        
        # Process playlist videos
        for playlist_id, (playlist_dir, videos) in playlist_videos.items():
            print(f"\n{'='*80}")
            print(f"[PLAYLIST] Processing playlist {playlist_id} ({len(videos)} videos)")
            print(f"[PLAYLIST] Save directory: {playlist_dir}")
            print(f"{'='*80}\n")
            
            for idx, video in enumerate(videos, 1):
                print(f"\n[{idx}/{len(videos)}] {video['title']}")
                get_transcript(driver, video['url'], video['title'], save_dir=playlist_dir, failed_video_ids=failed_video_ids, failed_log_path=failed_log_path)
                time.sleep(2)  # Be nice to the server
        
        # Process single videos
        if single_videos:
            print(f"\n{'='*80}")
            print(f"[INFO] Processing {len(single_videos)} single videos")
            print(f"{'='*80}\n")
            
            for idx, video in enumerate(single_videos, 1):
                print(f"\n[{idx}/{len(single_videos)}] {video['title']}")
                get_transcript(driver, video['url'], video['title'], failed_video_ids=failed_video_ids, failed_log_path=failed_log_path)
                time.sleep(2)  # Be nice to the server
        
    finally:
        driver.quit()
        print("\n[COMPLETE] All videos processed")

if __name__ == "__main__":
    main()