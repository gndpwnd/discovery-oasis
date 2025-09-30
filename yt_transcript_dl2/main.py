#!/usr/bin/env python3
"""
Robust YouTube Transcript Downloader (Concurrent Version)
Downloads transcripts from YouTube videos and playlists with proxy support

Usage:
    python main.py                    # Default: 5 workers
    python main.py --workers 10       # Custom number of workers
    python main.py --workers 1        # Sequential (like before)
"""

import argparse
from downloader import TranscriptDownloader


def main():
    parser = argparse.ArgumentParser(
        description='YouTube Transcript Downloader with concurrent processing'
    )
    parser.add_argument(
        '--workers', 
        type=int, 
        default=5,
        help='Number of concurrent workers (default: 5)'
    )
    
    args = parser.parse_args()
    
    # Validate workers
    if args.workers < 1:
        print("Error: workers must be at least 1")
        return
    if args.workers > 20:
        print("Warning: More than 20 workers may cause issues. Limiting to 20.")
        args.workers = 20
    
    downloader = TranscriptDownloader(max_workers=args.workers)
    downloader.run()


if __name__ == "__main__":
    main()