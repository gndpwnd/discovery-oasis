"""
File handling operations for transcripts and playlists
"""

import json
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Set
import logging


class FileHandler:
    """Handles file operations for transcripts and progress tracking"""
    
    def __init__(self, transcript_dir: Path, links_dir: Path, 
                 progress_file: Path, logger: logging.Logger):
        self.transcript_dir = transcript_dir
        self.links_dir = links_dir
        self.progress_file = progress_file
        self.logger = logger
        
    def load_progress(self) -> Dict:
        """Load progress from JSON file"""
        if self.progress_file.exists():
            try:
                with open(self.progress_file, 'r') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def save_progress(self, progress: Dict):
        """Save progress to JSON file"""
        with open(self.progress_file, 'w') as f:
            json.dump(progress, f, indent=2)
    
    def scan_existing_transcripts(self) -> Set[str]:
        """Scan existing transcripts to avoid re-downloading"""
        video_ids = set()
        for file in self.transcript_dir.glob('*.md'):
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
    
    def save_transcript(self, video_info: Dict, transcript: Optional[str], 
                       error: Optional[str]) -> Path:
        """Save transcript to markdown file"""
        from utils import sanitize_filename
        
        timestamp = datetime.now().strftime("%m%d%H%M%S")
        sanitized_title = sanitize_filename(video_info['title'])
        filename = self.transcript_dir / f"{sanitized_title}_{video_info['id']}_{timestamp}.md"
        
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
    
    def save_playlist_links(self, playlist_id: str, playlist_title: str, 
                           videos: List[Dict]) -> Path:
        """Save playlist video links to file in ./links"""
        from utils import sanitize_filename
        
        filename = self.links_dir / f"{playlist_id}_{sanitize_filename(playlist_title)}.md"
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f"# {playlist_title}\n\n")
            f.write(f"Playlist ID: {playlist_id}\n")
            f.write(f"Total Videos: {len(videos)}\n")
            f.write(f"Created: {datetime.now().isoformat()}\n\n")
            f.write("## Videos\n\n")
            
            for i, video in enumerate(videos, 1):
                f.write(f"{i}. [{video['title']}]({video['url']})\n")
        
        self.logger.info(f"💾 Saved playlist links to: {filename.name}")
        return filename
    
    def check_playlist_links_exist(self, url: str) -> Optional[List[str]]:
        """Check if playlist links file exists and return video URLs"""
        from utils import extract_playlist_id
        
        playlist_id = extract_playlist_id(url)
        if not playlist_id:
            return None
        
        # Look for existing playlist file
        for file in self.links_dir.glob(f"{playlist_id}_*.md"):
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    urls = re.findall(
                        r'https?://(?:www\.)?youtube\.com/watch\?v=[^\s\)]+',
                        content
                    )
                    if urls:
                        self.logger.info(
                            f"📋 Found existing playlist file: {file.name} "
                            f"with {len(urls)} videos"
                        )
                        return urls
            except:
                continue
        return None