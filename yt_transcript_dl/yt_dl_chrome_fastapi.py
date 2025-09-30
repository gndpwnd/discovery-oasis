from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import os
import re
from pathlib import Path

app = FastAPI(title="YouTube Transcript API")

# Enable CORS for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Chrome extensions need this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
DOWNLOAD_FOLDER = "./yt_transcripts_chrome"
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)


class TranscriptData(BaseModel):
    videoId: str
    title: str
    url: str
    channel: str
    uploadDate: str
    views: str
    extractedAt: str
    transcript: str | None = None
    transcriptAvailable: bool = False


def sanitize_filename(name: str) -> str:
    """Sanitize filename by removing invalid characters"""
    # Remove invalid characters
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    # Limit length
    return name[:100]


def create_markdown_content(data: TranscriptData) -> str:
    """Create formatted markdown content"""
    content = f"""# {data.title}

**Video ID:** {data.videoId}

**URL:** {data.url}

**Channel:** {data.channel}

**Upload Date:** {data.uploadDate}

**Views:** {data.views}

**Extracted At:** {data.extractedAt}

---

## Transcript

"""
    
    if data.transcriptAvailable and data.transcript:
        content += f"{data.transcript}\n"
    else:
        content += "*No transcript available for this video.*\n"
    
    return content


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "YouTube Transcript API",
        "download_folder": DOWNLOAD_FOLDER
    }


@app.post("/transcript")
async def save_transcript(data: TranscriptData):
    try:
        # Create timestamp in MMDDHHMMSS format
        now = datetime.now()
        timestamp = now.strftime("%m%d%H%M%S")
        
        # Create filename
        sanitized_title = sanitize_filename(data.title)
        filename = f"{sanitized_title}_{data.videoId}_{timestamp}.md"
        
        # Create markdown content
        markdown_content = create_markdown_content(data)
        
        # Save to file
        filepath = Path(DOWNLOAD_FOLDER) / filename
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        return {
            "success": True,
            "filename": filename,
            "filepath": str(filepath.absolute()),
            "transcript_length": len(data.transcript) if data.transcript else 0,
            "has_transcript": data.transcriptAvailable
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stats")
async def get_stats():
    """Get statistics about saved transcripts"""
    try:
        files = list(Path(DOWNLOAD_FOLDER).glob("*.md"))
        return {
            "total_files": len(files),
            "download_folder": DOWNLOAD_FOLDER,
            "recent_files": [f.name for f in sorted(files, key=lambda x: x.stat().st_mtime, reverse=True)[:10]]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)