import os
import time
from pathlib import Path
from datetime import datetime
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
import yt_dlp

# Config
LINKS_DIR = "links"
OUTPUT_DIR = "videos_md"
DELAY_SECONDS = 10  # pause between transcript downloads

Path(OUTPUT_DIR).mkdir(exist_ok=True)

def log(msg: str):
    """Simple timestamped logger used by this script."""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"{ts} - {msg}")
    
def extract_video_id(url: str) -> str:
    if "youtu.be/" in url:
        return url.split("/")[-1].split("?")[0]
    elif "youtube.com/watch" in url:
        from urllib.parse import parse_qs, urlparse
        query = parse_qs(urlparse(url).query)
        return query.get("v", [None])[0]
    return None

def extract_playlist_id(url: str) -> str:
    if "list=" in url:
        from urllib.parse import parse_qs, urlparse
        query = parse_qs(urlparse(url).query)
        return query.get("list", [None])[0]
    return None

def get_playlist_videos(playlist_url: str) -> list:
    """Get all videos (id, title) from a playlist using yt-dlp."""
    ydl_opts = {'quiet': True, 'extract_flat': True, 'skip_download': True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(playlist_url, download=False)
    videos = info.get('entries', [])
    return [(v['id'], v.get('title', 'No Title')) for v in videos]

def save_video_md(video_id: str, title: str, transcript: list):
    """Save a single video's info and transcript to a Markdown file."""
    safe_title = "".join(c for c in title if c.isalnum() or c in "_- ").strip() or "NoTitle"
    timestamp = datetime.now().isoformat()
    filename = Path(OUTPUT_DIR) / f"{video_id}_{safe_title}_{timestamp}.md"

    with open(filename, "w", encoding="utf-8") as f:
        f.write(f"# {title}\n\n")
        f.write(f"Video ID: {video_id}\n")
        f.write(f"URL: https://www.youtube.com/watch?v={video_id}\n")
        f.write(f"Created: {timestamp}\n\n")
        f.write("## Transcript\n\n")
        if transcript:
            for entry in transcript:
                f.write(f"{entry['start']:.2f} --> {entry['start'] + entry['duration']:.2f}\n")
                f.write(entry['text'] + "\n\n")
        else:
            f.write("_Transcript not available._\n")
    print(f"[+] Saved Markdown: {filename}")

def download_transcript(video_id: str) -> list:
    """Download transcript if available, return it, verbose logging."""
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        log(f"[+] Transcript downloaded successfully for video: {video_id}")
        return transcript
    except TranscriptsDisabled:
        log(f"[!] Transcripts are disabled for video: {video_id}")
        return []
    except NoTranscriptFound:
        log(f"[!] No transcript found for video: {video_id}")
        return []
    except Exception as e:
        log(f"[!] Unexpected error for video {video_id}: {type(e).__name__} - {e}")
        return []

def process_video(video_id: str, title: str):
    log(f"[*] Processing video: {video_id} - {title}")
    transcript = download_transcript(video_id)
    if not transcript:
        log(f"[!] Transcript empty or unavailable for video: {video_id} - saving markdown anyway")
    save_video_md(video_id, title, transcript)
    time.sleep(DELAY_SECONDS)

def main():
    for file_path in Path(LINKS_DIR).glob("*.txt"):
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                url = line.strip()
                if not url:
                    continue

                playlist_id = extract_playlist_id(url)
                if playlist_id:
                    # Skip if playlist markdown already exists
                    existing_files = list(Path(OUTPUT_DIR).glob(f"{playlist_id}_*.md"))
                    if existing_files:
                        print(f"[*] Playlist {playlist_id} already processed, skipping.")
                        continue

                    print(f"[*] Fetching playlist: {playlist_id}")
                    videos = get_playlist_videos(url)
                    for vid_id, title in videos:
                        process_video(vid_id, title)

                else:
                    # Single video
                    video_id = extract_video_id(url)
                    if video_id:
                        title = "No Title"
                        process_video(video_id, title)

if __name__ == "__main__":
    main()
