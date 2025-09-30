"""
Main transcript downloader class
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
from proxy_manager import ProxyManager
from youtube_api import YouTubeAPI
from file_handler import FileHandler
from utils import (
    setup_logging, extract_video_id, is_playlist, scan_links_directory
)


class TranscriptDownloader:
    """Main downloader class"""
    
    def __init__(self):
        self.setup_directories()
        self.logger = setup_logging(LOG_DIR)
        self.proxy_manager = ProxyManager(PROXIES)
        self.youtube_api = YouTubeAPI(self.proxy_manager, self.logger, PROXY_TIMEOUT)
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
        """Process a single video"""
        video_id = extract_video_id(url)
        if not video_id:
            self.logger.warning(f"Could not extract video ID from: {url}")
            return False
        
        if video_id in self.processed_videos:
            self.logger.info(f"⏭  Skipping {video_id} (already downloaded)")
            return True
        
        self.logger.info(f"Processing video: {video_id}")
        
        video_info = self.youtube_api.get_video_info(url)
        time.sleep(DELAY_BETWEEN_REQUESTS)
        
        transcript, error = self.youtube_api.get_transcript(url, video_id)
        
        # Check if all proxies are exhausted
        if error == "RATE_LIMITED_ALL_PROXIES":
            self.logger.error("="*80)
            self.logger.error("⛔ RATE LIMITED ACROSS ALL PROXIES")
            self.logger.error("Unable to continue - all proxies have been exhausted")
            self.logger.error("="*80)
            filename = self.file_handler.save_transcript(video_info, transcript, error)
            self.logger.info(f"Saved error state: {filename.name}")
            sys.exit(1)
        
        filename = self.file_handler.save_transcript(video_info, transcript, error)
        
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
        existing_urls = self.file_handler.check_playlist_links_exist(url)
        
        if existing_urls:
            self.logger.info(f"✓ Using cached playlist with {len(existing_urls)} videos")
            video_urls = existing_urls
        else:
            self.logger.info("🔍 Fetching playlist information...")
            playlist_id, playlist_title, videos = self.youtube_api.get_playlist_videos(url)
            
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
            self.file_handler.save_playlist_links(playlist_id, playlist_title, videos)
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
        self.logger.info(f"⏰ End time: {datetime.now()}")
        self.logger.info("="*80)