# main.py - FastAPI application with FastMCP integration
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Optional, Any, List
import logging
from pathlib import Path

from fastmcp import FastMCP
from rag_manager import RAGManager
from llm_service import LLMService
from form_processor import FormProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Universal Form Filler API",
    description="AI-powered form filling service using local LLM with MCP",
    version="1.0.0"
)

# Initialize FastMCP
mcp = FastMCP("Universal Form Filler MCP", dependencies=["fastapi"])

# Configure CORS for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
rag_manager = RAGManager(docs_path="./md_docs")
llm_service = LLMService()
form_processor = FormProcessor(llm_service, rag_manager)


class FormRequest(BaseModel):
    fields: Dict[str, str]
    url: Optional[str] = None
    title: Optional[str] = None
    timestamp: Optional[str] = None


class FormResponse(BaseModel):
    fields: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None


# FastMCP Resources - Expose markdown documents as resources
@mcp.resource("doc://user-profile")
def get_user_profile() -> str:
    """Get the complete user profile from all markdown documents"""
    return rag_manager.get_all_context()


@mcp.resource("doc://documents")
def list_documents() -> List[Dict[str, Any]]:
    """List all available markdown documents"""
    return [
        {
            "filename": doc["filename"],
            "size": len(doc["content"]),
            "chunks": len(doc["chunks"]),
            "last_modified": doc.get("last_modified", "unknown")
        }
        for doc in rag_manager.documents
    ]


@mcp.resource("doc://{filename}")
def get_document(filename: str) -> str:
    """Get content of a specific markdown document"""
    for doc in rag_manager.documents:
        if doc["filename"] == filename:
            return doc["content"]
    raise ValueError(f"Document {filename} not found")


# FastMCP Tools - Expose form processing as tools
@mcp.tool()
async def fill_form_fields(
    fields: Dict[str, str],
    url: Optional[str] = None,
    title: Optional[str] = None
) -> Dict[str, Any]:
    """
    Fill form fields using user context from markdown documents.
    
    Args:
        fields: Dictionary of field names to empty values
        url: Optional URL of the form
        title: Optional title of the form
        
    Returns:
        Dictionary of field names to filled values
    """
    logger.info(f"MCP Tool: fill_form_fields called with {len(fields)} fields")
    
    result = await form_processor.process_form(
        fields=fields,
        url=url,
        title=title
    )
    
    return result


@mcp.tool()
async def get_user_info(query: str) -> str:
    """
    Query user information from markdown documents.
    
    Args:
        query: Natural language query about user information
        
    Returns:
        Relevant context from user documents
    """
    logger.info(f"MCP Tool: get_user_info called with query: {query}")
    return rag_manager.get_relevant_context(query, top_k=5)


@mcp.tool()
async def reload_user_documents() -> Dict[str, Any]:
    """
    Reload all markdown documents from the md_docs directory.
    
    Returns:
        Status of reload operation
    """
    logger.info("MCP Tool: reload_user_documents called")
    await rag_manager.reload_documents()
    
    return {
        "success": True,
        "documents_loaded": len(rag_manager.documents),
        "documents": [doc["filename"] for doc in rag_manager.documents]
    }


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting Universal Form Filler API with FastMCP...")
    
    # Initialize RAG manager
    await rag_manager.initialize()
    logger.info("RAG manager initialized")
    
    # Initialize LLM service
    await llm_service.initialize()
    logger.info("LLM service initialized")
    
    # Start file watcher for markdown docs
    await rag_manager.start_file_watcher()
    logger.info("File watcher started")
    
    logger.info("API startup complete")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down Universal Form Filler API...")
    
    # Stop file watcher
    await rag_manager.stop_file_watcher()
    
    logger.info("API shutdown complete")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Universal Form Filler API with FastMCP",
        "version": "1.0.0",
        "status": "running",
        "mcp_enabled": True
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "rag_initialized": rag_manager.is_initialized,
        "llm_initialized": llm_service.is_initialized,
        "docs_count": len(rag_manager.documents),
        "mcp_resources": len(mcp._resources),
        "mcp_tools": len(mcp._tools)
    }


@app.post("/fill-form", response_model=FormResponse)
async def fill_form(request: FormRequest):
    """
    Main endpoint to process form fields and return filled values
    """
    try:
        logger.info(f"Received form fill request for {request.url}")
        logger.info(f"Number of fields: {len(request.fields)}")
        
        # Process the form fields
        filled_fields = await form_processor.process_form(
            fields=request.fields,
            url=request.url,
            title=request.title
        )
        
        logger.info(f"Successfully filled {len(filled_fields)} fields")
        
        return FormResponse(
            fields=filled_fields,
            metadata={
                "processed_at": request.timestamp,
                "url": request.url,
                "title": request.title
            }
        )
        
    except Exception as e:
        logger.error(f"Error processing form: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing form: {str(e)}"
        )


@app.post("/reload-docs")
async def reload_docs():
    """Manually trigger reload of markdown documents"""
    try:
        await rag_manager.reload_documents()
        return {
            "success": True,
            "message": "Documents reloaded successfully",
            "docs_count": len(rag_manager.documents)
        }
    except Exception as e:
        logger.error(f"Error reloading documents: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error reloading documents: {str(e)}"
        )


@app.get("/docs-status")
async def get_docs_status():
    """Get status of loaded markdown documents"""
    return {
        "documents_loaded": len(rag_manager.documents),
        "documents": [
            {
                "filename": doc["filename"],
                "size": len(doc["content"]),
                "chunks": len(doc["chunks"]),
                "last_modified": doc.get("last_modified", "unknown")
            }
            for doc in rag_manager.documents
        ]
    }


@app.get("/mcp-info")
async def get_mcp_info():
    """Get information about available MCP resources and tools"""
    return {
        "resources": [
            {
                "uri": uri,
                "description": getattr(func, "__doc__", "No description")
            }
            for uri, func in mcp._resources.items()
        ],
        "tools": [
            {
                "name": name,
                "description": getattr(func, "__doc__", "No description")
            }
            for name, func in mcp._tools.items()
        ]
    }


# Mount FastMCP to the app
mcp.mount(app)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)