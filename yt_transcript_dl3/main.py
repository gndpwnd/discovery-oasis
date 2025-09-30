# yt_transcript_manager.py
# -*- coding: utf-8 -*-
import time
import datetime
from pathlib import Path
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
from yt_dlp import YoutubeDL

# CONFIG
LINKS_DIR = Path("./links")
TRANSCRIPTS_DIR = Path("./yt_transcripts")
PLAYLIST_ARCHIVES_DIR = Path("./playlist_archives")
LOGS_DIR = Path("./logs")
DELAY_SECONDS = 20

# Ensure directories exist
for d in [LINKS_DIR, TRANSCRIPTS_DIR, PLAYLIST_ARCHIVES_DIR, LOGS_DIR]:
    d.mkdir(exist_ok=True)

def log(message):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {message}")
    with open(LOGS_DIR / "yt_transcript_log.txt", "a", encoding="utf-8") as f:
        f.write(f"[{ts}] {message}\n")

def get_video_id(url: str):
    """Extract the video ID from a YouTube URL"""
    if "watch?v=" in url:
        return url.split("watch?v=")[1].split("&")[0]
    elif "youtu.be/" in url:
        return url.split("youtu.be/")[1].split("?")[0]
    else:
        return None

def fetch_transcript(video_id):
    """Fetch the transcript using YouTubeTranscriptApi"""
    try:
        api = YouTubeTranscriptApi()
        return api.fetch(video_id)  # returns FetchedTranscript object
    except TranscriptsDisabled:
        log(f"Transcripts disabled for {video_id}")
    except NoTranscriptFound:
        log(f"No transcript found for {video_id}")
    except Exception as e:
        log(f"Error fetching transcript for {video_id}: {e}")
    return None

def save_transcript_md(video_title, video_id, transcript):
    # clean up title for filename
    safe_title = "".join(c if c.isalnum() or c in "-_ " else "_" for c in video_title)
    out_file = TRANSCRIPTS_DIR / f"{video_id}_{safe_title}.md"

    # combine transcript text into one block, removing newlines
    transcript_text = " ".join([entry.text for entry in transcript]).replace("\n", " ").strip()

    with open(out_file, "w", encoding="utf-8") as f:
        f.write(f"# {video_title}\n\n")
        f.write(f"**Video ID:** {video_id}\n\n")
        f.write(transcript_text + "\n")

    log(f"Saved Markdown for '{video_title}' -> {out_file}")


def fetch_playlist_videos(playlist_url):
    """Fetch video IDs and titles from a playlist using yt-dlp"""
    ydl_opts = {
        "quiet": True,
        "extract_flat": True,
        "skip_download": True,
    }
    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(playlist_url, download=False)
        if "_type" in info and info["_type"] == "playlist":
            videos = []
            for entry in info["entries"]:
                if entry:
                    videos.append({
                        "id": entry["id"],
                        "title": entry["title"],
                        "url": f"https://www.youtube.com/watch?v={entry['id']}"
                    })
            return info["id"], info.get("title", "Playlist"), videos
    return None, None, []

def fetch_video_title(video_url_or_id):
    """Get a video's title using yt-dlp. Accepts either a full URL or a video id."""
    # If only an id was provided, build a watch URL
    if not video_url_or_id.startswith("http"):
        video_url_or_id = f"https://www.youtube.com/watch?v={video_url_or_id}"
    ydl_opts = {
        "quiet": True,
        "skip_download": True,
    }
    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url_or_id, download=False)
            return info.get("title") if info else None
    except Exception as e:
        log(f"Could not fetch title for {video_url_or_id}: {e}")
        return None

def save_playlist_markdown(playlist_id, playlist_title, videos):
    """Save playlist info and transcript links to a Markdown file"""
    safe_title = "".join(c if c.isalnum() or c in "-_ " else "_" for c in playlist_title)
    md_file = PLAYLIST_ARCHIVES_DIR / f"{playlist_id}_{safe_title}.md"
    with open(md_file, "w", encoding="utf-8") as f:
        f.write(f"# Playlist {playlist_title}\n\n")
        f.write(f"Playlist ID: {playlist_id}\n")
        f.write(f"Total Videos: {len(videos)}\n")
        f.write(f"Created: {datetime.datetime.now().isoformat()}\n\n")
        f.write("## Videos\n\n")
        for idx, video in enumerate(videos, 1):
            f.write(f"{idx}. [{video['title']}]({video['url']})\n")
    log(f"Saved playlist Markdown with transcripts -> {md_file}")

def process_links_file(file_path):
    log(f"Processing file: {file_path}")
    with open(file_path, "r", encoding="utf-8") as f:
        urls = [line.strip() for line in f if line.strip()]

    for url in urls:
        if "playlist" in url:
            log(f"Fetching playlist: {url}")
            playlist_id, playlist_title, videos = fetch_playlist_videos(url)
            if not videos:
                log(f"No videos found in playlist {url}")
                continue

            for video in videos:
                vid_id = video["id"]
                # Check for any existing transcript files that start with the video id
                existing = list(TRANSCRIPTS_DIR.glob(f"{vid_id}*"))
                if existing:
                    log(f"Transcript already exists for {vid_id}, skipping...")
                    continue
                log(f"Fetching transcript for {vid_id}")
                transcript = fetch_transcript(vid_id)
                if transcript:
                    save_transcript_md(video["title"], vid_id, transcript)
                log(f"Waiting {DELAY_SECONDS} seconds to avoid rate limiting...")
                time.sleep(DELAY_SECONDS)

            save_playlist_markdown(playlist_id, playlist_title, videos)

        else:
            # Single video
            vid_id = get_video_id(url)
            if not vid_id:
                log(f"Skipping URL (cannot extract video ID): {url}")
                continue
            # Check for any existing transcript files that start with the video id
            existing = list(TRANSCRIPTS_DIR.glob(f"{vid_id}*"))
            if existing:
                log(f"Transcript already exists for {vid_id}, skipping...")
                continue
            log(f"Fetching transcript for {vid_id}")
            transcript = fetch_transcript(vid_id)
            if transcript:
                # Try to get the video's title to include in the markdown filename
                title = fetch_video_title(url) or vid_id
                save_transcript_md(title, vid_id, transcript)
            log(f"Waiting {DELAY_SECONDS} seconds to avoid rate limiting...")
            time.sleep(DELAY_SECONDS)

def main():
    txt_files = list(LINKS_DIR.glob("*.txt"))
    if not txt_files:
        log(f"No .txt files found in {LINKS_DIR}")
        return
    for file_path in txt_files:
        process_links_file(file_path)

if __name__ == "__main__":
    main()
