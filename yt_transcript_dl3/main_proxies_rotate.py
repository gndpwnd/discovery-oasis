# yt_transcript_manager.py
# -*- coding: utf-8 -*-

'''
free proxy list

https://dashboard.webshare.io/

cron job:
0 */2 * * * /usr/bin/python3 ${HOME}/yt_dlo/yt_dlo_runner.py
'''

import time
import datetime
from pathlib import Path
import os
import sys
import json
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
    CouldNotRetrieveTranscript,
)
from youtube_transcript_api.proxies import GenericProxyConfig
from yt_dlp import YoutubeDL

# --- CONFIG ---
DELAY_SECONDS = 20
MAX_RETRIES_PER_PROXY = 3

# --- BASE PATHS ---
HOME_DIR = Path(os.path.expanduser("~"))
BASE_DIR = HOME_DIR / "yt_dlo"
LINKS_FILE = BASE_DIR / "links" / "links.txt"
TRANSCRIPTS_DIR = BASE_DIR / "yt_transcripts"
PLAYLIST_ARCHIVES_DIR = BASE_DIR / "playlist_archives"
LOGS_DIR = BASE_DIR / "logs"
CONFIG_FILE = BASE_DIR / "config" / "proxies.json"

for d in [BASE_DIR, TRANSCRIPTS_DIR, PLAYLIST_ARCHIVES_DIR, LOGS_DIR, LINKS_FILE.parent, CONFIG_FILE.parent]:
    d.mkdir(parents=True, exist_ok=True)

# Timestamped log file
timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = LOGS_DIR / f"transcripts_{timestamp}.log"

def log(message):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_msg = f"[{ts}] {message}"
    print(log_msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(log_msg + "\n")

# --- Load multi-account config ---
if not CONFIG_FILE.exists():
    log(f"❌ Proxy config file not found: {CONFIG_FILE}")
    sys.exit(1)

with open(CONFIG_FILE, "r") as f:
    cfg_list = json.load(f)

if not isinstance(cfg_list, list):
    log("❌ Proxy config JSON must be a list of accounts")
    sys.exit(1)

# Validate config
ACCOUNTS = []
for cfg in cfg_list:
    username = cfg.get("username")
    password = cfg.get("password")
    proxies = cfg.get("proxies", [])
    if not username or not password or not proxies:
        log(f"❌ Skipping invalid config entry: {cfg}")
        continue
    ACCOUNTS.append({
        "username": username,
        "password": password,
        "proxies": proxies
    })

if not ACCOUNTS:
    log("❌ No valid proxy accounts found in config")
    sys.exit(1)

# --- GLOBAL DEAD PROXIES SET ---
dead_proxies = set()
tried_no_proxy = False

# --- HELPERS ---
def get_video_id(url: str):
    if "watch?v=" in url:
        return url.split("watch?v=")[1].split("&")[0]
    elif "youtu.be/" in url:
        return url.split("youtu.be/")[1].split("?")[0]
    return None

def fetch_transcript(video_id):
    global dead_proxies, tried_no_proxy

    # --- Attempt no proxy first ---
    if not tried_no_proxy:
        tried_no_proxy = True
        log(f"Trying No Proxy for video {video_id}")
        for attempt in range(1, MAX_RETRIES_PER_PROXY + 1):
            try:
                ytt_api = YouTubeTranscriptApi()
                return ytt_api.fetch(video_id)
            except (CouldNotRetrieveTranscript, Exception) as e:
                msg = str(e).lower()
                if "429" in msg or "blocked" in msg or "ip" in msg:
                    log(f"[No Proxy] Rate limit/IP block for {video_id} (retry {attempt}/{MAX_RETRIES_PER_PROXY})")
                    time.sleep(DELAY_SECONDS)
                    continue
                elif isinstance(e, (TranscriptsDisabled, NoTranscriptFound)):
                    return None
                else:
                    log(f"[No Proxy] Unexpected error: {e}")
                    return None
        log("[No Proxy] Failed, moving to proxies...")

    # --- Rotate through all accounts and proxies ---
    for account in ACCOUNTS:
        username = account["username"]
        password = account["password"]
        for ip, port in account["proxies"]:
            proxy_url = f"http://{username}:{password}@{ip}:{port}"
            if proxy_url in dead_proxies:
                continue

            log(f"Trying proxy {proxy_url} for video {video_id}")
            for attempt in range(1, MAX_RETRIES_PER_PROXY + 1):
                try:
                    ytt_api = YouTubeTranscriptApi(
                        proxy_config=GenericProxyConfig(
                            http_url=proxy_url,
                            https_url=proxy_url
                        )
                    )
                    return ytt_api.fetch(video_id)
                except (CouldNotRetrieveTranscript, Exception) as e:
                    msg = str(e).lower()
                    if "429" in msg or "blocked" in msg or "ip" in msg:
                        log(f"[{proxy_url}] Rate limit/IP block for {video_id} (retry {attempt}/{MAX_RETRIES_PER_PROXY})")
                        time.sleep(DELAY_SECONDS)
                        continue
                    elif isinstance(e, (TranscriptsDisabled, NoTranscriptFound)):
                        return None
                    else:
                        log(f"[{proxy_url}] Unexpected error: {e}")
                        return None
            log(f"Proxy {proxy_url} failed for {video_id}, marking as dead")
            dead_proxies.add(proxy_url)

    log(f"All proxies (including No Proxy) exhausted for {video_id}, exiting program.")
    sys.exit(1)

# --- Remaining functions ---
def save_transcript_md(video_title, video_id, transcript):
    safe_title = "".join(c if c.isalnum() or c in "-_ " else "_" for c in video_title)
    out_file = TRANSCRIPTS_DIR / f"{video_id}_{safe_title}.md"
    transcript_text = " ".join([entry.text for entry in transcript]).replace("\n", " ").strip()
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(f"# {video_title}\n\n")
        f.write(f"**Video ID:** {video_id}\n\n")
        f.write(transcript_text + "\n")
    log(f"Saved Markdown for '{video_title}' -> {out_file}")

def fetch_playlist_videos(playlist_url):
    ydl_opts = {"quiet": True, "extract_flat": True, "skip_download": True}
    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(playlist_url, download=False)
        if info.get("_type") == "playlist":
            videos = [
                {"id": e["id"], "title": e["title"], "url": f"https://www.youtube.com/watch?v={e['id']}"}
                for e in info["entries"] if e
            ]
            return info["id"], info.get("title", "Playlist"), videos
    return None, None, []

def fetch_video_title(video_url_or_id):
    if not video_url_or_id.startswith("http"):
        video_url_or_id = f"https://www.youtube.com/watch?v={video_url_or_id}"
    ydl_opts = {"quiet": True, "skip_download": True}
    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url_or_id, download=False)
            return info.get("title") if info else None
    except Exception as e:
        log(f"Could not fetch title for {video_url_or_id}: {e}")
        return None

def save_playlist_markdown(playlist_id, playlist_title, videos):
    safe_title = "".join(c if c.isalnum() or c in "-_ " else "_" for c in playlist_title)
    md_file = PLAYLIST_ARCHIVES_DIR / f"{playlist_id}_{safe_title}.md"
    with open(md_file, "w", encoding="utf-8") as f:
        f.write(f"# Playlist {playlist_id}\n\n")
        f.write(f"Playlist ID: {playlist_id}\n")
        f.write(f"Total Videos: {len(videos)}\n")
        f.write(f"Created: {datetime.datetime.now().isoformat()}\n\n")
        f.write("## Videos\n\n")
        for idx, video in enumerate(videos, 1):
            f.write(f"{idx}. [{video['title']}]({video['url']})\n")
    log(f"Saved playlist Markdown -> {md_file}")

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
            save_playlist_markdown(playlist_id, playlist_title, videos)

            for video in videos:
                vid_id = video["id"]
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
        else:
            vid_id = get_video_id(url)
            if not vid_id:
                log(f"Skipping URL (cannot extract video ID): {url}")
                continue
            existing = list(TRANSCRIPTS_DIR.glob(f"{vid_id}*"))
            if existing:
                log(f"Transcript already exists for {vid_id}, skipping...")
                continue
            log(f"Fetching transcript for {vid_id}")
            transcript = fetch_transcript(vid_id)
            if transcript:
                title = fetch_video_title(url) or vid_id
                save_transcript_md(title, vid_id, transcript)
            log(f"Waiting {DELAY_SECONDS} seconds to avoid rate limiting...")
            time.sleep(DELAY_SECONDS)

def main():
    process_links_file(LINKS_FILE)

if __name__ == "__main__":
    main()
