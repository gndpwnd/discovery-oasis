"""
YouTube API interactions using yt-dlp
"""

import yt_dlp
import json
import time
import urllib.request
import re
from typing import Dict, List, Optional, Tuple
from proxy_manager import ProxyManager
import logging


class YouTubeAPI:
    """Handles all YouTube API interactions"""
    
    def __init__(self, proxy_manager: ProxyManager, logger: logging.Logger, 
                 proxy_timeout: int):
        self.proxy_manager = proxy_manager
        self.logger = logger
        self.proxy_timeout = proxy_timeout
        self.consecutive_failures = 0
        self.max_consecutive_failures = 3
        
    def _force_proxy_change_if_needed(self):
        """Force new proxy if we've had too many consecutive failures"""
        if self.consecutive_failures >= self.max_consecutive_failures:
            self.logger.warning(
                f"⚠️  {self.consecutive_failures} consecutive failures - forcing proxy change"
            )
            self.proxy_manager.get_proxy(force_next=True)
            self.consecutive_failures = 0
    
    def get_video_info(self, url: str) -> Dict:
        """Get video title and ID"""
        self._force_proxy_change_if_needed()
        
        for attempt in range(len(self.proxy_manager.proxies)):
            proxy = self.proxy_manager.get_proxy()
            
            if proxy is None:
                # Fallback to basic info if all proxies fail
                from utils import extract_video_id
                video_id = extract_video_id(url)
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
                'socket_timeout': self.proxy_timeout,
            }
            
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    self.proxy_manager.mark_success()
                    self.consecutive_failures = 0
                    return {
                        'title': info.get('title', 'Unknown'),
                        'id': info.get('id', extract_video_id(url)),
                        'channel': info.get('channel', 'Unknown'),
                        'upload_date': info.get('upload_date', 'Unknown')
                    }
            except Exception as e:
                self.consecutive_failures += 1
                self.proxy_manager.mark_failed()
                time.sleep(1)
                continue
        
        # Fallback
        from utils import extract_video_id
        video_id = extract_video_id(url)
        return {
            'title': f'video_{video_id}',
            'id': video_id,
            'channel': 'Unknown',
            'upload_date': 'Unknown'
        }
    
    def get_transcript(self, video_url: str, video_id: str) -> Tuple[Optional[str], Optional[str]]:
        """Get transcript using yt-dlp with proxy rotation until success"""
        self._force_proxy_change_if_needed()
        
        for attempt in range(len(self.proxy_manager.proxies)):
            proxy = self.proxy_manager.get_proxy()
            
            if proxy is None:
                self.logger.error("⛔ Rate limited across all proxies")
                return None, "RATE_LIMITED_ALL_PROXIES"
            
            if attempt == 0 or not self.proxy_manager.working_proxy:
                self.logger.info(
                    f"Using proxy: {self.proxy_manager.current_proxy} (attempt {attempt + 1})"
                )
            
            ydl_opts = {
                'skip_download': True,
                'writesubtitles': True,
                'writeautomaticsub': True,
                'subtitleslangs': ['en'],
                'subtitlesformat': 'json3',
                'quiet': True,
                'no_warnings': True,
                'proxy': proxy,
                'socket_timeout': self.proxy_timeout,
            }
            
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(video_url, download=False)
                    
                    subtitles = info.get('subtitles', {})
                    automatic_captions = info.get('automatic_captions', {})
                    
                    subtitle_data = subtitles.get('en') or automatic_captions.get('en')
                    
                    if not subtitle_data:
                        self.proxy_manager.mark_success()
                        self.consecutive_failures = 0
                        return None, "NO_TRANSCRIPT"
                    
                    subtitle_url = None
                    for fmt in subtitle_data:
                        if fmt.get('ext') == 'json3':
                            subtitle_url = fmt.get('url')
                            break
                    
                    if not subtitle_url:
                        self.proxy_manager.mark_success()
                        self.consecutive_failures = 0
                        return None, "NO_TRANSCRIPT"
                    
                    with urllib.request.urlopen(subtitle_url, timeout=self.proxy_timeout) as response:
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
                    
                    self.proxy_manager.mark_success()
                    self.consecutive_failures = 0
                    return transcript_text, None
                    
            except Exception as e:
                error_msg = str(e)
                
                # Check if it's a video availability issue (not proxy issue)
                if "unavailable" in error_msg.lower() or "private" in error_msg.lower():
                    self.proxy_manager.mark_success()
                    self.consecutive_failures = 0
                    return None, "VIDEO_UNAVAILABLE"
                
                # It's a proxy/rate limit issue, try next proxy
                self.consecutive_failures += 1
                self.logger.warning(f"✗ Proxy failed: {error_msg[:150]}")
                self.proxy_manager.mark_failed()
                time.sleep(1)
                continue
        
        self.logger.error("⛔ Rate limited across all proxies")
        return None, "RATE_LIMITED_ALL_PROXIES"