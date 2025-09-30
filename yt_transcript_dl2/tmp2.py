# youtube_transcript_xml.py

import requests
import xml.etree.ElementTree as ET
import re
import sys

def get_video_id(url):
    """
    Extract the YouTube video ID from a URL.
    """
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',  # https://www.youtube.com/watch?v=VIDEOID
        r'youtu\.be\/([0-9A-Za-z_-]{11})'   # https://youtu.be/VIDEOID
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def fetch_transcript(video_url, lang='en'):
    video_id = get_video_id(video_url)
    if not video_id:
        print("Invalid YouTube URL.")
        return

    url = f"http://video.google.com/timedtext?lang={lang}&v={video_id}"
    
    response = requests.get(url)
    if response.status_code != 200 or not response.text.strip():
        print("No transcript available for this video.")
        return

    # Parse the XML
    root = ET.fromstring(response.text)
    transcript = []
    for elem in root.findall('text'):
        text = elem.text or ""
        # Remove extra spaces/newlines
        text = re.sub(r'\s+', ' ', text)
        transcript.append(text)

    transcript_text = ' '.join(transcript)
    
    print(f"Transcript for video {video_id}:\n")
    print(transcript_text)

    # Save to file
    with open(f"{video_id}_transcript.txt", "w", encoding="utf-8") as f:
        f.write(transcript_text)
    print(f"\nSaved transcript to {video_id}_transcript.txt")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python youtube_transcript_xml.py <YouTube_URL>")
    else:
        fetch_transcript(sys.argv[1])
