"""
Main transcript downloader class with proxy racing
"""

import sys
import time
from datetime import datetime
from pathlib import Path
import logging

from config import (
    TRANSCRIPT_DIR, LINKS_DIR, LOG_DIR, PROGRESS_FILE,
    DELAY_BETWEEN_REQUESTS, PROXY_TIMEOUT, PROXIES
)
from youtube_api import YouTubeAPI
from file_handler import FileHandler
from utils import (
    setup_logging, extract_video_id, is_playlist, scan_links_directory
)


class TranscriptDownloader:
    """Main downloader class with proxy racing"""
    
    def __init__(self, max_workers=5, max_racing_proxies=10):
        self.setup_directories()
        self.logger = setup_logging(LOG_DIR)
        self.max_racing_proxies = max_racing_proxies
        self.max_workers = max_workers
        
        # Single YouTube API instance that handles proxy racing internally
        self.youtube_api = YouTubeAPI(PROXIES, self.logger, PROXY_TIMEOUT)
        
        self.file_handler = FileHandler(
            TRANSCRIPT_DIR, LINKS_DIR, PROGRESS_FILE, self.logger
        )
        self.progress = self.file_handler.load_progress()
        self.processed_videos = self.file_handler.scan_existing_transcripts()
        
    def setup_directories(self):
        """Create necessary directories"""
        TRANSCRIPT_DIR.mkdir(exist_ok=True)
        LINKS_DIR.mkdir(exist_ok=True)
        LOG_DIR.mkdir(exist_ok=True)
    
    def process_video(self, url: str) -> bool:
        """Process a single video by racing proxies"""
        video_id = extract_video_id(url)
        if not video_id:
            self.logger.warning(f"Could not extract video ID from: {url}")
            return False
        
        if video_id in self.processed_videos:
            self.logger.info(f"⏭️  Skipping {video_id} (already downloaded)")
            return True
        
        # Check if all proxies are exhausted before starting
        if self.youtube_api.health.all_proxies_exhausted(len(PROXIES)):
            self.logger.error("="*80)
            self.logger.error("⛔ ALL PROXIES EXHAUSTED")
            self.logger.error("All proxies are either dead or rate limited")
            self._log_final_stats()
            self.logger.error("="*80)
            sys.exit(1)
        
        self.logger.info(f"📹 Processing video: {video_id}")
        
        # Race proxies for video info
        video_info = self.youtube_api.get_video_info(url, self.max_racing_proxies)
        time.sleep(1)
        
        # Race proxies for transcript
        transcript, error = self.youtube_api.get_transcript(
            url, video_id, self.max_racing_proxies
        )
        
        # Check if all proxies are exhausted
        if error == "RATE_LIMITED_ALL_PROXIES":
            self.logger.error("="*80)
            self.logger.error("⛔ ALL PROXIES EXHAUSTED")
            self.logger.error("Unable to continue - all proxies are dead or rate limited")
            self._log_final_stats()
            self.logger.error("="*80)
            filename = self.file_handler.save_transcript(video_info, transcript, error)
            self.logger.info(f"Saved error state: {filename.name}")
            sys.exit(1)
        
        filename = self.file_handler.save_transcript(video_info, transcript, error)
        
        if not error:
            self.logger.info(f"✅ Saved: {filename.name}")
            stats = self.youtube_api.health.get_stats()
            self.logger.info(
                f"📊 Proxy Stats - Working: {stats['working']}, "
                f"Dead: {stats['dead']}, Rate-limited: {stats['rate_limited']}"
            )
        else:
            self.logger.info(f"⚠️  Saved with status: {error}")
        
        self.processed_videos.add(video_id)
        
        # Small delay between videos
        time.sleep(1)
        
        return True
    
    def _log_final_stats(self):
        """Log detailed final proxy statistics"""
        stats = self.youtube_api.health.get_stats()
        self.logger.error(f"📊 Final Proxy Statistics:")
        self.logger.error(f"   Total Proxies: {len(PROXIES)}")
        self.logger.error(f"   ✓ Working: {stats['working']}")
        self.logger.error(f"   💀 Dead/Timeout: {stats['dead']}")
        self.logger.error(f"   🚫 Rate Limited: {stats['rate_limited']}")
        self.logger.error(f"   📈 Total Successes: {stats['total_successes']}")
        self.logger.error(f"   📉 Total Failures: {stats['total_failures']}")
    
    def process_playlist(self, url: str):
        """Process a playlist"""
        self.logger.info("="*80)
        self.logger.info("📺 PLAYLIST DETECTED")
        self.logger.info("="*80)
        
        # Check if playlist links already exist
        existing_urls = self.file_handler.check_playlist_links_exist(url)
        
        if existing_urls:
            self.logger.info(f"✓ Using cached playlist with {len(existing_urls)} videos")
            video_urls = existing_urls
        else:
            self.logger.info("🔍 Fetching playlist information...")
            playlist_id, playlist_title, videos = self.youtube_api.get_playlist_videos(
                url, self.max_racing_proxies
            )
            
            if not videos:
                self.logger.error("Could not extract videos from playlist")
                if self.youtube_api.health.all_proxies_exhausted(len(PROXIES)):
                    self.logger.error("="*80)
                    self.logger.error("⛔ ALL PROXIES EXHAUSTED")
                    self.logger.error("Unable to fetch playlist - all proxies are dead or rate limited")
                    self._log_final_stats()
                    self.logger.error("="*80)
                    sys.exit(1)
                return
            
            self.logger.info(f"✓ Found {len(videos)} videos in playlist: {playlist_title}")
            self.file_handler.save_playlist_links(playlist_id, playlist_title, videos)
            video_urls = [v['url'] for v in videos]
        
        self.logger.info("="*80)
        self.logger.info(f"🎬 Starting to process {len(video_urls)} videos from playlist")
        self.logger.info("="*80)
        
        # Process all videos sequentially (but each races proxies internally)
        for i, video_url in enumerate(video_urls, 1):
            self.logger.info(f"\n[{i}/{len(video_urls)}] Processing playlist video...")
            success = self.process_video(video_url)
            if not success:
                # If process_video returns False and exits, we won't reach here
                continue
            
        self.logger.info("="*80)
        self.logger.info(f"✅ Completed processing playlist ({len(video_urls)} videos)")
        self.logger.info("="*80)
    
    def run(self):
        """Main execution loop"""
        self.logger.info("="*80)
        self.logger.info("🚀 Starting YouTube Transcript Downloader (Proxy Racing Mode)")
        self.logger.info(f"🏁 Racing {self.max_racing_proxies} proxies per request")
        self.logger.info(f"📊 Total available proxies: {len(PROXIES)}")
        self.logger.info(f"⏰ Start time: {datetime.now()}")
        self.logger.info("="*80)
        
        # Scan for URLs
        urls = scan_links_directory(LINKS_DIR, self.logger)
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
                if is_playlist(url):
                    self.process_playlist(url)
                else:
                    self.process_video(url)
            except KeyboardInterrupt:
                self.logger.info("\n⚠️  Interrupted by user")
                self.file_handler.save_progress(self.progress)
                sys.exit(0)
            except Exception as e:
                self.logger.error(f"❌ Error processing {url}: {e}", exc_info=True)
        
        self.logger.info("\n" + "="*80)
        self.logger.info("✅ ALL DONE!")
        self.logger.info(f"📁 Transcripts saved to: {TRANSCRIPT_DIR}")
        
        # Log detailed final statistics
        stats = self.youtube_api.health.get_stats()
        self.logger.info(f"📊 Final Proxy Statistics:")
        self.logger.info(f"   Total Proxies: {len(PROXIES)}")
        self.logger.info(f"   ✓ Working: {stats['working']}")
        self.logger.info(f"   💀 Dead/Timeout: {stats['dead']}")
        self.logger.info(f"   🚫 Rate Limited: {stats['rate_limited']}")
        self.logger.info(f"   📈 Total Successes: {stats['total_successes']}")
        self.logger.info(f"   📉 Total Failures: {stats['total_failures']}")
        
        self.logger.info(f"⏰ End time: {datetime.now()}")
        self.logger.info("="*80)