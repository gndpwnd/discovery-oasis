#!/usr/bin/env python3
"""
Check proxies specifically for youtube-transcript-api usage.
Tries HTTPS first, then HTTP if HTTPS fails.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from requests import Session, RequestException
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
from config import PROXIES  # your proxy list

VIDEO_ID = "eisUsOj6HGM"  # test video, can be customized
DEFAULT_TIMEOUT = 10


def format_proxy(proxy):
    """Format proxy as http://host:port"""
    if isinstance(proxy, (list, tuple)):
        if len(proxy) >= 2:
            return f"http://{proxy[0]}:{proxy[1]}"
        return f"http://{proxy[0]}:8080"
    return proxy


def test_proxy(proxy_raw, index, timeout=DEFAULT_TIMEOUT):
    proxy = format_proxy(proxy_raw)
    session = Session()
    session.proxies = {"http": proxy, "https": proxy}
    session.headers.update({"User-Agent": "Mozilla/5.0"})
    
    # Try HTTPS first
    try:
        ytt_api = YouTubeTranscriptApi(http_client=session)
        ytt_api.fetch(VIDEO_ID, languages=['en'])
        return (index, proxy, 'WORKING')
    except (RequestException, TranscriptsDisabled, NoTranscriptFound) as e:
        # HTTPS failed, try HTTP fallback
        try:
            session.proxies = {"http": proxy}  # HTTP only
            ytt_api = YouTubeTranscriptApi(http_client=session)
            ytt_api.fetch(VIDEO_ID, languages=['en'])
            return (index, proxy, 'HTTP_ONLY')
        except Exception as e2:
            # Both failed
            return (index, proxy, 'DEAD')


def main():
    parser = argparse.ArgumentParser(description="Check proxy health for YouTube transcript API")
    parser.add_argument('--max', type=int, default=50, help='Max proxies to test')
    parser.add_argument('--workers', type=int, default=20, help='Concurrent workers')
    args = parser.parse_args()
    
    proxies_to_test = PROXIES[:args.max]
    
    working = []
    http_only = []
    dead = []

    print(f"Testing {len(proxies_to_test)} proxies with {args.workers} workers...\n")
    
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(test_proxy, p, i): i for i, p in enumerate(proxies_to_test)}
        
        completed = 0
        for future in as_completed(futures):
            index, proxy, status = future.result()
            completed += 1
            if status == 'WORKING':
                working.append(proxy)
                print(f"[{completed}/{len(proxies_to_test)}] ✓ WORKING (HTTPS): {proxy}")
            elif status == 'HTTP_ONLY':
                http_only.append(proxy)
                print(f"[{completed}/{len(proxies_to_test)}] ⚠ HTTP only: {proxy}")
            else:
                dead.append(proxy)
                print(f"[{completed}/{len(proxies_to_test)}] 💀 DEAD: {proxy}")

    print("\nSummary:")
    print(f"✓ WORKING (HTTPS): {len(working)}")
    print(f"⚠ HTTP only:      {len(http_only)}")
    print(f"💀 DEAD:           {len(dead)}")


if __name__ == "__main__":
    main()
