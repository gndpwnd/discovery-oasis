#!/usr/bin/env python3
"""
Robust YouTube Transcript Downloader
Downloads transcripts from YouTube videos and playlists with proxy support

Usage:
    python main.py
"""

from downloader import TranscriptDownloader


if __name__ == "__main__":
    downloader = TranscriptDownloader()
    downloader.run()