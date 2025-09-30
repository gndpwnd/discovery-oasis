"""
Utility functions for YouTube Transcript Downloader
"""

import re
import logging
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse, parse_qs


def setup_logging(log_dir: Path) -> logging.Logger:
    """Setup logging configuration"""
    log_dir.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_file = log_dir / f'download_{timestamp}.log'
    
    logger = logging.getLogger('transcript_downloader')
    logger.setLevel(logging.INFO)
    logger.handlers = []
    
    formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setFormatter(formatter)
    
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    logger.info(f"Log file: {log_file}")
    return logger


def extract_video_id(url: str) -> Optional[str]:
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


def extract_playlist_id(url: str) -> Optional[str]:
    """Extract playlist ID from URL"""
    parsed = urlparse(url)
    query_params = parse_qs(parsed.query)
    return query_params.get('list', [None])[0]


def is_playlist(url: str) -> bool:
    """Check if URL is a playlist"""
    return 'playlist?list=' in url or '&list=' in url


def sanitize_filename(name: str) -> str:
    """Sanitize filename by removing invalid characters"""
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    return name[:100]


def scan_links_directory(links_dir: Path, logger: logging.Logger) -> list:
    """Scan ./links directory for YouTube URLs"""
    urls = []
    for file in links_dir.glob('*'):
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
                logger.error(f"Error reading {file}: {e}")
    
    # Remove duplicates while preserving order
    seen = set()
    unique_urls = []
    for url in urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)
    
    return unique_urls