#!/usr/bin/env python3
"""
YouTube Transcript Downloader
Downloads transcripts from YouTube videos, playlists, and shorts
Uses only yt-dlp for everything (more reliable, better rate limiting)

Features:
- Auto-retry on errors with exponential backoff
- Skip already downloaded transcripts
- Continuous running until all videos are processed


nohup python main.py --delay 10 &

ps aux | grep main.py
"""

import yt_dlp
import re
from pathlib import Path
from datetime import datetime, timedelta
import time
import json
import argparse
import logging
import sys


def setup_logging(log_file='./transcripts/download.log'):
    """Setup logging to both file and console"""
    # Create logger
    logger = logging.getLogger('transcript_downloader')
    logger.setLevel(logging.INFO)
    
    # Create formatters
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # File handler (detailed logging)
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(detailed_formatter)
    
    # Console handler (same detailed logging)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(detailed_formatter)
    
    # Add handlers
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger


def extract_video_id(url):
    """Extract video ID from various YouTube URL formats"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)',
        r'youtube\.com\/embed\/([^&\n?#]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def is_playlist(url):
    """Check if URL is a playlist"""
    return 'playlist?list=' in url or '&list=' in url


def sanitize_filename(name):
    """Remove invalid characters from filename"""
    return re.sub(r'[<>:"/\\|?*]', '_', name)


def load_progress(progress_file):
    """Load progress from JSON file"""
    if progress_file.exists():
        try:
            with open(progress_file, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}


def save_progress(progress_file, progress_data):
    """Save progress to JSON file"""
    with open(progress_file, 'w') as f:
        json.dump(progress_data, f, indent=2)


def is_transcript_downloaded(video_id, output_dir):
    """Check if transcript already exists for this video ID"""
    # Look for any file containing the video ID
    for file in output_dir.glob('*_transcript.md'):
        try:
            with open(file, 'r', encoding='utf-8') as f:
                content = f.read(500)  # Read first 500 chars to find video ID
                if f'Video ID: {video_id}' in content:
                    return True
        except:
            continue
    return False


def get_transcript_with_ytdlp(video_url, video_id, logger):
    """Get transcript using yt-dlp"""
    ydl_opts = {
        'skip_download': True,
        'writesubtitles': True,
        'writeautomaticsub': True,
        'subtitleslangs': ['en'],
        'subtitlesformat': 'json3',
        'quiet': True,
        'no_warnings': True,
    }
    
    try:
        logger.debug(f"Fetching transcript for video {video_id}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            
            # Try to get manual subtitles first, then automatic
            subtitles = info.get('subtitles', {})
            automatic_captions = info.get('automatic_captions', {})
            
            subtitle_data = None
            
            # Prefer manual English subtitles
            if 'en' in subtitles:
                subtitle_data = subtitles['en']
            elif 'en' in automatic_captions:
                subtitle_data = automatic_captions['en']
            
            if not subtitle_data:
                logger.debug(f"No subtitles found for video {video_id}")
                return None, "NO_TRANSCRIPT"
            
            # Find json3 format
            subtitle_url = None
            for fmt in subtitle_data:
                if fmt.get('ext') == 'json3':
                    subtitle_url = fmt.get('url')
                    break
            
            if not subtitle_url:
                logger.debug(f"No json3 subtitle format found for video {video_id}")
                return None, "NO_TRANSCRIPT"
            
            # Download and parse subtitle
            import urllib.request
            with urllib.request.urlopen(subtitle_url) as response:
                subtitle_json = json.loads(response.read().decode('utf-8'))
            
            # Extract text from subtitle events
            text_parts = []
            if 'events' in subtitle_json:
                for event in subtitle_json['events']:
                    if 'segs' in event:
                        for seg in event['segs']:
                            if 'utf8' in seg:
                                text_parts.append(seg['utf8'])
            
            # Join text with spaces and clean up all newlines and extra whitespace
            transcript_text = ' '.join(text_parts)
            # Remove all newlines, carriage returns, and multiple spaces
            transcript_text = transcript_text.replace('\n', ' ').replace('\r', ' ')
            transcript_text = re.sub(r'\s+', ' ', transcript_text).strip()
            
            logger.debug(f"Successfully extracted transcript for video {video_id} ({len(transcript_text)} chars)")
            return transcript_text, None
            
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error getting transcript for {video_id}: {error_msg}")
        if "HTTP Error 429" in error_msg or "Too Many Requests" in error_msg:
            return None, "RATE_LIMITED"
        elif "unavailable" in error_msg.lower() or "private" in error_msg.lower():
            return None, "VIDEO_UNAVAILABLE"
        else:
            return None, f"ERROR: {error_msg}"


def get_video_info(url):
    """Get video title and ID using yt-dlp"""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                'title': info.get('title', 'Unknown'),
                'id': info.get('id', extract_video_id(url))
            }
    except Exception as e:
        video_id = extract_video_id(url)
        return {
            'title': f'video_{video_id}',
            'id': video_id
        }


def get_playlist_videos(url):
    """Get all video URLs from a playlist using yt-dlp"""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True,
        'playlistend': None,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            if 'entries' not in info:
                return None, []
            
            playlist_title = info.get('title', 'Unknown Playlist')
            videos = []
            
            for entry in info['entries']:
                if entry:
                    video_id = entry.get('id')
                    if video_id:
                        videos.append({
                            'id': video_id,
                            'title': entry.get('title', f'video_{video_id}'),
                            'url': f'https://www.youtube.com/watch?v={video_id}'
                        })
            
            return playlist_title, videos
    except Exception as e:
        print(f"Error extracting playlist: {str(e)}")
        return None, []


def process_single_video(url, output_dir, delay=10, logger=None):
    """Process a single video URL"""
    video_id = extract_video_id(url)
    if not video_id:
        logger.warning(f"Could not extract video ID from: {url}")
        return "SUCCESS"
    
    # Check if already downloaded
    if is_transcript_downloaded(video_id, output_dir):
        logger.info(f"⏭  Skipping {video_id} (already downloaded)")
        return "SUCCESS"
    
    logger.info(f"Processing video: {video_id}")
    
    # Get video info
    video_info = get_video_info(url)
    title = sanitize_filename(video_info['title'])
    
    # Add delay before getting transcript
    time.sleep(delay)
    
    # Get transcript
    transcript, error = get_transcript_with_ytdlp(url, video_id, logger)
    
    # Check for rate limiting
    if error == "RATE_LIMITED":
        logger.warning(f"⚠  Rate limited! Will retry after waiting...")
        return "RATE_LIMITED"
    
    # Save to file
    filename = output_dir / f"{title}_transcript.md"
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(f"# {title}\n\n")
        f.write(f"Video ID: {video_id}\n")
        f.write(f"Video URL: {url}\n\n")
        f.write(f"## Transcript\n\n")
        
        if error == "NO_TRANSCRIPT":
            f.write("*No transcript available for this video (subtitles disabled)*\n")
            logger.info(f"⊘  No transcript available")
        elif error == "VIDEO_UNAVAILABLE":
            f.write("*Video is unavailable or private*\n")
            logger.info(f"⊘  Video unavailable")
        elif error:
            f.write(f"*Error: {error}*\n")
            logger.error(f"✗  Error: {error}")
        else:
            f.write(transcript)
            logger.info(f"✓  Saved: {filename.name}")
    
    return "SUCCESS"


def process_playlist(url, output_dir, delay=10, progress_file=None, logger=None):
    """Process a playlist URL"""
    logger.info(f"Extracting playlist information...")
    
    playlist_title, videos = get_playlist_videos(url)
    
    if not videos:
        logger.error("✗ Could not extract videos from playlist")
        return "SUCCESS"
    
    playlist_title = sanitize_filename(playlist_title)
    logger.info(f"Processing playlist: {playlist_title}")
    logger.info(f"Found {len(videos)} videos")
    
    # Load progress
    progress = load_progress(progress_file) if progress_file else {}
    playlist_key = url
    if playlist_key not in progress:
        progress[playlist_key] = {'completed_videos': []}
    
    filename = output_dir / f"{playlist_title}_transcripts.md"
    
    # Write header once (only if starting fresh)
    if not filename.exists():
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f"# {playlist_title}\n\n")
            f.write(f"Playlist URL: {url}\n\n")
            f.write(f"Total videos: {len(videos)}\n\n")
            f.write("---\n\n")
    
    # Process each video
    for i, video in enumerate(videos):
        # Skip already completed videos
        if video['id'] in progress[playlist_key]['completed_videos']:
            logger.info(f"  [{i + 1}/{len(videos)}] ⏭  Skipping: {video['title'][:50]}... (already downloaded)")
            continue
        
        logger.info(f"  [{i + 1}/{len(videos)}] Processing: {video['title'][:50]}...")
        
        # Add delay before getting transcript
        time.sleep(delay)
        
        # Get transcript
        transcript, error = get_transcript_with_ytdlp(video['url'], video['id'], logger)
        
        # Check for rate limiting
        if error == "RATE_LIMITED":
            logger.warning(f"\n⚠  Rate limited at video {i + 1}!")
            if progress_file:
                save_progress(progress_file, progress)
            return "RATE_LIMITED"
        
        # Append to file immediately to save memory
        with open(filename, 'a', encoding='utf-8') as f:
            f.write(f"## Video {i + 1}: {video['title']}\n\n")
            f.write(f"Video ID: {video['id']}\n")
            f.write(f"URL: {video['url']}\n\n")
            f.write(f"### Transcript\n\n")
            
            if error == "NO_TRANSCRIPT":
                f.write("*No transcript available for this video (subtitles disabled)*\n")
                logger.info(f"    ⊘  No transcript available")
            elif error == "VIDEO_UNAVAILABLE":
                f.write("*Video is unavailable or private*\n")
                logger.info(f"    ⊘  Video unavailable")
            elif error:
                f.write(f"*Error: {error}*\n")
                logger.error(f"    ✗  Error: {error}")
            else:
                f.write(transcript)
                logger.info(f"    ✓  Success")
            
            f.write("\n\n---\n\n")
        
        # Mark as completed
        progress[playlist_key]['completed_videos'].append(video['id'])
        if progress_file:
            save_progress(progress_file, progress)
        
        # Clear transcript from memory
        del transcript
    
    logger.info(f"✓ Completed playlist: {filename.name}")
    return "SUCCESS"


def main():
    """Main function to process links.txt"""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Download YouTube transcripts using yt-dlp')
    parser.add_argument('--delay', type=int, default=10, help='Delay between requests in seconds (default: 10)')
    parser.add_argument('--retry-delay', type=int, default=1800, help='Delay after rate limit in seconds (default: 1800 = 30 min)')
    args = parser.parse_args()
    
    # Use fixed output directory
    output_dir = Path('./transcripts')
    output_dir.mkdir(exist_ok=True)
    
    # Setup logging
    logger = setup_logging(output_dir / 'download.log')
    logger.info("="*80)
    logger.info("Starting YouTube Transcript Downloader")
    logger.info(f"Start time: {datetime.now()}")
    logger.info("="*80)
    
    links_file = Path('./links.txt')
    
    if not links_file.exists():
        logger.error("Error: ./links.txt not found!")
        return
    
    logger.info(f"Output directory: {output_dir}")
    
    # Progress file
    progress_file = output_dir / '.progress.json'
    
    with open(links_file, 'r', encoding='utf-8') as f:
        links = [line.strip() for line in f if line.strip()]
    
    if not links:
        logger.error("No links found in links.txt")
        return
    
    logger.info(f"Found {len(links)} link(s) to process")
    logger.info(f"Delay between requests: {args.delay} seconds")
    logger.info(f"Retry delay after rate limit: {args.retry_delay} seconds ({args.retry_delay // 60} minutes)")
    logger.info("🔄 Script will run continuously until all videos are processed")
    logger.info("")
    
    # Keep trying until all links are processed
    loop_count = 0
    while True:
        loop_count += 1
        logger.info(f"Starting processing loop #{loop_count}")
        all_completed = True
        
        for i, link in enumerate(links, 1):
            logger.info(f"[{i}/{len(links)}] Processing: {link}")
            
            try:
                if is_playlist(link):
                    result = process_playlist(link, output_dir, delay=args.delay, progress_file=progress_file, logger=logger)
                else:
                    result = process_single_video(link, output_dir, delay=args.delay, logger=logger)
                
                if result == "RATE_LIMITED":
                    all_completed = False
                    logger.warning(f"⏸  Pausing for {args.retry_delay // 60} minutes due to rate limiting...")
                    logger.info(f"   Will resume automatically at {datetime.now() + timedelta(seconds=args.retry_delay)}")
                    time.sleep(args.retry_delay)
                    logger.info("🔄 Resuming after rate limit pause...")
                    break  # Break inner loop to restart from beginning
                    
            except KeyboardInterrupt:
                logger.info("⏹  Interrupted by user. Progress has been saved.")
                logger.info("   Run the script again to resume from where you left off.")
                return
            except Exception as e:
                logger.error(f"✗  Error processing {link}: {str(e)}", exc_info=True)
                logger.info(f"   Continuing to next link...")
        
        if all_completed:
            logger.info("="*80)
            logger.info(f"✅ All done! All transcripts saved to: {output_dir}")
            logger.info(f"End time: {datetime.now()}")
            logger.info("="*80)
            break
        else:
            logger.info("🔄 Restarting from beginning to process remaining videos...")
            time.sleep(5)


if __name__ == "__main__":
    main()