"""
YouTube API wrapper with proxy racing support
"""

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled, NoTranscriptFound, VideoUnavailable
)
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple
from utils import extract_video_id
import time


class ProxyHealth:
    """Track proxy health status"""
    
    def __init__(self):
        self.dead_proxies = set()
        self.rate_limited_proxies = {}  # proxy -> timestamp
        self.working_proxies = set()
        self.successes = 0
        self.failures = 0
    
    def is_dead(self, proxy: str) -> bool:
        return proxy in self.dead_proxies
    
    def is_rate_limited(self, proxy: str) -> bool:
        if proxy not in self.rate_limited_proxies:
            return False
        # Check if enough time has passed (10 minutes)
        elapsed = time.time() - self.rate_limited_proxies[proxy]
        if elapsed > 600:  # 10 minutes
            del self.rate_limited_proxies[proxy]
            return False
        return True
    
    def mark_dead(self, proxy: str):
        self.dead_proxies.add(proxy)
        self.working_proxies.discard(proxy)
        self.failures += 1
    
    def mark_rate_limited(self, proxy: str):
        self.rate_limited_proxies[proxy] = time.time()
        self.failures += 1
    
    def mark_success(self, proxy: str):
        self.working_proxies.add(proxy)
        self.successes += 1
    
    def get_available_proxies(self, all_proxies: List[str]) -> List[str]:
        """Get list of proxies that aren't dead or rate limited"""
        return [p for p in all_proxies 
                if not self.is_dead(p) and not self.is_rate_limited(p)]
    
    def all_proxies_exhausted(self, total_proxies: int) -> bool:
        """Check if all proxies are either dead or rate limited"""
        unavailable = len(self.dead_proxies) + len(self.rate_limited_proxies)
        return unavailable >= total_proxies
    
    def get_stats(self) -> Dict:
        """Get current statistics"""
        return {
            'working': len(self.working_proxies),
            'dead': len(self.dead_proxies),
            'rate_limited': len(self.rate_limited_proxies),
            'total_successes': self.successes,
            'total_failures': self.failures
        }


class YouTubeAPI:
    """Handles YouTube transcript fetching with proxy racing"""
    
    def __init__(self, proxies: List, logger, proxy_timeout: int):
        self.proxies = [self._format_proxy(p) for p in proxies if p]
        self.logger = logger
        self.proxy_timeout = proxy_timeout
        self.health = ProxyHealth()
    
    def _format_proxy(self, proxy) -> Optional[str]:
        """Format proxy to http://host:port"""
        if isinstance(proxy, str) and proxy.startswith(('http://', 'https://', 'socks')):
            return proxy
        
        if isinstance(proxy, (list, tuple)) and len(proxy) >= 2:
            return f"http://{proxy[0]}:{proxy[1]}"
        
        return None
    
    def _try_proxy_for_transcript(self, video_id: str, proxy: str) -> Optional[Tuple[str, str]]:
        """Try to fetch transcript with a single proxy"""
        if self.health.is_dead(proxy) or self.health.is_rate_limited(proxy):
            return None
        
        try:
            # Create a custom session with this proxy
            session = requests.Session()
            session.proxies = {
                'http': proxy,
                'https': proxy
            }
            session.timeout = self.proxy_timeout
            
            # Create YouTubeTranscriptApi instance with custom session
            api = YouTubeTranscriptApi(http_client=session)
            
            # Fetch transcript list
            transcript_list = api.list_transcripts(video_id)
            
            # Try to find English transcript first, then any available
            try:
                transcript = transcript_list.find_transcript(['en'])
            except NoTranscriptFound:
                # Try to get any generated transcript
                transcript = transcript_list.find_generated_transcript(['en'])
            
            # Get the actual transcript data
            transcript_data = transcript.fetch()
            
            # Format transcript text with timestamps
            text = '\n'.join([f"[{entry.get('start', 0):.2f}s] {entry['text']}" 
                             for entry in transcript_data])
            
            self.health.mark_success(proxy)
            return (text, proxy)
            
        except TranscriptsDisabled:
            self.health.mark_success(proxy)  # Proxy works, video just has no transcript
            return ("NO_TRANSCRIPT", proxy)
            
        except VideoUnavailable:
            self.health.mark_success(proxy)
            return ("VIDEO_UNAVAILABLE", proxy)
        
        except NoTranscriptFound:
            self.health.mark_success(proxy)
            return ("NO_TRANSCRIPT", proxy)
            
        except requests.exceptions.Timeout:
            self.health.mark_dead(proxy)
            return None
            
        except requests.exceptions.ProxyError:
            self.health.mark_dead(proxy)
            return None
        
        except requests.exceptions.ConnectionError:
            self.health.mark_dead(proxy)
            return None
            
        except Exception as e:
            error_str = str(e).lower()
            if '429' in error_str or 'too many requests' in error_str or 'rate' in error_str:
                self.health.mark_rate_limited(proxy)
            else:
                self.health.mark_dead(proxy)
            return None
    
    def get_transcript(self, video_url: str, video_id: str, 
                      max_proxies: int = 10) -> Tuple[Optional[str], Optional[str]]:
        """Race proxies to get transcript"""
        attempt = 0
        max_attempts = 30  # Reduced from 50 since we have better proxy handling
        
        while attempt < max_attempts:
            available = self.health.get_available_proxies(self.proxies)
            
            if not available:
                return None, "RATE_LIMITED_ALL_PROXIES"
            
            proxies_to_race = available[:max_proxies]
            attempt += 1
            
            self.logger.info(f"Racing batch {attempt}: {len(proxies_to_race)} proxies")
            
            # Use a shorter timeout per batch to fail faster
            batch_timeout = self.proxy_timeout + 10
            
            with ThreadPoolExecutor(max_workers=len(proxies_to_race)) as executor:
                futures = {
                    executor.submit(self._try_proxy_for_transcript, video_id, proxy): proxy
                    for proxy in proxies_to_race
                }
                
                try:
                    for future in as_completed(futures, timeout=batch_timeout):
                        try:
                            result = future.result()
                            
                            if result:
                                text, proxy = result
                                
                                # Cancel remaining futures
                                for f in futures:
                                    if not f.done():
                                        f.cancel()
                                
                                if text == "NO_TRANSCRIPT":
                                    self.logger.info(f"Video has no transcript (via {proxy})")
                                    return None, "NO_TRANSCRIPT"
                                elif text == "VIDEO_UNAVAILABLE":
                                    self.logger.info(f"Video unavailable (via {proxy})")
                                    return None, "VIDEO_UNAVAILABLE"
                                else:
                                    self.logger.info(f"Success via {proxy}")
                                    return text, None
                        except Exception as e:
                            # Individual future error, continue to next
                            continue
                            
                except TimeoutError:
                    self.logger.warning(f"Batch {attempt} timed out, trying next batch")
                    # Mark all proxies in this batch as potentially slow
                    for proxy in proxies_to_race:
                        if proxy not in self.health.working_proxies:
                            self.health.mark_dead(proxy)
                    continue
        
        return None, "RATE_LIMITED_ALL_PROXIES"
    
    def get_video_info(self, url: str, max_proxies: int = 10) -> Dict:
        """Get basic video info"""
        video_id = extract_video_id(url)
        
        # Return minimal info - you could expand this to fetch actual metadata
        return {
            'title': f'video_{video_id}',
            'id': video_id,
            'channel': 'Unknown',
            'upload_date': 'Unknown'
        }
    
    def get_playlist_videos(self, url: str, max_proxies: int = 10) -> Tuple[str, str, List[Dict]]:
        """Get playlist videos - placeholder implementation"""
        from utils import extract_playlist_id
        
        playlist_id = extract_playlist_id(url)
        
        # This is a simplified version - you'd need to implement actual playlist fetching
        # with proxy racing similar to transcript fetching
        return playlist_id, f"Playlist_{playlist_id}", []