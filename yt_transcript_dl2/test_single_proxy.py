#!/usr/bin/env python3
"""
Simple test to verify proxy works with youtube-transcript-api
"""

from requests import Session
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.proxies import GenericProxyConfig  # optional for easier proxy handling

VIDEO_ID = "eisUsOj6HGM"
PROXY = "http://8.219.97.248:80"

print(f"Testing proxy: {PROXY}")
print(f"Video ID: {VIDEO_ID}")
print("-" * 60)

# Using a session with proxies manually
session = Session()
session.proxies = {
    'http': PROXY,
    'https': PROXY
}

# pass session directly
ytt_api = YouTubeTranscriptApi(http_client=session)

try:
    # just fetch transcript directly
    transcript = ytt_api.fetch(VIDEO_ID, languages=['en'])
    print(f"Success! Got {len(transcript)} transcript entries")
    print(f"First entry: {transcript[0].text}")  # snippet object
except Exception as e:
    print(f"Failed: {type(e).__name__}: {e}")
