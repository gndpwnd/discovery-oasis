# main.py - FastAPI application with optional FastMCP integration
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Optional, Any, List
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from rag_manager import RAGManager
from llm_service import LLMService
from form_processor import FormProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize services (will be initialized in lifespan)
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app lifespan - startup and shutdown"""
    # Startup
    logger.info("Starting Universal Form Filler API...")
    
    # Initialize RAG manager
    await rag_manager.initialize()
    logger.info("RAG manager initialized")
    
    # Initialize LLM service
    llm_initialized = await llm_service.initialize()
    if llm_initialized:
        logger.info("LLM service initialized")
    else:
        logger.warning("LLM service failed to initialize - check Ollama connection")
    
    # Start file watcher for markdown docs
    await rag_manager.start_file_watcher()
    logger.info("File watcher started")
    
    logger.info("API startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Universal Form Filler API...")
    
    # Stop file watcher
    await rag_manager.stop_file_watcher()
    
    logger.info("API shutdown complete")


# Initialize FastAPI app with lifespan
app = FastAPI(
    title="Universal Form Filler API",
    description="AI-powered form filling service using local LLM",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Universal Form Filler API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "fill_form": "/fill-form",
            "health": "/health",
            "docs_status": "/docs-status",
            "reload_docs": "/reload-docs"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "rag_initialized": rag_manager.is_initialized,
        "llm_initialized": llm_service.is_initialized,
        "docs_count": len(rag_manager.documents),
        "ollama_model": llm_service.model
    }


@app.post("/fill-form", response_model=FormResponse)
async def fill_form(request: FormRequest):
    """
    Main endpoint to process form fields and return filled values
    """
    try:
        logger.info(f"Received form fill request for {request.url}")
        logger.info(f"Number of fields: {len(request.fields)}")
        
        if not rag_manager.is_initialized:
            raise HTTPException(
                status_code=503,
                detail="RAG manager not initialized"
            )
        
        if not llm_service.is_initialized:
            raise HTTPException(
                status_code=503,
                detail="LLM service not available - check Ollama connection"
            )
        
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
                "title": request.title,
                "model_used": llm_service.model
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
        ],
        "rag_initialized": rag_manager.is_initialized
    }


@app.get("/query-context")
async def query_context(q: str, top_k: int = 5):
    """Query user context from documents"""
    try:
        context = rag_manager.get_relevant_context(q, top_k=top_k)
        return {
            "success": True,
            "query": q,
            "context": context,
            "docs_used": len(rag_manager.documents)
        }
    except Exception as e:
        logger.error(f"Error querying context: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error querying context: {str(e)}"
        )


@app.get("/test-llm")
async def test_llm():
    """Test LLM connection and basic functionality"""
    try:
        if not llm_service.is_initialized:
            return {
                "success": False,
                "error": "LLM service not initialized"
            }
        
        # Simple test
        response = await llm_service.generate_completion(
            prompt="What is 2+2? Answer with just the number.",
            system_prompt="You are a helpful assistant. Be concise."
        )
        
        return {
            "success": True,
            "model": llm_service.model,
            "test_response": response.strip(),
            "status": "LLM is responding correctly"
        }
        
    except Exception as e:
        logger.error(f"Error testing LLM: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


# Optional FastMCP integration (commented out due to compatibility issues)
"""
To enable FastMCP integration:
1. Fix the FastMCP compatibility issue
2. Uncomment the FastMCP code below
3. Add FastMCP endpoints as needed

try:
    from fastmcp import FastMCP
    
    # Initialize FastMCP
    mcp = FastMCP("Universal Form Filler MCP")
    
    # FastMCP Resources
    @mcp.resource("doc://user-profile")
    def get_user_profile() -> str:
        return rag_manager.get_all_context()
    
    @mcp.tool()
    async def fill_form_fields(
        fields: Dict[str, str],
        url: Optional[str] = None,
        title: Optional[str] = None
    ) -> Dict[str, Any]:
        result = await form_processor.process_form(
            fields=fields,
            url=url,
            title=title
        )
        return result
    
    # Mount FastMCP
    mcp.mount(app)
    logger.info("FastMCP integration enabled")
    
except ImportError:
    logger.info("FastMCP not available - running without MCP integration")
except Exception as e:
    logger.warning(f"FastMCP integration failed: {str(e)}")
"""


if __name__ == "__main__":
    import uvicorn
    
    logger.info("Starting Universal Form Filler API server...")
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        log_level="info"
    )