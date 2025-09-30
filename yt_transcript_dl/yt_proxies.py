#!/usr/bin/env python3
"""
Robust YouTube Transcript Downloader
Downloads transcripts from YouTube videos and playlists with proxy support
"""

import yt_dlp
import re
import json
import time
import logging
import sys
import random
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from urllib.parse import urlparse, parse_qs

# Configuration
TRANSCRIPT_DIR = Path("./yt_transcripts")
LINKS_DIR = Path("./links")
LOG_DIR = Path("./logs")
PROGRESS_FILE = TRANSCRIPT_DIR / ".progress.json"
DELAY_BETWEEN_REQUESTS = 5  # seconds - reduced since we have delays elsewhere
PROXY_TIMEOUT = 15  # seconds - reduced from default 20

# Proxy list (keeping your existing proxies)
PROXIES = [
    ["47.252.11.233", 443],
    ["154.65.39.8", 80],
    ["8.219.229.53", 9080],
    ["143.198.147.156", 8888],
    ["8.211.49.86", 8008],
    ["158.255.77.168", 80],
    ["38.180.230.188", 1080],
    ["123.30.154.171", 7777],
    ["8.220.204.92", 12000],
    ["94.158.49.82", 3128],
    ["47.237.92.86", 9080],
    ["8.212.165.164", 8081],
    ["188.40.57.101", 80],
    ["192.73.244.36", 80],
    ["107.174.123.200", 80],
    ["109.135.16.145", 8789],
    ["23.247.136.254", 80],
    ["103.214.109.66", 80],
    ["4.245.123.244", 80],
    ["154.118.231.30", 80],
    ["4.195.16.140", 80],
    ["124.108.6.20", 8085],
    ["108.141.130.146", 80],
    ["103.214.109.67", 80],
    ["52.148.130.219", 8080],
    ["213.35.105.30", 8080],
    ["90.162.35.34", 80],
    ["89.58.55.33", 80],
    ["89.58.57.45", 80],
    ["101.1.59.65", 443],
    ["45.152.87.67", 8443],
    ["91.103.120.49", 443],
    ["5.45.126.128", 8080],
    ["195.114.209.50", 80],
    ["176.126.103.194", 44214],
    ["14.251.13.0", 8080],
    ["57.129.81.201", 999],
    ["97.74.87.226", 80],
    ["8.219.97.248", 80],
    ["20.210.76.175", 8561],
    ["45.136.49.130", 8118],
    ["212.2.234.165", 8080],
    ["194.58.57.71", 3128],
    ["133.18.234.13", 80],
    ["32.223.6.94", 80],
    ["103.65.237.92", 5678],
    ["190.58.248.86", 80],
    ["50.122.86.118", 80],
    ["35.197.89.213", 80],
    ["4.156.78.45", 80],
    ["109.248.59.70", 1080],
    ["123.58.219.225", 8080],
    ["156.59.103.43", 8080],
    ["54.198.50.8", 8888],
    ["27.79.248.199", 16000],
    ["185.216.214.205", 8888],
    ["66.29.156.102", 8080],
    ["34.94.98.68", 8080],
    ["157.250.203.234", 8080],
    ["142.171.224.165", 8080],
    ["58.186.177.7", 16000],
    ["94.141.162.36", 1080],
    ["92.67.186.210", 80],
    ["123.141.181.71", 5031],
    ["62.99.138.162", 80],
    ["103.249.120.207", 80],
    ["213.143.113.82", 80],
    ["197.221.234.253", 80],
    ["194.145.200.184", 3128],
    ["84.39.112.144", 3128],
    ["52.67.251.34", 80],
    ["115.77.241.248", 10001],
    ["68.185.57.66", 80],
    ["8.215.12.103", 8001],
    ["8.211.195.173", 9080],
    ["47.91.89.3", 11],
    ["103.126.119.99", 8080],
    ["158.255.77.169", 80],
    ["47.252.29.28", 11222],
    ["213.230.121.73", 3128],
    ["128.199.202.122", 8080],
    ["41.191.203.167", 80],
    ["41.59.90.175", 80],
    ["158.255.77.166", 80],
    ["91.84.99.28", 80],
    ["194.104.156.179", 8080],
    ["103.72.89.28", 8097],
    ["154.40.37.211", 8080],
    ["115.126.50.5", 8080],
    ["154.37.152.36", 8080],
    ["129.159.114.120", 8080],
    ["206.237.27.169", 8000],
    ["38.244.18.123", 8080],
    ["38.246.226.224", 8080],
    ["109.195.47.104", 3128],
    ["154.12.89.5", 8080],
    ["156.238.236.132", 8080],
    ["182.253.233.35", 8080],
    ["202.5.60.113", 2727],
    ["202.5.60.205", 2727],
    ["202.5.60.200", 2727],
    ["80.240.23.28", 80],
    ["103.187.86.54", 8182],
    ["20.210.76.178", 8561],
    ["139.59.1.14", 80],
    ["159.203.61.169", 3128],
    ["161.35.70.249", 8080],
    ["160.248.7.177", 80],
    ["31.97.62.219", 8888],
    ["138.68.60.8", 80],
    ["38.244.18.211", 8080],
    ["38.76.144.10", 8080],
    ["45.207.211.184", 8080],
    ["143.42.66.91", 80],
    ["103.214.109.70", 80],
    ["47.250.159.65", 161],
    ["34.22.184.163", 4290],
    ["47.91.121.127", 6379],
    ["154.65.39.7", 80],
    ["188.166.229.121", 80],
    ["171.249.163.170", 1452],
    ["5.10.248.107", 80],
    ["51.159.28.39", 80],
    ["72.217.5.73", 3129],
    ["92.113.150.5", 1080],
    ["27.79.240.0", 16000],
    ["223.205.127.68", 8888],
    ["45.14.224.247", 80],
    ["162.238.123.152", 8888],
    ["65.108.203.36", 18080],
    ["209.97.150.167", 8080],
    ["159.65.221.25", 80],
    ["198.199.86.11", 8080],
    ["185.36.145.215", 80],
    ["152.53.107.230", 80],
    ["91.108.189.126", 8080],
    ["176.162.240.186", 8081],
    ["5.189.170.61", 3128],
    ["84.214.150.146", 8080],
    ["103.184.54.163", 8080],
    ["47.74.157.194", 80],
    ["51.254.78.223", 80],
    ["178.124.197.141", 8080],
    ["41.191.203.162", 80],
    ["45.91.94.197", 80],
    ["160.251.142.232", 80],
    ["47.251.43.115", 33333],
    ["103.214.109.69", 80],
    ["103.88.202.84", 8080],
    ["182.253.151.39", 8080],
    ["179.1.128.57", 999],
    ["163.223.172.27", 1080],
    ["58.187.181.37", 16000],
    ["181.129.183.19", 53281],
    ["65.108.159.129", 8081],
    ["103.133.26.117", 8080],
    ["38.54.71.67", 80],
    ["147.91.22.150", 80],
    ["5.75.196.127", 1080],
    ["154.9.232.122", 8080],
    ["72.10.164.178", 2493],
    ["199.188.204.195", 8080],
    ["80.75.215.19", 8888],
    ["103.118.175.200", 3127],
    ["190.110.226.122", 80],
    ["41.59.90.171", 80],
    ["72.10.160.93", 30557],
    ["41.204.8.1", 8246],
    ["195.86.215.2", 3128],
    ["72.10.160.91", 2473],
    ["78.26.146.16", 443],
    ["88.247.215.249", 3310],
    ["185.216.214.223", 8888],
    ["157.250.203.202", 8080],
    ["42.117.124.249", 16000],
    ["202.5.54.41", 2727],
    ["38.34.15.120", 8080],
    ["38.148.248.35", 8080],
    ["38.92.9.202", 8080],
    ["72.10.160.172", 5699],
    ["103.169.254.9", 6080],
    ["119.82.242.200", 8080],
    ["189.196.18.150", 999],
    ["36.255.86.113", 83],
    ["89.135.59.71", 8090],
    ["102.210.106.1", 83],
    ["103.139.98.69", 8080],
    ["77.37.244.119", 8080],
    ["103.239.253.66", 8080],
    ["114.198.245.51", 8080],
    ["58.69.117.149", 8082],
    ["183.88.212.184", 8080],
    ["103.105.76.65", 8080],
    ["103.133.24.74", 8080],
    ["189.222.69.100", 8080],
    ["170.80.78.211", 8088],
    ["195.62.50.21", 8080],
    ["157.20.207.55", 1111],
    ["213.169.33.8", 8001],
    ["202.5.40.57", 2727],
    ["35.201.216.227", 8080],
    ["77.220.192.96", 8085],
    ["45.147.234.234", 8085],
    ["83.142.52.184", 8085],
    ["185.77.223.49", 8085],
    ["185.101.20.149", 8085],
    ["161.123.151.72", 6056],
    ["178.20.215.75", 8085],
    ["45.39.17.48", 5471],
    ["88.218.45.207", 8085],
    ["173.244.41.116", 6300],
    ["199.96.165.17", 8085],
    ["45.41.179.7", 6542],
    ["193.233.219.161", 8085],
    ["93.177.94.12", 8085],
    ["45.140.205.54", 8085],
    ["38.170.173.129", 7680],
    ["45.10.167.153", 8085],
    ["193.233.210.252", 8085],
    ["185.61.219.218", 8085],
    ["212.119.45.232", 8085],
    ["193.31.127.24", 8085],
    ["212.119.44.195", 8085],
    ["93.177.119.228", 8085],
    ["170.168.97.210", 8085],
    ["45.10.167.30", 8085],
    ["93.177.119.98", 8085],
    ["194.180.237.150", 8085],
    ["45.140.205.124", 8085],
    ["45.147.233.239", 8085],
    ["193.31.127.129", 8085],
    ["179.61.166.137", 6560],
    ["193.163.92.244", 8085],
    ["178.20.30.164", 8085],
    ["140.235.170.229", 8085],
    ["198.37.116.62", 6021],
    ["45.3.43.119", 3129],
    ["38.153.156.51", 9734],
    ["209.50.163.18", 3129],
    ["185.212.115.174", 8085],
    ["209.50.164.12", 3129],
    ["194.99.24.245", 8085],
    ["45.159.23.183", 8085],
    ["45.41.179.12", 6547],
    ["154.29.235.128", 6469],
    ["38.153.140.60", 8938],
    ["67.227.14.72", 6664],
    ["166.88.48.196", 5522],
    ["64.49.38.78", 8085],
    ["193.233.218.53", 8085],
    ["170.168.175.220", 8085],
    ["38.153.133.133", 9537],
    ["136.0.182.93", 6163],
    ["166.88.172.60", 8085],
    ["64.188.100.196", 7944],
    ["146.19.91.137", 8085],
    ["38.170.190.201", 9552],
    ["93.177.95.113", 8085],
    ["193.203.9.65", 8085],
    ["83.171.225.88", 8085],
    ["45.61.100.242", 6510],
    ["166.88.172.146", 8085],
    ["38.170.161.157", 9208],
    ["83.142.53.197", 8085],
    ["193.233.210.253", 8085],
    ["154.30.242.29", 9423],
    ["206.206.69.249", 6513],
    ["83.171.225.184", 8085],
    ["173.234.250.94", 8800],
    ["212.119.46.148", 8085],
    ["64.188.100.69", 7817],
    ["185.89.42.95", 8085],
    ["45.3.48.234", 3129],
]


class ProxyManager:
    """Manages proxy rotation and tracking"""
    
    def __init__(self, proxies: List[str]):
        self.proxies = proxies
        self.current_proxy = None
        self.current_proxy_index = 0
        self.working_proxy = None
        self.all_failed = False
        
    def _format_proxy(self, proxy) -> Optional[str]:
        """Normalize proxy entries to a proxy URL like http://host:port"""
        if proxy is None:
            return None
        # If already includes scheme, return as-is
        if isinstance(proxy, str) and (proxy.startswith('http://') or proxy.startswith('https://') or proxy.startswith('socks5://') or proxy.startswith('socks4://')):
            return proxy
        host = None
        port = None
        if isinstance(proxy, (list, tuple)):
            if len(proxy) >= 2:
                host, port = proxy[0], proxy[1]
            elif len(proxy) == 1:
                host = proxy[0]
        elif isinstance(proxy, str):
            if ':' in proxy:
                host, port = proxy.split(':', 1)
            else:
                host = proxy
        else:
            # Unsupported type
            return None
        try:
            port = int(port) if port is not None else None
        except Exception:
            port = None
        if port:
            return f"http://{host}:{port}"
        else:
            # Default to common HTTP proxy port if not provided
            return f"http://{host}:8080"
        
    def get_proxy(self, force_next: bool = False) -> Optional[str]:
        """Get current proxy or next one if current failed"""
        # If force_next is True, move to next proxy even if we have a working one
        if force_next and self.working_proxy:
            self.working_proxy = None
            self.current_proxy_index += 1
        
        # If we have a working proxy, keep using it (normalize it)
        if self.working_proxy:
            self.current_proxy = self.working_proxy
            return self._format_proxy(self.current_proxy)
        
        # Otherwise get next proxy from list
        if self.current_proxy_index >= len(self.proxies):
            # We've exhausted all proxies
            self.all_failed = True
            return None
        
        self.current_proxy = self.proxies[self.current_proxy_index]
        return self._format_proxy(self.current_proxy)
    
    def mark_success(self):
        """Mark current proxy as working"""
        self.working_proxy = self.current_proxy
    
    def mark_failed(self):
        """Mark current proxy as failed and move to next"""
        self.working_proxy = None
        self.current_proxy_index += 1
    
    def reset(self):
        """Reset to beginning of proxy list"""
        self.current_proxy_index = 0
        self.working_proxy = None
        self.all_failed = False


class TranscriptDownloader:
    """Main downloader class"""
    
    def __init__(self):
        self.setup_directories()
        self.setup_logging()
        self.proxy_manager = ProxyManager(PROXIES)
        self.progress = self.load_progress()
        self.processed_videos = self.scan_existing_transcripts()
        self.consecutive_failures = 0  # Track consecutive proxy failures
        self.max_consecutive_failures = 3  # Force proxy change after this many failures
        
    def setup_directories(self):
        """Create necessary directories"""
        TRANSCRIPT_DIR.mkdir(exist_ok=True)
        LINKS_DIR.mkdir(exist_ok=True)
        LOG_DIR.mkdir(exist_ok=True)
        
    def setup_logging(self):
        """Setup logging configuration"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_file = LOG_DIR / f'download_{timestamp}.log'
        
        self.logger = logging.getLogger('transcript_downloader')
        self.logger.setLevel(logging.INFO)
        self.logger.handlers = []
        
        formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(formatter)
        
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)
        
        self.logger.info(f"Log file: {log_file}")
        
    def load_progress(self) -> Dict:
        """Load progress from JSON file"""
        if PROGRESS_FILE.exists():
            try:
                with open(PROGRESS_FILE, 'r') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def save_progress(self):
        """Save progress to JSON file"""
        with open(PROGRESS_FILE, 'w') as f:
            json.dump(self.progress, f, indent=2)
    
    def scan_existing_transcripts(self) -> set:
        """Scan existing transcripts to avoid re-downloading"""
        video_ids = set()
        for file in TRANSCRIPT_DIR.glob('*.md'):
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    content = f.read(500)
                    match = re.search(r'Video ID:\s*([a-zA-Z0-9_-]+)', content)
                    if match:
                        video_ids.add(match.group(1))
            except:
                continue
        self.logger.info(f"Found {len(video_ids)} existing transcripts")
        return video_ids
    
    def extract_video_id(self, url: str) -> Optional[str]:
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
    
    def extract_playlist_id(self, url: str) -> Optional[str]:
        """Extract playlist ID from URL"""
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)
        return query_params.get('list', [None])[0]
    
    def is_playlist(self, url: str) -> bool:
        """Check if URL is a playlist"""
        return 'playlist?list=' in url or '&list=' in url
    
    def sanitize_filename(self, name: str) -> str:
        """Sanitize filename by removing invalid characters"""
        name = re.sub(r'[<>:"/\\|?*]', '_', name)
        return name[:100]
    
    def scan_links_directory(self) -> List[str]:
        """Scan ./links directory for YouTube URLs"""
        urls = []
        for file in LINKS_DIR.glob('*'):
            if file.suffix in ['.txt', '.md']:
                try:
                    with open(file, 'r', encoding='utf-8') as f:
                        content = f.read()
                        # Find all YouTube URLs
                        found_urls = re.findall(
                            r'https?://(?:www\.)?(?:youtube\.com|youtu\.be)/[^\s\)]+',
                            content
                        )
                        urls.extend(found_urls)
                except Exception as e:
                    self.logger.error(f"Error reading {file}: {e}")
        
        # Remove duplicates while preserving order
        seen = set()
        unique_urls = []
        for url in urls:
            if url not in seen:
                seen.add(url)
                unique_urls.append(url)
        
        return unique_urls
    
    def get_playlist_videos(self, url: str) -> Tuple[Optional[str], Optional[str], List[Dict]]:
        """Get all video URLs from a playlist"""
        for attempt in range(len(self.proxy_manager.proxies)):
            proxy = self.proxy_manager.get_proxy()
            
            if proxy is None:
                self.logger.error("⛔ Rate limited across all proxies for playlist fetch")
                return None, None, []
            
            self.logger.info(f"Fetching playlist via proxy: {self.proxy_manager.current_proxy} (attempt {attempt + 1})")
            
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,
                'proxy': proxy,
                'socket_timeout': PROXY_TIMEOUT,
            }
            
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    
                    if 'entries' not in info:
                        return None, None, []
                    
                    playlist_id = info.get('id', 'unknown')
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
                    
                    # Success! Mark proxy as working
                    self.proxy_manager.mark_success()
                    self.logger.info(f"✓ Successfully fetched playlist with {len(videos)} videos")
                    return playlist_id, playlist_title, videos
                    
            except Exception as e:
                error_msg = str(e)
                self.logger.warning(f"✗ Proxy failed: {error_msg[:150]}")
                self.proxy_manager.mark_failed()
                time.sleep(1)  # Brief delay before trying next proxy
                continue
        
        # All proxies exhausted
        self.logger.error("⛔ Rate limited across all proxies for playlist fetch")
        return None, None, []
    
    def save_playlist_links(self, playlist_id: str, playlist_title: str, videos: List[Dict]):
        """Save playlist video links to file in ./links"""
        filename = LINKS_DIR / f"{playlist_id}_{self.sanitize_filename(playlist_title)}.md"
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f"# {playlist_title}\n\n")
            f.write(f"Playlist ID: {playlist_id}\n")
            f.write(f"Total Videos: {len(videos)}\n")
            f.write(f"Created: {datetime.now().isoformat()}\n\n")
            f.write("## Videos\n\n")
            
            for i, video in enumerate(videos, 1):
                f.write(f"{i}. [{video['title']}]({video['url']})\n")
        
        self.logger.info(f"💾 Saved playlist links to: {filename.name}")
    
    def check_playlist_links_exist(self, url: str) -> Optional[List[str]]:
        """Check if playlist links file exists and return video URLs"""
        playlist_id = self.extract_playlist_id(url)
        if not playlist_id:
            return None
        
        # Look for existing playlist file
        for file in LINKS_DIR.glob(f"{playlist_id}_*.md"):
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    urls = re.findall(
                        r'https?://(?:www\.)?youtube\.com/watch\?v=[^\s\)]+',
                        content
                    )
                    if urls:
                        self.logger.info(f"📋 Found existing playlist file: {file.name} with {len(urls)} videos")
                        return urls
            except:
                continue
        return None
    
    def get_transcript(self, video_url: str, video_id: str) -> Tuple[Optional[str], Optional[str]]:
        """Get transcript using yt-dlp with proxy rotation until success"""
        # Force new proxy if we've had too many consecutive failures
        if self.consecutive_failures >= self.max_consecutive_failures:
            self.logger.warning(f"⚠️  {self.consecutive_failures} consecutive failures - forcing proxy change")
            self.proxy_manager.get_proxy(force_next=True)
            self.consecutive_failures = 0
        
        for attempt in range(len(self.proxy_manager.proxies)):
            proxy = self.proxy_manager.get_proxy()
            
            if proxy is None:
                self.logger.error("⛔ Rate limited across all proxies")
                return None, "RATE_LIMITED_ALL_PROXIES"
            
            if attempt == 0 or not self.proxy_manager.working_proxy:
                self.logger.info(f"Using proxy: {self.proxy_manager.current_proxy} (attempt {attempt + 1})")
            
            ydl_opts = {
                'skip_download': True,
                'writesubtitles': True,
                'writeautomaticsub': True,
                'subtitleslangs': ['en'],
                'subtitlesformat': 'json3',
                'quiet': True,
                'no_warnings': True,
                'proxy': proxy,
                'socket_timeout': PROXY_TIMEOUT,
            }
            
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(video_url, download=False)
                    
                    subtitles = info.get('subtitles', {})
                    automatic_captions = info.get('automatic_captions', {})
                    
                    subtitle_data = subtitles.get('en') or automatic_captions.get('en')
                    
                    if not subtitle_data:
                        # This is not a proxy failure, video truly has no transcript
                        self.proxy_manager.mark_success()
                        self.consecutive_failures = 0  # Reset on success
                        return None, "NO_TRANSCRIPT"
                    
                    subtitle_url = None
                    for fmt in subtitle_data:
                        if fmt.get('ext') == 'json3':
                            subtitle_url = fmt.get('url')
                            break
                    
                    if not subtitle_url:
                        self.proxy_manager.mark_success()
                        self.consecutive_failures = 0  # Reset on success
                        return None, "NO_TRANSCRIPT"
                    
                    import urllib.request
                    with urllib.request.urlopen(subtitle_url, timeout=PROXY_TIMEOUT) as response:
                        subtitle_json = json.loads(response.read().decode('utf-8'))
                    
                    text_parts = []
                    if 'events' in subtitle_json:
                        for event in subtitle_json['events']:
                            if 'segs' in event:
                                for seg in event['segs']:
                                    if 'utf8' in seg:
                                        text_parts.append(seg['utf8'])
                    
                    transcript_text = ' '.join(text_parts)
                    transcript_text = transcript_text.replace('\n', ' ').replace('\r', ' ')
                    transcript_text = re.sub(r'\s+', ' ', transcript_text).strip()
                    
                    # Success! Mark proxy as working
                    self.proxy_manager.mark_success()
                    self.consecutive_failures = 0  # Reset on success
                    return transcript_text, None
                    
            except Exception as e:
                error_msg = str(e)
                
                # Check if it's a video availability issue (not proxy issue)
                if "unavailable" in error_msg.lower() or "private" in error_msg.lower():
                    self.proxy_manager.mark_success()
                    self.consecutive_failures = 0  # Reset on success
                    return None, "VIDEO_UNAVAILABLE"
                
                # It's a proxy/rate limit issue, try next proxy
                self.consecutive_failures += 1
                self.logger.warning(f"✗ Proxy failed: {error_msg[:150]}")
                self.proxy_manager.mark_failed()
                time.sleep(1)  # Brief delay before trying next proxy
                continue
        
        # All proxies exhausted
        self.logger.error("⛔ Rate limited across all proxies")
        return None, "RATE_LIMITED_ALL_PROXIES"
    
    def get_video_info(self, url: str) -> Dict:
        """Get video title and ID"""
        # Force new proxy if we've had too many consecutive failures
        if self.consecutive_failures >= self.max_consecutive_failures:
            self.logger.warning(f"⚠️  {self.consecutive_failures} consecutive failures - forcing proxy change")
            self.proxy_manager.get_proxy(force_next=True)
            self.consecutive_failures = 0
        
        for attempt in range(len(self.proxy_manager.proxies)):
            proxy = self.proxy_manager.get_proxy()
            
            if proxy is None:
                # Fallback to basic info if all proxies fail
                video_id = self.extract_video_id(url)
                return {
                    'title': f'video_{video_id}',
                    'id': video_id,
                    'channel': 'Unknown',
                    'upload_date': 'Unknown'
                }
            
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,
                'proxy': proxy,
                'socket_timeout': PROXY_TIMEOUT,
            }
            
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    self.proxy_manager.mark_success()
                    self.consecutive_failures = 0  # Reset on success
                    return {
                        'title': info.get('title', 'Unknown'),
                        'id': info.get('id', self.extract_video_id(url)),
                        'channel': info.get('channel', 'Unknown'),
                        'upload_date': info.get('upload_date', 'Unknown')
                    }
            except Exception as e:
                self.consecutive_failures += 1
                self.proxy_manager.mark_failed()
                time.sleep(1)
                continue
        
        # Fallback
        video_id = self.extract_video_id(url)
        return {
            'title': f'video_{video_id}',
            'id': video_id,
            'channel': 'Unknown',
            'upload_date': 'Unknown'
        }
    
    def save_transcript(self, video_info: Dict, transcript: str, error: Optional[str]):
        """Save transcript to markdown file"""
        timestamp = datetime.now().strftime("%m%d%H%M%S")
        sanitized_title = self.sanitize_filename(video_info['title'])
        filename = TRANSCRIPT_DIR / f"{sanitized_title}_{video_info['id']}_{timestamp}.md"
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f"# {video_info['title']}\n\n")
            f.write(f"Video ID: {video_info['id']}\n")
            f.write(f"Video URL: https://www.youtube.com/watch?v={video_info['id']}\n")
            f.write(f"Channel: {video_info.get('channel', 'Unknown')}\n")
            f.write(f"Upload Date: {video_info.get('upload_date', 'Unknown')}\n")
            f.write(f"Extracted At: {datetime.now().isoformat()}\n\n")
            f.write("---\n\n")
            f.write("## Transcript\n\n")
            
            if error == "NO_TRANSCRIPT":
                f.write("*No transcript available for this video*\n")
            elif error == "VIDEO_UNAVAILABLE":
                f.write("*Video is unavailable or private*\n")
            elif error == "RATE_LIMITED_ALL_PROXIES":
                f.write("*Rate limited across all proxies - unable to fetch transcript*\n")
            elif error:
                f.write(f"*Error: {error}*\n")
            else:
                f.write(transcript)
        
        return filename
    
    def process_video(self, url: str) -> bool:
        """Process a single video"""
        video_id = self.extract_video_id(url)
        if not video_id:
            self.logger.warning(f"Could not extract video ID from: {url}")
            return False
        
        if video_id in self.processed_videos:
            self.logger.info(f"⏭  Skipping {video_id} (already downloaded)")
            return True
        
        self.logger.info(f"Processing video: {video_id}")
        
        video_info = self.get_video_info(url)
        time.sleep(DELAY_BETWEEN_REQUESTS)
        
        transcript, error = self.get_transcript(url, video_id)
        
        # Check if all proxies are exhausted
        if error == "RATE_LIMITED_ALL_PROXIES":
            self.logger.error("="*80)
            self.logger.error("⛔ RATE LIMITED ACROSS ALL PROXIES")
            self.logger.error("Unable to continue - all proxies have been exhausted")
            self.logger.error("="*80)
            filename = self.save_transcript(video_info, transcript, error)
            self.logger.info(f"Saved error state: {filename.name}")
            sys.exit(1)
        
        filename = self.save_transcript(video_info, transcript, error)
        
        if not error:
            self.logger.info(f"✓ Saved: {filename.name}")
            if self.proxy_manager.working_proxy:
                self.logger.info(f"✓ Using proxy: {self.proxy_manager.working_proxy}")
        else:
            self.logger.info(f"⚠  Saved with status: {error}")
        
        self.processed_videos.add(video_id)
        
        # Add small delay between videos to avoid overloading proxies
        time.sleep(2)
        
        return True
    
    def process_playlist(self, url: str):
        """Process a playlist"""
        self.logger.info("="*80)
        self.logger.info("📺 PLAYLIST DETECTED")
        self.logger.info("="*80)
        
        # Check if playlist links already exist
        existing_urls = self.check_playlist_links_exist(url)
        
        if existing_urls:
            self.logger.info(f"✓ Using cached playlist with {len(existing_urls)} videos")
            video_urls = existing_urls
        else:
            self.logger.info("🔍 Fetching playlist information...")
            playlist_id, playlist_title, videos = self.get_playlist_videos(url)
            
            if not videos:
                if self.proxy_manager.all_failed:
                    self.logger.error("="*80)
                    self.logger.error("⛔ RATE LIMITED ACROSS ALL PROXIES")
                    self.logger.error("Unable to fetch playlist - all proxies exhausted")
                    self.logger.error("="*80)
                    sys.exit(1)
                self.logger.error("Could not extract videos from playlist")
                return
            
            self.logger.info(f"✓ Found {len(videos)} videos in playlist: {playlist_title}")
            self.save_playlist_links(playlist_id, playlist_title, videos)
            video_urls = [v['url'] for v in videos]
        
        self.logger.info("="*80)
        self.logger.info(f"🎬 Starting to process {len(video_urls)} videos from playlist")
        self.logger.info("="*80)
        
        # Process all videos
        for i, video_url in enumerate(video_urls, 1):
            self.logger.info(f"\n[{i}/{len(video_urls)}] Processing playlist video...")
            self.process_video(video_url)  # Will exit program if all proxies fail
            
        self.logger.info("="*80)
        self.logger.info(f"✅ Completed processing playlist ({len(video_urls)} videos)")
        self.logger.info("="*80)
    
    def run(self):
        """Main execution loop"""
        self.logger.info("="*80)
        self.logger.info("🚀 Starting YouTube Transcript Downloader")
        self.logger.info(f"⏰ Start time: {datetime.now()}")
        self.logger.info("="*80)
        
        # Scan for URLs
        urls = self.scan_links_directory()
        self.logger.info(f"📄 Found {len(urls)} URLs to process")
        
        if not urls:
            self.logger.info("ℹ️  No URLs found. Add YouTube links to files in ./links directory")
            return
        
        # Process each URL
        for i, url in enumerate(urls, 1):
            self.logger.info(f"\n{'='*80}")
            self.logger.info(f"[{i}/{len(urls)}] Processing URL: {url}")
            self.logger.info('='*80)
            
            try:
                if self.is_playlist(url):
                    self.process_playlist(url)
                else:
                    self.process_video(url)
            except KeyboardInterrupt:
                self.logger.info("\n⚠️  Interrupted by user")
                self.save_progress()
                sys.exit(0)
            except Exception as e:
                self.logger.error(f"❌ Error processing {url}: {e}", exc_info=True)
        
        self.logger.info("\n" + "="*80)
        self.logger.info("✅ ALL DONE!")
        self.logger.info(f"📁 Transcripts saved to: {TRANSCRIPT_DIR}")
        self.logger.info(f"⏰ End time: {datetime.now()}")
        self.logger.info("="*80)


if __name__ == "__main__":
    downloader = TranscriptDownloader()
    downloader.run()