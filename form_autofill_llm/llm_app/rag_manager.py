# rag_manager.py - Manages markdown documents and RAG functionality
import os
import asyncio
from pathlib import Path
from typing import List, Dict, Any
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import hashlib

logger = logging.getLogger(__name__)


class MarkdownFileHandler(FileSystemEventHandler):
    """Watches for changes in markdown files"""
    
    def __init__(self, rag_manager):
        self.rag_manager = rag_manager
        
    def on_modified(self, event):
        if event.is_directory or not event.src_path.endswith('.md'):
            return
        logger.info(f"Detected change in: {event.src_path}")
        asyncio.create_task(self.rag_manager.reload_documents())
        
    def on_created(self, event):
        if event.is_directory or not event.src_path.endswith('.md'):
            return
        logger.info(f"New markdown file detected: {event.src_path}")
        asyncio.create_task(self.rag_manager.reload_documents())
        
    def on_deleted(self, event):
        if event.is_directory or not event.src_path.endswith('.md'):
            return
        logger.info(f"Markdown file deleted: {event.src_path}")
        asyncio.create_task(self.rag_manager.reload_documents())


class RAGManager:
    """Manages document loading, chunking, and retrieval"""
    
    def __init__(self, docs_path: str = "./md_docs"):
        self.docs_path = Path(docs_path)
        self.documents = []
        self.doc_hashes = {}
        self.is_initialized = False
        self.observer = None
        
    async def initialize(self):
        """Initialize the RAG manager"""
        # Create docs directory if it doesn't exist
        self.docs_path.mkdir(parents=True, exist_ok=True)
        
        # Load initial documents
        await self.reload_documents()
        
        self.is_initialized = True
        logger.info(f"RAG Manager initialized with {len(self.documents)} documents")
        
    async def reload_documents(self):
        """Reload all markdown documents from the docs directory"""
        logger.info("Reloading markdown documents...")
        
        new_documents = []
        new_hashes = {}
        
        # Find all markdown files
        md_files = list(self.docs_path.glob("*.md"))
        
        if not md_files:
            logger.warning(f"No markdown files found in {self.docs_path}")
            logger.info("Creating example documentation file...")
            self._create_example_doc()
            md_files = list(self.docs_path.glob("*.md"))
        
        for md_file in md_files:
            try:
                with open(md_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Calculate hash to detect changes
                content_hash = hashlib.md5(content.encode()).hexdigest()
                
                # Check if document has changed
                if md_file.name in self.doc_hashes:
                    if self.doc_hashes[md_file.name] == content_hash:
                        # No change, use existing document
                        for doc in self.documents:
                            if doc['filename'] == md_file.name:
                                new_documents.append(doc)
                                break
                        new_hashes[md_file.name] = content_hash
                        continue
                
                # New or changed document
                doc = {
                    'filename': md_file.name,
                    'content': content,
                    'chunks': self._chunk_document(content),
                    'last_modified': md_file.stat().st_mtime
                }
                
                new_documents.append(doc)
                new_hashes[md_file.name] = content_hash
                logger.info(f"Loaded: {md_file.name} ({len(doc['chunks'])} chunks)")
                
            except Exception as e:
                logger.error(f"Error loading {md_file}: {str(e)}")
        
        self.documents = new_documents
        self.doc_hashes = new_hashes
        logger.info(f"Reloaded {len(self.documents)} documents")
        
    def _chunk_document(self, content: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Split document into overlapping chunks"""
        chunks = []
        start = 0
        
        while start < len(content):
            end = start + chunk_size
            chunk = content[start:end]
            
            # Try to break at sentence boundary
            if end < len(content):
                last_period = chunk.rfind('.')
                last_newline = chunk.rfind('\n')
                break_point = max(last_period, last_newline)
                
                if break_point > chunk_size // 2:
                    chunk = chunk[:break_point + 1]
                    end = start + break_point + 1
            
            chunks.append(chunk.strip())
            start = end - overlap
            
        return chunks
    
    def _create_example_doc(self):
        """Create an example markdown documentation file"""
        example_content = """# User Information

## Personal Details
- **Full Name**: John Doe
- **Email**: john.doe@example.com
- **Phone**: +1 (555) 123-4567
- **Location**: Daytona Beach, FL

## Work Experience

### Current Position
**Software Engineer** at Tech Company (2020 - Present)
- Developing full-stack web applications
- Working with Python, JavaScript, and cloud technologies
- Leading team of 3 developers

### Previous Position
**Junior Developer** at Startup Inc (2018 - 2020)
- Built RESTful APIs
- Implemented CI/CD pipelines
- Collaborated with design team

## Education
**Bachelor of Science in Computer Science**
University of Technology (2014 - 2018)
- GPA: 3.8/4.0
- Focus: Software Engineering

## Skills
- **Programming Languages**: Python, JavaScript, Java, C++
- **Frameworks**: FastAPI, React, Node.js
- **Tools**: Git, Docker, AWS
- **Certifications**: AWS Certified Developer

## Preferences
- **Salary Expectations**: $30-35/hour
- **Start Date**: Available immediately
- **Willing to Relocate**: Yes
- **Work Authorization**: US Citizen
"""
        
        example_file = self.docs_path / "user_profile.md"
        with open(example_file, 'w', encoding='utf-8') as f:
            f.write(example_content)
        
        logger.info(f"Created example documentation: {example_file}")
    
    def get_relevant_context(self, query: str, top_k: int = 5) -> str:
        """Retrieve relevant document chunks for a query"""
        if not self.documents:
            return ""
        
        # Simple keyword-based retrieval (can be enhanced with embeddings)
        query_lower = query.lower()
        query_words = set(query_lower.split())
        
        chunk_scores = []
        
        for doc in self.documents:
            for chunk in doc['chunks']:
                chunk_lower = chunk.lower()
                # Calculate simple relevance score
                score = sum(1 for word in query_words if word in chunk_lower)
                
                if score > 0:
                    chunk_scores.append((score, chunk, doc['filename']))
        
        # Sort by score and get top chunks
        chunk_scores.sort(reverse=True, key=lambda x: x[0])
        top_chunks = chunk_scores[:top_k]
        
        if not top_chunks:
            # Return some context from all documents if no matches
            context_parts = []
            for doc in self.documents[:2]:  # First 2 docs
                if doc['chunks']:
                    context_parts.append(f"From {doc['filename']}:\n{doc['chunks'][0]}")
            return "\n\n".join(context_parts)
        
        # Format context
        context_parts = []
        for score, chunk, filename in top_chunks:
            context_parts.append(f"From {filename}:\n{chunk}")
        
        return "\n\n".join(context_parts)
    
    def get_all_context(self) -> str:
        """Get all document content as context"""
        if not self.documents:
            return ""
        
        context_parts = []
        for doc in self.documents:
            context_parts.append(f"=== {doc['filename']} ===\n{doc['content']}")
        
        return "\n\n".join(context_parts)
    
    async def start_file_watcher(self):
        """Start watching the docs directory for changes"""
        event_handler = MarkdownFileHandler(self)
        self.observer = Observer()
        self.observer.schedule(event_handler, str(self.docs_path), recursive=False)
        self.observer.start()
        logger.info(f"Started file watcher on {self.docs_path}")
        
    async def stop_file_watcher(self):
        """Stop the file watcher"""
        if self.observer:
            self.observer.stop()
            self.observer.join()
            logger.info("Stopped file watcher")