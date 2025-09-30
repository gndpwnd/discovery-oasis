#!/usr/bin/env python3
"""
Quick proxy health checker - test your proxies before running downloads
"""

import sys
import socket
from concurrent.futures import ThreadPoolExecutor, as_completed
from config import PROXIES, PROXY_TIMEOUT


def format_proxy(proxy):
    """Format proxy to string"""
    if isinstance(proxy, (list, tuple)):
        if len(proxy) >= 2:
            return f"http://{proxy[0]}:{proxy[1]}"
        return f"http://{proxy[0]}:8080"
    return proxy


def test_proxy(proxy_raw, index, timeout=10):
    """Test if a proxy can fetch YouTube transcripts"""
    import urllib.request

    proxy = format_proxy(proxy_raw)
    proxy_handler = urllib.request.ProxyHandler({
        'http': proxy,
        'https': proxy
    })
    opener = urllib.request.build_opener(proxy_handler)
    socket.setdefaulttimeout(timeout)

    # 1️⃣ Test actual transcript endpoint first
    transcript_test_url = "https://www.youtube.com/api/timedtext?v=eisUsOj6HGM&lang=en"
    try:
        req = urllib.request.Request(
            transcript_test_url,
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with opener.open(req, timeout=timeout) as response:
            if response.status == 200:
                return (index, proxy, 'WORKING', response.status)
    except Exception as e:
        transcript_error = str(type(e).__name__)

    # 2️⃣ Fallback: test generic HTTPS
    try:
        homepage_url = "https://www.youtube.com/"
        req = urllib.request.Request(
            homepage_url,
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with opener.open(req, timeout=timeout) as response:
            if response.status == 200:
                # Can fetch homepage, but transcript fails
                return (index, proxy, 'LIMITED', transcript_error)
    except Exception as e:
        pass

    # 3️⃣ Both failed → dead
    return (index, proxy, 'DEAD', transcript_error)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Test proxy health')
    parser.add_argument('--max', type=int, default=50, help='Max proxies to test')
    parser.add_argument('--workers', type=int, default=20, help='Concurrent workers')
    parser.add_argument('--timeout', type=int, default=10, help='Timeout per proxy (seconds)')
    
    args = parser.parse_args()
    
    proxies_to_test = PROXIES[:args.max]
    
    print("="*80)
    print(f"🔍 Testing {len(proxies_to_test)} proxies with {args.workers} workers...")
    print(f"⏱️  Timeout: {args.timeout}s per proxy")
    print("="*80)
    
    working = []
    timeout = []
    rate_limited = []
    dead = []
    
    completed = 0
    
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(test_proxy, proxy, i, args.timeout): i 
            for i, proxy in enumerate(proxies_to_test)
        }
        
        for future in as_completed(futures):
            result = future.result()
            if result:
                idx, proxy, status, extra = result
                completed += 1
                
                if status == 'WORKING':
                    working.append((idx, proxy))
                    print(f"[{completed}/{len(proxies_to_test)}] ✓ WORKING: {proxy}")
                elif status == 'TIMEOUT':
                    timeout.append((idx, proxy))
                    print(f"[{completed}/{len(proxies_to_test)}] ⏱️  TIMEOUT: {proxy}")
                elif status == 'RATE_LIMITED':
                    rate_limited.append((idx, proxy))
                    print(f"[{completed}/{len(proxies_to_test)}] 🚫 RATE LIMITED: {proxy}")
                elif status == 'DEAD':
                    dead.append((idx, proxy))
                    print(f"[{completed}/{len(proxies_to_test)}] 💀 DEAD: {proxy} ({extra})")
                else:
                    dead.append((idx, proxy))
                    print(f"[{completed}/{len(proxies_to_test)}] ❌ FAILED: {proxy}")
    
    print("\n" + "="*80)
    print("📊 RESULTS:")
    print("="*80)
    print(f"✓ Working:       {len(working):3d} ({len(working)/len(proxies_to_test)*100:.1f}%)")
    print(f"⏱️  Timeout:       {len(timeout):3d} ({len(timeout)/len(proxies_to_test)*100:.1f}%)")
    print(f"🚫 Rate Limited:  {len(rate_limited):3d} ({len(rate_limited)/len(proxies_to_test)*100:.1f}%)")
    print(f"💀 Dead/Failed:   {len(dead):3d} ({len(dead)/len(proxies_to_test)*100:.1f}%)")
    print("="*80)
    
    if working:
        print(f"\n✅ Good news! {len(working)} proxies are working")
        print(f"   Recommended: python main.py --race {min(len(working), 15)}")
    else:
        print("\n⚠️  WARNING: No working proxies found!")
        print("   Consider getting a fresh proxy list")
    
    print()


if __name__ == "__main__":
    main()